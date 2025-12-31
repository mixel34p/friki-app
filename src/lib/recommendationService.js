import { supabase } from './supabase'
import { calculateAffinityClient } from './socialDiscoveryService'

// ═══════════════════════════════════════════════════════
// RECOMMENDATION SERVICE
// Sistema de recomendaciones basado en gustos del usuario
// ═══════════════════════════════════════════════════════

/**
 * Get personalized recommendations for a user
 * @param {string} userId - Current user ID
 * @param {object} userProfile - User profile with library, tierlists, reviews, tags
 * @param {string} mediaType - 'game' or 'anime'
 * @param {object} options - { limit, minScore, excludeGenres }
 */
export async function getRecommendations(userId, userProfile, mediaType = 'all', options = {}) {
    const { limit = 40, minScore = 20 } = options // Increased limit, lowered minScore

    try {
        // 1. Get user's existing works (to exclude)
        const excludedWorkIds = await getExcludedWorks(userId, userProfile, mediaType)

        // 2. Find affine users (similarity >= 30%)
        const affineUsers = await findAffineUsers(userId, userProfile)

        // 3. Collect candidate works from affine users
        const candidates = await collectCandidateWorks(affineUsers, mediaType, excludedWorkIds)

        // 4. NEW: Collect works with similar names to user's favorites
        const similarNameCandidates = await collectSimilarNameWorks(userId, userProfile, mediaType, excludedWorkIds)

        // 4.2. SOCIAL: Collect works from followed users
        const socialCandidates = await collectFollowedUsersWorks(userId, userProfile, mediaType, excludedWorkIds)

        // Merge candidates
        let allCandidates = mergeCandidates(candidates, similarNameCandidates)
        // Merge social candidates
        allCandidates = mergeCandidates(allCandidates, socialCandidates)

        // 4.5. FALLBACK: If we have few candidates (< 10), get popular items from DB based on genres
        if (allCandidates.length < 10) {
            const fallbackCandidates = await collectFallbackWorks(userId, userProfile, mediaType, excludedWorkIds, 20 - allCandidates.length)
            allCandidates = [...allCandidates, ...fallbackCandidates]
        }

        // 5. Get user's tag preferences
        const userTagPreferences = extractTagPreferences(userProfile, mediaType)

        // 6. Score each candidate
        const scoredCandidates = allCandidates.map(work => {
            const score = calculateWorkScore(work, userProfile, userTagPreferences, affineUsers)
            return {
                ...work,
                score,
                reasons: generateReasons(work, userProfile, userTagPreferences)
            }
        })

        // 7. Sort by score and return top N
        const recommendations = scoredCandidates
            .filter(w => w.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)

        return recommendations
    } catch (error) {
        console.error('Error getting recommendations:', error)
        return []
    }
}

/**
 * Get all work IDs that user already knows (library + tierlists + reviews)
 */
async function getExcludedWorks(userId, userProfile, mediaType) {
    const excluded = new Set()

    // From library
    if (mediaType === 'game' || mediaType === 'all') {
        const gameLibrary = userProfile.library || []
        gameLibrary.forEach(item => {
            if (item.game_id) excluded.add(`game_${item.game_id}`)
            if (item.id) excluded.add(`game_${item.id}`)
        })
    }

    if (mediaType === 'anime' || mediaType === 'all') {
        const animeLibrary = userProfile.anime_library || []
        animeLibrary.forEach(item => {
            if (item.mal_id) excluded.add(`anime_${item.mal_id}`)
            if (item.id) excluded.add(`anime_${item.id}`)
        })
    }

    // From tierlists
    const { data: userTierlists } = await supabase
        .from('tierlists')
        .select('id, media_type')
        .eq('user_id', userId)

    if (userTierlists && userTierlists.length > 0) {
        const tierlistIds = userTierlists.map(t => t.id)
        const { data: items } = await supabase
            .from('tierlist_items')
            .select('media_id, tierlist_id')
            .in('tierlist_id', tierlistIds)

        items?.forEach(item => {
            const tierlist = userTierlists.find(t => t.id === item.tierlist_id)
            if (item.media_id && tierlist) {
                excluded.add(`${tierlist.media_type}_${item.media_id}`)
            }
        })
    }

    // From reviews
    const { data: userReviews } = await supabase
        .from('reviews')
        .select('work_id, work_type')
        .eq('user_id', userId)

    userReviews?.forEach(review => {
        excluded.add(`${review.work_type}_${review.work_id}`)
    })

    return excluded
}

