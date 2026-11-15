import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { loadSearchRecommendations } from '../../src/lib/searchRecommendationRanking.js'
const env = parseEnv(await readFile('.env.local', 'utf8'))
assert.equal(new URL(env.VITE_SUPABASE_URL).hostname, 'mzkesbzdgpregglmxyrf.supabase.co')
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const result = await loadSearchRecommendations(client)
assert.equal(result.length, 6)
assert.deepEqual(new Set(result.map(work => work.type)), new Set(['game', 'anime', 'manga']))
const report = { readonly: true, personalized: result.personalized, items: result.map(({ id, type, title, year }) => ({ id, type, title, year })) }
await writeFile('output/manga/recommendations-remote.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
