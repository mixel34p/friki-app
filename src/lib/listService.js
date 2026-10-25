import { supabase } from './supabase'

// --- TEMPLATES ---
export async function getTemplates({ type = null, mediaType = null, query = '', limit = 30 } = {}) {
    let q = supabase
        .from('list_templates')
        .select('*')
        .eq('visibility', 'public')
        .order('uses_count', { ascending: false })
        .limit(limit)
    if (type) q = q.eq('list_type', type)
    if (mediaType) q = q.eq('media_type', mediaType)
    if (query.trim()) q = q.ilike('title', `%${query}%`)
    const { data, error } = await q
    if (error) throw error
    
    if (data && data.length > 0) {
        const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))];
        if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, display_name, featured_badge').in('id', userIds);
            if (profiles) {
                const profileMap = profiles.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
                data.forEach(t => { t.profiles = profileMap[t.user_id] || null; });
            }
        }
    }
    return data || []
}

/** Public, paginated catalog of user-created lists (never templates). */
export async function getDiscoverLists({ type = null, mediaType = null, query = '', page = 1, pageSize = 24, signal } = {}) {
    const safePage = Math.max(1, page)
    const from = (safePage - 1) * pageSize
    const scanSize = 500
    const rankedLists = []
    let total = 0

    // Fetch light metadata with the related like count, then rank globally before slicing pages.
    // Sorting only the current page would let older, popular lists stay buried.
    for (let offset = 0; ; offset += scanSize) {
        let request = supabase
            .from('user_lists')
            .select('id, created_at, user_list_likes(count)', { count: 'exact' })
            .eq('visibility', 'public')
            .range(offset, offset + scanSize - 1)
        if (type) request = request.eq('list_type', type)
        if (mediaType) request = request.eq('media_type', mediaType)
        if (query.trim()) request = request.ilike('title', `%${query.trim()}%`)
        if (signal) request = request.abortSignal(signal)
        const { data, count, error } = await request
        if (error) throw error
        total = count || 0
        rankedLists.push(...(data || []).map(list => ({
            id: list.id,
            created_at: list.created_at,
            likes: list.user_list_likes?.[0]?.count || 0,
        })))
        if (!data?.length || data.length < scanSize || rankedLists.length >= total) break
    }

    rankedLists.sort((a, b) => b.likes - a.likes || (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0) || String(a.id).localeCompare(String(b.id)))
    const pageIds = rankedLists.slice(from, from + pageSize).map(list => list.id)
    if (!pageIds.length) return { items: [], total }

    let pageRequest = supabase
        .from('user_lists')
        .select('id, title, list_type, media_type, content, user_id, created_at, visibility')
        .eq('visibility', 'public')
        .in('id', pageIds)
    if (signal) pageRequest = pageRequest.abortSignal(signal)
    const { data, error } = await pageRequest
    if (error) throw error
    const rank = new Map(pageIds.map((id, index) => [String(id), index]))
    const pageLists = (data || []).sort((a, b) => rank.get(String(a.id)) - rank.get(String(b.id)))

    const userIds = [...new Set(pageLists.map(list => list.user_id).filter(Boolean))]
    let profiles = []
    if (userIds.length) {
        let profileRequest = supabase.from('profiles').select('id, username, display_name, avatar_url, featured_badge').in('id', userIds)
        if (signal) profileRequest = profileRequest.abortSignal(signal)
        const { data: profileData, error: profileError } = await profileRequest
        if (profileError) throw profileError
        profiles = profileData || []
    }
    const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
    return { items: pageLists.map(list => ({ ...list, author: profileMap.get(list.user_id) || null })), total }
}

