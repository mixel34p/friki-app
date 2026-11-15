// Browser contract tests. Every remote response is an explicitly synthetic fixture.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createAlignmentConfig } from '../../src/lib/alignment.js'
const runtime = process.env.PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(/^[A-Z]:/i.test(runtime) ? pathToFileURL(runtime).href : runtime)
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid' }
const manga = { id: 'mal:manga:900719925474099312345', provider: 'mal', external_type: 'manga', external_id: '900719925474099312345', title: 'Fixture Manga', image_url: null, start_date: '1997', date_precision: 'year', synopsis: 'Sinopsis sintética para verificar el contrato de la interfaz.', authors: [{ name: 'Autora Fixture', role: 'Story & Art' }], chapters: null, volumes: null, format: 'manga', genres: ['Adventure'], external_score: 8.75, external_score_scale: 10, source_url: 'https://myanimelist.net/manga/900719925474099312345', publication_status: 'currently_publishing' }
const game = { id: 2, name: 'Fixture Game', cover_url: null, banner_url: '', developers: [], release_date: '2001-01-01', genres: [] }
const anime = { id: 2, title: 'Fixture Anime', image_url: null, banner_url: '', studios: [], start_date: '2002-01-01', genres: [] }
const errors = [], checks = []

async function setup(authenticated, viewport = { width: 1360, height: 1000 }) {
  const context = await browser.newContext({ viewport })
  const state = { profile: { id: user.id, username: 'fixture-owner', display_name: 'Fixture Owner', theme_color: '#14b8a6', onboarding_completed: true, favorite_games: [], favorite_animes: [], favorite_manga: [], wishlist: [] }, entries: [], lists: [], templates: [], requests: [], mangaError: false }
  if (authenticated) {
    const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`
    await context.addInitScript(session => localStorage.setItem('frikinet-auth', JSON.stringify(session)), { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user })
  }
  await context.route('https://graphql.anilist.co/**', route => route.fulfill({ status: 503, json: { errors: [{ message: 'Fixture provider unavailable' }] } }))
  await context.route('**/*.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url()), table = url.pathname.split('/').pop()
    state.requests.push({ table, method: req.method(), url: url.href })
    const body = req.postData() ? req.postDataJSON() : null
    let data = [], total
    if (url.pathname.includes('/auth/v1/user')) data = user
    else if (table === 'profiles') {
      if (req.method() === 'PATCH') state.profile = { ...state.profile, ...body }
      data = [state.profile]
    } else if (table === 'search_manga_catalog') {
      if (state.mangaError) return route.fulfill({ status: 503, json: { message: 'Fixture provider unavailable' } })
      data = [manga]
    } else if (table === 'manga') data = [manga]
    else if (table === 'games') data = [game]
    else if (table === 'anime') data = [anime]
    else if (table === 'discover_manga') data = { items: [{ ...manga, registrations: state.entries.length, ratingCount: state.entries.filter(e => e.rating).length, userRating: 3.5 }], total: 1, genres: manga.genres }
    else if (table === 'recommend_manga') data = []
    else if (table === 'get_work_rating_summary') data = { membersCount: state.entries.length, ratingsCount: state.entries.filter(e => e.rating).length, avgRating: state.entries.some(e => e.rating) ? 3.5 : null, reviewsCount: state.entries.filter(e => e.review_text).length, recentMembers: [], distribution: Array.from({ length: 10 }, (_, index) => ({ rating: (index + 1) / 2, count: 0 })) }
    else if (table === 'library_entries') {
      if (req.method() === 'POST') {
        const value = Array.isArray(body) ? body[0] : body
        const entry = { ...state.entries[0], ...value, id: '33333333-3333-4333-8333-333333333333', created_at: '2026-11-15T12:00:00Z' }
        state.entries = [entry]
      } else if (req.method() === 'DELETE') state.entries = []
      data = state.entries.filter(e => !url.searchParams.has('work_type') || url.searchParams.get('work_type') === `eq.${e.work_type}`)
      if (url.searchParams.get('review_text') === 'not.is.null') data = data.filter(e => e.review_text)
      if (url.searchParams.get('rating') === 'not.is.null') data = data.filter(e => e.rating != null)
    } else if (table === 'user_lists') {
      if (['POST', 'PATCH'].includes(req.method())) {
        const value = Array.isArray(body) ? body[0] : body
        state.lists = [{ ...state.lists[0], ...value, id: '44444444-4444-4444-8444-444444444444', created_at: '2026-11-15T12:00:00Z' }]
      }
      data = state.lists
    } else if (table === 'list_templates') data = state.templates
    if (Array.isArray(data)) {
      total = data.length
      if (req.headers().accept?.includes('object')) data = data[0] || null
    }
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${total || 0}` } })
    await route.fulfill({ json: data, headers: total == null ? {} : { 'content-range': `0-${Math.max(0, total - 1)}/${total}` } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  return { page, context, state }
}

try {
  const metrics = []
  for (const width of [1360, 390, 360]) {
    const app = await setup(false, { width, height: 900 })
    await app.page.goto(base + '/search')
    const grid = app.page.locator('.search-category-grid')
    await grid.waitFor()
    const layout = await grid.evaluate(element => {
      const cards = [...element.children].map(card => { const r = card.getBoundingClientRect(); return { top: r.top, width: r.width, height: r.height, text: card.innerText } })
      return { width: element.getBoundingClientRect().width, columns: getComputedStyle(element).gridTemplateColumns, cards, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert.equal(layout.cards.length, 3)
    assert.ok(layout.cards.every(card => Math.abs(card.top - layout.cards[0].top) < 1))
    assert.ok(layout.cards.every(card => Math.abs(card.width - layout.cards[0].width) < 1))
    assert.equal(layout.overflow, false)
    await grid.screenshot({ path: 'output/manga/explore-' + width + '.png' })
    metrics.push({ viewport: width, ...layout })
    await app.context.close()
  }
  await writeFile('output/manga/explore-layout.json', JSON.stringify(metrics, null, 2))
  console.log(JSON.stringify(metrics))
} finally { await browser.close() }
