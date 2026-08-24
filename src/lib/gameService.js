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

        // 2. If we have enough local results, return them sorted by rating
        if (localResults.length >= limit / 2) {
            return localResults.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, limit)
        }

        // 3. Fetch from IGDB for more results
        const igdbResults = await searchGamesIGDB(query, limit)

        // 4. Import new games to local DB (don't await, do in background)
        const localIds = new Set(localResults.map(g => g.id))
        const newGames = igdbResults.filter(g => !localIds.has(g.id))

        if (newGames.length > 0) {
            importGamesToDb(newGames) // Fire and forget
        }

        // 5. Merge, deduplicate, and sort by rating so best games stay on top
        const allGames = [...localResults]
        for (const game of igdbResults) {
            if (!localIds.has(game.id)) {
                allGames.push(game)
            }
        }

        return allGames.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, limit)
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

        // Auto-repair: If it's missing banner or developers, fetch from API to update DB
        const hasBanner = localGame?.banner_url !== null;
        const hasDevelopers = localGame?.developers !== null;

        if (localGame && !error && hasBanner && hasDevelopers) {
            return formatGame(localGame)
        }

        // 2. Fetch from IGDB
        const igdbGame = await getGameByIdIGDB(id)

        if (igdbGame) {
            // Import to local DB (this auto-repairs missing fields!)
            importGamesToDb([igdbGame])
            
            // If we had a local game but just fetched from IGDB to repair,
            // we should still return the formatted localGame supplemented with the new data
            // But since IGDB game is what we want, just return it.
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
    if (!games || games.length === 0) return

    try {
        const ids = games.map(game => game.id)
        
        // Use secure-sync Edge Function to fetch from IGDB and upsert server-side
        // This ensures the client cannot insert spoofed data directly into the DB.
        const { error } = await supabase.functions.invoke('secure-sync', {
            body: { type: 'game', ids }
        })
        
        if (error) throw error
    } catch (error) {
        console.error('Error importing games via secure-sync:', error)
    }
}

/**
 * Format game from DB to standard structure
 */
function formatGame(dbGame) {
    let relDate = dbGame.release_date
    if (relDate && /^\d+$/.test(relDate.toString()) && relDate.toString().length === 10) {
        relDate = new Date(parseInt(relDate, 10) * 1000).toISOString().split('T')[0]
    }

    return {
        id: dbGame.id,
        name: dbGame.name,
        slug: dbGame.slug,
        image_url: dbGame.cover_url, // Alias for compatibility
        cover_url: dbGame.cover_url,
        banner_url: dbGame.banner_url,
        release_date: relDate,
        rating: dbGame.rating,
        igdb_rating: dbGame.rating,
        genres: dbGame.genres || [],
        platforms: dbGame.platforms || [],
        developers: dbGame.developers || [],
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
