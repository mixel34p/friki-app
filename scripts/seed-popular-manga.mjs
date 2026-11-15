// Small, explicit catalog import through the same quota-controlled server adapter as the app.
// Run with --apply; never creates user registrations or community ratings.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { setTimeout as pause } from 'node:timers/promises'

const selection = [
  ['2', 'Berserk'], ['13', 'One Piece'], ['11', 'Naruto'], ['21', 'Death Note'],
  ['25', 'Fullmetal Alchemist'], ['12', 'Bleach'], ['1', 'Monster'],
  ['23390', 'Shingeki no Kyojin'], ['44347', 'One Punch-Man'],
  ['116778', 'Chainsaw Man'], ['113138', 'Jujutsu Kaisen'], ['96792', 'Kimetsu no Yaiba'],
]
if (!process.argv.includes('--apply')) {
  console.log('Use --apply to import these 12 real works through manga-catalog:', selection)
  process.exit(0)
}
const env = { ...parseEnv(await readFile('.env.local', 'utf8')), ...process.env }
const base = new URL(env.VITE_SUPABASE_URL)
assert.equal(base.hostname, 'mzkesbzdgpregglmxyrf.supabase.co')
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
const imported = []
await mkdir('output/manga', { recursive: true })
for (const [id, expected] of selection) {
  const request = () => fetch(new URL('/functions/v1/manga-catalog', base), { method: 'POST', headers, body: JSON.stringify({ operation: 'detail', id: `mal:manga:${id}` }), signal: AbortSignal.timeout(20000) })
  let response = await request()
  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'))
    assert.ok(Number.isFinite(seconds) && seconds > 0 && seconds <= 120, 'Unbounded provider cooldown; stopped')
    console.log(`Waiting ${seconds}s for the shared catalog quota`)
    await pause(seconds * 1000 + 1000)
    response = await request()
  }
  const body = await response.json()
  assert.equal(response.status, 200, `Import ${expected} failed: HTTP ${response.status}, ${body.code || body.error || ''}`)
  const item = body.item
  assert.equal(item.id, `mal:manga:${id}`)
  assert.equal(item.title.toLowerCase(), expected.toLowerCase(), 'Provider title differs from selected work')
  assert.ok(item.image_url && item.genres.length && item.authors.length, 'Expected complete provider metadata')
  imported.push({ id: item.id, title: item.title, image_url: item.image_url, format: item.format, metadata_checked_at: item.metadata_checked_at })
  await writeFile('output/manga/popular-import.json', JSON.stringify({ importedAt: new Date().toISOString(), items: imported }, null, 2))
  console.log(`Imported ${item.id}: ${item.title}`)
  await pause(3000)
}
console.log(`Verified ${imported.length} popular manga imports; no user records changed`)
