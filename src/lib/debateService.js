import { supabase, getCurrentUser } from './supabase'

// ═══════════════════════════════════════════════════════
// DEBATE SERVICE - GeekSphere
// ═══════════════════════════════════════════════════════

/**
 * Get list of debates with filters and pagination
 */
export const getDebates = async ({
    orderBy = 'recent',
    mediaType = null,
    debateType = null,
    limit = 20,
    offset = 0,
    search = null,
    mediaId = null // Filter debates containing a specific media item
} = {}) => {
    try {
        let query = supabase
            .from('debates')
            .select(`
                *,
                debate_media (
                    id,
                    media_type,
                    media_id,
                    position
                )
            `)

        // Filter by debate type
        if (debateType) {
            query = query.eq('debate_type', debateType)
        }

        // Search by title
        if (search && search.trim().length > 0) {
            query = query.ilike('title', `%${search.trim()}%`)
        }

        // Exclude locked debates only if NOT searching and NOT filtering by media
        if ((!search || search.trim().length === 0) && !mediaId) {
            query = query.eq('is_locked', false)
        }

        // Order
        if (orderBy === 'active') {
            query = query.order('updated_at', { ascending: false })
        } else {
            query = query.order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })
        }

        query = query.range(offset, offset + limit - 1)

        const { data, error } = await query

        if (error) {
            console.error('getDebates query error:', error)
            throw error
        }

        console.log('Debates raw data:', data)

        if (!data || data.length === 0) {
            return []
        }

        // Fetch profiles separately to avoid FK issues
        const userIds = [...new Set(data.map(d => d.user_id))]
        const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, color_primary, color_secondary')
            .in('user_id', userIds)

        const profilesMap = {}
        profiles?.forEach(p => {
            profilesMap[p.user_id] = p
        })

        // Enrich debates with profiles and media details
        const enrichedDebates = await Promise.all(
            data.map(async (debate) => {
                const mediaDetails = await getMediaDetails(debate.debate_media)
                return {
                    ...debate,
                    profiles: profilesMap[debate.user_id] || null,
                    media: mediaDetails
                }
            })
        )

        // Filter by media type if specified
        let filteredDebates = enrichedDebates
        if (mediaType) {
            filteredDebates = filteredDebates.filter(d =>
                d.media.some(m => m.media_type === mediaType)
            )
        }

        // Filter by specific media ID if specified
        if (mediaId) {
            filteredDebates = filteredDebates.filter(d =>
                d.media.some(m => String(m.id) === String(mediaId))
            )
        }

        return filteredDebates
    } catch (error) {
        console.error('getDebates error:', error)
        throw error
    }
}

/**
 * Get a single debate by ID with all details
 */
export const getDebateById = async (id) => {
    try {
        const { data, error } = await supabase
            .from('debates')
            .select(`
                *,
                debate_media (
                    id,
                    media_type,
                    media_id,
                    position
                )
            `)
            .eq('id', id)
            .single()

        if (error) {
            console.error('getDebateById query error:', error)
            throw error
        }

        if (!data) return null

        // Fetch profile separately
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, color_primary, color_secondary')
            .eq('user_id', data.user_id)
            .single()

        // Enrich with media details
        data.profiles = profile
        data.media = await getMediaDetails(data.debate_media)

        return data
    } catch (error) {
        console.error('getDebateById error:', error)
        throw error
    }
}

/**
 * Create a new debate
 */
export const createDebate = async ({ title, content, debateType, mediaItems }) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    if (!mediaItems || mediaItems.length === 0) {
        throw new Error('Debes seleccionar al menos una obra')
    }

    // Create debate
    const { data: debate, error: debateError } = await supabase
        .from('debates')
        .insert({
            user_id: user.id,
            title: title.trim(),
            content: content.trim(),
            debate_type: debateType || 'opinion'
        })
        .select()
        .single()

    if (debateError) throw debateError

    // Add media associations
    const mediaInserts = mediaItems.map((item, index) => ({
        debate_id: debate.id,
        media_type: item.media_type,
        media_id: item.id,
        position: index
    }))

    const { error: mediaError } = await supabase
        .from('debate_media')
        .insert(mediaInserts)

    if (mediaError) {
        // Rollback debate if media insert fails
        await supabase.from('debates').delete().eq('id', debate.id)
        throw mediaError
    }

    return debate
}

/**
 * Get posts for a debate
 */
