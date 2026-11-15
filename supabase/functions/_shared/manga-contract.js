// MAL v2 adapter contract. Fixtures are tests, never a runtime catalog fallback.
const formats = new Set(['manga', 'one_shot', 'manhwa', 'manhua'])
export const allowedMangaFormats = [...formats]
export function externalMangaId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe external ID')
  const id = String(value ?? '')
  if (!/^[1-9]\d{0,29}$/.test(id)) throw new Error('Invalid external ID')
  return id
}
export function mangaIdentity(value) { return `mal:manga:${externalMangaId(value)}` }
export function parseMangaIdentity(value) {
  if (typeof value !== 'string' || !value.startsWith('mal:manga:')) throw new Error('Invalid manga identity')
  return externalMangaId(value.slice('mal:manga:'.length))
}
export function partialDate(value) {
  if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return { start_date: null, date_precision: null }
  const [year, month, day] = value.split('-').map(Number)
  if (!year || month != null && (month < 1 || month > 12) || day != null && (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())) return { start_date: null, date_precision: null }
  return { start_date: value, date_precision: value.length === 4 ? 'year' : value.length === 7 ? 'month' : 'day' }
}
function text(value, max = 30000) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity]).slice(0, max).trim() : ''
}
function positiveCount(value) { return Number.isInteger(value) && value > 0 ? value : null }
export function mangaCover(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'cdn.myanimelist.net' && !url.username && !url.password && !url.port ? url.href : null
  } catch { return null }
}
export function normalizeMalManga(node, detail = false) {
  if (!node || !formats.has(node.media_type)) return null // Light novels, novels, doujinshi and unknown formats excluded.
  const external_id = externalMangaId(node.id)
  const title = text(node.title, 500)
  if (!title) throw new Error('Missing manga title')
  const row = {
    provider: 'mal', external_type: 'manga', external_id, title,
    alternative_titles: [...new Set([node.alternative_titles?.en, node.alternative_titles?.ja, ...(node.alternative_titles?.synonyms || [])].map(value => text(value, 500)).filter(Boolean))],
    image_url: mangaCover(node.main_picture?.large || node.main_picture?.medium),
    ...partialDate(node.start_date), format: node.media_type,
    source_url: `https://myanimelist.net/manga/${external_id}`,
  }
  if (detail) Object.assign(row, {
    synopsis: text(node.synopsis) || null,
    genres: (node.genres || []).map(genre => text(genre.name, 100)).filter(Boolean),
    authors: (node.authors || []).map(author => ({ name: [author.node?.first_name, author.node?.last_name].map(value => text(value, 100)).filter(Boolean).join(' '), role: text(author.role, 100) || null })).filter(author => author.name),
    publication_status: text(node.status, 100) || null,
    chapters: positiveCount(node.num_chapters), volumes: positiveCount(node.num_volumes),
    external_score: Number.isFinite(node.mean) && node.mean > 0 && node.mean <= 10 ? node.mean : null,
    external_score_scale: 10,
  })
  return row
}
export function validateMangaRequest(body) {
  if (!body || !['search', 'detail'].includes(body.operation)) throw new Error('Invalid operation')
  if (body.operation === 'detail') return { operation: 'detail', externalId: parseMangaIdentity(body.id) }
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const limit = body.limit ?? 20
  const offset = body.offset ?? 0
  if (query.length < 2 || query.length > 100 || !Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(offset) || offset < 0 || offset > 1000) throw new Error('Invalid search')
  return { operation: 'search', query, limit, offset }
}
export function retryAfterSeconds(header, now = Date.now()) {
  if (!header) return 60
  const number = Number(header)
  return Number.isFinite(number) && number >= 0 ? Math.ceil(number) : Math.max(1, Math.ceil((Date.parse(header) - now) / 1000) || 60)
}
