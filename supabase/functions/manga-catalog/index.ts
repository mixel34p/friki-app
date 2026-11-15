import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'
import { mangaIdentity, normalizeMalManga, retryAfterSeconds, validateMangaRequest } from '../_shared/manga-contract.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After',
}
const reply = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...headers } })
const configuredInteger = (name: string, maximum: number) => {
  const value = Number(Deno.env.get(name))
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : null
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  // Operational configuration only. A project-specific "approval" secret is not a MAL API requirement.
  const clientId = Deno.env.get('MAL_CLIENT_ID')
  const salt = Deno.env.get('MANGA_RATE_LIMIT_SALT')
  const searchTtl = configuredInteger('MAL_SEARCH_TTL_SECONDS', 86400)
  const detailTtl = configuredInteger('MAL_DETAIL_TTL_SECONDS', 604800)
  const providerLimit = configuredInteger('MAL_REQUESTS_PER_MINUTE', 1000)
  const required = { MAL_CLIENT_ID: clientId, MANGA_RATE_LIMIT_SALT: salt }
  const integers = { MAL_SEARCH_TTL_SECONDS: searchTtl, MAL_DETAIL_TTL_SECONDS: detailTtl, MAL_REQUESTS_PER_MINUTE: providerLimit }
  const missing = Object.entries(required).filter(([, value]) => !value?.trim()).map(([name]) => name)
  const invalid: string[] = []
  for (const [name, value] of Object.entries(integers)) {
    if (!Deno.env.get(name)?.trim()) missing.push(name)
    else if (value == null) invalid.push(name)
  }
  const disabled = Deno.env.get('MANGA_PROVIDER_ENABLED') !== 'true'
  if (disabled || missing.length || invalid.length) return reply({
    code: 'MANGA_NOT_CONFIGURED',
    error: disabled ? 'La búsqueda externa de manga está desactivada en el servidor.' : 'La configuración del catálogo de manga está incompleta o no es válida.',
    disabled,
    missing,
    invalid,
  }, 503)
  let input
  try {
    if (Number(req.headers.get('content-length')) > 2048) return reply({ error: 'Request too large' }, 413)
    const body = await req.text()
    if (body.length > 2048) return reply({ error: 'Request too large' }, 413)
    input = validateMangaRequest(JSON.parse(body))
  } catch { return reply({ error: 'Invalid manga request' }, 400) }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const quota = async (key: string, maximum: number) => {
    const { data, error } = await db.rpc('take_manga_quota', { bucket_key: key, max_hits: maximum, window_seconds: 60 })
    if (error) throw error
    return data === true
  }
  try {
    if (!await quota('public:all', 300)) return reply({ error: 'El catálogo está ocupado.' }, 429, { 'Retry-After': '60' })
    const token = req.headers.get('authorization')?.replace(/^Bearer /i, '')
    let userId: string | null = null
    // Catalog operations are public. Only a user verified by Auth receives the user quota.
    // The gateway still verifies JWTs; do not rely on equality with one runtime anon key (keys can rotate).
    if (token && token !== Deno.env.get('SUPABASE_ANON_KEY')) {
      const { data, error } = await db.auth.getUser(token)
      if (!error && data.user) userId = data.user.id
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${userId || ip}`))
    const bucket = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
    if (!await quota(`client:${bucket}`, userId ? 60 : 15)) return reply({ error: 'Demasiadas búsquedas.' }, 429, { 'Retry-After': '60' })

    const key = input.operation === 'search' ? `search:${JSON.stringify([input.query.toLocaleLowerCase(), input.limit, input.offset])}` : `detail:${input.externalId}`
    const { data: cache, error: cacheError } = await db.from('manga_provider_cache').select('payload,expires_at').eq('key', key).maybeSingle()
    if (cacheError) throw cacheError
    if (cache?.payload && Date.parse(cache.expires_at) > Date.now()) return reply(cache.payload)
    const { data: cooldown, error: cooldownError } = await db.from('manga_provider_cache').select('expires_at').eq('key', 'provider-cooldown').maybeSingle()
    if (cooldownError) throw cooldownError
    if (cooldown?.expires_at && Date.parse(cooldown.expires_at) > Date.now()) return reply({ error: 'Proveedor temporalmente limitado.' }, 429, { 'Retry-After': String(Math.ceil((Date.parse(cooldown.expires_at) - Date.now()) / 1000)) })
    const { data: leased, error: leaseError } = await db.rpc('lease_manga_cache', { cache_key: key })
    if (leaseError) throw leaseError
    if (!leased) return reply({ error: 'Búsqueda en curso. Vuelve a intentarlo.' }, 503, { 'Retry-After': '2' })
    try {
      if (!await quota('provider:mal', providerLimit)) return reply({ error: 'Cuota temporal del catálogo agotada.' }, 429, { 'Retry-After': '60' })
      const fields = input.operation === 'search' ? 'alternative_titles,start_date,media_type' : 'alternative_titles,start_date,synopsis,mean,genres,media_type,status,num_volumes,num_chapters,authors{first_name,last_name}'
      const url = new URL(input.operation === 'search' ? 'https://api.myanimelist.net/v2/manga' : `https://api.myanimelist.net/v2/manga/${input.externalId}`)
      url.searchParams.set('fields', fields)
      if (input.operation === 'search') { url.searchParams.set('q', input.query); url.searchParams.set('limit', String(input.limit)); url.searchParams.set('offset', String(input.offset)); url.searchParams.set('nsfw', 'false') }
      // No automatic retries: each later attempt uses the shared cache/circuit breaker and quota.
      const response = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': clientId, 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'error' })
      if (!response.ok) {
        if (response.status === 429 || response.status === 403 || response.status >= 500) {
          const delay = retryAfterSeconds(response.headers.get('retry-after'))
          const { error } = await db.from('manga_provider_cache').upsert({ key: 'provider-cooldown', expires_at: new Date(Date.now() + delay * 1000).toISOString() })
          if (error) throw error
          return reply({ error: 'MyAnimeList no está disponible temporalmente.' }, response.status === 429 ? 429 : 503, { 'Retry-After': String(delay) })
        }
        return reply({ error: 'No se pudo consultar la obra.' }, response.status === 404 ? 404 : 502)
      }
      const payload = await response.json()
      const detail = input.operation === 'detail'
      const nodes = detail ? [payload] : (payload.data || []).map((item: { node: unknown }) => item.node)
      const expires_at = new Date(Date.now() + (detail ? detailTtl : searchTtl) * 1000).toISOString()
      const rows = nodes.map((node: unknown) => normalizeMalManga(node, detail)).filter(Boolean).map((row: Record<string, unknown>) => ({ ...row, metadata_checked_at: new Date().toISOString(), ...(detail ? { detail_expires_at: expires_at } : {}) }))
      // Search does not overwrite detail-only fields; identity is a generated column, never accepted from a client.
      if (rows.length) {
        const { error } = await db.from('manga').upsert(rows, { onConflict: 'provider,external_type,external_id' })
        if (error) throw error
      }
      const ids = rows.map((row: { external_id: string }) => mangaIdentity(row.external_id))
      const { data: catalog, error } = ids.length ? await db.from('manga').select('*').in('id', ids) : { data: [], error: null }
      if (error) throw error
      const byId = new Map((catalog || []).map(row => [row.id, row]))
      const items = ids.map((id: string) => byId.get(id)).filter(Boolean)
      const result = detail ? { item: items[0] || null } : { items, nextOffset: payload.paging?.next ? input.offset + input.limit : null }
      const { error: saveError } = await db.from('manga_provider_cache').upsert({ key, payload: result, expires_at })
      if (saveError) throw saveError
      return reply(result)
    } finally {
      await db.from('manga_provider_cache').update({ locked_until: null }).eq('key', key)
    }
  } catch (error) {
    console.error('manga-catalog', error instanceof Error ? error.name : 'Server error')
    return reply({ error: 'El catálogo de manga no responde. Tus registros se conservan.' }, 503, { 'Retry-After': '10' })
  }
})
