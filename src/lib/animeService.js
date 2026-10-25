/**
 * Anime Service - Orchestrates local DB cache + Jikan API (MyAnimeList)
 */

import { supabase } from './supabase'

/**
 * Anime Service - Orchestrates local DB cache + AniList GraphQL API
 */

const ANILIST_API_URL = 'https://graphql.anilist.co'

/**
 * Search anime (DB first, then AniList)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of anime objects
 */
export async function searchAnime(query, limit = 20, { signal } = {}) {
    if (!query || query.length < 2) return []

    try {
        // 1. Search local DB first
        const { data: localAnime, error } = await supabase
            .from('anime')
            .select('*')
            .ilike('title', `%${query}%`)
            .limit(limit)
            .abortSignal(signal)

        if (error) {
            console.error('Local DB anime search error:', error)
        }

        const localResults = (localAnime || []).map(formatAnime)

        // 2. If we have enough local results, return them
        if (localResults.length >= limit / 2) {
            return localResults.slice(0, limit)
        }

        // 3. Fetch from AniList GraphQL API
        const graphqlQuery = `
        query ($search: String, $limit: Int) {
          Page (page: 1, perPage: $limit) {
            media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              title {
                romaji
                english
              }
              coverImage {
                extraLarge
              }
              bannerImage
              startDate {
                year
                month
                day
              }
              averageScore
              description
              genres
            }
          }
        }
        `

        const response = await fetch(ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            signal,
            body: JSON.stringify({
                query: graphqlQuery,
                variables: { search: query, limit: limit }
            })
        })

        const { data } = await response.json()
        const anilistResults = (data?.Page?.media || []).map(anilistToStandard)

        // 4. Import new anime to local DB
        const localIds = new Set(localResults.map(a => a.id))
        const newAnime = anilistResults.filter(a => !localIds.has(a.id))

        if (newAnime.length > 0) {
            importAnimeToDb(newAnime) // Fire and forget
        }

        // 5. Merge
        const allAnime = [...localResults]
        for (const anime of anilistResults) {
            if (!localIds.has(anime.id)) {
                allAnime.push(anime)
            }
        }

        return allAnime.slice(0, limit)

    } catch (error) {
        console.error('searchAnime error:', error)
        return []
    }
}

/**
 * Get anime by ID
 * @param {number} id - AniList ID
 */
export async function getAnimeById(id) {
    try {
        // 1. Check local DB
        const { data: localAnime } = await supabase
            .from('anime')
            .select('*')
            .eq('id', id)
            .single()

        const hasBanner = localAnime?.banner_url !== null;
        const hasStudios = localAnime?.studios !== null;

        if (localAnime && hasBanner && hasStudios) {
            return formatAnime(localAnime)
        }

        // 2. Fetch from AniList
        const graphqlQuery = `
        query ($id: Int) {
          Media (id: $id, type: ANIME) {
            id
            title {
              romaji
              english
            }
            coverImage {
              extraLarge
            }
            bannerImage
            status
            episodes
            studios(isMain: true) { nodes { name } }
            startDate {
              year
              month
              day
            }
            averageScore
            description
            genres
          }
        }
        `

        const response = await fetch(ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: graphqlQuery,
                variables: { id: parseInt(id) }
            })
        })

        const { data } = await response.json()

        if (data?.Media) {
            const anime = anilistToStandard(data.Media)
            importAnimeToDb([anime])
            return anime
        }

        return null
    } catch (error) {
        console.error('getAnimeById error:', error)
        return null
    }
}

/**
 * Get similar anime from AniList recommendations
 * @param {number} id - AniList ID
 * @param {number} limit
 */
export async function getSimilarAnime(id, limit = 10) {
    try {
        const graphqlQuery = `
        query ($id: Int) {
          Media (id: $id, type: ANIME) {
            recommendations (sort: RATING_DESC, perPage: ${limit}) {
              nodes {
                mediaRecommendation {
                  id
                  title {
                    romaji
                    english
                  }
                  coverImage {
                    extraLarge
                  }
                  bannerImage
                  averageScore
                  genres
                }
              }
            }
          }
        }
        `

        const response = await fetch(ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: graphqlQuery,
                variables: { id: parseInt(id) }
            })
        })

        const { data } = await response.json()
        const nodes = data?.Media?.recommendations?.nodes || []
        const mapped = nodes.filter(n => n.mediaRecommendation).map(n => ({
            id: n.mediaRecommendation.id,
            name: n.mediaRecommendation.title.romaji || n.mediaRecommendation.title.english,
            title: n.mediaRecommendation.title.romaji || n.mediaRecommendation.title.english,
            image_url: n.mediaRecommendation.coverImage?.extraLarge,
            cover_url: n.mediaRecommendation.coverImage?.extraLarge,
            banner_url: n.mediaRecommendation.bannerImage || null,
            genres: n.mediaRecommendation.genres || [],
            anilist_score: n.mediaRecommendation.averageScore || null,
            media_type: 'anime'
        }))
        
        if (mapped.length > 0) {
            importAnimeToDb(mapped)
        }
        
        return mapped
    } catch (error) {
        console.error('getSimilarAnime error:', error)
        return []
    }
}

/**
 * Helper to convert AniList API response to our standard format
 */
function anilistToStandard(media) {
    const title = media.title?.english || media.title?.romaji || 'Unknown Title'
    const dateStr = (media.startDate?.year && media.startDate?.month && media.startDate?.day) 
        ? `${media.startDate.year}-${String(media.startDate.month).padStart(2, '0')}-${String(media.startDate.day).padStart(2, '0')}` 
        : null

    return {
        id: media.id,
        name: title,
        title: title,
        image_url: media.coverImage?.extraLarge,
        cover_url: media.coverImage?.extraLarge,
        banner_url: media.bannerImage || null,
        release_date: dateStr,
        rating: media.averageScore || null, // AniList is already 0-100! Matches IGDB perfectly
        summary: media.description?.replace(/<[^>]*>?/gm, ''), // Basic HTML tag strip since AniList returns HTML descriptions
        genres: media.genres || [],
        status: media.status || null,
        episodes: media.episodes || null,
        studios: media.studios?.nodes?.map(n => n.name) || [],
        media_type: 'anime'
    }
}

/**
 * Format DB object to standard
 */
function formatAnime(dbAnime) {
    return {
        id: dbAnime.id,
        name: dbAnime.title,
        title: dbAnime.title,
        image_url: dbAnime.image_url,
        cover_url: dbAnime.image_url,
        banner_url: dbAnime.banner_url || null,
        release_date: dbAnime.start_date,
        rating: dbAnime.score ? dbAnime.score * 10 : null,
        summary: dbAnime.synopsis,
        genres: dbAnime.genres || [],
        status: dbAnime.status || null,
        episodes: dbAnime.episodes || null,
        studios: dbAnime.studios || [],
        media_type: 'anime'
    }
}

async function importAnimeToDb(animeList) {
    if (!animeList || animeList.length === 0) return

    try {
        const ids = animeList.map(a => a.id)
        const { error } = await supabase.functions.invoke('secure-sync', {
            body: { type: 'anime', ids }
        })
        if (error) console.error('Import anime secure-sync error:', error)
    } catch (e) {
        console.error('importAnimeToDb error:', e)
    }
}
