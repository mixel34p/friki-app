/**
 * Work Page Service - Datos para la página de una obra (juego/anime)
 * 
 * Funciones para obtener:
 * - Detalles de la obra
 * - Debates relacionados
 * - Tierlists que contienen la obra
 * - Usuarios que han interactuado
 * - Obras similares/recomendaciones
 */

import { supabase } from './supabase'
import { getGameById, getSimilarGames, searchGames } from './gameService'
import { getAnimeById, getSimilarAnime, searchAnime } from './animeService'

// ═══════════════════════════════════════════════════════
// GET WORK BY ID
// ═══════════════════════════════════════════════════════

/**
 * Get work details by type and ID
 * @param {'game' | 'anime'} mediaType 
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
export async function getWorkById(mediaType, id) {
    try {
        if (mediaType === 'game') {
            return await getGameById(id)
        } else if (mediaType === 'anime') {
            return await getAnimeById(id)
        }
        return null
    } catch (error) {
        console.error('getWorkById error:', error)
        return null
    }
}

// ═══════════════════════════════════════════════════════
// DEBATES FOR WORK
// ═══════════════════════════════════════════════════════

/**
 * Get debates that mention this work
 * @param {'game' | 'anime'} mediaType 
 * @param {number} mediaId 
 * @param {Object} options
 * @returns {Promise<Array>}
 */
export async function getDebatesForWork(mediaType, mediaId, { limit = 10, orderBy = 'recent' } = {}) {
    try {
        // Get debate IDs from debate_media
        const { data: debateMedia, error: mediaError } = await supabase
            .from('debate_media')
            .select('debate_id')
            .eq('media_type', mediaType)
            .eq('media_id', mediaId)

        if (mediaError) throw mediaError
        if (!debateMedia || debateMedia.length === 0) return []

        const debateIds = debateMedia.map(dm => dm.debate_id)

        // Get debates
        let query = supabase
            .from('debates')
            .select('id, title, debate_type, posts_count, created_at, user_id')
            .in('id', debateIds)
            .limit(limit)

        if (orderBy === 'recent') {
            query = query.order('created_at', { ascending: false })
        } else if (orderBy === 'popular') {
            query = query.order('posts_count', { ascending: false })
        }

        const { data: debates, error } = await query

        if (error) throw error
        if (!debates || debates.length === 0) return []

        // Get profiles
        const userIds = [...new Set(debates.map(d => d.user_id))]
        const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, color_primary, color_secondary')
            .in('user_id', userIds)

        const profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.user_id]: p }), {})

        return debates.map(d => ({
            ...d,
            profiles: profilesMap[d.user_id]
        }))
    } catch (error) {
        console.error('getDebatesForWork error:', error)
        return []
    }
}

// ═══════════════════════════════════════════════════════
// TIERLISTS WITH WORK
// ═══════════════════════════════════════════════════════

/**
 * Get tierlists that contain this work
 * @param {'game' | 'anime'} mediaType 
 * @param {number} mediaId 
 * @param {Object} options
 * @returns {Promise<Object>} { tierlists, stats }
 */
// ═══════════════════════════════════════════════════════
// TIERLISTS WITH WORK
// ═══════════════════════════════════════════════════════

/**
 * Get tierlists that contain this work
 * @param {'game' | 'anime'} mediaType 
 * @param {number} mediaId 
 * @param {Object} options
 * @returns {Promise<Object>} { tierlists, stats }
 */