/**
 * Find users with moderate affinity (>= 30%) to get more recommendations
 */
async function findAffineUsers(userId, userProfile) {
    const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', userId)
        .limit(150) // Increased limit

    if (!allProfiles) return []

    const affineUsers = allProfiles
        .map(profile => {
            const { score } = calculateAffinityClient(userProfile, profile)
            return { ...profile, affinity: score }
        })
        .filter(u => u.affinity >= 10) // Lowered threshold to 10% to get more potential sources
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 50) // Increased limit

    return affineUsers
}

/**
 * Collect candidate works from affine users' tierlists, reviews, and libraries
 */
async function collectCandidateWorks(affineUsers, mediaType, excludedWorkIds) {
    if (affineUsers.length === 0) return []

    const candidates = new Map() // work_key -> { workData, sources: [...] }
    const affineUserIds = affineUsers.map(u => u.user_id)

    // 1. From tierlists (ALL tiers now, not just S/A/B)
    const { data: affineTierlists } = await supabase
        .from('tierlists')
        .select('id, user_id, media_type, title')
        .in('user_id', affineUserIds)
        .eq('visibility', 'public')

    if (affineTierlists && affineTierlists.length > 0) {
        const tierlistIds = affineTierlists.map(t => t.id)
        const { data: tierlistItems } = await supabase
            .from('tierlist_items')
            .select('*')
            .in('tierlist_id', tierlistIds)
        // Removed tier filter to include all items

        tierlistItems?.forEach(item => {
            const tierlist = affineTierlists.find(t => t.id === item.tierlist_id)
            if (!tierlist) return

            const workKey = `${tierlist.media_type}_${item.media_id}`

            // Skip if excluded or wrong media type
            if (excludedWorkIds.has(workKey)) return
            if (mediaType !== 'all' && tierlist.media_type !== mediaType) return

            if (!candidates.has(workKey)) {
                candidates.set(workKey, {
                    work_id: item.media_id,
                    media_type: tierlist.media_type,
                    tags: item.tags || [],
                    sources: []
                })
            }

            const affineUser = affineUsers.find(u => u.user_id === tierlist.user_id)
            candidates.get(workKey).sources.push({
                type: 'tierlist',
                tier: item.tier,
                userId: tierlist.user_id,
                affinity: affineUser?.affinity || 0,
                tags: item.tags || []
            })
        })
    }

    // 2. From reviews (rating >= 3, lowered from 4)
    const { data: affineReviews } = await supabase
        .from('reviews')
        .select('work_id, work_type, rating, user_id')
        .in('user_id', affineUserIds)
        .gte('rating', 3) // Lowered from 4 to 3

    affineReviews?.forEach(review => {
        const workKey = `${review.work_type}_${review.work_id}`

        // Skip if excluded or wrong media type
        if (excludedWorkIds.has(workKey)) return
        if (mediaType !== 'all' && review.work_type !== mediaType) return

        if (!candidates.has(workKey)) {
            candidates.set(workKey, {
                work_id: review.work_id,
                media_type: review.work_type,
                tags: [],
                sources: []
            })
        }

        const affineUser = affineUsers.find(u => u.user_id === review.user_id)
        candidates.get(workKey).sources.push({
            type: 'review',
            rating: review.rating,
            userId: review.user_id,
            affinity: affineUser?.affinity || 0
        })
    })

    // 3. NEW: From libraries (completed and playing status)
    affineUsers.forEach(affineUser => {
        // Game library
        if (mediaType === 'game' || mediaType === 'all') {
            const gameLibrary = affineUser.library || []
            gameLibrary
                .filter(item => ['completed', 'playing'].includes(item.status))
                .forEach(item => {
                    const gameId = item.game_id || item.id
                    if (!gameId) return

                    const workKey = `game_${gameId}`
                    if (excludedWorkIds.has(workKey)) return

                    if (!candidates.has(workKey)) {
                        candidates.set(workKey, {
                            work_id: gameId,
                            media_type: 'game',
                            tags: [],
                            sources: []
                        })
                    }

                    candidates.get(workKey).sources.push({
                        type: 'library',
                        status: item.status,
                        rating: item.rating,
                        userId: affineUser.user_id,
                        affinity: affineUser.affinity || 0
                    })
                })
        }

        // Anime library
        if (mediaType === 'anime' || mediaType === 'all') {
            const animeLibrary = affineUser.anime_library || []
            animeLibrary
                .filter(item => ['completed', 'watching'].includes(item.status))
                .forEach(item => {
                    const animeId = item.mal_id || item.id
                    if (!animeId) return

                    const workKey = `anime_${animeId}`
                    if (excludedWorkIds.has(workKey)) return

                    if (!candidates.has(workKey)) {
                        candidates.set(workKey, {
                            work_id: animeId,
                            media_type: 'anime',
                            tags: [],
                            sources: []
                        })
                    }

                    candidates.get(workKey).sources.push({
                        type: 'library',
                        status: item.status,
                        rating: item.rating,
                        userId: affineUser.user_id,
                        affinity: affineUser.affinity || 0
                    })
                })
        }
    })

    return Array.from(candidates.values())
}



