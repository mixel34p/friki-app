import { supabase } from './supabase'

const STATUS_FIELDS = 'user_id, status_type, content, song, created_at, expires_at'

export async function getActiveStatuses(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return []
  const { data, error } = await supabase.from('user_statuses')
    .select(STATUS_FIELDS).in('user_id', ids).gt('expires_at', new Date().toISOString())
  if (error) throw error
  return data || []
}

export async function saveUserStatus(userId, status) {
  const now = new Date()
  const row = {
    user_id: userId,
    status_type: status.type,
    content: status.type === 'text' ? String(status.content || '').trim() : null,
    song: status.type === 'song' ? status.song : null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
  const { data, error } = await supabase.from('user_statuses')
    .upsert(row, { onConflict: 'user_id' }).select(STATUS_FIELDS).single()
  if (error) throw error
  return data
}

export async function deleteUserStatus(userId) {
  const { error } = await supabase.from('user_statuses').delete().eq('user_id', userId)
  if (error) throw error
}
