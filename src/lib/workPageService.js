/**
 * Work Page Service - Datos para la página de una obra (juego/anime)
 * 
 * Funciones para obtener:
 * - Detalles de la obra
 * - Tierlists que contienen la obra
 * - Usuarios que han interactuado
 * - Obras similares/recomendaciones
 */

import { supabase } from './supabase'
import { getGameById, getSimilarGames } from './gameService'
import { getAnimeById, getSimilarAnime } from './animeService'

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
 * Get users who have tierlisted this work
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
        const results = []
        const seenIds = new Set([parseInt(mediaId)])

        // ── STEP 1: Official API recommendations (most accurate source) ──────
        // IGDB similar_games / AniList recommendations are curated by the platform
        // itself and are far more reliable than co-occurrence in user tierlists.
        let apiRecs = []
        if (mediaType === 'game') {
            apiRecs = await getSimilarGames(mediaId, limit)
        } else {
            apiRecs = await getSimilarAnime(mediaId, limit)
        }

        for (const rec of apiRecs) {
            if (!seenIds.has(rec.id)) {
                seenIds.add(rec.id)
                results.push({ ...rec, source: 'official' })
            }
        }

        // ── STEP 2: Genre fallback (sorted by rating, only if we need more) ──
        // Only kick in when the API didn't give us enough results.
        // We order by rating DESC so the best works of the same genre appear first,
        // avoiding random/obscure results.
        if (results.length < limit && genres && genres.length > 0) {
            const needed = limit - results.length
            const genreRecs = await getSimilarByGenre(mediaType, mediaId, genres, needed * 3, seenIds)
            for (const rec of genreRecs) {
                if (results.length >= limit) break
                if (!seenIds.has(rec.id)) {
                    seenIds.add(rec.id)
                    results.push({ ...rec, source: 'genre' })
                }
            }
        }

        // ── STEP 3: Community tierlists co-occurrence (last resort) ──────────
        // Tierlists group *any* works together (a user might put Dragon Ball and
        // Tetris in the same list), so this signal is very noisy. We only use it
        // as an absolute last resort when both better sources failed.
        if (results.length < limit) {
            const needed = limit - results.length
            const communityRecs = await getSimilarFromTierlists(mediaType, mediaId, needed * 2, seenIds)
            for (const rec of communityRecs) {
                if (results.length >= limit) break
                if (!seenIds.has(rec.id)) {
                    seenIds.add(rec.id)
                    results.push({ ...rec, source: 'community' })
                }
            }
        }

        return results.slice(0, limit)
    } catch (error) {
        console.error('getSimilarWorks error:', error)
        return []
    }
}

/**
 * Fallback: Get similar works by genre
 */
async function getSimilarByGenre(mediaType, excludeId, genres, limit, seenIds = new Set()) {
    if (!genres || genres.length === 0) return []

    try {
        const table = mediaType === 'game' ? 'games' : 'anime'
        const nameColumn = mediaType === 'game' ? 'name' : 'title'
        const imageColumn = mediaType === 'game' ? 'cover_url' : 'image_url'

        // Order by rating DESC so the best works of the genre appear first
        const { data } = await supabase
            .from(table)
            .select(`id, ${nameColumn}, ${imageColumn}, genres, rating`)
            .neq('id', excludeId)
            .overlaps('genres', genres)
            .not('rating', 'is', null)
            .order('rating', { ascending: false })
            .limit(limit)

        return (data || [])
            .filter(work => !seenIds.has(work.id))
            .map(work => ({
                id: work.id,
                name: work[nameColumn],
                title: work[nameColumn],
                cover_url: work[imageColumn],
                image_url: work[imageColumn],
                genres: work.genres || [],
                rating: work.rating,
                media_type: mediaType,
            }))
    } catch (error) {
        console.error('getSimilarByGenre error:', error)
        return []
    }
}

