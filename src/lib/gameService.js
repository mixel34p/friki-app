/**
 * Game Service - Orchestrates local DB cache + IGDB API
 * 
 * Flow:
 * 1. Search and rank the local DB
 * 2. Fetch from IGDB only to fill missing results
 * 3. Import only newly discovered game IDs
 * 4. Return the ranked combined results
 */

import { supabase } from './supabase'
import { searchGamesIGDB, getGameByIdIGDB, getSimilarGamesIGDB, filterPrimaryIGDBGames, gameCatalogDedupKey } from './igdb'
import { rankSearchResults } from './searchRanking'
// ...

const legacyGameRefreshRetryAfter = new Map()

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
 * Search games (DB first, then IGDB only if needed)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of game objects
 */
export async function searchGames(query, limit = 20, { signal } = {}) {
    if (!query || query.length < 2) return []
    let localResults = []

    try {
        // 1. Search local DB first
        const { data: localGames, error } = await supabase
            .from('games')
            .select('*')
            .ilike('name', `%${query}%`)
            .limit(Math.min(100, Math.max(limit * 5, 50)))
            .abortSignal(signal)

        if (error) {
            console.error('Local DB search error:', error)
        }

        localResults = await refreshLegacyGameRows((localGames || []).map(formatGame), signal)
        localResults = filterPrimaryIGDBGames(localResults)
        const rankedLocal = rankSearchResults(dedupeGames(localResults), query, game => [game.name], game => game.rating)

        // The local database is the first source. Only call IGDB to fill slots
        // the local catalog could not satisfy.
        if (rankedLocal.length >= limit) return rankedLocal.slice(0, limit)

        const igdbResults = await searchGamesIGDB(query, limit, signal)
        const localIds = new Set(localResults.map(game => String(game.id)))
        let existingIds = localIds
        if (igdbResults.length) {
            const { data: existingGames, error: existingError } = await supabase
                .from('games')
                .select('id')
                .in('id', igdbResults.map(game => game.id))
                .abortSignal(signal)
            if (!existingError) existingIds = new Set([...(existingGames || []).map(game => String(game.id)), ...localIds])
        }
        const newGames = igdbResults.filter(game => !existingIds.has(String(game.id)))
        if (newGames.length) importGamesToDb(newGames)

        return rankSearchResults(
            dedupeGames([...igdbResults, ...localResults]),
            query,
            game => [game.name, ...(game.search_terms || [])],
            game => game.rating,
        ).slice(0, limit)
    } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') return []
        console.error('searchGames error:', error)
        const filteredLocal = filterPrimaryIGDBGames(localResults)
        return rankSearchResults(dedupeGames(filteredLocal), query, game => [game.name], game => game.rating).slice(0, limit)
    }
}

function dedupeGames(games) {
    const seenIds = new Set()
    const seenNames = new Set()
    return games.filter(game => {
        const name = gameCatalogDedupKey(game)
        if (seenIds.has(game.id) || !name || seenNames.has(name)) return false
        seenIds.add(game.id)
        seenNames.add(name)
        return true
    })
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
    if (!games || games.length === 0) return true

    try {
        const ids = games.map(game => game.id)
        
        // Use secure-sync Edge Function to fetch from IGDB and upsert server-side
        // This ensures the client cannot insert spoofed data directly into the DB.
        const { error } = await supabase.functions.invoke('secure-sync', {
            body: { type: 'game', ids }
        })
        
        if (error) throw error
        return true
    } catch (error) {
        console.error('Error importing games via secure-sync:', error)
        return false
    }
}

async function refreshLegacyGameRows(games, signal) {
    const staleRows = games.filter(game =>
        !game.igdb_metadata_checked_at
        && (legacyGameRefreshRetryAfter.get(String(game.id)) || 0) <= Date.now()
    ).slice(0, 20)
    if (!staleRows.length || signal?.aborted) return games

    const ids = staleRows.map(game => game.id)
    ids.forEach(id => legacyGameRefreshRetryAfter.set(String(id), Date.now() + 5 * 60 * 1000))
    const synced = await importGamesToDb(staleRows)
    if (!synced || signal?.aborted) return games

    const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('id', ids)
        .abortSignal(signal)
    if (error || !data?.length) return games

    const checkedIds = new Set(data.filter(game => game.igdb_metadata_checked_at).map(game => String(game.id)))
    if (checkedIds.size < ids.length) {
        console.warn('Game metadata was not persisted. Apply add_catalog_classification_metadata.sql and deploy secure-sync.')
    }
    for (const id of checkedIds) legacyGameRefreshRetryAfter.delete(String(id))

    const refreshed = new Map(data.map(game => [String(game.id), formatGame(game)]))
    return games.map(game => refreshed.get(String(game.id)) || game)
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
        igdb_category: dbGame.igdb_category ?? null,
        igdb_parent_game: dbGame.igdb_parent_game ?? null,
        igdb_version_parent: dbGame.igdb_version_parent ?? null,
        igdb_metadata_checked_at: dbGame.igdb_metadata_checked_at ?? null,
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
            .limit(Math.min(100, Math.max(limit * 5, 50)))

        if (error) throw error

        const games = filterPrimaryIGDBGames((data || []).map(formatGame))
        return rankSearchResults(dedupeGames(games), query, game => [game.name], game => game.rating).slice(0, limit)
    } catch (error) {
        console.error('searchGamesLocal error:', error)
        return []
    }
}
