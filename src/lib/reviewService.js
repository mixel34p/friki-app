import { supabase } from './supabase'

/**
 * Fetch reviews for a specific work
 * @param {string} workId 
 * @param {'game'|'anime'} workType 
 * @param {'recent'|'rating_desc'|'rating_asc'|'reactions'} sortBy 
 */
export async function getReviews(workId, workType, sortBy = 'recent', page = 0, limit = 10) {
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
        .from('reviews')
        .select(`
            *,
            profiles:user_id (
                username,
                display_name,
                avatar_url
            ),
            my_reaction:review_reactions(reaction_type)
        `)
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        .range(from, to)

    // Sort logic
    if (sortBy === 'recent') {
        query = query.order('created_at', { ascending: false })
    } else if (sortBy === 'rating_desc') {
        query = query.order('rating', { ascending: false })
    } else if (sortBy === 'rating_asc') {
        query = query.order('rating', { ascending: true })
    } else if (sortBy === 'reactions') {
        query = query.order('reaction_count', { ascending: false })
    }

    const { data, error } = await query

    if (error) throw error
    return data
}

/**
 * Get recent reviews globally (for Landing page)
 */
export async function getRecentReviews(limit = 6) {
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            id,
            rating,
            content,
            work_id,
            work_type,
            created_at,
            profiles:user_id (
                username,
                display_name,
                avatar_url
            )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching recent reviews:', error)
        return []
    }

    // We need to fetch the work names/covers
    // This is a bit inefficient but works for a small limit
    const reviewsWithWork = await Promise.all(data.map(async (review) => {
        let work = null
        if (review.work_type === 'game') {
            const { data: g } = await supabase.from('games').select('name, cover_url').eq('id', review.work_id).single()
            work = { title: g?.name, image: g?.cover_url }
        } else {
            const { data: a } = await supabase.from('anime').select('title, image_url').eq('id', review.work_id).single()
            work = { title: a?.title, image: a?.image_url }
        }
        return { ...review, work }
    }))

    return reviewsWithWork
}

/**
 * Create a new review
 */
export async function createReview({ workId, workType, title, content, rating, isSpoiler, userId }) {
    const { data, error } = await supabase
        .from('reviews')
        .insert({
            work_id: String(workId),
            work_type: workType,
            user_id: userId,
            title,
            content,
            rating,
            is_spoiler: isSpoiler
        })
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Update an existing review
 */
export async function updateReview(reviewId, { title, content, rating, isSpoiler }) {
    const { data, error } = await supabase
        .from('reviews')
        .update({
            title,
            content,
            rating,
            is_spoiler: isSpoiler,
            updated_at: new Date()
        })
        .eq('id', reviewId)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId) {
    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)

    if (error) throw error
    return true
}

/**
 * Toggle a reaction on a review
 */
export async function toggleReaction(reviewId, reactionType, userId) {
    // 1. Check existing
    const { data: existing, error: fetchError } = await supabase
        .from('review_reactions')
        .select('*')
        .eq('review_id', reviewId)
        .eq('user_id', userId)
        .maybeSingle()

    if (fetchError) throw fetchError

    if (existing) {
        if (existing.reaction_type === reactionType) {
            // Delete (Untoggle)
            const { error } = await supabase
                .from('review_reactions')
                .delete()
                .eq('id', existing.id)
            if (error) throw error
            return 'removed'
        } else {
            // Update
            const { error } = await supabase
                .from('review_reactions')
                .update({ reaction_type: reactionType })
                .eq('id', existing.id)
            if (error) throw error
            return 'updated'
        }
    } else {
        // Insert
        const { error } = await supabase
            .from('review_reactions')
            .insert({
                review_id: reviewId,
                user_id: userId,
                reaction_type: reactionType
            })
        if (error) throw error
        return 'inserted'
    }
}

/**
 * Fetch comments for a review
 */
export async function getReviewComments(reviewId) {
    const { data, error } = await supabase
        .from('review_comments')
        .select(`
            *,
            profiles:user_id (
                username,
                display_name,
                avatar_url
            )
        `)
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data
}

/**
 * Post a comment/reply
 */
export async function postReviewComment(reviewId, content, userId) {
    const { data, error } = await supabase
        .from('review_comments')
        .insert({
            review_id: reviewId,
            user_id: userId,
            content
        })
        .select(`
            *,
            profiles:user_id (
                username,
                display_name,
                avatar_url
            )
        `)
        .single()

    if (error) throw error
    return data
}

/**
 * Check specifically if I have reacted to these reviews
 * Returns a map: { reviewId: reactionType }
 */
export async function getMyReactions(reviewIds, userId) {
    if (!reviewIds.length) return {}

    const { data, error } = await supabase
        .from('review_reactions')
        .select('review_id, reaction_type')
        .eq('user_id', userId)
        .in('review_id', reviewIds)

    if (error) {
        console.error('Error fetching reactions:', error)
        return {}
    }

    const map = {}
    data.forEach(r => map[r.review_id] = r.reaction_type)
    return map
}

/**
 * Get aggregate stats for reviews
 */
export async function getReviewStats(workId, workType) {
    const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('work_id', String(workId))
        .eq('work_type', workType)

    if (error) throw error

    if (!data || data.length === 0) {
        return { average: 0, count: 0 }
    }

    // Simple average
    const sum = data.reduce((acc, curr) => acc + curr.rating, 0)
    const average = sum / data.length

    return {
        average: parseFloat(average.toFixed(1)),
        count: data.length
    }
}

/**
 * Check if a user has reviewed a specific work
 */
export async function getUserReview(workId, workType, userId) {
    const { data, error } = await supabase
        .from('reviews')
        .select('id, rating')
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        console.error('Error checking user review:', error)
    }

    return data
}
