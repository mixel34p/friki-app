import { workHref } from './workTypes'
export const SAVED_LABELS = { work: 'Obra', post: 'Post', list: 'Lista', review: 'Review' }
export function savedHref(entry) {
  if (entry.type === 'work') return workHref(entry.workType, entry.targetId)
  return `/${{post: 'posts', list: 'lists', review: 'reviews'}[entry.type]}/${encodeURIComponent(entry.targetId)}`
}
export function savedTitle(entry) {
  const item = entry.content
  if (!item) return 'Contenido no disponible'
  if (entry.type === 'post') return item.author?.display_name || item.author?.username || 'Publicación'
  if (entry.type === 'review') return item.work?.title || 'Review de una obra'
  return item.title || item.name || 'Sin título'
}
export function listPreviewCovers(content) {
  const result = []
  for (const group of Array.isArray(content) ? [content] : Object.values(content || {})) {
    for (const item of Array.isArray(group) ? group : [group]) {
      const image = item?.image_url || item?.cover_url || item?.cover?.url
      if (image && !result.includes(image)) result.push(image)
      if (result.length === 4) return result
    }
  }
  return result
}
