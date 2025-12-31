/**
 * Anime Service - Orchestrates local DB cache + Jikan API (MyAnimeList)
 */

import { supabase } from './supabase'

const JIKAN_API_BASE = 'https://api.jikan.moe/v4'

/**
 * Search anime (DB first, then Jikan)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of anime objects
 */
export async function searchAnime(query, limit = 20) {
    if (!query || query.length < 2) return []

    try {
        // 1. Search local DB first
        const { data: localAnime, error } = await supabase
            .from('anime')
            .select('*')
            .ilike('title', `%${query}%`)
            .limit(limit)

        if (error) {
            console.error('Local DB anime search error:', error)
        }

        const localResults = (localAnime || []).map(formatAnime)

        // 2. If we have enough local results, return them
        if (localResults.length >= limit / 2) {
            return localResults.slice(0, limit)
        }

        // 3. Fetch from Jikan API (MAL)
        // Rate limit: 3 requests per second for Jikan. We should be careful but search is user-triggered.
        const response = await fetch(`${JIKAN_API_BASE}/anime?q=${encodeURIComponent(query)}&limit=${limit}&sfw=true`)
        const data = await response.json()
        const jikanResults = (data.data || []).map(malToStandard)

        // 4. Import new anime to local DB
        const localIds = new Set(localResults.map(a => a.id))
        const newAnime = jikanResults.filter(a => !localIds.has(a.id))

        if (newAnime.length > 0) {
            importAnimeToDb(newAnime) // Fire and forget
        }

        // 5. Merge
        const allAnime = [...localResults]
        for (const anime of jikanResults) {
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
 * @param {number} id - MAL ID
 */
export async function getAnimeById(id) {
    try {
        // 1. Check local DB
        const { data: localAnime } = await supabase
            .from('anime')
            .select('*')
            .eq('id', id)
            .single()

        if (localAnime) {
            return formatAnime(localAnime)
        }

        // 2. Fetch from Jikan
        const response = await fetch(`${JIKAN_API_BASE}/anime/${id}`)
        const data = await response.json()

        if (data.data) {
            const anime = malToStandard(data.data)
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
 * Get similar anime from Jikan
 * @param {number} id - MAL ID
 * @param {number} limit
 */
export async function getSimilarAnime(id, limit = 10) {
    try {
        const response = await fetch(`${JIKAN_API_BASE}/anime/${id}/recommendations`)
        const data = await response.json()

        if (!data.data) return []

        return data.data.slice(0, limit).map(item => ({
            id: item.entry.mal_id,
            name: item.entry.title,
            title: item.entry.title,
            image_url: item.entry.images?.jpg?.large_image_url || item.entry.images?.jpg?.image_url,
            cover_url: item.entry.images?.jpg?.large_image_url || item.entry.images?.jpg?.image_url,
            genres: [], // Recommendations endpoint doesn't provide genres
            media_type: 'anime'
        }))
    } catch (error) {
        console.error('getSimilarAnime error:', error)
        return []
    }
}

/**
 * Helper to convert MAL API response to our standard format
 */
function malToStandard(malItem) {
    return {
        id: malItem.mal_id,
        name: malItem.title, // Standardize on 'name' for UI compatibility with games
        title: malItem.title,
        image_url: malItem.images?.jpg?.large_image_url || malItem.images?.jpg?.image_url,
        cover_url: malItem.images?.jpg?.large_image_url || malItem.images?.jpg?.image_url, // Alias
        release_date: malItem.aired?.from,
        rating: malItem.score ? malItem.score * 10 : null, // Normalize to 0-100? or keep as 0-10. MAL is 0-10. Games are usually 0-100. Let's keep MAL as is or multiply? 
        // Games rating comes from IGDB which is 0-100. Let's make MAL comparable so 0-10 * 10 = 0-100.
        summary: malItem.synopsis,
        genres: malItem.genres?.map(g => g.name) || [],
        media_type: 'anime' // Important for separation vs games
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
        release_date: dbAnime.start_date,
        rating: dbAnime.score ? dbAnime.score * 10 : null,
        summary: dbAnime.synopsis,
        genres: dbAnime.genres || [],
        media_type: 'anime'
    }
}

async function importAnimeToDb(animeList) {
    try {
        const toInsert = animeList.map(a => ({
            id: a.id,
            title: a.title,
            image_url: a.image_url,
            start_date: a.release_date ? new Date(a.release_date).toISOString() : null,
            score: a.rating ? a.rating / 10 : null, // Store as 0-10 in DB to respect column decimal(4,2)
            genres: a.genres,
            synopsis: a.summary?.substring(0, 5000) // Truncate if too long
        }))

        const { error } = await supabase
            .from('anime')
            .upsert(toInsert, { onConflict: 'id', ignoreDuplicates: true })

        if (error) console.error('Import anime error:', error)
    } catch (e) {
        console.error('importAnimeToDb error:', e)
    }
}
