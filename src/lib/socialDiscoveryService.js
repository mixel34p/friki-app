import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════
// SOCIAL DISCOVERY SERVICE
// Servicio para el sistema de descubrimiento sin presión social
// ═══════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// VISIBILITY SETTINGS
// ─────────────────────────────────────────────────────────

export async function getVisibilitySettings(userId) {
    const { data, error } = await supabase
        .from('user_visibility_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw error

    // Return defaults if no settings exist
    return data || {
        visibility_mode: 'visible',
        min_affinity_threshold: 50,
        daily_request_limit: 5,
        requests_sent_today: 0,
        show_in_discovery: true
    }
}

export async function updateVisibilitySettings(userId, settings) {
    const { data, error } = await supabase
        .from('user_visibility_settings')
        .upsert({
            user_id: userId,
            ...settings,
            updated_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) throw error
    return data
}

// ─────────────────────────────────────────────────────────
// AFFINITY CALCULATION
// ─────────────────────────────────────────────────────────

export async function calculateAffinity(userId1, userId2) {
    const { data, error } = await supabase
        .rpc('calculate_user_affinity', { user1: userId1, user2: userId2 })
        .single()

    if (error) {
        console.error('Error calculating affinity:', error)
        return { affinity_score: 0, common_works: [], matching_genres: [], matching_platforms: [] }
    }

    return data
}

// Client-side affinity calculation (for initial load, lighter)
export function calculateAffinityClient(profile1, profile2) {
    if (!profile1 || !profile2) return { score: 0, matches: [] }

    let score = 0
    let maxScore = 0
    const matches = []

    // Genre matches (40% weight)
    const genres1 = profile1.favorite_genres || []
    const genres2 = profile2.favorite_genres || []
    const genreMatches = genres1.filter(g => genres2.includes(g))
    genreMatches.forEach(g => matches.push({ type: 'genre', value: g, icon: '🎮' }))
    score += genreMatches.length * 15
    maxScore += Math.max(genres1.length, genres2.length, 1) * 15

    // Platform matches (20% weight)
    const platforms1 = profile1.platforms || []
    const platforms2 = profile2.platforms || []
    const platformMatches = platforms1.filter(p => platforms2.includes(p))
    platformMatches.forEach(p => matches.push({ type: 'platform', value: p, icon: '🖥️' }))
    score += platformMatches.length * 10
    maxScore += Math.max(platforms1.length, platforms2.length, 1) * 10



    // Anime tags (15% weight)
    const animeTags1 = profile1.anime_tags || []
    const animeTags2 = profile2.anime_tags || []
    const animeMatches = animeTags1.filter(t => animeTags2.includes(t))
    animeMatches.forEach(t => matches.push({ type: 'anime', value: t, icon: '📺' }))
    score += animeMatches.length * 10
    maxScore += Math.max(animeTags1.length, animeTags2.length, 1) * 10

    // Game Library (20% weight in client calculation)
    if (profile1.library && profile2.library) {
        const lib1 = Array.isArray(profile1.library) ? profile1.library : []
        const lib2 = Array.isArray(profile2.library) ? profile2.library : []

        // Use 'game_id' key - matches actual library data structure
        const set1 = new Set(lib1.map(i => i.game_id || i.id).filter(Boolean))
        const commonCount = lib2.filter(i => set1.has(i.game_id || i.id)).length

        if (commonCount > 0) {
            matches.push({ type: 'library', value: `${commonCount} juegos en común`, icon: '🎮' })
            score += commonCount * 5
            maxScore += 50
        }
    }

    // Anime Library (15% weight in client calculation)
    if (profile1.anime_library && profile2.anime_library) {
        const animeLib1 = Array.isArray(profile1.anime_library) ? profile1.anime_library : []
        const animeLib2 = Array.isArray(profile2.anime_library) ? profile2.anime_library : []

        // Use 'mal_id' or 'id' key for anime
        const animeSet1 = new Set(animeLib1.map(i => i.mal_id || i.id).filter(Boolean))
        const animeCommonCount = animeLib2.filter(i => animeSet1.has(i.mal_id || i.id)).length

        if (animeCommonCount > 0) {
            matches.push({ type: 'anime_library', value: `${animeCommonCount} animes en común`, icon: '📺' })
            score += animeCommonCount * 5
            maxScore += 40
        }
    }

    const affinityScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

    return {
        score: Math.min(affinityScore, 100),
        matches
    }
}

// ─────────────────────────────────────────────────────────
// DISCOVER SIMILAR USERS
// ─────────────────────────────────────────────────────────

export async function discoverSimilarUsers(currentUserId, currentProfile, options = {}) {
    const { limit = 20, minAffinity = 0 } = options

    try {
        // Get users excluding current user and blocked users
        const { data: blockedUsers } = await supabase
            .from('user_blocks')
            .select('blocked_id, blocker_id')
            .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`)

        const blockedIds = new Set()
        blockedUsers?.forEach(b => {
            if (b.blocker_id === currentUserId) blockedIds.add(b.blocked_id)
            if (b.blocked_id === currentUserId) blockedIds.add(b.blocker_id)
        })

        // Get all profiles except current user
        let query = supabase
            .from('profiles')
            .select('*')
            .neq('user_id', currentUserId)
            .limit(100)

        const { data: profiles, error } = await query

        if (error) throw error

        // Filter and calculate affinity for each
        const usersWithAffinity = (profiles || [])
            .filter(p => !blockedIds.has(p.user_id))
            .map(p => {
                const { score, matches } = calculateAffinityClient(currentProfile, p)
                return {
                    ...p,
                    affinity: score,
                    matches: matches.slice(0, 5) // Top 5 matches
                }
            })
            .filter(u => u.affinity >= minAffinity)
            .sort((a, b) => b.affinity - a.affinity)
            .slice(0, limit)

        return usersWithAffinity
    } catch (error) {
        console.error('Error discovering users:', error)
        return []
    }
}

// ─────────────────────────────────────────────────────────
// COMMON WORKS
// ─────────────────────────────────────────────────────────

export async function getCommonWorks(userId1, userId2, limit = 5) {
    try {
        // 1. Get tierlists IDs for both users
        const [{ data: lists1 }, { data: lists2 }] = await Promise.all([
            supabase.from('tierlists').select('id, media_type').eq('user_id', userId1).eq('visibility', 'public'),
            supabase.from('tierlists').select('id, media_type').eq('user_id', userId2).eq('visibility', 'public')
        ])

        const ids1 = lists1?.map(l => l.id) || []
        const ids2 = lists2?.map(l => l.id) || []

        if (ids1.length === 0 || ids2.length === 0) return []

        // 2. Get items
        const [{ data: items1 }, { data: items2 }] = await Promise.all([
            supabase.from('tierlist_items').select('*').in('tierlist_id', ids1),
            supabase.from('tierlist_items').select('*').in('tierlist_id', ids2)
        ])

        // 3. Extract media IDs and identify common ones
        const map1 = new Map() // media_id -> item
        items1?.forEach(i => map1.set(i.media_id, i))

        const commonMediaIds = new Set()
        const commonWorksRaw = []

        items2?.forEach(i2 => {
            if (map1.has(i2.media_id)) {
                commonMediaIds.add(i2.media_id)
                commonWorksRaw.push({
                    item1: map1.get(i2.media_id),
                    item2: i2
                })
            }
        })

        if (commonMediaIds.size === 0) return []

        // 4. Fetch details (name, image) from games table (as viewed in ViewTierlist.jsx)
        // Assume 'games' table holds metadata for now
        const { data: games } = await supabase
            .from('games')
            .select('id, name, cover_url')
            .in('id', [...commonMediaIds])

        const gameMap = {}
        games?.forEach(g => gameMap[g.id] = g)

        // 5. Construct result
        const commonWorks = commonWorksRaw
            .map(({ item1, item2 }) => {
                const game = gameMap[item1.media_id]
                if (!game) return null // Skip if metadata found (or handle partial)

                return {
                    id: game.id,
                    name: game.name || `Item unknown`,
                    image_url: game.cover_url,
                    tier1: item1.tier,
                    tier2: item2.tier,
                    sameTier: item1.tier === item2.tier
                }
            })
            .filter(Boolean) // Remove nulls
            .sort((a, b) => {
                if (a.sameTier !== b.sameTier) return b.sameTier - a.sameTier
                return a.name.localeCompare(b.name)
            })

        return commonWorks.slice(0, limit)
    } catch (error) {
        console.error('Error getting common works:', error)
        return []
    }
}

// ─────────────────────────────────────────────────────────
// CONNECTION REQUESTS
// ─────────────────────────────────────────────────────────

export async function canSendRequest(userId) {
    const settings = await getVisibilitySettings(userId)

    // Check if it's a new day
    const today = new Date().toISOString().split('T')[0]
    const lastReset = settings.last_request_reset?.split('T')[0]

    if (lastReset !== today) {
        return { canSend: true, remaining: settings.daily_request_limit }
    }

    const remaining = settings.daily_request_limit - settings.requests_sent_today
    return { canSend: remaining > 0, remaining }
}

export async function sendConnectionRequest(requesterId, targetId, message = null) {
    try {
        // Check if can send
        const { canSend, remaining } = await canSendRequest(requesterId)
        if (!canSend) {
            throw new Error(`Has alcanzado el límite diario de solicitudes. Inténtalo mañana.`)
        }

        // Get common works for snapshot
        const commonWorks = await getCommonWorks(requesterId, targetId, 10)

        // Calculate affinity
        const { data: affinity } = await supabase
            .rpc('calculate_user_affinity', { user1: requesterId, user2: targetId })
            .single()

        const { data, error } = await supabase
            .from('connection_requests')
            .insert({
                requester_id: requesterId,
                target_id: targetId,
                message: message?.trim() || null,
                affinity_score: affinity?.affinity_score || 0,
                common_works_snapshot: commonWorks
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Ya existe una solicitud pendiente con este usuario.')
            }
            throw error
        }

        return { success: true, data, remaining: remaining - 1 }
    } catch (error) {
        console.error('Error sending request:', error)
        throw error
    }
}

export async function getPendingRequests(userId) {
    const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('target_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) throw error

    // Manually fetch requester profiles
    if (!data || data.length === 0) return []

    const requesterIds = [...new Set(data.map(r => r.requester_id))]
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', [...requesterIds, userId])

    const profileMap = {}
    profiles?.forEach(p => profileMap[p.user_id] = p)
    const currentUserProfile = profileMap[userId]

    return data.map(r => {
        const requesterProfile = profileMap[r.requester_id]
        let affinityScore = r.affinity_score || 0

        if (affinityScore === 0 && currentUserProfile && requesterProfile) {
            const { score } = calculateAffinityClient(currentUserProfile, requesterProfile)
            affinityScore = score
        }

        return {
            ...r,
            requester: requesterProfile,
            affinity_score: affinityScore
        }
    })
}



export async function getSentRequests(userId) {
    const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error

    // Manually fetch target profiles
    if (!data || data.length === 0) return []

    const targetIds = [...new Set(data.map(r => r.target_id))]
    const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', targetIds)

    const profileMap = {}
    profiles?.forEach(p => profileMap[p.user_id] = p)

    return data.map(r => ({
        ...r,
        target: profileMap[r.target_id]
    }))
}


export async function respondToRequest(requestId, accept) {
    const { data, error } = await supabase
        .from('connection_requests')
        .update({
            status: accept ? 'accepted' : 'rejected',
            responded_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single()

    if (error) throw error
    return data
}

// ─────────────────────────────────────────────────────────
// CONNECTIONS
// ─────────────────────────────────────────────────────────

export async function getConnections(userId) {
    const { data, error } = await supabase
        .from('connections')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false })

    if (error) throw error

    // Get profile info for each connection
    const connections = data || []
    const allUserIds = new Set([userId])
    connections.forEach(c => {
        allUserIds.add(c.user1_id)
        allUserIds.add(c.user2_id)
    })

    if (connections.length === 0) return []

    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', [...allUserIds])

    const profileMap = {}
    profiles?.forEach(p => profileMap[p.user_id] = p)
    const currentUserProfile = profileMap[userId]

    return connections.map(c => {
        const otherUserId = c.user1_id === userId ? c.user2_id : c.user1_id
        const otherUserProfile = profileMap[otherUserId]

        let affinityScore = c.affinity_score || 0
        // Calculate dynamic affinity if stored is 0
        if (affinityScore === 0 && currentUserProfile && otherUserProfile) {
            const { score } = calculateAffinityClient(currentUserProfile, otherUserProfile)
            affinityScore = score
        }

        return {
            ...c,
            otherUser: otherUserProfile,
            affinity_score: affinityScore
        }
    })
}

export async function isConnectedWith(userId1, userId2) {
    const u1 = userId1 < userId2 ? userId1 : userId2
    const u2 = userId1 < userId2 ? userId2 : userId1

    const { data, error } = await supabase
        .from('connections')
        .select('id')
        .eq('user1_id', u1)
        .eq('user2_id', u2)
        .maybeSingle()

    if (error) return false
    return !!data
}

// ─────────────────────────────────────────────────────────
// BLOCKS
// ─────────────────────────────────────────────────────────

export async function blockUser(blockerId, blockedId) {
    const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: blockerId, blocked_id: blockedId })

    if (error && error.code !== '23505') throw error
    return true
}

export async function unblockUser(blockerId, blockedId) {
    const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)

    if (error) throw error
    return true
}

export async function getBlockedUsers(userId) {
    const { data, error } = await supabase
        .from('user_blocks')
        .select(`
            blocked_id,
            blocked:profiles!user_blocks_blocked_id_fkey(
                user_id, username, display_name, avatar_url
            ),
            created_at
        `)
        .eq('blocker_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function isBlocked(userId1, userId2) {
    const { data } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
        .maybeSingle()

    return !!data
}

export async function checkBlockRelationship(currentUserId, otherUserId) {
    const { data } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${currentUserId})`)

    if (!data || data.length === 0) return { blocked: false, blockedByMe: false, blockedByThem: false }

    const blockedByMe = data.some(r => r.blocker_id === currentUserId)
    const blockedByThem = data.some(r => r.blocker_id === otherUserId)

    return {
        blocked: true,
        blockedByMe,
        blockedByThem
    }
}

// ─────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────

export async function getConversations(userId) {
    const { data: connections, error: connError } = await supabase
        .from('connections')
        .select('id, user1_id, user2_id, common_works, affinity_score')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    if (connError) throw connError

    const connectionIds = connections?.map(c => c.id) || []
    if (connectionIds.length === 0) return []

    const { data: conversations, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .in('connection_id', connectionIds)
        .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convError) throw convError

    // Get all user IDs involved (current + others)
    const allUserIds = new Set([userId])
    connections.forEach(c => {
        allUserIds.add(c.user1_id)
        allUserIds.add(c.user2_id)
    })

    // Get full profiles for affinity calculation
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', [...allUserIds])

    const profileMap = {}
    profiles?.forEach(p => profileMap[p.user_id] = p)

    const currentUserProfile = profileMap[userId]

    const connectionMap = {}
    connections.forEach(c => connectionMap[c.id] = c)

    return (conversations || []).map(conv => {
        const connection = connectionMap[conv.connection_id]
        const otherUserId = connection.user1_id === userId ? connection.user2_id : connection.user1_id
        const otherUserProfile = profileMap[otherUserId]

        // Calculate affinity on the fly if not stored
        let affinityScore = connection.affinity_score || 0
        if (affinityScore === 0 && currentUserProfile && otherUserProfile) {
            const { score } = calculateAffinityClient(currentUserProfile, otherUserProfile)
            affinityScore = score
        }

        return {
            ...conv,
            connection,
            otherUser: otherUserProfile,
            commonWorks: connection.common_works,
            affinity_score: affinityScore
        }
    })
}

export async function getMessages(conversationId, limit = 50, before = null) {
    let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (before) {
        query = query.lt('created_at', before)
    }

    const { data: messagesData, error } = await query

    if (error) throw error

    // Fetch replied messages content if any references exist
    const messages = messagesData || []
    const replyIds = [...new Set(messages.map(m => m.reply_to_id).filter(Boolean))]

    if (replyIds.length > 0) {
        const { data: repliedMessages } = await supabase
            .from('chat_messages')
            .select('id, content, sender_id') // minimal fields
            .in('id', replyIds)

        const replyMap = {}
        repliedMessages?.forEach(r => replyMap[r.id] = r)

        // Enrich messages
        return messages.map(m => ({
            ...m,
            replyTo: m.reply_to_id ? replyMap[m.reply_to_id] : null
        })).reverse()
    }

    return messages.reverse()
}

export async function sendMessage(conversationId, senderId, content, options = {}) {
    const { replyToId, imageUrl } = options

    const { data, error } = await supabase
        .from('chat_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            content: content.trim(),
            reply_to_id: replyToId || null,
            image_url: imageUrl || null
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function markMessagesAsRead(conversationId, userId) {
    const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false)

    if (error) throw error
}

export async function getUnreadCount(userId) {
    const conversations = await getConversations(userId)
    const conversationIds = conversations.map(c => c.id)

    if (conversationIds.length === 0) return 0

    const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .eq('is_read', false)

    if (error) return 0
    return count || 0
}

export async function uploadChatImage(file) {
    const formData = new FormData()
    formData.append('image', file)

    try {
        const response = await fetch('https://api.imgbb.com/1/upload?key=a7c9631cb58a81b0d9ab44fc840ff646', {
            method: 'POST',
            body: formData
        })

        const data = await response.json()

        if (!data.success) {
            throw new Error(data.error?.message || 'Error uploading to ImgBB')
        }

        return data.data.url
    } catch (error) {
        console.error('Error uploading chat image:', error)
        throw error
    }
}

export async function toggleMessageReaction(messageId, userId, emoji) {
    const { data, error } = await supabase
        .rpc('toggle_message_reaction', {
            p_message_id: messageId,
            p_user_id: userId,
            p_emoji: emoji
        })

    if (error) throw error
    return data
}

export async function editMessage(messageId, userId, newContent) {
    // First verify the user owns this message
    const { data: message, error: fetchError } = await supabase
        .from('chat_messages')
        .select('sender_id')
        .eq('id', messageId)
        .single()

    if (fetchError) throw fetchError
    if (message.sender_id !== userId) {
        throw new Error('Cannot edit message from another user')
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .update({
            content: newContent,
            edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteMessage(messageId, userId) {
    // First verify the user owns this message
    const { data: message, error: fetchError } = await supabase
        .from('chat_messages')
        .select('sender_id')
        .eq('id', messageId)
        .single()

    if (fetchError) throw fetchError
    if (message.sender_id !== userId) {
        throw new Error('Cannot delete message from another user')
    }

    const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)

    if (error) throw error
    return true
}

// ─────────────────────────────────────────────────────────
// PROFILE COMPARISON
// ─────────────────────────────────────────────────────────

export async function compareProfiles(userId1, userId2) {
    try {
        // Get both profiles
        const [{ data: profile1 }, { data: profile2 }] = await Promise.all([
            supabase.from('profiles').select('*').eq('user_id', userId1).single(),
            supabase.from('profiles').select('*').eq('user_id', userId2).single()
        ])

        // Get tierlists for comparison
        const [{ data: tierlists1 }, { data: tierlists2 }] = await Promise.all([
            supabase.from('tierlists').select('*').eq('user_id', userId1).eq('visibility', 'public'),
            supabase.from('tierlists').select('*').eq('user_id', userId2).eq('visibility', 'public')
        ])

        // Calculate detailed affinity
        const { score, matches } = calculateAffinityClient(profile1, profile2)
        const commonWorks = await getCommonWorks(userId1, userId2, 10)

        // Get common anime tags
        const animeTags1 = profile1?.anime_tags || []
        const animeTags2 = profile2?.anime_tags || []
        const commonAnimeTags = animeTags1.filter(t => animeTags2.includes(t))

        return {
            profile1,
            profile2,
            affinity: score,
            matches,
            commonWorks,
            tierlists1: tierlists1 || [],
            tierlists2: tierlists2 || [],
            commonLibrary: getCommonLibrary(profile1?.library, profile2?.library),
            commonAnimeLibrary: getCommonLibrary(profile1?.anime_library, profile2?.anime_library),
            commonAnimeTags
        }
    } catch (error) {
        console.error('Error comparing profiles:', error)
        throw error
    }
}

// ─────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────

export function subscribeToMessages(conversationId, callback) {
    const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            payload => callback(payload.new)
        )
        .subscribe()

    return () => supabase.removeChannel(channel)
}

export function subscribeToConnectionRequests(userId, callback) {
    const channel = supabase
        .channel(`requests:${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'connection_requests',
                filter: `target_id=eq.${userId}`
            },
            payload => callback(payload.new)
        )
        .subscribe()

    return () => supabase.removeChannel(channel)
}

export function getCommonLibrary(lib1, lib2) {
    if (!lib1 || !lib2 || !Array.isArray(lib1) || !Array.isArray(lib2)) return []

    // Build a map using game_id or id (the actual field name in library items)
    const map1 = new Map()
    lib1.forEach(i => {
        const itemId = i.game_id || i.id // game_id or id
        if (itemId) {
            map1.set(String(itemId), i)
        }
    })

    const common = []
    lib2.forEach(i2 => {
        const itemId2 = i2.game_id || i2.id
        if (itemId2 && map1.has(String(itemId2))) {
            const i1 = map1.get(String(itemId2))
            // Use 'title' as primary since that's what Library.jsx saves
            const itemName = i1.title || i2.title || i1.name || i2.name || 'Sin nombre'
            common.push({
                game_id: itemId2,
                id: itemId2,
                name: itemName,
                title: itemName,
                image_url: i1.image_url || i2.image_url,
                status1: i1.status,
                status2: i2.status,
                rating1: i1.rating,
                rating2: i2.rating
            })
        }
    })

    return common.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

// ─────────────────────────────────────────────────────────
// SHARE CONTENT UTILS
// ─────────────────────────────────────────────────────────

export async function getUserTierlists(userId) {
    const { data, error } = await supabase
        .from('tierlists')
        .select('id, title, media_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error('Error fetching tierlists:', error)
        return []
    }

    // Map to expected format
    return (data || []).map(t => ({
        id: t.id,
        name: t.title,
        category: t.media_type
    }))
}