export async function getTierlistsWithWork(mediaType, mediaId, { limit = 20 } = {}) {
    try {
        // Use RPC to search inside JSON content
        const { data: tierlistsData, error } = await supabase
            .rpc('get_tierlists_containing_media', {
                media_id_input: mediaId,
                media_type_input: mediaType,
                limit_count: limit
            })

        if (error) throw error
        if (!tierlistsData || tierlistsData.length === 0) {
            return { tierlists: [], stats: { totalAppearances: 0, averageTier: null } }
        }

        // Get profiles for these tierlists
        const userIds = [...new Set(tierlistsData.map(t => t.user_id))]
        const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, color_primary')
            .in('user_id', userIds)

        const profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.user_id]: p }), {})

        // Process data and calculate stats
        const tierScores = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 }
        const tiersFound = []

        const tierlists = tierlistsData.map(t => {
            // Find which tier this work is in
            let myTier = '?'
            if (t.content) {
                for (const [key, items] of Object.entries(t.content)) {
                    if (key === 'pool') continue
                    if (Array.isArray(items) && items.some(i => i.id === mediaId)) {
                        myTier = key
                        break
                    }
                }
            }
            if (tierScores[myTier]) tiersFound.push(myTier)

            return {
                ...t,
                tier: myTier,
                profiles: profilesMap[t.user_id]
            }
        })

        // Calculate average
        const averageScore = tiersFound.length > 0
            ? tiersFound.reduce((sum, t) => sum + tierScores[t], 0) / tiersFound.length
            : null

        let averageTier = null
        if (averageScore !== null) {
            if (averageScore >= 4.5) averageTier = 'S'
            else if (averageScore >= 3.5) averageTier = 'A'
            else if (averageScore >= 2.5) averageTier = 'B'
            else if (averageScore >= 1.5) averageTier = 'C'
            else averageTier = 'D'
        }

        return {
            tierlists,
            stats: {
                totalAppearances: tierlists.length, // Based on fetch limit, ideally should be count query
                averageTier,
                tierDistribution: tiersFound.reduce((acc, t) => {
                    acc[t] = (acc[t] || 0) + 1
                    return acc
                }, {})
            }
        }
    } catch (error) {
        console.error('getTierlistsWithWork error:', error)
        return { tierlists: [], stats: { totalAppearances: 0, averageTier: null } }
    }
}

// ═══════════════════════════════════════════════════════
// USERS WHO INTERACTED WITH WORK
// ═══════════════════════════════════════════════════════

/**
 * Get users who have tierliested or debated this work
 * @param {'game' | 'anime'} mediaType 
 * @param {number} mediaId 
 * @param {string} currentUserId - For affinity calculation
 * @param {Object} options
 * @returns {Promise<Array>}
 */
export async function getUsersWhoInteractedWithWork(mediaType, mediaId, currentUserId, { limit = 10 } = {}) {
    try {
        const userIds = new Set()

        // Get users from tierlists (via RPC)
        const { data: tierlists } = await supabase
            .rpc('get_tierlists_containing_media', {
                media_id_input: mediaId,
                media_type_input: mediaType,
                limit_count: limit * 2 // Fetch a bit more to filter duplicates
            })

        if (tierlists) {
            tierlists.forEach(t => {
                if (t.user_id !== currentUserId) userIds.add(t.user_id)
            })
        }

        // Get users from debates
        const { data: debateMedia, error: debateMediaError } = await supabase
            .from('debate_media')
            .select('debate_id')
            .eq('media_type', mediaType)
            .eq('media_id', mediaId)

        if (!debateMediaError && debateMedia && debateMedia.length > 0) {
            const debateIds = debateMedia.map(dm => dm.debate_id)

            // Get authors of these debates
            const { data: debateAuthors } = await supabase
                .from('debates')
                .select('user_id')
                .in('id', debateIds)

            debateAuthors?.forEach(d => {
                if (d.user_id && d.user_id !== currentUserId) {
                    userIds.add(d.user_id)
                }
            })
        }

        if (userIds.size === 0) return []

        // Get profiles for these users
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, color_primary, color_secondary')
            .in('user_id', Array.from(userIds).slice(0, limit))

        if (error) throw error
        return profiles || []
    } catch (error) {
        console.error('getUsersWhoInteractedWithWork error:', error)
        return []
    }
}

// ═══════════════════════════════════════════════════════
// SIMILAR WORKS / RECOMMENDATIONS
// ═══════════════════════════════════════════════════════

/**
 * Get similar works based on tierlists and genres
 * @param {'game' | 'anime'} mediaType 
 * @param {number} mediaId 
 * @param {Array} genres - Genres of the current work
 * @param {Object} options
 * @returns {Promise<Array>}
 */