/**
 * Collect works from users that the current user follows
 */
async function collectFollowedUsersWorks(userId, userProfile, mediaType, excludedWorkIds) {
    const candidates = new Map()

    // 1. Get followed users
    const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)

    if (!follows || follows.length === 0) return []

    const followingIds = follows.map(f => f.following_id)

    // 2. Get profiles of followed users to have their info (avatar, name)
    const { data: followedProfiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, library, anime_library')
        .in('user_id', followingIds)

    if (!followedProfiles) return []

    // 3. Collect from libraries
    followedProfiles.forEach(followedUser => {
        // Game library
        if (mediaType === 'game' || mediaType === 'all') {
            const gameLibrary = followedUser.library || []
            gameLibrary
                .filter(item => ['completed', 'playing'].includes(item.status)) // Only good status
                .forEach(item => {
                    const gameId = item.game_id || item.id
                    if (!gameId) return
                    const workKey = `game_${gameId}`
                    if (excludedWorkIds.has(workKey)) return

                    if (!candidates.has(workKey)) {
                        candidates.set(workKey, {
                            work_id: gameId,
                            media_type: 'game',
                            title: item.name || item.title,
                            image_url: item.cover_url || item.image_url,
                            tags: [],
                            sources: []
                        })
                    }

                    candidates.get(workKey).sources.push({
                        type: 'following',
                        userId: followedUser.user_id,
                        username: followedUser.username,
                        avatar_url: followedUser.avatar_url,
                        rating: item.rating,
                        status: item.status
                    })
                })
        }

        // Anime library
        if (mediaType === 'anime' || mediaType === 'all') {
            const animeLibrary = followedUser.anime_library || []
            animeLibrary
                .filter(item => ['completed', 'playing'].includes(item.status)) // 'playing' is used for 'watching' too
                .forEach(item => {
                    const animeId = item.mal_id || item.id
                    if (!animeId) return
                    const workKey = `anime_${animeId}`
                    if (excludedWorkIds.has(workKey)) return

                    if (!candidates.has(workKey)) {
                        candidates.set(workKey, {
                            work_id: animeId,
                            media_type: 'anime',
                            title: item.title || item.name,
                            image_url: item.image_url || item.cover_url,
                            tags: [],
                            sources: []
                        })
                    }

                    candidates.get(workKey).sources.push({
                        type: 'following',
                        userId: followedUser.user_id,
                        username: followedUser.username,
                        avatar_url: followedUser.avatar_url,
                        rating: item.rating,
                        status: item.status
                    })
                })
        }
    })

    return Array.from(candidates.values())
}

/**
 * Collect fallback works from DB based on user genres (when social discovery fails)
 */