/** Public paginated template catalog. Templates stay separate from user-created lists. */
export async function getDiscoverTemplates({ type = null, mediaType = null, query = '', page = 1, pageSize = 24, signal } = {}) {
    const from = (Math.max(1, page) - 1) * pageSize
    let request = supabase
        .from('list_templates')
        .select('*', { count: 'exact' })
        .eq('visibility', 'public')
        .order('uses_count', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
    if (type) request = request.eq('list_type', type)
    if (mediaType) request = request.eq('media_type', mediaType)
    if (query.trim()) request = request.ilike('title', `%${query.trim()}%`)
    if (signal) request = request.abortSignal(signal)
    const { data, count, error } = await request
    if (error) throw error

    const userIds = [...new Set((data || []).map(template => template.user_id).filter(Boolean))]
    let profiles = []
    if (userIds.length) {
        let profileRequest = supabase.from('profiles').select('id, username, display_name, avatar_url, featured_badge').in('id', userIds)
        if (signal) profileRequest = profileRequest.abortSignal(signal)
        const { data: profileData, error: profileError } = await profileRequest
        if (profileError) throw profileError
        profiles = profileData || []
    }
    const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
    return { items: (data || []).map(template => ({ ...template, profiles: profileMap.get(template.user_id) || null })), total: count || 0 }
}

export async function getRandomTemplatePreviewCovers(mediaType, limit = 30) {
    const table = mediaType === 'game' ? 'games' : mediaType === 'anime' ? 'anime' : null;
    if (!table || limit <= 0) return [];

    const { count, error: countError } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .not('cover_url', 'is', null);
    if (countError) throw countError;
    if (!count) return [];

    const sampleSize = Math.min(count, Math.max(30, limit));
    const maxStart = Math.max(0, count - sampleSize);
    const start = Math.floor(Math.random() * (maxStart + 1));
    const { data, error } = await supabase
        .from(table)
        .select('id, cover_url')
        .not('cover_url', 'is', null)
        .order('id', { ascending: true })
        .range(start, start + sampleSize - 1);
    if (error) throw error;

    const covers = (data || []).map(item => item.cover_url).filter(Boolean);
    for (let i = covers.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [covers[i], covers[j]] = [covers[j], covers[i]];
    }
    return covers;
}

export async function getTemplateById(id) {
    const { data, error } = await supabase
        .from('list_templates')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw error
    
    if (data && data.user_id) {
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url, display_name, featured_badge, theme_color').eq('id', data.user_id).single();
        if (profile) data.profiles = profile;
    }
    return data
}

export async function getUserTemplates(userId) {
    const { data, error } = await supabase
        .from('list_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    if (error) throw error
    
    if (data && data.length > 0) {
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url, display_name, featured_badge').eq('id', userId).single();
        if (profile) {
            data.forEach(t => { t.profiles = profile; });
        }
    }
    return data || []
}

export async function createTemplate(templateData) {
    const { data, error } = await supabase
        .from('list_templates')
        .insert(templateData)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function updateTemplate(id, updates) {
    const { data, error } = await supabase
        .from('list_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteTemplate(id) {
    const { error } = await supabase.from('list_templates').delete().eq('id', id)
    if (error) throw error
}

export async function incrementTemplateUses(templateId) {
    await supabase.rpc('increment_template_uses', { template_id: templateId })
}

// --- USER LISTS ---
export async function getUserLists(userId) {
    const { data, error } = await supabase
        .from('user_lists')
        .select('*, template:template_id(title, list_type, media_type)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
}

export async function getListById(id) {
    const { data, error } = await supabase
        .from('user_lists')
        .select('*, template:template_id(id, title, list_type, media_type, type_config)')
        .eq('id', id)
        .single()
    if (error) throw error
    
    if (data && data.user_id) {
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url, display_name, featured_badge, theme_color').eq('id', data.user_id).single();
        if (profile) data.author = profile;
    }
    return data
}

export async function createList(listData) {
    const { data, error } = await supabase
        .from('user_lists')
        .insert(listData)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function updateList(id, updates) {
    const { data, error } = await supabase
        .from('user_lists')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteList(id) {
    const { error } = await supabase.from('user_lists').delete().eq('id', id)
    if (error) throw error
}

// --- LIKES ---
export async function getListLikesCount(listId) {
    const { count, error } = await supabase
        .from('user_list_likes')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', listId)
    if (error) throw error
    return count || 0
}

export async function checkUserListLike(listId, userId) {
    const { data, error } = await supabase
        .from('user_list_likes')
        .select('id')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .maybeSingle()
    if (error) throw error
    return !!data
}

export async function toggleListLike(listId, userId) {
    const isLiked = await checkUserListLike(listId, userId)
    if (isLiked) {
        const { error } = await supabase.from('user_list_likes').delete().eq('list_id', listId).eq('user_id', userId)
        if (error) throw error
        return false
    } else {
        const { error } = await supabase.from('user_list_likes').insert({ list_id: listId, user_id: userId })
        if (error) throw error
        return true
    }
}

// --- CONSTANTS ---
export const DEFAULT_TIER_CONFIG = {
    tierlist: {
        tiers: [
            { id: 'S', label: 'S', color: '#ff7f7f' },
            { id: 'A', label: 'A', color: '#ffbf7f' },
            { id: 'B', label: 'B', color: '#ffff7f' },
            { id: 'C', label: 'C', color: '#7fff7f' },
            { id: 'D', label: 'D', color: '#7fbfff' },
        ]
    },
    ranking: { max_items: 10 },
    grid: {
        cells: [
            { id: 'c1', label: 'Grid 1' },
            { id: 'c2', label: 'Grid 2' },
            { id: 'c3', label: 'Grid 3' },
            { id: 'c4', label: 'Grid 4' },
        ],
        columns: 2
    }
}

export const TIER_COLORS_PALETTE = [
    '#ff7f7f', '#ffbf7f', '#ffff7f', '#bfff7f', '#7fff7f',
    '#7fffbf', '#7fffff', '#7fbfff', '#7f7fff', '#bf7fff',
    '#ff7fff', '#ff7fbf', '#aaaaaa', '#555555', '#14b8a6'
]