export async function getSimilarWorks(mediaType, mediaId, genres = [], { limit = 8 } = {}) {
    try {
        // Strategy: 
        // 1. Find other works that appear in tierlists alongside this one (Community Affinity)
        // 2. Fetch official similar games/anime from external APIs (IGDB/Jikan)
        // 3. Merge results

        let tierlistBasedWorks = []

        // 1. Get similar works from tierlists
        const { data: tierlists } = await supabase
            .rpc('get_tierlists_containing_media', {
                media_id_input: mediaId,
                media_type_input: mediaType,
                limit_count: 50
            })

        if (tierlists && tierlists.length > 0) {
            // Count co-occurrences
            const workCounts = {}
            for (const list of tierlists) {
                if (!list.content) continue

                const idsInList = new Set()
                Object.values(list.content).forEach(tierItems => {
                    if (Array.isArray(tierItems)) {
                        tierItems.forEach(item => {
                            if (item.id && item.id !== mediaId) {
                                idsInList.add(item.id)
                            }
                        })
                    }
                })

                idsInList.forEach(id => {
                    workCounts[id] = (workCounts[id] || 0) + 1
                })
            }

            const sortedWorkIds = Object.entries(workCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([id]) => parseInt(id))

            if (sortedWorkIds.length > 0) {
                const table = mediaType === 'game' ? 'games' : 'anime'
                const nameColumn = mediaType === 'game' ? 'name' : 'title'
                const imageColumn = mediaType === 'game' ? 'cover_url' : 'image_url'

                const { data: works } = await supabase
                    .from(table)
                    .select(`id, ${nameColumn}, ${imageColumn}, genres`)
                    .in('id', sortedWorkIds)

                const maxCount = Math.max(...Object.values(workCounts))
                tierlistBasedWorks = (works || []).map(work => ({
                    id: work.id,
                    name: work[nameColumn],
                    cover_url: work[imageColumn],
                    genres: work.genres || [],
                    media_type: mediaType,
                    affinity: Math.round((workCounts[work.id] / maxCount) * 100),
                    source: 'community'
                }))
            }
        }

        // 2. If we need more results, fetch from APIs
        if (tierlistBasedWorks.length < limit) {
            let apiRecs = []
            let nameBasedRecs = []

            // source 1: Recommendations API (IGDB similar_games / Mal recommendations)
            if (mediaType === 'game') {
                apiRecs = await getSimilarGames(mediaId, limit)
            } else {
                apiRecs = await getSimilarAnime(mediaId, limit)
            }

            // source 2: Name similarity (if we still have quota)
            // We need to fetch the name first if we don't have it (we usually don't inside this func)
            // However, this adds a fetch latency. Let's do it only if needed or parallel.
            // But we don't have the name argument.
            if (apiRecs.length + tierlistBasedWorks.length < limit) {
                try {
                    const work = await (mediaType === 'game' ? getGameById(mediaId) : getAnimeById(mediaId))
                    if (work) {
                        const nameToSearch = mediaType === 'game' ? work.name : work.title
                        if (nameToSearch) {
                            // Extract meaningful part? "Super Mario Bros" -> "Super Mario" ? 
                            // For now basic search.
                            const searchResults = mediaType === 'game'
                                ? await searchGames(nameToSearch, 10)
                                : await searchAnime(nameToSearch, 10)

                            nameBasedRecs = searchResults.map(r => ({ ...r, source: 'name_similarity', affinity: null }))
                        }
                    }
                } catch (e) {
                    console.error('Name search error:', e)
                }
            }

            // Filter out duplicates (already in tierlistBasedWorks)
            const existingIds = new Set(tierlistBasedWorks.map(w => w.id))

            // Process API Recs
            const validApiRecs = apiRecs.filter(r => !existingIds.has(r.id)).map(r => ({
                ...r,
                affinity: null,
                source: 'official'
            }))

            // Add valid API recs to existing set
            validApiRecs.forEach(r => existingIds.add(r.id));
            // Also exclude current work ID
            existingIds.add(parseInt(mediaId))

            // Process Name Recs
            const validNameRecs = nameBasedRecs.filter(r => !existingIds.has(r.id))

            // Combine: Tierlist -> Official -> Name
            return [...tierlistBasedWorks, ...validApiRecs, ...validNameRecs].slice(0, limit)
        }

        return tierlistBasedWorks
    } catch (error) {
        console.error('getSimilarWorks error:', error)
        return []
    }
}

/**
 * Fallback: Get similar works by genre
 */
async function getSimilarByGenre(mediaType, excludeId, genres, limit) {
    if (!genres || genres.length === 0) return []

    try {
        const table = mediaType === 'game' ? 'games' : 'anime'
        const nameColumn = mediaType === 'game' ? 'name' : 'title'
        const imageColumn = mediaType === 'game' ? 'cover_url' : 'image_url'

        const { data } = await supabase
            .from(table)
            .select(`id, ${nameColumn}, ${imageColumn}, genres`)
            .neq('id', excludeId)
            .overlaps('genres', genres)
            .limit(limit)

        return (data || []).map(work => ({
            id: work.id,
            name: work[nameColumn],
            cover_url: work[imageColumn],
            genres: work.genres || [],
            media_type: mediaType,
            affinity: null
        }))
    } catch (error) {
        console.error('getSimilarByGenre error:', error)
        return []
    }
}

// ═══════════════════════════════════════════════════════
// WORK STATS
// ═══════════════════════════════════════════════════════

/**
 * @returns {Promise<Object>}
 */