async function collectFallbackWorks(userId, userProfile, mediaType, excludedWorkIds, limit = 10) {
    const candidates = []
    const genres = userProfile.favorite_genres || []

    // If no genres, use generic popular ones or random
    const searchGenres = genres.length > 0 ? genres : ['Action', 'Adventure', 'RPG']

    // 1. Games fallback
    if (mediaType === 'game' || mediaType === 'all') {
        let query = supabase
            .from('games')
            .select('*')
            .order('rating', { ascending: false, nullsFirst: false }) // High rated first
            .limit(30)

        if (genres.length > 0) {
            // This is a simple approximation since genres is JSONB or array, dependent on DB structure.
            // Assuming array column or text search for now. 
            // If genres is text[], .contains works. If JSONB, different syntax.
            // Using a broader fetch and filter due to heterogeneous schema possibilities
        }

        const { data: games } = await query

        if (games) {
            let count = 0
            for (const game of games) {
                if (count >= limit) break
                const workKey = `game_${game.id}`
                if (excludedWorkIds.has(workKey)) continue

                // Simple verify if it matches any genre (if we have genre data)
                const matchesGenre = genres.length === 0 || (game.genres && game.genres.some(g => genres.includes(g)))

                if (matchesGenre) {
                    candidates.push({
                        work_id: game.id,
                        media_type: 'game',
                        title: game.name,
                        image_url: game.cover_url,
                        tags: game.genres || [],
                        sources: [{ type: 'fallback', reason: 'popular_genre' }]
                    })
                    count++
                }
            }
        }
    }

    // 2. Anime fallback
    if (mediaType === 'anime' || mediaType === 'all') {
        let query = supabase
            .from('anime')
            .select('*')
            .order('score', { ascending: false, nullsFirst: false })
            .limit(30)

        const { data: anime } = await query

        if (anime) {
            let count = 0
            for (const a of anime) {
                if (count >= limit) break
                const workKey = `anime_${a.id}`
                if (excludedWorkIds.has(workKey)) continue

                // Check genre match
                const matchesGenre = genres.length === 0 || (a.genres && a.genres.some(g => genres.includes(g)))

                if (matchesGenre) {
                    candidates.push({
                        work_id: a.id,
                        media_type: 'anime',
                        title: a.title,
                        image_url: a.image_url,
                        tags: a.genres || [],
                        sources: [{ type: 'fallback', reason: 'popular_genre' }]
                    })
                    count++
                }
            }
        }
    }

    return candidates
}

/**
 * Collect works with similar names to user's highly-rated works
 */
async function collectSimilarNameWorks(userId, userProfile, mediaType, excludedWorkIds) {
    const candidates = new Map()

    // Get user's highly-rated works
    const favoriteWorks = await getUserFavoriteWorks(userId, userProfile, mediaType)

    if (favoriteWorks.length === 0) return []

    // For each favorite, search for similar names
    for (const favorite of favoriteWorks) {
        // Extract keywords from the title (remove common words)
        const keywords = extractKeywords(favorite.title)

        if (keywords.length === 0) continue

        // Search in database based on media type
        if (favorite.media_type === 'game' && (mediaType === 'game' || mediaType === 'all')) {
            const { data: games } = await supabase
                .from('games')
                .select('id, name, cover_url')
                .or(keywords.map(kw => `name.ilike.%${kw}%`).join(','))
                .limit(10)

            games?.forEach(game => {
                const workKey = `game_${game.id}`
                if (excludedWorkIds.has(workKey)) return

                // Check if name is actually similar (not just keyword match)
                const similarity = calculateNameSimilarity(favorite.title, game.name)
                if (similarity < 0.3) return // At least 30% similarity

                if (!candidates.has(workKey)) {
                    candidates.set(workKey, {
                        work_id: game.id,
                        media_type: 'game',
                        tags: [],
                        sources: []
                    })
                }

                candidates.get(workKey).sources.push({
                    type: 'similar_name',
                    similar_to: favorite.title,
                    similarity: similarity,
                    reason: favorite.reason // 'high_rating' or 'top_tier'
                })
            })
        }

        if (favorite.media_type === 'anime' && (mediaType === 'anime' || mediaType === 'all')) {
            const { data: anime } = await supabase
                .from('anime')
                .select('mal_id, title, image_url')
                .or(keywords.map(kw => `title.ilike.%${kw}%`).join(','))
                .limit(10)

            anime?.forEach(a => {
                const workKey = `anime_${a.mal_id}`
                if (excludedWorkIds.has(workKey)) return

                const similarity = calculateNameSimilarity(favorite.title, a.title)
                if (similarity < 0.3) return

                if (!candidates.has(workKey)) {
                    candidates.set(workKey, {
                        work_id: a.mal_id,
                        media_type: 'anime',
                        tags: [],
                        sources: []
                    })
                }

                candidates.get(workKey).sources.push({
                    type: 'similar_name',
                    similar_to: favorite.title,
                    similarity: similarity,
                    reason: favorite.reason
                })
            })
        }
    }

    return Array.from(candidates.values())
}

