/** Catalog metadata is deliberately independent of services to avoid import cycles. */
export const WORK_TYPES = Object.freeze({
  game: { label: 'Videojuego', plural: 'Videojuegos', icon: '🎮', route: 'game', table: 'games', titleField: 'name', imageField: 'cover_url', creatorLabel: 'Desarrollo', provider: 'IGDB', sourceUrl: 'https://www.igdb.com' },
  anime: { label: 'Anime', plural: 'Anime', icon: '📺', route: 'anime', table: 'anime', titleField: 'title', imageField: 'image_url', creatorLabel: 'Estudio', provider: 'AniList', sourceUrl: 'https://anilist.co' },
  manga: { label: 'Manga', plural: 'Manga', icon: '📖', route: 'manga', table: 'manga', titleField: 'title', imageField: 'image_url', creatorLabel: 'Autoría', provider: 'MyAnimeList', sourceUrl: 'https://myanimelist.net' },
})

export const WORK_TYPE_IDS = Object.keys(WORK_TYPES)
export function workType(type) {
  const value = WORK_TYPES[type]
  if (!value) throw new Error('Tipo de obra no válido')
  return value
}
export function workKey(type, id) { return `${workType(type).route}:${String(id)}` }
export function workHref(type, id) {
  const descriptor = workType(type)
  const value = type === 'manga' ? String(id).replace(/^mal:manga:(\d+)$/, '$1') : String(id)
  return `/${descriptor.route}/${encodeURIComponent(value)}`
}
export function validateWorkIdentity(type, id) {
  workType(type)
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error('Identificador de obra no válido')
  const value = String(id)
  if (!value || value.length > 160 || (type === 'manga' ? !/^mal:manga:[1-9]\d{0,29}$/.test(value) : !/^[1-9]\d*$/.test(value))) throw new Error('Identificador de obra no válido')
  return value
}

export function normalizeCatalogWork(type, row) {
  const descriptor = workType(type)
  return { ...row, type, media_type: type, title: row[descriptor.titleField], name: row[descriptor.titleField], image: row[descriptor.imageField], image_url: row[descriptor.imageField], cover_url: row[descriptor.imageField] }
}
