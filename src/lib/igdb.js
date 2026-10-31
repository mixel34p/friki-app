/**
 * IGDB API Client (via Supabase Edge Function proxy)
 * 
 * The actual IGDB requests are made server-side to avoid CORS issues.
 * This client calls our igdb-proxy Edge Function.
 */

import { matchesAllSearchTokens, rankSearchResults } from './searchRanking'

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
        const allowedCategories = new Set([0, 4, 8, 9, 10])
        const normalizedQuery = normalizeGameName(query)
        const fetchCandidates = async searchTerm => {
            const escapedTerm = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
            const body = `
                search "${escapedTerm}";
                fields id, name, slug, cover.url, first_release_date, rating, total_rating_count, category, parent_game, version_parent,
                       alternative_names.name, genres.name, platforms.name, summary, artworks.url, screenshots.url;
                limit 500;
            `
            return callIgdbProxy('/games', body, signal)
        }
        const isAllowedGame = game => {
            const exactTitleMatch = normalizeGameName(game.name) === normalizedQuery
            return allowedCategories.has(Number(game.category))
                || (!game.version_parent && exactTitleMatch)
        }

        let games = (await fetchCandidates(query)).filter(isAllowedGame)
        const relevantCount = games.filter(game => matchesAllSearchTokens(
            query,
            [game.name, ...(game.alternative_names || []).map(name => name.name)],
        )).length

        // IGDB's search can return too few title continuations for a short
        // franchise query (e.g. “Persona 5” -> “Persona 5 Royal”). Search the
        // shorter prefix only to fill the remaining slots, then keep candidates
        // that still contain every token from the original query.
        const queryTokens = query.trim().split(/\s+/)
        if (queryTokens.length > 1 && relevantCount < limit) {
            const broaderQuery = queryTokens.slice(0, -1).join(' ')
            const existingIds = new Set(games.map(game => game.id))
            try {
                const broaderGames = (await fetchCandidates(broaderQuery))
                    .filter(isAllowedGame)
                    .filter(game => !existingIds.has(game.id))
                    .filter(game => matchesAllSearchTokens(
                        query,
                        [game.name, ...(game.alternative_names || []).map(name => name.name)],
                    ))
                games = [...games, ...broaderGames]
            } catch (error) {
                if (signal?.aborted || error?.name === 'AbortError') throw error
                console.warn('IGDB broader search failed:', error)
            }
        }

        // Remove only duplicate records for the same IGDB game. Distinct games
        // can legitimately share an identical display name.
        const seenIds = new Set()
        games = games.filter(game => {
            const key = String(game.id)
            if (!game.id || seenIds.has(key)) return false
            seenIds.add(key)
            return true
        })

        games = rankSearchResults(games, query, game => [game.name, ...(game.alternative_names || []).map(name => name.name)], game => game.total_rating_count)

        // Exact-title remakes/remasters are easy to bury below popular original
        // releases when the visible result list is capped. Keep those variants
        // in the page so they can be selected as favorites too.
        games = prioritizeExactTitleRemakesAndRemasters(games, query)

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
                search_terms: [game.name, ...(game.alternative_names || []).map(name => name.name)],
                slug: game.slug,
                igdb_category: game.category ?? null,
                igdb_parent_game: game.parent_game ?? null,
                igdb_version_parent: game.version_parent ?? null,
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
        throw error
    }
}

function normalizeGameName(name) {
    return (name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(deluxe|definitive|ultimate|complete|collector'?s|launch|special) edition\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

export function gameCatalogDedupKey(game) {
    const name = normalizeGameName(game?.name)
    if (!name) return ''
    const category = Number(game?.igdb_category ?? game?.category)
    if ([8, 9].includes(category)) {
        const id = game?.id
        return id !== null && id !== undefined
            ? `${name}|${category}|${id}`
            : `${name}|${category}|${getGameReleaseYear(game)}`
    }
    if ([4, 8, 9, 10].includes(category)) {
        return `${name}|${category}|${getGameReleaseYear(game)}`
    }
    return name
}

export function prioritizeExactTitleRemakesAndRemasters(games, query) {
    const normalizedQuery = normalizeGameName(query)
    const variants = (games || []).filter(game =>
        [8, 9].includes(Number(game?.igdb_category ?? game?.category))
        && normalizeGameName(game?.name) === normalizedQuery
    )
    const variantIds = new Set(variants.map(game => String(game.id)))
    return [...variants, ...(games || []).filter(game => !variantIds.has(String(game.id)))]
}

function getGameReleaseYear(game) {
    const rawDate = game?.release_date ?? game?.first_release_date
    return typeof rawDate === 'number'
        ? new Date(rawDate * 1000).getFullYear()
        : String(rawDate || '').match(/^\d{4}/)?.[0] || ''
}

export function isPrimaryIGDBGame(game, metadata = null) {
    const category = metadata?.category ?? game?.igdb_category
    const versionParent = metadata?.version_parent ?? game?.igdb_version_parent
    const parentGame = metadata?.parent_game ?? game?.igdb_parent_game
    if (category !== null && category !== undefined) {
        const numericCategory = Number(category)
        if (Number.isFinite(numericCategory)) {
            if ([4, 8, 9, 10].includes(numericCategory)) return true
            return numericCategory === 0 && !versionParent && !parentGame
        }
    }
    if (versionParent || parentGame) return false
    return !/\b(dlc|add[- ]on|downloadable content|expansion|expansi[oó]n|season\s*[0-9]+|temporada\s*[0-9]+|season pass|chapter\s*[2-9]|episode\s*[2-9]|episodio\s*[2-9]|demo|beta|soundtrack|banda sonora|original soundtrack|ost|deluxe edition|collector'?s edition|bundle|pack|bonus content|contenido descargable)\b/i.test(game?.name || '')
}

export function filterPrimaryIGDBGames(games) {
    return (games || []).filter(game => isPrimaryIGDBGame(game))
}

/**
 * Get a specific game by ID from IGDB
 * @param {number} id - IGDB game ID
 * @returns {Promise<Object|null>} Game object or null
 */
export async function getGameByIdIGDB(id) {
    try {
        const body = `
            fields id, name, slug, cover.url, first_release_date, rating, category, parent_game, version_parent,
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
            igdb_category: game.category ?? null,
            igdb_parent_game: game.parent_game ?? null,
            igdb_version_parent: game.version_parent ?? null,
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
