import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'frikinet-auth',
        storage: window.localStorage
    }
})

// Helper function to get current user
export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

// Helper function to get profile by user id
export const getProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error) throw error
    return data
}

// Helper function to get profile by username
export const getProfileByUsername = async (username) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*, users!inner(id, username)')
        .eq('users.username', username)
        .single()

    if (error) throw error
    return data
}

// Tierlist helpers
export const createTierlist = async (tierlistData) => {
    const { data, error } = await supabase
        .from('tierlists')
        .insert(tierlistData)
        .select()
        .single()

    if (error) throw error
    return data
}

export const getTierlistsByUser = async (userId) => {
    const { data, error } = await supabase
        .from('tierlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export const getTierlistById = async (id) => {
    const { data, error } = await supabase
        .from('tierlists')
        .select(`
      *,
      tierlist_items (
        *,
        media (*)
      )
    `)
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

// Media helpers
export const searchMedia = async (query, mediaType = 'game') => {
    const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('media_type', mediaType)
        .ilike('title', `%${query}%`)
        .limit(20)

    if (error) throw error
    return data
}

export const getOrCreateMedia = async (mediaData) => {
    // First try to find existing
    const { data: existing } = await supabase
        .from('media')
        .select('*')
        .eq('external_id', mediaData.external_id)
        .eq('media_type', mediaData.media_type)
        .single()

    if (existing) return existing

    // Create new
    const { data, error } = await supabase
        .from('media')
        .insert(mediaData)
        .select()
        .single()

    if (error) throw error
    return data
}

// Calculate affinity between two users
export const calculateAffinity = async (userAId, userBId) => {
    // Get tierlists from both users
    const [userALists, userBLists] = await Promise.all([
        getTierlistsByUser(userAId),
        getTierlistsByUser(userBId)
    ])

    // Basic affinity calculation (can be improved)
    let matches = 0
    let total = 0

    // Compare tierlists with same media_type
    for (const listA of userALists) {
        const matchingList = userBLists.find(b => b.media_type === listA.media_type)
        if (matchingList) {
            // Get items from both lists
            const [itemsA, itemsB] = await Promise.all([
                supabase.from('tierlist_items').select('media_id, tier').eq('tierlist_id', listA.id),
                supabase.from('tierlist_items').select('media_id, tier').eq('tierlist_id', matchingList.id)
            ])

            // Compare tiers for matching media
            for (const itemA of itemsA.data || []) {
                const itemB = (itemsB.data || []).find(b => b.media_id === itemA.media_id)
                if (itemB) {
                    total++
                    if (itemA.tier === itemB.tier) {
                        matches += 2
                    } else if (Math.abs(tierToNumber(itemA.tier) - tierToNumber(itemB.tier)) === 1) {
                        matches += 1
                    }
                }
            }
        }
    }

    return total > 0 ? Math.round((matches / (total * 2)) * 100) : 0
}

// Social Interactions
// Likes
export const toggleLike = async (tierlistId) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    // Check if liked
    const { data: existing } = await supabase
        .from('tierlist_likes')
        .select('*')
        .eq('tierlist_id', tierlistId)
        .eq('user_id', user.id)
        .single()

    if (existing) {
        // Unlike
        const { error } = await supabase
            .from('tierlist_likes')
            .delete()
            .eq('tierlist_id', tierlistId)
            .eq('user_id', user.id)
        if (error) throw error
        return false // Not liked anymore
    } else {
        // Like
        const { error } = await supabase
            .from('tierlist_likes')
            .insert({ tierlist_id: tierlistId, user_id: user.id })

        if (error) throw error
        return true // Liked
    }
}

export const getTierlistLikes = async (tierlistId) => {
    const { count, error } = await supabase
        .from('tierlist_likes')
        .select('*', { count: 'exact', head: true })
        .eq('tierlist_id', tierlistId)

    if (error) {
        console.error('getTierlistLikes error:', error)
        return 0
    }
    return count || 0
}

export const checkUserLike = async (tierlistId) => {
    const user = await getCurrentUser()
    if (!user) return false

    const { data } = await supabase
        .from('tierlist_likes')
        .select('*')
        .eq('tierlist_id', tierlistId)
        .eq('user_id', user.id)
        .single()

    return !!data
}

// Review Likes (library_entries)
export const toggleReviewLike = async (entryId) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    // Check if liked
    const { data: existing } = await supabase
        .from('review_likes')
        .select('*')
        .eq('entry_id', entryId)
        .eq('user_id', user.id)
        .single()

    if (existing) {
        // Unlike
        const { error } = await supabase
            .from('review_likes')
            .delete()
            .eq('entry_id', entryId)
            .eq('user_id', user.id)
        if (error) throw error
        return false // Not liked anymore
    } else {
        // Like
        const { error } = await supabase
            .from('review_likes')
            .insert({ entry_id: entryId, user_id: user.id })
        if (error) throw error
        return true // Liked
    }
}

export const getReviewLikes = async (entryId) => {
    const { count, error } = await supabase
        .from('review_likes')
        .select('*', { count: 'exact', head: true })
        .eq('entry_id', entryId)

    if (error) {
        console.error('getReviewLikes error:', error)
        return 0
    }
    return count || 0
}

export const checkUserReviewLike = async (entryId) => {
    const user = await getCurrentUser()
    if (!user) return false

    const { data } = await supabase
        .from('review_likes')
        .select('*')
        .eq('entry_id', entryId)
        .eq('user_id', user.id)
        .single()

    return !!data
}

// Comments
export const getComments = async (tierlistId) => {
    const { data, error } = await supabase
        .from('tierlist_comments')
        .select(`
            *,
            *,
            profiles:user_id (
                username,
                avatar_url,
                display_name
            )
        `)
        .eq('tierlist_id', tierlistId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data
}

export const addComment = async (tierlistId, content) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Debes iniciar sesión')

    const { data, error } = await supabase
        .from('tierlist_comments')
        .insert({
            tierlist_id: tierlistId,
            user_id: user.id,
            content: content.trim()
        })
        .select(`
             *,
            profiles:user_id (
                username,
                avatar_url,
                display_name
            )
        `)
        .single()

    if (error) throw error
    return data
}

export const deleteComment = async (commentId) => {
    const { error } = await supabase
        .from('tierlist_comments')
        .delete()
        .eq('id', commentId)

    if (error) throw error
}

function tierToNumber(tier) {
    const tiers = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 }
    return tiers[tier] || 0
}
