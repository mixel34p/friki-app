// Supabase Edge Function: IGDB Proxy
// Handles IGDB API calls server-side to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID')!
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET')!

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
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { endpoint, body } = await req.json()

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
