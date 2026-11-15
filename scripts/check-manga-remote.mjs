// Read-only smoke check; never prints credentials and never inserts fixture data.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const raw = await readFile('.env.local', 'utf8')
const setting = key => raw.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')
const base = setting('VITE_SUPABASE_URL')
assert.equal(new URL(base).hostname, 'mzkesbzdgpregglmxyrf.supabase.co')
const key = setting('VITE_SUPABASE_ANON_KEY')
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const catalog = await fetch(`${base}/rest/v1/manga?select=id&limit=1`, { headers, signal: AbortSignal.timeout(15000) })
const provider = await fetch(`${base}/functions/v1/manga-catalog`, { method: 'POST', headers, body: JSON.stringify({ operation: 'search', query: 'One Piece' }), signal: AbortSignal.timeout(15000) })
const body = await provider.json()
const sync = await fetch(`${base}/functions/v1/secure-sync`, { method: 'POST', headers, body: JSON.stringify({ type: 'manga', ids: [] }), signal: AbortSignal.timeout(15000) })
console.log(JSON.stringify({ project: new URL(base).hostname.split('.')[0], catalogHttpStatus: catalog.status, functionHttpStatus: provider.status, functionCode: body.code || null, disabled: body.disabled, missing: body.missing, invalid: body.invalid, itemCount: body.items?.length, anonymousSyncStatus: sync.status }))
assert.equal(catalog.status, 200)
if (provider.status === 503 && body.code === 'MANGA_NOT_CONFIGURED') {
  assert.ok(body.disabled || body.missing?.length || body.invalid?.length)
} else {
  assert.equal(provider.status, 200)
  assert.ok(Array.isArray(body.items))
}
assert.equal(sync.status, 400)
