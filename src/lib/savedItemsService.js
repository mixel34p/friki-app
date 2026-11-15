import { supabase } from './supabase'
import { WORK_TYPES } from './workTypes'

export const SAVED_TYPES = { post: 'post_id', list: 'list_id', review: 'review_id' }
export const savedKey = (type, id) => `${type}:${id}`
export const savedType = row => row.post_id ? 'post' : row.list_id ? 'list' : 'review'
export const savedTarget = row => row[SAVED_TYPES[savedType(row)]]

export async function getSavedIndex(userId, signal) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('saved_items').select('id,post_id,list_id,review_id,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 999).abortSignal(signal)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
export async function saveItem(userId, type, id) {
  const column = SAVED_TYPES[type]
  if (!column) throw new Error('Tipo de guardado no válido')
  const { error } = await supabase.from('saved_items').upsert({ user_id: userId, [column]: id }, { onConflict: `user_id,${column}`, ignoreDuplicates: true })
  if (error) throw error
  const { data, error: readError } = await supabase.from('saved_items').select('id,post_id,list_id,review_id,created_at').eq('user_id', userId).eq(column, id).single()
  if (readError) throw readError
  return data
}
export async function unsaveItem(userId, type, id) {
  const column = SAVED_TYPES[type]
  if (!column) throw new Error('Tipo de guardado no válido')
  const { error } = await supabase.from('saved_items').delete().eq('user_id', userId).eq(column, id)
  if (error) throw error
}

export function mergeSavedItems(rows, wishlist) {
  const entries = rows.map(row => ({ ...row, type: savedType(row), targetId: savedTarget(row), key: savedKey(savedType(row), savedTarget(row)) }))
  const works = new Map()
  for (const work of wishlist || []) {
    if (!WORK_TYPES[work.type] || work.id == null) continue
    const key = `work:${work.type}:${work.id}`
    if (!works.has(key)) works.set(key, { key, type: 'work', targetId: String(work.id), workType: work.type, content: work, created_at: work.added_at || null })
  }
  return [...entries, ...works.values()].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || a.key.localeCompare(b.key))
}

// Fetch only the visible page, through normal RLS. Never retain a private copy of content.
export async function getSavedContent(entries, signal) {
  const byType = { post: 'posts', list: 'user_lists', review: 'library_entries' }
  const content = new Map()
  await Promise.all(Object.entries(byType).map(async ([type, table]) => {
    const ids = entries.filter(entry => entry.type === type).map(entry => entry.targetId)
    if (!ids.length) return
    const { data, error } = await supabase.from(table).select('*').in('id', ids).abortSignal(signal)
    if (error) throw error
    for (const item of data) content.set(savedKey(type, item.id), item)
  }))
  const userIds = [...new Set([...content.values()].map(item => item.user_id).filter(Boolean))]
  const authors = new Map()
  if (userIds.length) {
    const { data, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url,theme_color').in('id', userIds).abortSignal(signal)
    if (error) throw error
    for (const author of data) authors.set(author.id, author)
  }
  const works = new Map()
  await Promise.all(Object.entries(WORK_TYPES).map(async ([type, descriptor]) => {
    const ids = [...new Set(entries.filter(entry => entry.type === 'review').map(entry => content.get(entry.key)).filter(item => item?.work_type === type).map(item => item.work_id))]
    if (!ids.length) return
    const { data, error } = await supabase.from(descriptor.table).select(`id,${descriptor.titleField},${descriptor.imageField}`).in('id', ids).abortSignal(signal)
    if (error) throw error
    for (const work of data) works.set(savedKey(type, work.id), { ...work, title: work[descriptor.titleField], image_url: work[descriptor.imageField] })
  }))
  return entries.map(entry => {
    if (entry.type === 'work') return entry
    const item = content.get(entry.key)
    const available = item && (entry.type !== 'review' || item.review_text?.trim())
    return { ...entry, content: available ? { ...item, author: authors.get(item.user_id), work: works.get(savedKey(item.work_type, item.work_id)) } : null }
  })
}
