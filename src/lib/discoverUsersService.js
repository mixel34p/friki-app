import { supabase } from './supabase'

const PAGE_SIZE = 500
const WORK_ID_BATCH_SIZE = 100

async function fetchAllRows(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

/** List discoverable profiles ordered by the number of registered/rated works in common. */
export async function getUsersByCommonWorks(currentUserId) {
  const [currentEntries, profiles] = await Promise.all([
    fetchAllRows(() => supabase
      .from('library_entries')
      .select('work_id, work_type')
      .eq('user_id', currentUserId)
      .order('id', { ascending: true })),
    fetchAllRows(() => supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, theme_color')
      .neq('id', currentUserId)
      .order('id', { ascending: true })),
  ])

  const candidates = (profiles || [])
    .map(profile => ({ ...profile, user_id: profile.id }))
    .filter(profile => profile.user_id)

  const workKeys = new Set((currentEntries || [])
    .filter(entry => entry.work_id != null && entry.work_type)
    .map(entry => `${entry.work_type}:${String(entry.work_id)}`))
  const workIdsByType = new Map()
  workKeys.forEach(key => {
    const separator = key.indexOf(':')
    const type = key.slice(0, separator)
    const id = key.slice(separator + 1)
    if (!workIdsByType.has(type)) workIdsByType.set(type, [])
    workIdsByType.get(type).push(id)
  })

  const commonCounts = new Map()
  for (const [workType, workIds] of workIdsByType) {
    for (let offset = 0; offset < workIds.length; offset += WORK_ID_BATCH_SIZE) {
      const batch = workIds.slice(offset, offset + WORK_ID_BATCH_SIZE)
      const entries = await fetchAllRows(() => supabase
        .from('library_entries')
        .select('user_id, work_id, work_type')
        .eq('work_type', workType)
        .in('work_id', batch))

      const counted = new Set()
      entries.forEach(entry => {
        if (!entry.user_id || entry.user_id === currentUserId) return
        const key = `${entry.user_id}:${entry.work_type}:${String(entry.work_id)}`
        if (counted.has(key)) return
        counted.add(key)
        commonCounts.set(entry.user_id, (commonCounts.get(entry.user_id) || 0) + 1)
      })
    }
  }

  return candidates
    .map(profile => ({ ...profile, commonWorks: commonCounts.get(profile.user_id) || 0 }))
    .sort((a, b) => b.commonWorks - a.commonWorks
      || (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '', 'es'))
}
