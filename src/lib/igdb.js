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
async function callIgdbProxy(endpoint, body, signal) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/igdb-proxy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ endpoint, body }),
        signal
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
export async function searchGamesIGDB(query, limit = 20, signal) {
    if (!query || query.length < 2) return []

    try {
        const body = `
              search "${query}";
              fields id, name, slug, cover.url, first_release_date, rating, total_rating_count, category, parent_game, version_parent,
                     genres.name, platforms.name, summary, artworks.url, screenshots.url;
              limit 50;
        `

        let games = await callIgdbProxy('/games', body, signal)

        // Advanced filter: Remove DLCs and garbage, but keep main games and popular expansions like Persona 5 Royal
        games = games.filter(game => {
            // Filter out alternate editions (Launch Edition, Deluxe Edition, etc)
            if (game.version_parent) return false;
            
            // If it has a parent game, it's either an expansion, remake, OR a misclassified DLC
            if (game.parent_game) {
                // If it's explicitly marked as remake/remaster/expansion, keep it
                const allowedCategories = [2, 4, 8, 9, 10]; // Expansion, Standalone Expansion, Remake, Remaster, Expanded Game
                if (allowedCategories.includes(game.category)) return true;
                
                // Otherwise (category 0 or null), only keep it if it's popular enough
                // This filters out obscure DLCs but keeps games like Persona 5 Royal
                if (game.total_rating_count && game.total_rating_count > 5) return true;
                
                return false; // Hide obscure DLCs
            }
            
            return true; // Keep all normal main games
        })

        // Sort locally: Exact matches first, then by popularity
        const lowerQuery = query.toLowerCase()
        games.sort((a, b) => {
            const aExact = a.name.toLowerCase() === lowerQuery ? 1 : 0
            const bExact = b.name.toLowerCase() === lowerQuery ? 1 : 0
            
            if (aExact !== bExact) return bExact - aExact
            
            return (b.total_rating_count || 0) - (a.total_rating_count || 0)
        })

        return games.map(game => {
            let banner = null
            if (game.artworks && game.artworks.length > 0) {
                banner = 'https:' + game.artworks[0].url.replace('t_thumb', 't_1080p')
            } else if (game.screenshots && game.screenshots.length > 0) {
                banner = 'https:' + game.screenshots[0].url.replace('t_thumb', 't_1080p')
            }
            return {
                id: game.id,
                name: game.name,
                slug: game.slug,
                cover_url: game.cover?.url
                    ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big')
                    : null,
                banner_url: banner,
                release_date: game.first_release_date
                    ? new Date(game.first_release_date * 1000).toISOString().split('T')[0]
                    : null,
                rating: game.rating ? (game.rating / 10).toFixed(1) : null,
                genres: game.genres?.map(g => g.name) || [],
                platforms: game.platforms?.map(p => p.name) || [],
                summary: game.summary || null
            }
        }).slice(0, limit)
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
                   genres.name, platforms.name, summary,
                   artworks.url, screenshots.url, involved_companies.company.name, involved_companies.developer;
            where id = ${id};
        `

        const games = await callIgdbProxy('/games', body)

        if (games.length === 0) return null

        const game = games[0]
        
        // Find best banner (artwork or screenshot)
        let banner = null
        if (game.artworks && game.artworks.length > 0) {
            banner = 'https:' + game.artworks[0].url.replace('t_thumb', 't_1080p')
        } else if (game.screenshots && game.screenshots.length > 0) {
            banner = 'https:' + game.screenshots[0].url.replace('t_thumb', 't_1080p')
        }

        return {
            id: game.id,
            name: game.name,
            slug: game.slug,
            cover_url: game.cover?.url
                ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big')
                : null,
            banner_url: banner,
            release_date: game.first_release_date
                ? new Date(game.first_release_date * 1000).toISOString().split('T')[0]
                : null,
            genres: game.genres ? game.genres.map(g => g.name) : [],
            platforms: game.platforms ? game.platforms.map(p => p.name) : [],
            summary: game.summary || '',
            involved_companies: game.involved_companies || [],
            igdb_rating: game.rating ? Math.round(game.rating) / 10 : null
        }
    } catch (error) {
        console.error('Error fetching from IGDB proxy:', error)
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