export const getDebatePosts = async (debateId, { orderBy = 'recent' } = {}) => {
    try {
        let query = supabase
            .from('debate_posts')
            .select('*')
            .eq('debate_id', debateId)

        if (orderBy === 'score') {
            query = query.order('reaction_score', { ascending: false })
        } else {
            query = query.order('created_at', { ascending: true })
        }

        const { data, error } = await query

        if (error) {
            console.error('getDebatePosts query error:', error)
            throw error
        }

        if (!data || data.length === 0) {
            return []
        }

        // Fetch profiles separately
        const userIds = [...new Set(data.map(p => p.user_id))]
        const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, color_primary, color_secondary')
            .in('user_id', userIds)

        const profilesMap = {}
        profiles?.forEach(p => {
            profilesMap[p.user_id] = p
        })

        // Fetch quoted posts if any
        const quotedPostIds = data.filter(p => p.quoted_post_id).map(p => p.quoted_post_id)
        let quotedPostsMap = {}

        if (quotedPostIds.length > 0) {
            const { data: quotedPosts } = await supabase
                .from('debate_posts')
                .select('id, content, user_id')
                .in('id', quotedPostIds)

            quotedPosts?.forEach(qp => {
                quotedPostsMap[qp.id] = {
                    id: qp.id,
                    content: qp.content,
                    profiles: profilesMap[qp.user_id] || { display_name: 'Usuario' }
                }
            })
        }

        // Enrich with user reactions
        const user = await getCurrentUser()
        let reactionMap = {}

        const postIds = data.map(p => p.id)

        if (user) {
            const { data: reactions } = await supabase
                .from('debate_reactions')
                .select('post_id, reaction_type')
                .eq('user_id', user.id)
                .in('post_id', postIds)

            reactions?.forEach(r => {
                reactionMap[r.post_id] = r.reaction_type
            })
        }

        // Fetch all reaction counts for posts
        const { data: allReactions } = await supabase
            .from('debate_reactions')
            .select('post_id, reaction_type')
            .in('post_id', postIds)

        // Build reaction counts map
        const reactionCountsMap = {}
        postIds.forEach(id => {
            reactionCountsMap[id] = {
                good_argument: 0,
                interesting: 0,
                strong_opinion: 0
            }
        })

        allReactions?.forEach(r => {
            if (reactionCountsMap[r.post_id]) {
                reactionCountsMap[r.post_id][r.reaction_type]++
            }
        })

        // Enrich all posts
        const enrichedPosts = []
        for (const post of data) {
            const enrichedPost = {
                ...post,
                profiles: profilesMap[post.user_id] || null,
                quoted_post: post.quoted_post_id ? quotedPostsMap[post.quoted_post_id] : null,
                userReaction: reactionMap[post.id] || null,
                reactionCounts: reactionCountsMap[post.id] || { good_argument: 0, interesting: 0, strong_opinion: 0 }
            }

            // Enrich mentioned media
            if (post.mentioned_media_type && post.mentioned_media_id) {
                enrichedPost.mentionedMedia = await getMediaById(
                    post.mentioned_media_type,
                    post.mentioned_media_id
                )
            }

            enrichedPosts.push(enrichedPost)
        }

        return enrichedPosts
    } catch (error) {
        console.error('getDebatePosts error:', error)
        throw error
    }
}

/**
 * Create a post/reply in a debate
 */
export const createPost = async (debateId, { content, quotedPostId = null, mentionedMedia = null, isSpoiler = false }) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    const postData = {
        debate_id: debateId,
        user_id: user.id,
        content: content.trim(),
        is_spoiler: isSpoiler
    }

    if (quotedPostId) {
        postData.quoted_post_id = quotedPostId
    }

    if (mentionedMedia) {
        postData.mentioned_media_type = mentionedMedia.media_type
        postData.mentioned_media_id = mentionedMedia.id
    }

    const { data, error } = await supabase
        .from('debate_posts')
        .insert(postData)
        .select('*')
        .single()

    if (error) {
        console.error('createPost error:', error)
        throw error
    }

    // Fetch profile separately
    const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, color_primary, color_secondary')
        .eq('user_id', user.id)
        .single()

    return {
        ...data,
        profiles: profile
    }
}

/**
 * Toggle a reaction on a post
 */