/**
 * Get user's favorite works (highly rated or top tier)
 */
async function getUserFavoriteWorks(userId, userProfile, mediaType) {
    const favorites = []

    // From reviews (rating >= 4)
    const { data: reviews } = await supabase
        .from('reviews')
        .select('work_id, work_type, rating, title')
        .eq('user_id', userId)
        .gte('rating', 4)

    reviews?.forEach(review => {
        if (mediaType === 'all' || review.work_type === mediaType) {
            if (review.title) { // Only if we have the title
                favorites.push({
                    title: review.title,
                    media_type: review.work_type,
                    reason: 'high_rating'
                })
            }
        }
    })

    // From tierlists (S, A, Top tiers)
    const { data: userTierlists } = await supabase
        .from('tierlists')
        .select('id, media_type')
        .eq('user_id', userId)

    if (userTierlists && userTierlists.length > 0) {
        const tierlistIds = userTierlists.map(t => t.id)
        const { data: topItems } = await supabase
            .from('tierlist_items')
            .select('media_id, tier, tierlist_id')
            .in('tierlist_id', tierlistIds)
            .in('tier', ['S', 'A', 'Top', 'God Tier', '#1', '#2'])

        if (topItems && topItems.length > 0) {
            // Get names from games/anime tables
            const gameIds = []
            const animeIds = []

            topItems.forEach(item => {
                const tierlist = userTierlists.find(t => t.id === item.tierlist_id)
                if (!tierlist) return

                if (tierlist.media_type === 'game' && (mediaType === 'game' || mediaType === 'all')) {
                    gameIds.push(item.media_id)
                } else if (tierlist.media_type === 'anime' && (mediaType === 'anime' || mediaType === 'all')) {
                    animeIds.push(item.media_id)
                }
            })

            // Fetch game names
            if (gameIds.length > 0) {
                const { data: games } = await supabase
                    .from('games')
                    .select('id, name')
                    .in('id', gameIds)

                games?.forEach(game => {
                    favorites.push({
                        title: game.name,
                        media_type: 'game',
                        reason: 'top_tier'
                    })
                })
            }

            // Fetch anime names
            if (animeIds.length > 0) {
                const { data: anime } = await supabase
                    .from('anime')
                    .select('mal_id, title')
                    .in('mal_id', animeIds)

                anime?.forEach(a => {
                    favorites.push({
                        title: a.title,
                        media_type: 'anime',
                        reason: 'top_tier'
                    })
                })
            }
        }
    }

    return favorites
}

/**
 * Extract meaningful keywords from a title
 */
function extractKeywords(title) {
    if (!title) return []

    // Common words to ignore
    const stopWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'en']

    // Split and clean
    const words = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ') // Remove special chars
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))

    // Return unique words, max 3
    return [...new Set(words)].slice(0, 3)
}

/**
 * Calculate similarity between two titles (simple Jaccard similarity)
 */
function calculateNameSimilarity(title1, title2) {
    const words1 = new Set(extractKeywords(title1))
    const words2 = new Set(extractKeywords(title2))

    if (words1.size === 0 || words2.size === 0) return 0

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
}

/**
 * Merge candidates from different sources
 */
function mergeCandidates(affineCandidates, similarNameCandidates) {
    const merged = new Map()

    // Add affine candidates
    affineCandidates.forEach(candidate => {
        const key = `${candidate.media_type}_${candidate.work_id}`
        merged.set(key, candidate)
    })

    // Merge similar name candidates
    similarNameCandidates.forEach(candidate => {
        const key = `${candidate.media_type}_${candidate.work_id}`

        if (merged.has(key)) {
            // Combine sources
            const existing = merged.get(key)
            existing.sources = [...existing.sources, ...candidate.sources]
        } else {
            merged.set(key, candidate)
        }
    })

    return Array.from(merged.values())
}

/**
 * Extract user's tag preferences from their tierlists and library
 */
