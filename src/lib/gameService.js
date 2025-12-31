/**
 * Game Service - Orchestrates local DB cache + IGDB API
 * 
 * Flow:
 * 1. Search local DB first
 * 2. If not enough results, fetch from IGDB
 * 3. Import new games to local DB
 * 4. Return combined results
 */

import { supabase } from './supabase'
import { searchGamesIGDB, getGameByIdIGDB, getSimilarGamesIGDB } from './igdb'
// ...

/**
 * Get similar games (IGDB)
 */
/**
 * Get similar games (IGDB) and save them to DB
 */
export async function getSimilarGames(gameId, limit = 10) {
    const games = await getSimilarGamesIGDB(gameId, limit)

    // Import to DB in background so they are available
    if (games.length > 0) {
        importGamesToDb(games)
    }

    return games
}

/**
 * Search games (DB first, then IGDB if needed)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of game objects
 */
export async function searchGames(query, limit = 20) {
    if (!query || query.length < 2) return []

    try {
        // 1. Search local DB first
        const { data: localGames, error } = await supabase
            .from('games')
            .select('*')
            .ilike('name', `%${query}%`)
            .limit(limit)

        if (error) {
            console.error('Local DB search error:', error)
        }

        const localResults = (localGames || []).map(formatGame)

        // 2. If we have enough local results, return them
        if (localResults.length >= limit / 2) {
            return localResults.slice(0, limit)
        }

        // 3. Fetch from IGDB for more results
        const igdbResults = await searchGamesIGDB(query, limit)

        // 4. Import new games to local DB (don't await, do in background)
        const localIds = new Set(localResults.map(g => g.id))
        const newGames = igdbResults.filter(g => !localIds.has(g.id))

        if (newGames.length > 0) {
            importGamesToDb(newGames) // Fire and forget
        }

        // 5. Merge and deduplicate results
        const allGames = [...localResults]
        for (const game of igdbResults) {
            if (!localIds.has(game.id)) {
                allGames.push(game)
            }
        }

        return allGames.slice(0, limit)
    } catch (error) {
        console.error('searchGames error:', error)
        return []
    }
}

/**
 * Get a game by ID (DB first, then IGDB)
 * @param {number|string} id - Game ID
 * @returns {Promise<Object|null>} Game object or null
 */
export async function getGameById(id) {
    try {
        // 1. Check local DB
        const { data: localGame, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', id)
            .single()

        if (localGame && !error) {
            return formatGame(localGame)
        }

        // 2. Fetch from IGDB
        const igdbGame = await getGameByIdIGDB(id)

        if (igdbGame) {
            // Import to local DB
            importGamesToDb([igdbGame])
            return igdbGame
        }

        return null
    } catch (error) {
        console.error('getGameById error:', error)
        return null
    }
}

/**
 * Import games to local database
 * @param {Array} games - Array of game objects
 */
async function importGamesToDb(games) {
    try {
        const toInsert = games.map(game => ({
            id: game.id,
            name: game.name,
            slug: game.slug,
            cover_url: game.cover_url,
            release_date: game.release_date,
            rating: game.rating,
            genres: game.genres,
            platforms: game.platforms,
            summary: game.summary
        }))

        const { error } = await supabase
            .from('games')
            .upsert(toInsert, { onConflict: 'id', ignoreDuplicates: true })

        if (error) {
            console.error('Import games error:', error)
        }
    } catch (error) {
        console.error('importGamesToDb error:', error)
    }
}

/**
 * Format game from DB to standard structure
 */
function formatGame(dbGame) {
    return {
        id: dbGame.id,
        name: dbGame.name,
        slug: dbGame.slug,
        image_url: dbGame.cover_url, // Alias for compatibility
        cover_url: dbGame.cover_url,
        release_date: dbGame.release_date,
        rating: dbGame.rating,
        genres: dbGame.genres || [],
        platforms: dbGame.platforms || [],
        summary: dbGame.summary
    }
}

/**
 * Search games in local DB only (for offline/fast access)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of game objects
 */
export async function searchGamesLocal(query, limit = 20) {
    if (!query || query.length < 2) return []

    try {
        const { data, error } = await supabase
            .from('games')
            .select('*')
            .ilike('name', `%${query}%`)
            .limit(limit)

        if (error) throw error

        return (data || []).map(formatGame)
    } catch (error) {
        console.error('searchGamesLocal error:', error)
        return []
    }
}