export async function getWorkStats(mediaType, mediaId) {
    try {
        // Get debates count
        const { count: debatesCount } = await supabase
            .from('debate_media')
            .select('*', { count: 'exact', head: true })
            .eq('media_type', mediaType)
            .eq('media_id', mediaId)

        return {
            debatesCount: debatesCount || 0
        }
    } catch (error) {
        console.error('getWorkStats error:', error)
        return { debatesCount: 0 }
    }
}

/**
 * Get trending/featured works for Landing page
 * Uses simple heuristic: recently added or static selection for now
 */
export async function getTrendingWorks(mediaType, limit = 6) {
    try {
        const table = mediaType === 'game' ? 'games' : 'anime'

        // 1. Get a batch of candidates
        // Ideally we'd have a 'popularity' column.
        // Strategy: 
        // A) Try to find works that are in reviews or tierlists first (if possible efficient query)
        // B) Simply fetch a larger batch of random/recent works and sort them by engagement.

        let candidateIds = new Set()

        // Get some IDs from recent reviews to ensure we have content-rich items
        const { data: reviewedWorks } = await supabase
            .from('reviews')
            .select('work_id')
            .eq('work_type', mediaType)
            .limit(10)
            .order('created_at', { ascending: false })

        reviewedWorks?.forEach(r => candidateIds.add(r.work_id))

        // Get some general works (padding)
        const { data: generalWorks } = await supabase
            .from(table)
            .select('id')
            .limit(20) // Fetch strictly more candidates to filter/sort

        generalWorks?.forEach(w => candidateIds.add(w.id))

        const finalIds = Array.from(candidateIds).slice(0, 20) // Cap analysis size

        // 2. Fetch details for these candidates
        const { data: works } = await supabase
            .from(table)
            .select(`id, ${mediaType === 'game' ? 'name' : 'title'}, ${mediaType === 'game' ? 'cover_url' : 'image_url'}, ${mediaType === 'game' ? 'release_date' : 'start_date'}`)
            .in('id', finalIds)

        if (!works) return []

        // 3. Compute Real Stats for each candidate
        // Parallelizing requests (be careful with rate limits, but for 20 it's fine)
        const worksWithStats = await Promise.all(works.map(async (work) => {
            // A. Rating from Reviews
            const { data: reviews } = await supabase
                .from('reviews')
                .select('rating')
                .eq('work_id', work.id)
                .eq('work_type', mediaType)

            let avgRating = 0
            if (reviews && reviews.length > 0) {
                const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
                avgRating = (sum / reviews.length).toFixed(1)
            } else {
                avgRating = '-' // No rating yet
            }

            // B. Tierlist Count
            // We use the existing RPC logic or just count via existing helper
            let tierlistsCount = 0
            try {
                const { count, error } = await supabase
                    .rpc('get_tierlists_containing_media', {
                        media_id_input: work.id,
                        media_type_input: mediaType,
                        limit_count: 100
                    }, { count: 'exact', head: true })

                // If RPC returns rows, we can count them. 
                // However, standard RPC returning table might not support head:true easily without wrapping.
                // Let's use the helper function we already have, modified to be lighter if needed
                // actually 'get_tierlists_containing_media' returns a set of rows.
                // We'll just call the function normally (limit 100) and count length.
                if (!error && count !== null) {
                    tierlistsCount = count
                } else {
                    // Fallback: call it without count options if RPC doesn't support it
                    const { data: tLists } = await supabase.rpc('get_tierlists_containing_media', {
                        media_id_input: work.id,
                        media_type_input: mediaType,
                        limit_count: 50
                    })
                    tierlistsCount = tLists ? tLists.length : 0
                }
            } catch (ignored) { }

            return {
                id: work.id,
                title: mediaType === 'game' ? work.name : work.title,
                image: mediaType === 'game' ? work.cover_url : work.image_url,
                year: (mediaType === 'game' ? work.release_date : work.start_date) ? new Date(mediaType === 'game' ? work.release_date : work.start_date).getFullYear() : null,
                media_type: mediaType,
                rating: avgRating,
                tierlists: tierlistsCount,
                // Sort Score: Weighted mix of activity
                sortScore: (parseFloat(avgRating) || 0) * 2 + (tierlistsCount * 5)
            }
        }))

        // 4. Sort by engagement (tierlists count first, then rating)
        // User said: "Prioriza juegos que si salen en tierlist"
        const sortedWorks = worksWithStats.sort((a, b) => b.sortScore - a.sortScore)

        return sortedWorks.slice(0, limit)

    } catch (err) {
        console.error('getTrendingWorks error:', err)
        return []
    }
}
