// Supabase Edge Function: IGDB Proxy
// Handles IGDB API calls server-side to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID')!
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET')!

function isAllowedImageHost(hostname: string): boolean {
    return hostname === 'images.igdb.com'
        || /^s[1-9]\.anilist\.co$/i.test(hostname)
        || hostname === 'mzkesbzdgpregglmxyrf.supabase.co'
}

async function fetchReviewImage(source: string): Promise<Response> {
    let target: URL
    try {
        target = new URL(source)
    } catch {
        throw new Error('Invalid image URL')
    }
    if (target.protocol !== 'https:' || !isAllowedImageHost(target.hostname)) {
        throw new Error('Image host is not allowed')
    }

    let response: Response | null = null
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        response = await fetch(target, { redirect: 'manual', headers: { Accept: 'image/avif,image/webp,image/*' } })
        if (![301, 302, 303, 307, 308].includes(response.status)) break
        const location = response.headers.get('location')
        if (!location || redirects === 3) throw new Error('Image redirect limit exceeded')
        target = new URL(location, target)
        if (target.protocol !== 'https:' || !isAllowedImageHost(target.hostname)) {
            throw new Error('Image redirect host is not allowed')
        }
    }
    if (!response?.ok) throw new Error(`Image server returned ${response?.status || 'an error'}`)

    const contentType = response.headers.get('content-type')?.split(';')[0] || ''
    if (!contentType.startsWith('image/')) throw new Error('The requested file is not an image')
    const image = await response.arrayBuffer()
    if (!image.byteLength || image.byteLength > 8 * 1024 * 1024) throw new Error('Image size is not supported')
    return new Response(image, {
        status: 200,
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-Image-Content-Type': contentType,
            'Content-Length': String(image.byteLength),
            'Cache-Control': 'public, max-age=86400',
        },
    })
}

// Token cache
let accessToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken
    }

    const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            client_secret: TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        })
    })

    if (!response.ok) {
        throw new Error('Failed to get Twitch OAuth token')
    }

    const data = await response.json()
    accessToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
    return accessToken!
}

serve(async (req) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Expose-Headers': 'X-Image-Content-Type',
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()
        const { endpoint, body } = payload

        if (typeof payload?.imageUrl === 'string') {
            try {
                const imageResponse = await fetchReviewImage(payload.imageUrl)
                const headers = new Headers(imageResponse.headers)
                Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
                return new Response(imageResponse.body, { status: imageResponse.status, headers })
            } catch (error) {
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Image request failed' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }
        }

        if (!endpoint || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing endpoint or body' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const token = await getAccessToken()

        const igdbResponse = await fetch(`https://api.igdb.com/v4${endpoint}`, {
            method: 'POST',
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body
        })

        if (!igdbResponse.ok) {
            return new Response(
                JSON.stringify({ error: `IGDB error: ${igdbResponse.status}` }),
                { status: igdbResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const data = await igdbResponse.json()

        return new Response(
            JSON.stringify(data),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
