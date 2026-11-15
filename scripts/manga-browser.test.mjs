// Browser contract tests. Every remote response is an explicitly synthetic fixture.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createAlignmentConfig } from '../src/lib/alignment.js'
const runtime = process.env.PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(/^[A-Z]:/i.test(runtime) ? pathToFileURL(runtime).href : runtime)
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid' }
const manga = { id: 'mal:manga:900719925474099312345', provider: 'mal', external_type: 'manga', external_id: '900719925474099312345', title: 'Fixture Manga', image_url: null, start_date: '1997', date_precision: 'year', synopsis: 'Sinopsis sintética para verificar el contrato de la interfaz.', authors: [{ name: 'Autora Fixture', role: 'Story & Art' }], chapters: null, volumes: null, format: 'manga', genres: ['Adventure'], external_score: 8.75, external_score_scale: 10, source_url: 'https://myanimelist.net/manga/900719925474099312345', publication_status: 'currently_publishing' }
const game = { id: 2, name: 'Fixture Game', cover_url: null, banner_url: '', developers: [], release_date: '2001-01-01', genres: [] }
const anime = { id: 2, title: 'Fixture Anime', image_url: null, banner_url: '', studios: [], start_date: '2002-01-01', genres: [] }
const highlightCover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="teal"/></svg>')
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
    } else if (table === 'manga-catalog') {
      if (state.mangaError) return route.fulfill({ status: 503, json: { code: 'MANGA_NOT_CONFIGURED', error: 'El catálogo está desactivado.', disabled: true, missing: [], invalid: [] } })
      data = body?.operation === 'detail' ? { item: manga } : { items: [manga], nextOffset: null }
    } else if (table === 'search_manga_catalog') {
      if (state.mangaError) return route.fulfill({ status: 503, json: { message: 'Fixture provider unavailable' } })
      const highlightId = { Berserk: '2', 'One Piece': '13' }[body?.search_query]
      data = highlightId ? [{ ...manga, id: `mal:manga:${highlightId}`, title: body.search_query, image_url: highlightCover }] : [manga]
    } else if (['manga', 'games', 'anime'].includes(table)) {
      data = state.catalogs?.[table] || [{ manga, games: game, anime }[table]]
      const idFilter = url.searchParams.get('id')
      if (idFilter?.startsWith('eq.')) data = data.filter(row => String(row.id) === idFilter.slice(3))
      if (idFilter?.startsWith('in.(')) data = data.filter(row => idFilter.slice(4, -1).split(',').map(id => id.replaceAll('"', '')).includes(String(row.id)))
    }
    else if (table === 'discover_manga') data = { items: [{ ...manga, registrations: state.entries.length, ratingCount: state.entries.filter(e => e.rating).length, userRating: 3.5 }], total: 1, genres: manga.genres }
    else if (table === 'recommend_manga') data = []
    else if (table === 'get_work_rating_summary') data = { membersCount: state.entries.length, ratingsCount: state.entries.filter(e => e.rating).length, avgRating: state.entries.some(e => e.rating) ? 3.5 : null, reviewsCount: state.entries.filter(e => e.review_text).length, recentMembers: [], distribution: Array.from({ length: 10 }, (_, index) => ({ rating: (index + 1) / 2, count: 0 })) }
    else if (table === 'library_entries') {
      if (req.method() === 'POST') {
        const value = Array.isArray(body) ? body[0] : body
        const entry = { ...state.entries[0], ...value, id: '33333333-3333-4333-8333-333333333333', created_at: '2026-11-15T12:00:00Z' }
        state.entries = [entry]
      } else if (req.method() === 'DELETE') state.entries = []
      data = state.entries.filter(e => !url.searchParams.has('work_type') || url.searchParams.get('work_type').startsWith('in.') || url.searchParams.get('work_type') === `eq.${e.work_type}`)
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
  await mkdir('output/manga', { recursive: true })
  for (const viewport of [{ width: 1360, height: 1000 }, { width: 390, height: 844 }]) {
    const app = await setup(false, viewport)
    await app.page.goto(`${base}/search`)
    await app.page.waitForFunction(() => document.querySelectorAll('.search-category-card.manga img').length === 2 && [...document.querySelectorAll('.search-category-card.manga img')].every(img => img.complete && img.naturalWidth > 0))
    const cards = await app.page.locator('.search-category-card').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, top: node.getBoundingClientRect().top })))
    assert.equal(cards.length, 3)
    assert.ok(cards.every(card => Math.abs(card.width - cards[0].width) < 1 && Math.abs(card.top - cards[0].top) < 1))
    assert.equal(app.state.requests.some(req => req.table === 'manga-catalog'), false)
    await app.page.locator('.search-category-card.manga').click()
    await app.page.waitForURL('**/discover/manga')
    const tabs = await app.page.getByRole('group', { name: 'Tipo de obra' }).getByRole('button').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, active: node.getAttribute('aria-pressed'), background: getComputedStyle(node).backgroundColor })))
    assert.equal(tabs.length, 3)
    assert.ok(tabs.every(tab => Math.abs(tab.width - tabs[0].width) < 1))
    assert.equal(tabs[2].active, 'true')
    assert.notEqual(tabs[2].background, tabs[0].background)
    checks.push(`Three equal Explore cards, local manga covers and correctly selected manga tab at ${viewport.width}px`)
    await app.page.goto(`${base}/search/results?q=Fixture&filter=manga`)
    await app.page.locator('a').filter({ hasText: manga.title }).first().waitFor()
    await app.page.locator('a').filter({ hasText: manga.title }).first().click()
    await app.page.getByRole('heading', { name: manga.title, exact: true }).waitFor()
    assert.equal(await app.page.locator('main').evaluate(main => main.classList.contains('work-main')), true)
    assert.match(await app.page.locator('.work-details').innerText(), /Capítulos\s+Desconocido/)
    assert.match(await app.page.locator('.work-details').innerText(), /Volúmenes\s+Desconocido/)
    assert.equal(await app.page.getByText('Estudio', { exact: true }).count(), 0)
    assert.equal(await app.page.getByText('Episodios', { exact: true }).count(), 0)
    assert.match(await app.page.locator('.work-details').innerText(), /8.75 \/ 10/)
    const mangaWidth = await app.page.locator('.work-page-inner').evaluate(node => node.getBoundingClientRect().width)
    await app.page.goto(`${base}/anime/${anime.id}`)
    await app.page.getByRole('heading', { name: anime.title, exact: true }).waitFor()
    assert.equal(await app.page.locator('.work-page-inner').evaluate(node => node.getBoundingClientRect().width), mangaWidth)
    await app.page.goto(`${base}/manga/${manga.id}`)
    await app.page.getByRole('heading', { name: manga.title, exact: true }).waitFor()
    assert.ok((await app.page.title()).includes('Manga'))
    await app.page.reload()
    await app.page.getByRole('heading', { name: manga.title, exact: true }).waitFor()
    assert.equal(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await app.page.screenshot({ path: `output/manga/work-${viewport.width}.png`, fullPage: true })
    await app.page.goto(`${base}/discover/manga`)
    await app.page.getByRole('link', { name: new RegExp(manga.title) }).first().waitFor()
    assert.equal(await app.page.locator('main').evaluate(main => main.classList.contains('discover-works-main')), true)
    const mangaCatalogWidth = await app.page.locator('.discover-catalog-inner').evaluate(node => node.getBoundingClientRect().width)
    await app.page.goto(`${base}/discover/anime`)
    await app.page.getByRole('link', { name: new RegExp(anime.title) }).first().waitFor()
    assert.equal(await app.page.locator('.discover-catalog-inner').evaluate(node => node.getBoundingClientRect().width), mangaCatalogWidth)
    await app.page.goto(`${base}/discover/manga`)
    await app.page.getByRole('link', { name: new RegExp(manga.title) }).first().waitFor()
    assert.ok(app.state.requests.some(req => req.table === 'discover_manga'))
    assert.equal(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await app.page.screenshot({ path: `output/manga/discover-${viewport.width}.png`, fullPage: true })
    checks.push(`Search, direct reload, metadata, no-cover and discovery at ${viewport.width}px`)
    await app.context.close()
  }
  const app = await setup(true)
  await app.page.goto(`${base}/manga/${manga.id}`)
  await app.page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await app.page.getByRole('button', { name: 'Editar registro', exact: true }).waitFor()
  assert.equal(app.state.entries[0].work_id, manga.id)
  await app.page.getByRole('button', { name: 'Wishlist', exact: true }).click()
  await app.page.getByRole('button', { name: 'En wishlist', exact: true }).waitFor()
  assert.equal(app.state.profile.wishlist[0].type, 'manga')
  await app.page.reload()
  await app.page.getByRole('button', { name: 'Editar registro', exact: true }).waitFor()
  await app.page.getByRole('button', { name: 'En wishlist', exact: true }).waitFor()
  await app.page.getByRole('button', { name: 'Editar registro', exact: true }).click()
  await app.page.getByRole('button', { name: '3.5 o 4 estrellas', exact: true }).click({ position: { x: 2, y: 10 } })
  await app.page.locator('textarea').first().fill('Reseña sintética con spoiler.')
  await app.page.getByRole('button', { name: /spoiler/i }).first().click()
  await app.page.getByRole('button', { name: 'Reseñar', exact: true }).click()
  await app.page.waitForURL(/\/reviews\//)
  assert.equal(app.state.entries[0].rating, 3.5)
  assert.equal(app.state.entries[0].contains_spoiler, true)
  await app.page.reload()
  await app.page.getByRole('link', { name: new RegExp(manga.title) }).first().waitFor()
  assert.equal(app.state.entries[0].work_id, manga.id)
  await app.page.goto(`${base}/profile/fixture-owner/diary`)
  await app.page.getByRole('link', { name: new RegExp(manga.title) }).first().waitFor()
  checks.push('Authenticated log, half star review, spoiler, wishlist and diary preserve text identity after reload (mock persistence)')

  const config = createAlignmentConfig()
  const item = { id: manga.id, name: manga.title, image_url: null, media_type: 'manga' }
  const template = { id: '55555555-5555-4555-8555-555555555555', user_id: user.id, title: 'Fixture Manga Alignment', list_type: 'alignment', media_type: 'manga', visibility: 'public', type_config: config, default_items: [item], cover_items: [] }
  app.state.templates = [template]
  await app.page.goto(`${base}/lists/new?template=${template.id}`)
  await app.page.locator('.alignment-edit-cell').first().click()
  await app.page.locator('.cl-modal-grid-item').filter({ hasText: manga.title }).click()
  await app.page.getByTitle('Editar título', { exact: true }).click()
  await app.page.locator('.cl-title-input').fill('Fixture Manga Saved')
  await app.page.locator('.cl-title-input').press('Enter')
  await app.page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await app.page.getByRole('button', { name: 'Postear', exact: true }).click()
  await app.page.waitForURL(/\/lists\//)
  assert.equal(app.state.lists[0].media_type, 'manga')
  assert.equal(app.state.lists[0].content['a:lawful:good'].id, manga.id)
  await app.page.reload()
  await app.page.getByRole('heading', { name: 'Fixture Manga Saved', exact: true }).waitFor()
  checks.push('Manga alignment template selection, publication and reload (mock persistence)')
  await app.page.goto(`${base}/settings`)
  await app.page.getByPlaceholder('Buscar manga…', { exact: true }).fill('Fixture')
  await app.page.locator('.manga-favorites-editor .ep-settings-work-result').filter({ hasText: manga.title }).click()
  await app.page.getByRole('button', { name: 'Guardar', exact: true }).first().click()
  await app.page.waitForFunction(() => document.querySelector('.ep-settings-save-button')?.textContent === 'Guardar')
  assert.equal(app.state.profile.favorite_manga[0].id, manga.id)
  await app.page.goto(`${base}/profile/fixture-owner`)
  await app.page.locator('a.profile-favorite-poster').filter({ hasText: manga.title }).waitFor()
  await app.page.goto(`${base}/profile/fixture-owner/reviews`)
  await app.page.locator('.review-menu-container > button').first().click()
  await app.page.getByRole('button', { name: 'Eliminar reseña', exact: true }).click()
  await app.page.waitForFunction(() => !document.querySelector('.review-poster-link'))
  assert.equal(app.state.entries.length, 0)
  checks.push('Favorite manga saves, appears in profile and own review can be deleted (mock persistence)')
  await app.context.close()
  const partial = await setup(false)
  partial.state.mangaError = true
  await partial.page.goto(`${base}/search/results?q=Fixture&filter=all`)
  await partial.page.locator('a').filter({ hasText: game.name }).first().waitFor()
  await partial.page.getByText('Algunos catálogos no respondieron.', { exact: false }).waitFor()
  if (partial.state.requests.some(req => req.table === 'manga-catalog')) await partial.page.getByText('La búsqueda de manga está desactivada en el servidor.', { exact: false }).waitFor()
  checks.push('Manga failure preserves valid anime/game search results')
  await partial.context.close()
  const recommendations = await setup(true)
  recommendations.state.catalogs = {
    anime: [
      { ...anime, id: 10, title: 'Liked horror', genres: ['Horror'] },
      { ...anime, id: 11, title: 'Liked romance', genres: ['Romance'] },
      { ...anime, id: 12, title: 'Similar horror anime', genres: ['Horror'], score: 85 },
      { ...anime, id: 13, title: 'Similar romance anime', genres: ['Romance'], score: 95 },
    ],
    games: [{ ...game, title: undefined, name: 'Similar horror game', genres: ['Horror'], rating: 85 }],
    manga: [{ ...manga, title: 'Similar horror manga', genres: ['Horror'] }],
  }
  recommendations.state.profile.favorite_animes = [{ id: 10 }]
  await recommendations.page.goto(`${base}/search`)
  await recommendations.page.locator('.srec-card').first().waitFor()
  assert.equal(await recommendations.page.locator('.srec-card').first().getAttribute('title'), 'Similar horror anime')
  assert.equal(await recommendations.page.locator('.srec-card[title="Liked horror"]').count(), 0)
  assert.ok(await recommendations.page.locator('.srec-card[href^="/game/"]').count())
  assert.ok(await recommendations.page.locator('.srec-card[href^="/manga/"]').count())
  assert.equal(await recommendations.page.locator('.search-sidebar h2').innerText(), 'TE PUEDE GUSTAR')
  recommendations.state.profile.favorite_animes = [{ id: 11 }]
  await recommendations.page.reload()
  await recommendations.page.locator('.srec-card').first().waitFor()
  assert.equal(await recommendations.page.locator('.srec-card').first().getAttribute('title'), 'Similar romance anime')
  await recommendations.page.screenshot({ path: 'output/manga/personalized-recommendations.png', fullPage: true })
  checks.push('Favorites change the first similar recommendation, exclude the favorite and include anime, games and manga')
  await recommendations.context.close()
  assert.deepEqual(errors, [])
  await writeFile('output/manga/browser-results.json', JSON.stringify({ fixtureOnly: true, checks, errors }, null, 2))
  console.log(checks.join('\n'))
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.log(page.url(), (await page.locator('body').innerText()).slice(0, 2500))
    await page.screenshot({ path: 'output/manga/browser-failure.png', fullPage: true })
  }
  await writeFile('output/manga/browser-results.json', JSON.stringify({ fixtureOnly: true, checks, errors, failure: error.message }, null, 2))
  throw error
} finally { await browser.close() }
