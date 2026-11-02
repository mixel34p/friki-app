import { supabase } from './supabase'

export async function getCustomItemGroups(userId) {
    if (!userId) {
        const { data, error } = await supabase.from('custom_item_groups')
            .select('*').eq('visibility', 'public').order('updated_at', { ascending: false })
        if (error) throw error
        return { mine: [], public: data || [], saved: [] }
    }

    const [mineResult, publicResult, savedResult] = await Promise.all([
        supabase.from('custom_item_groups').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
        supabase.from('custom_item_groups').select('*').eq('visibility', 'public').neq('owner_id', userId).order('updated_at', { ascending: false }),
        supabase.from('saved_custom_item_groups').select('group:custom_item_groups(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    ])
    if (mineResult.error) throw mineResult.error
    if (publicResult.error) throw publicResult.error
    if (savedResult.error) throw savedResult.error

    const saved = (savedResult.data || []).map(row => row.group).filter(Boolean)
    const savedIds = new Set(saved.map(group => String(group.id)))
    return {
        mine: mineResult.data || [],
        public: (publicResult.data || []).map(group => ({ ...group, is_saved: savedIds.has(String(group.id)) })),
        saved,
    }
}

export async function getUserCustomItemGroups(userId) {
    const { data, error } = await supabase.from('custom_item_groups').select('*')
        .eq('owner_id', userId).order('updated_at', { ascending: false })
    if (error) throw error
    return data || []
}

export async function getCustomItemGroupById(groupId) {
    const { data, error } = await supabase.from('custom_item_groups').select('*').eq('id', groupId).single()
    if (error) throw error
    if (data?.owner_id) {
        const { data: owner } = await supabase.from('profiles')
            .select('username, display_name, avatar_url, theme_color')
            .eq('id', data.owner_id).maybeSingle()
        data.owner = owner || null
    }
    return data
}

export async function createCustomItemGroup(group) {
    const { data, error } = await supabase.from('custom_item_groups').insert(group).select('*').single()
    if (error) throw error
    return data
}

export async function updateCustomItemGroup(id, updates, ownerId) {
    const { data, error } = await supabase.from('custom_item_groups')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).eq('owner_id', ownerId).select('*').single()
    if (error) throw error
    return data
}

export async function deleteCustomItemGroup(id, ownerId) {
    const { error } = await supabase.from('custom_item_groups').delete().eq('id', id).eq('owner_id', ownerId)
    if (error) throw error
}

export async function saveCustomItemGroup(groupId, userId) {
    const { error } = await supabase.from('saved_custom_item_groups').upsert(
        { group_id: groupId, user_id: userId }, { onConflict: 'user_id,group_id', ignoreDuplicates: true }
    )
    if (error) throw error
}

export async function unsaveCustomItemGroup(groupId, userId) {
    const { error } = await supabase.from('saved_custom_item_groups').delete()
        .eq('group_id', groupId).eq('user_id', userId)
    if (error) throw error
}
