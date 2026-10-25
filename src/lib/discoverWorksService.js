import { supabase } from './supabase'

const PAGE_SIZE = 1000

async function fetchAll(queryFactory) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryFactory().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

function genreNames(value) {
  if (!Array.isArray(value)) return []
  return value.map(genre => typeof genre === 'string' ? genre : genre?.name || genre?.name_en || genre?.name_es).filter(Boolean)
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function catalogRating(work, mediaType) {
  const value = finiteNumber(work.score ?? work.rating ?? work.averageScore)
  if (!value) return null
  const ratingOutOfFive = mediaType === 'anime' && work.score !== undefined
    ? value / 2
    : value > 10 ? value / 20 : value / 2
  return Math.min(5, ratingOutOfFive)
}

function catalogPopularity(work) {
  return Math.max(
    finiteNumber(work.total_rating_count),
    finiteNumber(work.rating_count),
    finiteNumber(work.scored_by),
    finiteNumber(work.members),
    finiteNumber(work.favorites),
    finiteNumber(work.user_count),
    finiteNumber(work.registrations_count),
  )
}

/** Loads the catalog and registration ratings used by Discover. */
export async function getDiscoverWorks(mediaType) {
  if (!['anime', 'game'].includes(mediaType)) throw new Error('Tipo de obra no válido')
  const table = mediaType === 'game' ? 'games' : 'anime'
  const titleField = mediaType === 'game' ? 'name' : 'title'
  const imageField = mediaType === 'game' ? 'cover_url' : 'image_url'
  const [catalog, entries] = await Promise.all([
    fetchAll(() => supabase.from(table).select('*').order(titleField, { ascending: true }).order('id', { ascending: true })),
    fetchAll(() => supabase.from('library_entries').select('id, work_id, rating').eq('work_type', mediaType).order('id', { ascending: true })),
  ])

  const stats = new Map()
  for (const entry of entries) {
    const key = String(entry.work_id)
    const item = stats.get(key) || { registrations: 0, ratingTotal: 0, ratingCount: 0 }
    item.registrations += 1
    const rating = Number(entry.rating)
    if (entry.rating !== null && entry.rating !== '' && Number.isFinite(rating)) {
      item.ratingTotal += rating
      item.ratingCount += 1
    }
    stats.set(key, item)
  }

  const works = catalog.map(work => {
    const score = stats.get(String(work.id)) || { registrations: 0, ratingTotal: 0, ratingCount: 0 }
    return {
      ...work,
      title: work[titleField],
      image: work[imageField] || work.cover_url || work.image_url,
      type: mediaType,
      genres: genreNames(work.genres),
      registrations: score.registrations,
      userRating: score.ratingCount ? score.ratingTotal / score.ratingCount : null,
      ratingCount: score.ratingCount,
      databaseRating: catalogRating(work, mediaType),
      databasePopularity: catalogPopularity(work),
    }
  })

  return works
}