function extractTagPreferences(userProfile, mediaType) {
    const tagCounts = {}

    // From favorite_genres
    const genres = userProfile.favorite_genres || []
    genres.forEach(g => {
        tagCounts[g] = (tagCounts[g] || 0) + 5 // High weight for explicit favorites
    })

    // From anime_tags
    if (mediaType === 'anime' || mediaType === 'all') {
        const animeTags = userProfile.anime_tags || []
        animeTags.forEach(t => {
            tagCounts[t] = (tagCounts[t] || 0) + 5
        })
    }

    // Could also analyze tags from user's own tierlists if needed

    return tagCounts
}

/**
 * Calculate recommendation score for a work
 */
function calculateWorkScore(work, userProfile, userTagPreferences, affineUsers) {
    let score = 0

    // Check if this has similar name sources
    const hasSimilarName = work.sources?.some(s => s.type === 'similar_name')

    // Check if from following
    const isFromFollowing = work.sources?.some(s => s.type === 'following')
    if (isFromFollowing) {
        return 95 + Math.random() * 5 // Top priority (95-100)
    }

    // 1. Tag/Genre Similarity (40% or 30% if similar name)
    const tagScore = calculateTagScore(work.tags, userTagPreferences)
    score += tagScore * (hasSimilarName ? 0.3 : 0.4)

    // 2. Affine Users Score (30% or 25% if similar name)
    const affinityScore = calculateAffinityScore(work.sources, affineUsers)
    score += affinityScore * (hasSimilarName ? 0.25 : 0.3)

    // 3. Tierlist Position Score (20% or 15% if similar name)
    const tierScore = calculateTierScore(work.sources)
    score += tierScore * (hasSimilarName ? 0.15 : 0.2)

    // 4. Popularity Score (10%)
    const popularityScore = calculatePopularityScore(work.sources)
    score += popularityScore * 0.1

    // 5. NEW: Similar Name Bonus (20% if applicable)
    if (hasSimilarName) {
        const similarNameScore = calculateSimilarNameScore(work.sources)
        score += similarNameScore * 0.2
    }

    // 6. Fallback Score
    const isFallback = work.sources?.some(s => s.type === 'fallback')
    if (isFallback) {
        score = 65 + Math.random() * 15 // Ensure typical score between 65-80 for fallback items
    }

    return Math.round(score)
}

/**
 * Score based on name similarity to user's favorites
 */
function calculateSimilarNameScore(sources) {
    const similarNameSources = sources.filter(s => s.type === 'similar_name')
    if (similarNameSources.length === 0) return 0

    // Average similarity * 100, with bonus for multiple matches
    const avgSimilarity = similarNameSources.reduce((sum, s) => sum + (s.similarity || 0), 0) / similarNameSources.length
    const bonus = Math.min(similarNameSources.length * 10, 30) // Up to +30 for multiple

    return Math.min((avgSimilarity * 100) + bonus, 100)
}

/**
 * Score based on tag matching
 */
function calculateTagScore(workTags, userTagPreferences) {
    if (!workTags || workTags.length === 0) return 0

    let matchScore = 0
    let maxPossible = 0

    workTags.forEach(tag => {
        const preference = userTagPreferences[tag] || 0
        matchScore += preference
        maxPossible += 5
    })

    // Normalize to 0-100
    if (maxPossible === 0) return 0
    return (matchScore / maxPossible) * 100
}

/**
 * Score based on affinity of users who recommended it
 */
function calculateAffinityScore(sources, affineUsers) {
    if (!sources || sources.length === 0) return 0

    const totalAffinity = sources.reduce((sum, source) => sum + (source.affinity || 0), 0)
    const avgAffinity = totalAffinity / sources.length

    // Bonus for multiple sources
    const sourceBonus = Math.min(sources.length * 5, 20)

    return Math.min(avgAffinity + sourceBonus, 100)
}

/**
 * Score based on tier positions in tierlists
 */
function calculateTierScore(sources) {
    if (!sources || sources.length === 0) return 0

    const tierWeights = {
        'S': 100,
        'God Tier': 100,
        'Top': 100,
        '#1': 100,
        'A': 80,
        '#2': 80,
        'B': 60,
        '#3': 60
    }

    let totalTierScore = 0
    let tierCount = 0

    sources.forEach(source => {
        if (source.type === 'tierlist' && source.tier) {
            totalTierScore += tierWeights[source.tier] || 50
            tierCount++
        }
    })

    if (tierCount === 0) return 50 // Neutral score if no tier info

    return totalTierScore / tierCount
}

