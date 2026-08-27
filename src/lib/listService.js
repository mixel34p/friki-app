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

export async function getTemplateById(id) {
    const { data, error } = await supabase
        .from('list_templates')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw error
    
    if (data && data.user_id) {
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url, display_name, featured_badge').eq('id', data.user_id).single();
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
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url, display_name, featured_badge').eq('id', data.user_id).single();
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