/**
 * Last-resort fallback: works that appear in the same tierlists.
 * Very noisy (any works can share a tierlist), so only use when API + genre fail.
 */
async function getSimilarFromTierlists(mediaType, mediaId, limit, seenIds = new Set()) {
    try {
        const { data: tierlists } = await supabase
            .rpc('get_tierlists_containing_media', {
                media_id_input: mediaId,
                media_type_input: mediaType,
                limit_count: 30
            })

        if (!tierlists || tierlists.length === 0) return []

        // Count co-occurrences (works that appear most frequently across lists)
        const workCounts = {}
        for (const list of tierlists) {
            if (!list.content) continue
            const idsInList = new Set()
            Object.values(list.content).forEach(tierItems => {
                if (Array.isArray(tierItems)) {
                    tierItems.forEach(item => {
                        if (item.id && !seenIds.has(item.id) && item.id !== mediaId) {
                            idsInList.add(item.id)
                        }
                    })
                }
            })
            idsInList.forEach(id => {
                workCounts[id] = (workCounts[id] || 0) + 1
            })
        }

        const sortedIds = Object.entries(workCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id]) => parseInt(id))

        if (sortedIds.length === 0) return []

        const table = mediaType === 'game' ? 'games' : 'anime'
        const nameColumn = mediaType === 'game' ? 'name' : 'title'
        const imageColumn = mediaType === 'game' ? 'cover_url' : 'image_url'

        const { data: works } = await supabase
            .from(table)
            .select(`id, ${nameColumn}, ${imageColumn}, genres, rating`)
            .in('id', sortedIds)

        const maxCount = Math.max(...Object.values(workCounts), 1)
        return (works || []).map(work => ({
            id: work.id,
            name: work[nameColumn],
            title: work[nameColumn],
            cover_url: work[imageColumn],
            image_url: work[imageColumn],
            genres: work.genres || [],
            rating: work.rating,
            media_type: mediaType,
            affinity: Math.round((workCounts[work.id] / maxCount) * 100),
        }))
    } catch (error) {
        console.error('getSimilarFromTierlists error:', error)
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
        // Get members, average rating
        const { data: entries, error: entriesError } = await supabase
            .from('library_entries')
            .select('user_id, rating, created_at')
            .eq('work_type', mediaType)
            .eq('work_id', String(mediaId))
            
        let membersCount = 0
        let ratingsCount = 0
        let avgRating = 0
        let recentMembers = []
        
        if (entries && entries.length > 0) {
            membersCount = entries.length
            const ratings = entries.filter(e => e.rating != null).map(e => e.rating)
            ratingsCount = ratings.length
            if (ratings.length > 0) {
                const sum = ratings.reduce((acc, curr) => acc + curr, 0)
                avgRating = sum / ratings.length
            }
            
            // Sort by created_at desc
            const sortedEntries = [...entries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            
            // Extract up to 5 unique user_ids
            const recentUserIds = []
            for (const entry of sortedEntries) {
                if (entry.user_id && !recentUserIds.includes(entry.user_id)) {
                    recentUserIds.push(entry.user_id)
                    if (recentUserIds.length >= 5) break
                }
            }
            
            // Fetch profiles for these users
            if (recentUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', recentUserIds)
                    
                if (profiles) {
                    // Map back to recentMembers maintaining sort order
                    for (const uid of recentUserIds) {
                        const profile = profiles.find(p => p.id === uid)
                        if (profile) {
                            recentMembers.push({
                                username: profile.username || 'Usuario',
                                avatar: profile.avatar_url
                            })
                        }
                    }
                }
            }
        }

        return {
            membersCount: membersCount,
            ratingsCount,
            avgRating: avgRating > 0 ? avgRating.toFixed(1) : 0,
            recentMembers
        }
    } catch (error) {
        console.error('getWorkStats error:', error)
        return { membersCount: 0, ratingsCount: 0, avgRating: 0, recentMembers: [] }
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