export const toggleReaction = async (postId, reactionType) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    // Check existing reaction
    const { data: existing } = await supabase
        .from('debate_reactions')
        .select('reaction_type')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .maybeSingle()

    if (existing) {
        // Remove existing reaction
        await supabase
            .from('debate_reactions')
            .delete()
            .eq('user_id', user.id)
            .eq('post_id', postId)

        // If same reaction, just remove (toggle off)
        if (existing.reaction_type === reactionType) {
            return null
        }
    }

    // Add new reaction
    const { error } = await supabase
        .from('debate_reactions')
        .insert({
            user_id: user.id,
            post_id: postId,
            reaction_type: reactionType
        })

    if (error) throw error

    return reactionType
}

/**
 * Get reaction counts for a post
 */
export const getReactionCounts = async (postId) => {
    const { data, error } = await supabase
        .from('debate_reactions')
        .select('reaction_type')
        .eq('post_id', postId)

    if (error) throw error

    const counts = {
        good_argument: 0,
        interesting: 0,
        strong_opinion: 0
    }

    data?.forEach(r => {
        counts[r.reaction_type]++
    })

    return counts
}

/**
 * Delete a debate
 */
export const deleteDebate = async (debateId) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    const { error } = await supabase
        .from('debates')
        .delete()
        .eq('id', debateId)
        .eq('user_id', user.id)

    if (error) throw error
}

/**
 * Close a debate (lock it without deleting)
 * Closed debates don't appear in the main feed but are searchable
 */
export const closeDebate = async (debateId) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    const { data, error } = await supabase
        .from('debates')
        .update({ is_locked: true })
        .eq('id', debateId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a post
 */
export const deletePost = async (postId) => {
    const { error } = await supabase
        .from('debate_posts')
        .delete()
        .eq('id', postId)

    if (error) throw error
}

// ═══════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Get media details from debate_media entries
 */
async function getMediaDetails(debateMedia) {
    if (!debateMedia || debateMedia.length === 0) return []

    const gameIds = debateMedia.filter(m => m.media_type === 'game').map(m => m.media_id)
    const animeIds = debateMedia.filter(m => m.media_type === 'anime').map(m => m.media_id)

    const results = []

    if (gameIds.length > 0) {
        const { data: games } = await supabase
            .from('games')
            .select('id, name, cover_url, genres')
            .in('id', gameIds)

        games?.forEach(game => {
            const mediaEntry = debateMedia.find(m => m.media_type === 'game' && m.media_id === game.id)
            results.push({
                ...game,
                media_type: 'game',
                position: mediaEntry?.position || 0
            })
        })
    }

    if (animeIds.length > 0) {
        const { data: animes } = await supabase
            .from('anime')
            .select('id, title, image_url, genres')
            .in('id', animeIds)

        animes?.forEach(anime => {
            const mediaEntry = debateMedia.find(m => m.media_type === 'anime' && m.media_id === anime.id)
            results.push({
                id: anime.id,
                name: anime.title,
                cover_url: anime.image_url,
                genres: anime.genres,
                media_type: 'anime',
                position: mediaEntry?.position || 0
            })
        })
    }

    return results.sort((a, b) => a.position - b.position)
}

/**
 * Get a single media item by type and ID
 */
async function getMediaById(mediaType, mediaId) {
    if (mediaType === 'game') {
        const { data } = await supabase
            .from('games')
            .select('id, name, cover_url')
            .eq('id', mediaId)
            .single()
        return data ? { ...data, media_type: 'game' } : null
    } else if (mediaType === 'anime') {
        const { data } = await supabase
            .from('anime')
            .select('id, title, image_url')
            .eq('id', mediaId)
            .single()
        return data ? {
            id: data.id,
            name: data.title,
            cover_url: data.image_url,
            media_type: 'anime'
        } : null
    }
    return null
}

// Reaction display info
export const REACTION_TYPES = {
    good_argument: { emoji: '💡', label: 'Buen argumento', weight: 3 },
    interesting: { emoji: '✨', label: 'Interesante', weight: 2, icon: '/icons/star.png' },
    strong_opinion: { emoji: '🔥', label: 'Opinión fuerte', weight: 1, icon: '/icons/fire.gif' }
}

// Debate type display info
export const DEBATE_TYPES = {
    opinion: { emoji: '💭', label: 'Opinión', icon: '/icons/opinion.png' },
    comparison: { emoji: '⚖️', label: 'Comparación', icon: '/icons/scale.png' },
    question: { emoji: '❓', label: 'Pregunta', icon: '/icons/interrogation.png' },
    ranking: { emoji: '🏆', label: 'Ranking', icon: '/icons/medal.png' }
}
