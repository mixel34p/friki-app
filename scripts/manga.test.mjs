import assert from 'node:assert/strict'
import { test } from 'node:test'
import { externalMangaId, mangaIdentity, normalizeMalManga, parseMangaIdentity, partialDate, retryAfterSeconds, validateMangaRequest } from '../supabase/functions/_shared/manga-contract.js'
import { normalizeCatalogWork, validateWorkIdentity, workHref, workKey } from '../src/lib/workTypes.js'
import { isMangaCover, mangaExportPlaceholder } from '../src/lib/artworkExport.js'
import { coalescedRequests } from '../src/lib/coalescedRequests.js'
import { mangaCatalogError } from '../src/lib/mangaCatalogError.js'

// Synthetic provider fixtures: these are never imported into the application or production database.
const fixture = { id: '900719925474099312345', title: 'Fixture de manga', media_type: 'manga', start_date: '1997', mean: 8.75, num_chapters: 0, authors: [{ node: { first_name: 'Autor', last_name: 'Prueba' }, role: 'Story & Art' }] }
test('text identities remain stable and never collide across providers or media', () => {
  assert.equal(externalMangaId(fixture.id), fixture.id)
  assert.equal(parseMangaIdentity(mangaIdentity(fixture.id)), fixture.id)
  assert.equal(validateWorkIdentity('manga', mangaIdentity(fixture.id)), `mal:manga:${fixture.id}`)
  assert.equal(new Set(['game', 'anime', 'manga'].map(type => workKey(type, '2'))).size, 3)
  assert.throws(() => externalMangaId(Number(fixture.id)))
  assert.throws(() => validateWorkIdentity('manga', '2'))
  assert.throws(() => validateWorkIdentity('unknown', '2'))
  assert.equal(decodeURIComponent(workHref('manga', mangaIdentity(fixture.id))), `/manga/mal:manga:${fixture.id}`)
})
test('partial dates, unknown counts and missing covers remain honest', () => {
  const row = normalizeMalManga(fixture, true)
  assert.deepEqual(partialDate('1997'), { start_date: '1997', date_precision: 'year' })
  assert.equal(partialDate('1997-07').date_precision, 'month')
  assert.equal(partialDate('1997-07-22').date_precision, 'day')
  assert.equal(partialDate('1997-02-30').start_date, null)
  assert.equal(partialDate('1997-00').start_date, null)
  assert.equal(row.chapters, null)
  assert.equal(row.volumes, null)
  assert.equal(row.image_url, null)
  assert.equal(row.external_score, 8.75)
  assert.equal(row.external_score_scale, 10)
  assert.equal(row.rating, undefined) // Community rating is not a provider score.
  assert.equal(row.authors[0].role, 'Story & Art')
  assert.equal(normalizeCatalogWork('manga', { ...row, id: mangaIdentity(fixture.id) }).type, 'manga')
})
test('exclude novels, preserve manhwa/manhua, and never accept arbitrary image destinations', () => {
  for (const type of ['novel', 'light_novel', 'doujinshi', 'unknown']) assert.equal(normalizeMalManga({ ...fixture, media_type: type }), null)
  for (const type of ['manga', 'one_shot', 'manhwa', 'manhua']) assert.equal(normalizeMalManga({ ...fixture, media_type: type }).format, type)
  assert.equal(normalizeMalManga({ ...fixture, main_picture: { large: 'https://127.0.0.1/secret' } }).image_url, null)
  assert.equal(normalizeMalManga({ ...fixture, main_picture: { large: 'https://cdn.myanimelist.net/images/manga/test.jpg' } }).image_url, 'https://cdn.myanimelist.net/images/manga/test.jpg')
  assert.equal(normalizeMalManga({ ...fixture, synopsis: '<script>alert(1)</script><b>texto</b>' }, true).synopsis.includes('<'), false)
  assert.equal(isMangaCover('https://cdn.myanimelist.net/images/manga/test.jpg'), true)
  assert.match(mangaExportPlaceholder(), /^data:image\/svg\+xml/)
})
test('bounded operations, paging and Retry-After', () => {
  assert.equal(validateMangaRequest({ operation: 'search', query: ' One Piece ', limit: 12, offset: 24 }).query, 'One Piece')
  for (const payload of [{ operation: 'delete' }, { operation: 'search', query: 'x' }, { operation: 'search', query: 'manga', limit: 51 }, { operation: 'search', query: 'manga', offset: -1 }, { operation: 'detail', id: 'https://example.com' }]) assert.throws(() => validateMangaRequest(payload))
  assert.equal(retryAfterSeconds('120'), 120)
  assert.equal(retryAfterSeconds('Sun, 15 Nov 2026 13:00:00 GMT', Date.parse('2026-11-15T12:59:30Z')), 30)
})
test('deduplicates simultaneous searches and keeps independent cancellation', async () => {
  let calls = 0
  let complete
  let sharedSignal
  const invoke = coalescedRequests((_, signal) => { calls++; sharedSignal = signal; return new Promise(resolve => { complete = resolve }) })
  const first = new AbortController()
  const a = invoke({ query: 'Fixture' }, first.signal)
  const b = invoke({ query: 'Fixture' })
  await Promise.resolve()
  first.abort()
  await assert.rejects(a, { name: 'AbortError' })
  assert.equal(calls, 1); assert.equal(sharedSignal.aborted, false)
  complete('ok')
  assert.equal(await b, 'ok')
  assert.equal(sharedSignal.aborted, false, 'A completed request must keep its response body readable')
  const last = new AbortController()
  const c = invoke({ query: 'Other' }, last.signal)
  await Promise.resolve(); last.abort()
  await assert.rejects(c, { name: 'AbortError' })
  assert.equal(sharedSignal.aborted, true)
})

test('completed HTTP failures keep their body readable and expose configuration diagnostics', async () => {
  let signal
  const invoke = coalescedRequests(async (_, requestSignal) => {
    signal = requestSignal
    return Response.json({ code: 'MANGA_NOT_CONFIGURED', disabled: true, missing: ['MAL_CLIENT_ID'] }, { status: 503 })
  })
  const response = await invoke({ operation: 'search' })
  assert.equal(signal.aborted, false)
  const error = await mangaCatalogError({ context: response })
  assert.equal(error.code, 'MANGA_NOT_CONFIGURED')
  assert.equal(error.status, 503)
  assert.deepEqual(error.missing, ['MAL_CLIENT_ID'])
  assert.match(error.message, /desactivada/)
})

test('rate limits and network errors produce useful, safe messages', async () => {
  const limited = await mangaCatalogError({}, Response.json({}, { status: 429 }))
  assert.equal(limited.code, 'MANGA_RATE_LIMITED')
  const network = await mangaCatalogError(new Error('Fetch failed'))
  assert.equal(network.code, 'MANGA_UNAVAILABLE')
  const aborted = new DOMException('Aborted', 'AbortError')
  assert.equal(await mangaCatalogError(aborted), aborted)
})
