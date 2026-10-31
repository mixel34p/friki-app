import { supabase } from './supabase'
import { searchGamesLocal } from './gameService'
import { searchAnimeLocal } from './animeService'

/**
 * Gets personalized works for signed-in users, with popular works as a fallback.
 * Returns an array of up to `limit` items shaped { id, title, image, type, year }.
 */
export async function getSearchRecommendations(limit = 6, userId = null) {
  let results = []
  const seen = new Set()
  let owned = new Set()

  // When signed in, use the user's registered works to build a genre profile.
  if (userId) {
    try {
      const personalized = await getPersonalizedWorks(userId, limit)
      results = personalized.items
      owned = personalized.ownedKeys
      results.forEach(item => seen.add(`${item.type}:${item.id}`))
    } catch (e) {
      console.warn('Error loading personalized works:', e)
    }
  }

  // Fill any remaining slots with generally popular works.
  if (results.length < limit) {
    try {
      const popular = await getPopularWorks(limit * 3)
      for (const item of popular) {
        const key = `${item.type}:${item.id}`
        if (!seen.has(key) && !owned.has(key)) {
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
        if (!seen.has(key) && !owned.has(key)) {
          seen.add(key)
          results.push(item)
          if (results.length >= limit) break
        }
      }
    } catch {}
  }

  return results.slice(0, limit)
}

async function getPersonalizedWorks(userId, limit) {
  const { data: entries, error } = await supabase
    .from('library_entries')
    .select('work_id, work_type, rating')
    .eq('user_id', userId)
    .in('work_type', ['game', 'anime'])
    .limit(500)

  if (error) throw error
  if (!entries?.length) return { items: [], ownedKeys: new Set() }
  const ownedKeys = new Set(entries.map(entry => `${entry.work_type}:${entry.work_id}`))

  const registeredIds = {
    game: [...new Set(entries.filter(e => e.work_type === 'game').map(e => String(e.work_id)))],
    anime: [...new Set(entries.filter(e => e.work_type === 'anime').map(e => String(e.work_id)))],
  }
  const [gameSeeds, animeSeeds] = await Promise.all([
    registeredIds.game.length
      ? supabase.from('games').select('id, genres').in('id', registeredIds.game)
      : Promise.resolve({ data: [] }),
    registeredIds.anime.length
      ? supabase.from('anime').select('id, genres').in('id', registeredIds.anime)
      : Promise.resolve({ data: [] }),
  ])

  const genreWeights = new Map()
  const seedByType = [
    ...(gameSeeds.data || []).map(work => ({ ...work, type: 'game' })),
    ...(animeSeeds.data || []).map(work => ({ ...work, type: 'anime' })),
  ]
  for (const seed of seedByType) {
    const entry = entries.find(item => item.work_type === seed.type && String(item.work_id) === String(seed.id))
    const ratingWeight = entry?.rating ? Math.max(0.75, Math.min(Number(entry.rating) / 3, 1.5)) : 1
    for (const genre of normalizeGenres(seed.genres)) {
      genreWeights.set(genre, (genreWeights.get(genre) || 0) + ratingWeight)
    }
  }
  if (genreWeights.size === 0) return { items: [], ownedKeys }

  // Start from frequently registered works, then rank them by how well their
  // genres match this user's own library.
  const { data: stats, error: statsError } = await supabase
    .from('library_entries')
    .select('work_id, work_type')
    .in('work_type', ['game', 'anime'])
    .limit(3000)
  if (statsError) throw statsError

  const popularity = new Map()
  for (const row of stats || []) {
    const key = `${row.work_type}:${row.work_id}`
    popularity.set(key, (popularity.get(key) || 0) + 1)
  }
  const owned = new Set(entries.map(entry => `${entry.work_type}:${entry.work_id}`))
  const candidateIds = { game: [], anime: [] }
  for (const [key] of [...popularity.entries()].sort((a, b) => b[1] - a[1])) {
    const [type, id] = key.split(':')
    if (!owned.has(key) && candidateIds[type].length < limit * 8) candidateIds[type].push(id)
  }

  const [gameRows, animeRows] = await Promise.all([
    candidateIds.game.length
      ? supabase.from('games').select('id, name, cover_url, genres, first_release_date').in('id', candidateIds.game)
      : Promise.resolve({ data: [] }),
    candidateIds.anime.length
      ? supabase.from('anime').select('id, title, image_url, genres, start_date').in('id', candidateIds.anime)
      : Promise.resolve({ data: [] }),
  ])

  const candidates = [
    ...(gameRows.data || []).map(work => ({ ...work, type: 'game', title: work.name, image: work.cover_url, year: work.first_release_date ? new Date(work.first_release_date * 1000).getFullYear() : null })),
    ...(animeRows.data || []).map(work => ({ ...work, type: 'anime', title: work.title, image: work.image_url, year: work.start_date ? String(work.start_date).slice(0, 4) : null })),
  ]
  const maxGenreWeight = Math.max(...genreWeights.values())
  const items = candidates
    .map(work => {
      const genres = normalizeGenres(work.genres)
      const genreScore = genres.length
        ? genres.reduce((sum, genre) => sum + (genreWeights.get(genre) || 0), 0) / genres.length / maxGenreWeight
        : 0
      const popularityScore = Math.log1p(popularity.get(`${work.type}:${work.id}`) || 0) / Math.log(3001)
      return { ...work, genres, popularity: popularity.get(`${work.type}:${work.id}`) || 0, _score: genreScore * 0.85 + popularityScore * 0.15 }
    })
    .filter(work => work._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...work }) => work)
  return { items, ownedKeys }
}

function normalizeGenres(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(genre => typeof genre === 'string' ? genre : genre?.name || genre?.name_en || genre?.name_es)
    .filter(Boolean)
    .map(genre => genre.trim().toLocaleLowerCase())
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
