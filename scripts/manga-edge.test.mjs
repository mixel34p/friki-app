import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'
import * as contract from '../supabase/functions/_shared/manga-contract.js'

const source = (await readFile(new URL('../supabase/functions/manga-catalog/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*createClient.*\n/m, 'const { createClient } = globalThis.fixture;\n')
  .replace(/^import .*manga-contract.js.*\n/m, 'const { mangaIdentity, normalizeMalManga, retryAfterSeconds, validateMangaRequest } = globalThis.fixture;\n')
const { code } = await transform(source, { loader: 'ts', format: 'iife', target: 'es2022' })

function runtime(enabled = true, overrides = {}) {
  const env = { ...(enabled ? { MANGA_PROVIDER_ENABLED: 'true', MAL_CLIENT_ID: 'fixture-client', MANGA_RATE_LIMIT_SALT: 'fixture-salt', MAL_SEARCH_TTL_SECONDS: '60', MAL_DETAIL_TTL_SECONDS: '120', MAL_REQUESTS_PER_MINUTE: '5', SUPABASE_ANON_KEY: 'fixture-anon' } : {}), ...overrides }
  const cache = new Map(), catalog = new Map(), quotas = []
  let verifiedUser = null
  let handler, fetches = 0, limited = false, fail = 0, leased = true
  function query(table) {
    let action = 'read', payload, key, ids
    const builder = {
      select() { return builder }, eq(_, value) { key = value; return builder }, in(_, value) { ids = value; return builder }, maybeSingle() { return builder },
      upsert(value) { action = 'upsert'; payload = value; return builder }, update(value) { action = 'update'; payload = value; return builder },
      then(resolve, reject) {
        try {
          if (action === 'upsert') {
            if (table === 'manga_provider_cache') cache.set(payload.key, { ...cache.get(payload.key), ...payload })
            else for (const row of payload) { const id = contract.mangaIdentity(row.external_id); catalog.set(id, { ...catalog.get(id), ...row, id }) }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject)
          }
          if (action === 'update') { cache.set(key, { ...cache.get(key), ...payload }); return Promise.resolve({ error: null }).then(resolve, reject) }
          const data = table === 'manga_provider_cache' ? cache.get(key) || null : ids.map(id => catalog.get(id)).filter(Boolean)
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        } catch (error) { return Promise.reject(error).then(resolve, reject) }
      },
    }
    return builder
  }
  const db = { from: query, rpc: async (name, args) => { if (name === 'take_manga_quota') quotas.push(args); return { data: name === 'lease_manga_cache' ? leased : !limited, error: null } }, auth: { getUser: async () => ({ data: { user: verifiedUser }, error: verifiedUser ? null : new Error('no user') }) } }
  vm.runInNewContext(code, {
    Deno: { env: { get: name => env[name] }, serve: callback => { handler = callback } },
    fixture: { ...contract, createClient: () => db }, URL, URLSearchParams, Request, Response, Headers, AbortSignal, crypto: globalThis.crypto, TextEncoder, console: { error() {} },
    fetch: async () => {
      fetches++
      if (fail === -1) throw new DOMException('Fixture timeout', 'TimeoutError')
      if (fail) return new Response('{}', { status: fail, headers: { 'Retry-After': '120' } })
      return Response.json({ data: [{ node: { id: 2, title: 'Fixture Manga', media_type: 'manga' } }] })
    },
  })
  return { cache, catalog, quotas, set verifiedUser(value) { verifiedUser = value }, get fetches() { return fetches }, set limited(value) { limited = value }, set fail(value) { fail = value }, set leased(value) { leased = value }, call: (body, token = 'fixture-anon') => handler(new Request('https://fixture.invalid/manga-catalog', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) }
}

test('public catalog accepts a gateway-validated rotated anon key; only verified users receive the user quota', async () => {
  const app = runtime()
  const body = { operation: 'search', query: 'Fixture' }
  assert.equal((await app.call(body, 'fixture-rotated-anon')).status, 200)
  assert.equal(app.quotas.find(q => q.bucket_key.startsWith('client:')).max_hits, 15)
  app.quotas.length = 0
  app.verifiedUser = { id: 'verified-user' }
  assert.equal((await app.call(body, 'fixture-user')).status, 200)
  assert.equal(app.quotas.find(q => q.bucket_key.startsWith('client:')).max_hits, 60)
})

test('Edge Function stays unavailable without operational configuration and lists missing names only', async () => {
  const app = runtime(false)
  const response = await app.call({ operation: 'search', query: 'Fixture' })
  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.code, 'MANGA_NOT_CONFIGURED')
  assert.equal(body.disabled, true)
  assert.ok(body.missing.includes('MAL_CLIENT_ID'))
  assert.equal(body.missing.includes('MAL_APPROVAL_REFERENCE'), false)
  assert.equal(app.fetches, 0)
})
test('approval references are not required; disabled and invalid operational settings are distinguished', async () => {
  const app = runtime(true, { MAL_SEARCH_TTL_SECONDS: '-1', MAL_CLIENT_ID: '' })
  const response = await app.call({ operation: 'search', query: 'Fixture' })
  const body = await response.json()
  assert.equal(response.status, 503)
  assert.equal(body.disabled, false)
  assert.deepEqual(body.missing, ['MAL_CLIENT_ID'])
  assert.deepEqual(body.invalid, ['MAL_SEARCH_TTL_SECONDS'])
  assert.equal(app.fetches, 0)
  assert.equal((await runtime().call({ operation: 'search', query: 'Fixture' })).status, 200)
})
test('server search persists identities, reuses cache, refreshes expiry and validates input', async () => {
  const app = runtime()
  const body = { operation: 'search', query: 'Fixture', limit: 10 }
  assert.equal((await app.call(body)).status, 200)
  const repeated = await app.call(body)
  assert.equal((await repeated.json()).items[0].id, 'mal:manga:2')
  assert.equal(app.fetches, 1)
  assert.equal(app.catalog.size, 1)
  for (const row of app.cache.values()) row.expires_at = '2000-01-01T00:00:00Z'
  assert.equal((await app.call(body)).status, 200)
  assert.equal(app.fetches, 2)
  assert.equal((await app.call({ operation: 'search', query: 'x' })).status, 400)
  assert.equal((await app.call({ operation: 'detail', id: 'http://localhost' })).status, 400)
})
test('provider Retry-After coordinates cooldown across queries and never loops retries', async () => {
  const app = runtime(); app.fail = 429
  const response = await app.call({ operation: 'search', query: 'Fixture' })
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '120')
  assert.equal((await app.call({ operation: 'search', query: 'Another' })).status, 429)
  assert.equal(app.fetches, 1)
})
test('quota, concurrent leases and provider timeouts produce bounded recoverable failures', async () => {
  const quota = runtime(); quota.limited = true
  assert.equal((await quota.call({ operation: 'search', query: 'Fixture' })).status, 429)
  assert.equal(quota.fetches, 0)
  const lease = runtime(); lease.leased = false
  assert.equal((await lease.call({ operation: 'search', query: 'Fixture' })).status, 503)
  assert.equal(lease.fetches, 0)
  const timeout = runtime(); timeout.fail = -1
  assert.equal((await timeout.call({ operation: 'search', query: 'Fixture' })).status, 503)
  assert.equal(timeout.fetches, 1)
})
