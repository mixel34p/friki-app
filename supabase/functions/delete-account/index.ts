import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ownedAvatarPath(url: string | null | undefined, userId: string): string | null {
    if (!url) return null
    try {
        const pathname = new URL(url).pathname
        const marker = '/storage/v1/object/public/avatars/'
        const markerIndex = pathname.indexOf(marker)
        if (markerIndex < 0) return null
        const path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
        return path.startsWith(`avatars/${userId}.`) || path.startsWith(`avatars/${userId}-`) ? path : null
    } catch {
        return null
    }
}

function ownedBannerPath(url: string | null | undefined, userId: string): string | null {
    if (!url) return null
    try {
        const pathname = new URL(url).pathname
        const marker = '/storage/v1/object/public/avatars/'
        const markerIndex = pathname.indexOf(marker)
        if (markerIndex < 0) return null
        const path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
        return path.startsWith(`banners/${userId}.`) ? path : null
    } catch {
        return null
    }
}

serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    try {
        const authorization = request.headers.get('Authorization') || ''
        const token = authorization.replace(/^Bearer\s+/i, '')
        if (!token) throw new Error('Unauthorized')

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: { user }, error: authError } = await callerClient.auth.getUser(token)
        if (authError || !user) throw new Error('Unauthorized')

        const body = await request.json()
        const typedUsername = String(body?.username || '').trim().replace(/^@/, '').toLowerCase()
        if (!typedUsername) throw new Error('Escribe tu nombre de usuario para continuar.')

        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('username, avatar_url, banner_url')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError) throw profileError
        if (!profile?.username || String(profile.username).toLowerCase() !== typedUsername) {
            return new Response(JSON.stringify({ error: 'El nombre de usuario no coincide.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
        if (deleteError) throw deleteError

        const storagePaths = [
            ownedAvatarPath(profile.avatar_url, user.id),
            ownedBannerPath(profile.banner_url, user.id),
        ].filter((path): path is string => Boolean(path))
        if (storagePaths.length) {
            const { error: storageError } = await adminClient.storage.from('avatars').remove(storagePaths)
            if (storageError) console.warn('Could not remove deleted account profile images:', storageError.message)
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not delete account'
        const status = message === 'Unauthorized' ? 401 : 400
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
