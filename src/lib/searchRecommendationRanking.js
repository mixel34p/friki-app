import { normalizeCatalogWork, validateWorkIdentity } from './workTypes.js'

const catalogs = {
  game: { table: 'games', fields: 'id,name,cover_url,genres,release_date,rating', score: 'rating', favorites: 'favorite_games' },
  anime: { table: 'anime', fields: 'id,title,image_url,genres,start_date,score', score: 'score', favorites: 'favorite_animes' },
  manga: { table: 'manga', fields: 'id,title,image_url,genres,start_date,external_score', score: 'external_score', favorites: 'favorite_manga' },
}
const types = Object.keys(catalogs)
const key = work => `${work.type || work.work_type}:${work.type ? work.id : work.work_id}`
const canonicalGenre = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const genres = work => [...new Set((work.genres || []).map(value => typeof value === 'string' ? value : value?.name || '').filter(Boolean).map(canonicalGenre))]
const quality = work => Math.max(0, Math.min(1, Number(work[catalogs[work.type].score] || 0) / (work.type === 'manga' ? 10 : 100)))

function weight(entry) {
  if (entry.favorite) return 3
  if (entry.rating == null || entry.rating === '') return .25
  const rating = Number(entry.rating)
  if (!Number.isFinite(rating)) return 0
  return rating >= 4 ? rating - 2.5 : rating >= 3 ? .5 : -1.5
}

/** Similarity to positively rated works comes first; low ratings penalize genres. */
export function rankSearchCandidates(candidates, seeds, excluded = new Set(), limit = 6) {
  const positive = seeds.filter(seed => weight(seed) > 0 && genres(seed).length)
  const negative = seeds.filter(seed => weight(seed) < 0 && genres(seed).length)
  const unique = new Map()
  for (const work of candidates) {
    if (!excluded.has(key(work)) && !unique.has(key(work))) unique.set(key(work), work)
  }
  const scored = [...unique.values()].map(work => {
    const candidateGenres = new Set(genres(work))
    const similarity = seed => {
      const seedGenres = genres(seed)
      const overlap = seedGenres.filter(genre => candidateGenres.has(genre)).length
      return overlap / Math.max(1, Math.sqrt(seedGenres.length * candidateGenres.size))
    }
    const matches = positive.map(seed => similarity(seed) * weight(seed) * (seed.type === work.type ? 1 : .7))
    const totalWeight = positive.reduce((sum, seed) => sum + weight(seed), 0) || 1
    const match = matches.length ? Math.max(...matches) + matches.reduce((a, b) => a + b, 0) / totalWeight : 0
    const penalty = negative.length ? Math.max(...negative.map(seed => similarity(seed) * .6)) : 0
    return { ...work, _match: match > 0 ? Math.max(0, match - penalty) : 0 }
  })
  const sort = (a, b) => b._match - a._match || quality(b) - quality(a) || key(a).localeCompare(key(b))
  const matched = scored.filter(work => work._match > 0).sort(sort)
  const fallback = scored.filter(work => work._match === 0).sort(sort)
  const selected = []
  const counts = Object.fromEntries(types.map(type => [type, 0]))
  function take(pool) {
    const cap = Math.ceil(limit / Math.max(1, new Set(pool.map(work => work.type)).size))
    while (pool.length && selected.length < limit) {
      // Balance media when other relevant matches exist; never replace a match with an unrelated work.
      const availableTypes = new Set(pool.map(work => work.type))
      const index = pool.findIndex(work => counts[work.type] < cap || availableTypes.size === 1)
      const [work] = pool.splice(index < 0 ? 0 : index, 1)
      selected.push(work)
      counts[work.type]++
    }
  }
  take(matched)
  take(fallback)
  const personalized = selected.some(work => work._match > 0)
  return Object.assign(selected.map(({ _match, ...work }) => ({ ...work, recommendationKind: _match > 0 ? 'taste' : 'discovery' })), { personalized })
}

function favoriteIds(profile, type) {
  const source = Array.isArray(profile?.favorite_works) && profile.favorite_works.length > 0
    ? profile.favorite_works.filter(item => item?.type === type)
    : profile?.[catalogs[type].favorites] || []
  return source.flatMap(value => {
    try { return [validateWorkIdentity(type, value?.id ?? value)] } catch { return [] }
  }).slice(0, 4)
}

function normalized(type, rows) {
  return (rows || []).map(row => ({ ...normalizeCatalogWork(type, row), year: String(row.release_date || row.start_date || '').slice(0, 4) || null }))
}

/** Bounded local reads with the caller's normal Supabase/RLS context, without provider imports. */
export async function loadSearchRecommendations(client, requestedLimit = 6, userId = null) {
  const limit = Math.max(1, Math.min(30, Math.floor(Number(requestedLimit) || 6)))
  let entries = [], profile = null
  if (userId) {
    const [logs, favorites] = await Promise.all([
      client.from('library_entries').select('work_id,work_type,rating').eq('user_id', userId).in('work_type', types).order('created_at', { ascending: false }).order('id').limit(500),
      client.from('profiles').select('favorite_works,favorite_games,favorite_animes,favorite_manga').eq('id', userId).maybeSingle(),
    ])
    if (!logs.error) entries = logs.data || []
    if (!favorites.error) profile = favorites.data
  }
  const excluded = new Set(entries.map(key))
  const seedResults = await Promise.allSettled(types.map(async type => {
    const favorites = favoriteIds(profile, type)
    favorites.forEach(id => excluded.add(`${type}:${id}`))
    const ids = [...new Set([...favorites, ...entries.filter(entry => entry.work_type === type).map(entry => String(entry.work_id))])]
    if (!ids.length) return []
    const { data, error } = await client.from(catalogs[type].table).select(catalogs[type].fields).in('id', ids).limit(504)
    if (error) throw error
    return normalized(type, data).map(work => ({ ...work, rating: entries.find(entry => entry.work_type === type && String(entry.work_id) === String(work.id))?.rating, favorite: favorites.includes(String(work.id)) }))
  }))
  const seeds = seedResults.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  // Preserve provider spellings for Postgres array overlap; ranking is case-insensitive.
  const queryGenres = [...new Set(seeds.filter(seed => weight(seed) > 0).sort((a, b) => weight(b) - weight(a)).flatMap(seed => seed.genres || []))].slice(0, 24)
  const candidateResults = await Promise.allSettled(types.map(async type => {
    const descriptor = catalogs[type]
    const base = () => client.from(descriptor.table).select(descriptor.fields).order(descriptor.score, { ascending: false, nullsFirst: false }).order('id')
    const [matches, discovery] = await Promise.all([
      queryGenres.length ? base().overlaps('genres', queryGenres).limit(60) : Promise.resolve({ data: [] }),
      base().limit(Math.max(12, limit * 2)),
    ])
    if (matches.error && discovery.error) throw matches.error
    const candidates = normalized(type, [...(matches.error ? [] : matches.data || []), ...(discovery.error ? [] : discovery.data || [])])
    if (userId && candidates.length) {
      // Verify exact candidates too, excluding even works beyond the 500 taste seeds.
      const { data, error } = await client.from('library_entries').select('work_id,work_type').eq('user_id', userId).eq('work_type', type).in('work_id', [...new Set(candidates.map(work => String(work.id)))]).limit(120)
      if (error) throw error
      for (const entry of data || []) excluded.add(key(entry))
    }
    return candidates
  }))
  const candidates = candidateResults.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  return rankSearchCandidates(candidates, seeds, excluded, limit)
}
