import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID')!
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Token cache for IGDB
let accessToken: string | null = null
let tokenExpiry = 0

async function getTwitchToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiry) return accessToken
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            client_secret: TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        })
    })
    if (!response.ok) throw new Error('Failed to get Twitch token')
    const data = await response.json()
    accessToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
    return accessToken!
}

async function syncGames(ids: number[]) {
    if (!ids.length) return []
    const token = await getTwitchToken()
    const body = `
        fields id, name, slug, cover.url, first_release_date, rating, 
               genres.name, platforms.name, summary,
               artworks.url, screenshots.url, involved_companies.company.name, involved_companies.developer;
        where id = (${ids.join(',')});
        limit ${ids.length};
    `
    const igdbRes = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' },
        body
    })
    if (!igdbRes.ok) throw new Error('IGDB fetch failed')
    const games = await igdbRes.json()

    const toInsert = games.map((game: any) => {
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
            cover_url: game.cover?.url ? 'https:' + game.cover.url.replace('t_thumb', 't_cover_big') : null,
            banner_url: banner,
            release_date: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null,
            rating: game.rating ? Math.round(game.rating) / 10 : null,
            genres: game.genres ? game.genres.map((g: any) => g.name) : [],
            platforms: game.platforms ? game.platforms.map((p: any) => p.name) : [],
            developers: game.involved_companies ? game.involved_companies.filter((c: any) => c.developer).map((c: any) => c.company.name) : [],
            summary: game.summary || ''
        }
    })

    const { error } = await supabase.from('games').upsert(toInsert, { onConflict: 'id' })
    if (error) throw error
    return toInsert
}

async function syncAnime(ids: number[]) {
    if (!ids.length) return []
    const query = `
        query ($ids: [Int]) {
          Page (page: 1, perPage: ${ids.length}) {
            media (id_in: $ids, type: ANIME) {
              id
              title { romaji english }
              coverImage { extraLarge }
              bannerImage
              status
              episodes
              startDate { year month day }
              averageScore
              description
              genres
              studios(isMain: true) { nodes { name } }
            }
          }
        }
    `
    const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { ids } })
    })
    if (!res.ok) throw new Error('AniList fetch failed')
    const { data } = await res.json()
    const animeList = data.Page.media

    const toInsert = animeList.map((a: any) => {
        const title = a.title.english || a.title.romaji
        return {
            id: a.id,
            title,
            image_url: a.coverImage?.extraLarge,
            banner_url: a.bannerImage || '',
            start_date: a.startDate?.year ? `${a.startDate.year}-${String(a.startDate.month || 1).padStart(2, '0')}-${String(a.startDate.day || 1).padStart(2, '0')}` : null,
            score: a.averageScore ? a.averageScore / 10 : null,
            genres: a.genres || [],
            synopsis: a.description || '',
            status: a.status || null,
            episodes: a.episodes || null,
            studios: a.studios?.nodes?.map((n: any) => n.name) || []
        }
    })

    const { error } = await supabase.from('anime').upsert(toInsert, { onConflict: 'id' })
    if (error) throw error
    return toInsert
}

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Unauthorized')
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) throw new Error('Unauthorized')

        const { type, ids } = await req.json()
        if (!type || !ids || !Array.isArray(ids)) throw new Error('Invalid body')

        let result = []
        if (type === 'game') result = await syncGames(ids)
        else if (type === 'anime') result = await syncAnime(ids)
        else throw new Error('Invalid type')

        return new Response(JSON.stringify({ success: true, count: result.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
