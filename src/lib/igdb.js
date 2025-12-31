/**
 * IGDB API Client (via Supabase Edge Function proxy)
 * 
 * The actual IGDB requests are made server-side to avoid CORS issues.
 * This client calls our igdb-proxy Edge Function.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Call IGDB via our Edge Function proxy
 */
async function callIgdbProxy(endpoint, body) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/igdb-proxy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ endpoint, body })
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Proxy error: ${response.status}`)
    }

    return response.json()
}

/**
 * Search games on IGDB
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 20)
 * @returns {Promise<Array>} Array of game objects
 */
export async function searchGamesIGDB(query, limit = 20) {
    if (!query || query.length < 2) return []

    try {
        const body = `
            search "${query}";
            fields id, name, slug, cover.url, first_release_date, rating, 
                   genres.name, platforms.name, summary;
            limit ${limit};
        `

        const games = await callIgdbProxy('/games', body)

        return games.map(game => ({
            id: game.id,
            name: game.name,
            slug: game.slug,
            cover_url: game.cover?.url
                ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big')
                : null,
            release_date: game.first_release_date
                ? new Date(game.first_release_date * 1000).toISOString().split('T')[0]
                : null,
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
            genres: game.genres?.map(g => g.name) || [],
            platforms: game.platforms?.map(p => p.name) || [],
            summary: game.summary || null
        }))
    } catch (error) {
        console.error('IGDB search error:', error)
        return []
    }
}

/**
 * Get a specific game by ID from IGDB
 * @param {number} id - IGDB game ID
 * @returns {Promise<Object|null>} Game object or null
 */
export async function getGameByIdIGDB(id) {
    try {
        const body = `
            fields id, name, slug, cover.url, first_release_date, rating, 
                   genres.name, platforms.name, summary;
            where id = ${id};
        `

        const games = await callIgdbProxy('/games', body)

        if (games.length === 0) return null

        const game = games[0]
        return {
            id: game.id,
            name: game.name,
            slug: game.slug,
            cover_url: game.cover?.url
                ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big')
                : null,
            release_date: game.first_release_date
                ? new Date(game.first_release_date * 1000).toISOString().split('T')[0]
                : null,
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
            genres: game.genres?.map(g => g.name) || [],
            platforms: game.platforms?.map(p => p.name) || [],
            summary: game.summary || null
        }
    } catch (error) {
        console.error('IGDB get game error:', error)
        return null
    }
}
/**
 * Get similar games from IGDB
 * @param {number} gameId 
 * @param {number} limit 
 */
export async function getSimilarGamesIGDB(gameId, limit = 10) {
    try {
        // 1. Get similar_games IDs from the game
        const body = `
            fields similar_games;
            where id = ${gameId};
        `
        const response = await callIgdbProxy('/games', body)

        if (!response || response.length === 0 || !response[0].similar_games) {
            return []
        }

        const similarIds = response[0].similar_games.slice(0, limit)

        // 2. Get details for these games
        if (similarIds.length === 0) return []

        const detailsBody = `
            fields id, name, slug, cover.url, first_release_date, rating, 
                   genres.name, platforms.name, summary;
            where id = (${similarIds.join(',')});
        `

        const games = await callIgdbProxy('/games', detailsBody)

        return games.map(game => ({
            id: game.id,
            name: game.name,
            slug: game.slug,
            cover_url: game.cover?.url
                ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big')
                : null,
            image_url: game.cover?.url // Alias for compatibility
                ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big')
                : null,
            release_date: game.first_release_date
                ? new Date(game.first_release_date * 1000).toISOString().split('T')[0]
                : null,
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
            genres: game.genres?.map(g => g.name) || [],
            platforms: game.platforms?.map(p => p.name) || [],
            summary: game.summary || null,
            media_type: 'game'
        }))

    } catch (error) {
        console.error('IGDB get similar games error:', error)
        return []
    }
}