/**
 * Score based on popularity (how many affine users have it)
 */
function calculatePopularityScore(sources) {
    if (!sources || sources.length === 0) return 0

    // Sweet spot: 2-5 sources = high score
    // Too few (1) = lower score
    // Too many (6+) = lower score (mainstream penalty)

    const count = sources.length
    if (count === 1) return 40
    if (count >= 2 && count <= 5) return 100
    if (count >= 6 && count <= 10) return 70
    return 50 // 10+ sources, probably too mainstream
}

/**
 * Generate human-readable reasons for recommendation
 */
function generateReasons(work, userProfile, userTagPreferences) {
    const reasons = []

    // 0. Priority: Following
    const followingSource = work.sources?.find(s => s.type === 'following')
    if (followingSource) {
        reasons.push({
            type: 'following',
            icon: '👥',
            text: `De la biblioteca de ${followingSource.username}`,
            user: {
                username: followingSource.username,
                avatar_url: followingSource.avatar_url
            }
        })
        return reasons // Show mainly this
    }

    // 0.5. Fallback Reasons
    const fallbackSource = work.sources?.find(s => s.type === 'fallback')
    if (fallbackSource) {
        reasons.push({
            type: 'fallback',
            icon: '🔥', // Fire for popular/hot
            text: 'Popular en géneros que te gustan'
        })
        // If fallback, usually just show this one reason
        return reasons
    }

    // 1. Similar Name Reasons (Priority) reason)
    const similarNameSources = work.sources?.filter(s => s.type === 'similar_name') || []
    if (similarNameSources.length > 0) {
        const firstMatch = similarNameSources[0]
        const reasonText = firstMatch.reason === 'high_rating'
            ? 'Nombre similar a obras que valoraste bien'
            : 'Nombre similar a obras en tus top tiers'

        reasons.push({
            type: 'similar_name',
            icon: '🔤',
            text: reasonText
        })
    }

    // Tag matches
    const matchingTags = work.tags?.filter(tag => userTagPreferences[tag] > 0) || []
    if (matchingTags.length > 0 && reasons.length < 3) {
        reasons.push({
            type: 'tags',
            icon: '🏷️',
            text: `Tags: ${matchingTags.slice(0, 3).join(', ')}`
        })
    }

    // Affine users
    const tierlistSources = work.sources?.filter(s => s.type === 'tierlist') || []
    const reviewSources = work.sources?.filter(s => s.type === 'review') || []
    const librarySources = work.sources?.filter(s => s.type === 'library') || []

    if (tierlistSources.length > 0 && reasons.length < 3) {
        const topTier = tierlistSources.find(s => ['S', 'God Tier', 'Top', '#1'].includes(s.tier))
        if (topTier) {
            reasons.push({
                type: 'tierlist',
                icon: '⭐',
                text: `Tier ${topTier.tier} en listas afines`
            })
        } else {
            // Show tier info even for non-top tiers
            const firstTier = tierlistSources[0]
            if (firstTier?.tier) {
                reasons.push({
                    type: 'tierlist',
                    icon: '📋',
                    text: `En tierlists de usuarios afines`
                })
            }
        }
    }

    if (reviewSources.length > 0 && reasons.length < 3) {
        const avgRating = reviewSources.reduce((sum, s) => sum + s.rating, 0) / reviewSources.length
        reasons.push({
            type: 'rating',
            icon: '💯',
            text: `Valorado ${avgRating.toFixed(1)}/5 por usuarios afines`
        })
    }

    if (librarySources.length > 0 && reasons.length < 3) {
        const completedCount = librarySources.filter(s => s.status === 'completed').length
        if (completedCount > 0) {
            reasons.push({
                type: 'library',
                icon: '✅',
                text: `${completedCount} usuarios afines lo completaron`
            })
        }
    }

    // Number of affine users
    if (work.sources && work.sources.length > 1 && reasons.length < 3) {
        reasons.push({
            type: 'users',
            icon: '👥',
            text: `${work.sources.length} usuarios afines lo tienen`
        })
    }

    return reasons.slice(0, 3) // Max 3 reasons
}
