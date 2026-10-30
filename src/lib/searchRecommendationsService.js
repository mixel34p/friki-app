import { supabase } from './supabase'
import { searchGamesLocal } from './gameService'
import { searchAnimeLocal } from './animeService'

/**
 * Gets personalised work recommendations for a user based on their library entries.
 * If there are fewer than `limit` personalised works, it fills the remainder with popular works.
 * Returns an array of up to `limit` items shaped { id, title, image, type, year }.
 */
export async function getSearchRecommendations(userId, limit = 6) {
  let results = []
  const seen = new Set()

  if (userId) {
    try {
      const recs = await getPersonalisedRecommendations(userId, limit)
      for (const item of recs) {
        const key = `${item.type}:${item.id}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push(item)
        }
      }
    } catch (e) {
      console.warn('Error loading personalised recommendations:', e)
    }
  }

  // If we don't have enough recommendations, fill the rest with popular works
  if (results.length < limit) {
    try {
      const popular = await getPopularWorks(limit * 3)
      for (const item of popular) {
        const key = `${item.type}:${item.id}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push(item)
          if (results.length >= limit) break
        }
      }
    } catch (e) {
      console.warn('Error loading popular works:', e)
    }
  }

  // If still completely empty or less than 4, fallback to search seeds
  if (results.length < 4) {
    try {
      const seeds = await getFallbackSeeds(limit)
      for (const item of seeds) {
        const key = `${item.type}:${item.id}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push(item)
          if (results.length >= limit) break
        }
      }
    } catch {}
  }

  return results.slice(0, limit)
}

async function getPersonalisedRecommendations(userId, limit) {
  // Fetch user's top-rated library entries (rating >= 3)
  const { data: entries, error } = await supabase
    .from('library_entries')
    .select('work_id, work_type, rating')
    .eq('user_id', userId)
    .gte('rating', 3)
    .order('rating', { ascending: false })
    .limit(40)

  if (error || !entries?.length) return []

  const userWorkIds = new Set(entries.map(e => `${e.work_type}:${e.work_id}`))
  const topEntries = entries.slice(0, 10)
  const seededIds = topEntries.map(e => e.work_id)

  const [gameRows, animeRows] = await Promise.all([
    supabase
      .from('games')
      .select('id, name, cover_url, genres, first_release_date')
      .in('id', seededIds.filter(Boolean))
      .limit(20),
    supabase
      .from('anime')
      .select('id, title, image_url, genres, start_date')
      .in('id', seededIds.filter(Boolean))
      .limit(20),
  ])

  const genreFreq = {}
  const addGenres = (genres, weight = 1) => {
    if (!Array.isArray(genres)) return
    for (const g of genres) {
      const name = typeof g === 'string' ? g : g?.name || ''
      if (name) genreFreq[name] = (genreFreq[name] || 0) + weight
    }
  }
  for (const row of gameRows.data || []) addGenres(row.genres, 2)
  for (const row of animeRows.data || []) addGenres(row.genres, 2)

  const popular = await getPopularWorks(limit * 4)

  const scored = popular.map(work => {
    if (userWorkIds.has(`${work.type}:${String(work.id)}`)) return { work, score: -1 }
    const genres = Array.isArray(work.genres) ? work.genres : []
    const genreScore = genres.reduce((sum, g) => {
      const name = typeof g === 'string' ? g : g?.name || ''
      return sum + (genreFreq[name] || 0)
    }, 0)
    return { work, score: genreScore }
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score)

  return scored.map(item => item.work).slice(0, limit)
}

async function getPopularWorks(limit) {
  const { data: stats } = await supabase
    .from('library_entries')
    .select('work_id, work_type')
    .limit(3000)

  const counts = {}
  const typemap = {}
  for (const row of stats || []) {
    const key = `${row.work_type}:${row.work_id}`
    counts[key] = (counts[key] || 0) + 1
    typemap[key] = row.work_type
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 3)

  const gameIds = sorted.filter(([k]) => typemap[k] === 'game').slice(0, limit).map(([k]) => k.split(':')[1])
  const animeIds = sorted.filter(([k]) => typemap[k] === 'anime').slice(0, limit).map(([k]) => k.split(':')[1])

  const [gameRows, animeRows] = await Promise.all([
    gameIds.length
      ? supabase.from('games').select('id, name, cover_url, genres, first_release_date').in('id', gameIds).limit(limit)
      : Promise.resolve({ data: [] }),
    animeIds.length
      ? supabase.from('anime').select('id, title, image_url, genres, start_date').in('id', animeIds).limit(limit)
      : Promise.resolve({ data: [] }),
  ])

  const games = (gameRows.data || []).map(g => ({
    id: g.id,
    title: g.name,
    image: g.cover_url,
    type: 'game',
    genres: g.genres,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
    popularity: counts[`game:${g.id}`] || 0,
  }))
  const anime = (animeRows.data || []).map(a => ({
    id: a.id,
    title: a.title,
    image: a.image_url,
    type: 'anime',
    genres: a.genres,
    year: a.start_date ? String(a.start_date).slice(0, 4) : null,
    popularity: counts[`anime:${a.id}`] || 0,
  }))

  if (games.length || anime.length) {
    return [...games, ...anime]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit)
  }

  return getFallbackSeeds(limit)
}

async function getFallbackSeeds(limit = 6) {
  try {
    const [mc, botw, elden, persona, naruto, aot, frieren, onePiece] = await Promise.allSettled([
      searchGamesLocal('Minecraft', 2),
      searchGamesLocal('The Legend of Zelda', 2),
      searchGamesLocal('Elden Ring', 2),
      searchGamesLocal('Persona 5', 2),
      searchAnimeLocal('Naruto', 2),
      searchAnimeLocal('Attack on Titan', 2),
      searchAnimeLocal('Sousou no Frieren', 2),
      searchAnimeLocal('One Piece', 2),
    ])

    const fallback = []
    const pick = (res, type) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value[0]) {
        fallback.push({ ...res.value[0], mediaType: type })
      }
    }
    pick(mc, 'game')
    pick(naruto, 'anime')
    pick(botw, 'game')
    pick(aot, 'anime')
    pick(elden, 'game')
    pick(frieren, 'anime')
    pick(persona, 'game')
    pick(onePiece, 'anime')

    return fallback.map(w => ({
      id: w.id,
      title: w.title || w.name,
      image: w.cover_url || w.image_url,
      type: w.mediaType || (w.media_type === 'anime' ? 'anime' : 'game'),
      genres: w.genres || [],
      year: null,
      popularity: 0,
    })).slice(0, limit)
  } catch {
    return []
  }
}
