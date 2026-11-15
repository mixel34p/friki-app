// Run with a local Vite server. PLAYWRIGHT_MODULE may point to a bundled index.mjs.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createAlignmentConfig } from '../src/lib/alignment.js'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240" viewBox="0 0 180 240"><rect width="180" height="240" fill="#15483e"/><circle cx="90" cy="85" r="40" fill="#65cba5"/><path d="M25 220v-35a65 65 0 0 1 130 0v35" fill="#47a68b"/><text x="90" y="234" fill="white" text-anchor="middle" font-family="sans-serif" font-size="15">PERSONAJE</text></svg>').toString('base64')
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid' }
const profile = { id: user.id, username: 'alignment-test', display_name: 'Prueba', theme_color: '#14b8a6' }
const config = createAlignmentConfig()
const items = [{ id: 'hero', name: 'Héroe', image_url: image }, { id: 'villain', name: 'Villano', image_url: image }]
let template = { id: '22222222-2222-4222-8222-222222222222', user_id: user.id, title: 'Alineamiento de prueba', list_type: 'alignment', media_type: 'game', visibility: 'public', type_config: config, default_items: items, uses_count: 0, cover_items: [] }
let savedList = null
const writes = []
const errors = []

async function setup(authenticated, viewport = { width: 1360, height: 1000 }) {
  const context = await browser.newContext({ viewport })
  if (authenticated) {
    const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.mock`
    await context.addInitScript(session => localStorage.setItem('frikinet-auth', JSON.stringify(session)), { access_token: jwt, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user })
  }
  await context.route('**/*.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const table = url.pathname.split('/').pop()
    let data = []
    if (url.pathname.includes('/auth/v1/user')) data = user
    else if (table === 'profiles') data = request.headers().accept?.includes('object') ? profile : [profile]
    else if (table === 'list_templates') {
      if (request.method() === 'PATCH') { template = { ...template, ...request.postDataJSON() }; writes.push({ table, payload: request.postDataJSON() }) }
      if (request.method() === 'POST') { template = { ...template, ...request.postDataJSON() }; writes.push({ table, payload: request.postDataJSON() }) }
      data = request.headers().accept?.includes('object') ? template : [template]
    } else if (table === 'user_lists') {
      if (['POST', 'PATCH'].includes(request.method())) {
        savedList = { ...savedList, ...request.postDataJSON(), id: '33333333-3333-4333-8333-333333333333', created_at: new Date().toISOString() }
        writes.push({ table, payload: request.postDataJSON() })
      }
      data = request.headers().accept?.includes('object') ? savedList : savedList ? [savedList] : []
    }
    await route.fulfill({ json: data, headers: { 'content-range': '0-0/1' } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  return { page, context }
}

try {
  await mkdir('output/alignment', { recursive: true })
  const guest = await setup(false)
  await guest.page.goto(`${base}/lists/new?template=${template.id}`)
  await guest.page.locator('.alignment-edit-cell').first().waitFor()
  assert.equal(await guest.page.locator('.alignment-label-input').count(), 0)
  assert.equal(await guest.page.locator('.alignment-size-controls').count(), 0)
  assert.equal(await guest.page.locator('.alignment-corner').innerText(), '')
  const square = await guest.page.locator('.alignment-cell').first().boundingBox()
  assert.ok(Math.abs(square.width - square.height) < 1)
  assert.equal(await guest.page.locator('.alignment-edit-cell').count(), 9)
  await guest.page.getByRole('button', { name: 'Añadir elemento: Fila 1 · Columna 1', exact: true }).click()
  await guest.page.locator('.cl-modal-grid-item').filter({ hasText: 'Héroe' }).click()
  await guest.page.getByRole('button', { name: 'Añadir elemento: Fila 1 · Columna 2', exact: true }).click()
  await guest.page.locator('.cl-modal-grid-item').filter({ hasText: 'Villano' }).click()
  const heroCell = guest.page.getByRole('button', { name: 'Cambiar Héroe: Fila 1 · Columna 1', exact: true })
  await heroCell.focus()
  await heroCell.press('Alt+ArrowRight')
  await guest.page.getByRole('button', { name: 'Cambiar Héroe: Fila 1 · Columna 2', exact: true }).waitFor()
  assert.equal(await guest.page.locator('.alignment-edit-cell img').first().evaluate(el => getComputedStyle(el).objectFit), 'contain')
  await guest.page.getByRole('button', { name: 'Cambiar Villano: Fila 1 · Columna 1', exact: true }).waitFor()
  // A second assignment of the same artwork has its own drag identity.
  await guest.page.getByRole('button', { name: 'Añadir elemento: Fila 1 · Columna 3', exact: true }).click()
  await guest.page.locator('.cl-modal-grid-item').filter({ hasText: 'Héroe' }).click()
  const source = await guest.page.getByRole('button', { name: 'Cambiar Héroe: Fila 1 · Columna 3', exact: true }).boundingBox()
  const target = await guest.page.getByRole('button', { name: 'Añadir elemento: Fila 2 · Columna 3', exact: true }).boundingBox()
  await guest.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await guest.page.mouse.down()
  await guest.page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 })
  await guest.page.mouse.up()
  await guest.page.getByRole('button', { name: 'Cambiar Héroe: Fila 2 · Columna 3', exact: true }).waitFor()
  await guest.page.locator('.cl-drag-ghost').waitFor({ state: 'detached' })
  await guest.page.screenshot({ path: 'output/alignment/editor-desktop.png', fullPage: true })
  await guest.page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await guest.page.locator('.alignment-scroll').evaluate(el => el.scrollWidth > el.clientWidth))
  await guest.page.screenshot({ path: 'output/alignment/editor-mobile.png', fullPage: true })
  await guest.page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await guest.page.locator('.cl-guest-download-btn:enabled').waitFor({ timeout: 30000 })
  const draft = await guest.page.evaluate(() => JSON.parse(localStorage.getItem('geeksphere.pending-guest-list-draft')).draft)
  assert.equal(draft.payload.list_type, 'alignment')
  assert.equal(Object.values(draft.payload.content).filter(Boolean).length, 3)
  assert.equal(draft.payload.content['a:neutral-x:good'].id, 'hero')
  const exportResult = await guest.page.evaluate(async () => {
    const { generateListImage } = await import('/src/pages/lists/ViewList.jsx')
    const source = document.querySelector('.cl-guest-render-source .vl-post-visual-wrapper')
    const blob = await generateListImage(source, 'Alineamiento', '', null, '#14b8a6', '', '', 'alignment', false)
    const bitmap = await createImageBitmap(blob)
    return { bytes: blob.size, width: bitmap.width, height: bitmap.height, data: await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) }) }
  })
  assert.equal(exportResult.width, 1200)
  assert.ok(exportResult.bytes > 5000)
  await writeFile('output/alignment/export-mobile.png', Buffer.from(exportResult.data.split(',')[1], 'base64'))
  await guest.page.locator('.cl-guest-register-btn').click()
  assert.equal(await guest.page.evaluate(() => JSON.parse(localStorage.getItem('geeksphere.pending-guest-list-draft')).registerRequested), true)
  await guest.context.close()

  const signedIn = await setup(true)
  const page = signedIn.page
  await page.goto(`${base}/templates/${template.id}/edit`)
  await page.getByRole('group', { name: 'Columnas', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Quitar una columna', exact: true }).click()
  await page.getByRole('button', { name: 'Quitar una fila', exact: true }).click()
  await page.getByLabel('Texto de columna 1', { exact: true }).fill('Poco')
  await page.getByLabel('Texto de columna 2', { exact: true }).fill('Mucho')
  await page.getByRole('button', { name: 'Añadir una columna', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.waitForURL(`**/templates/${template.id}`)
  assert.equal(template.type_config.axes.x.entries.length, 3)
  assert.equal(template.type_config.axes.y.entries.length, 2)
  assert.equal(template.type_config.axes.x.entries[0].label, 'Poco')
  await page.goto(`${base}/templates/${template.id}/edit`)
  await page.getByLabel('Texto de columna 1', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Texto de columna 1', { exact: true }).inputValue(), 'Poco')
  assert.equal(await page.locator('.alignment-cell').count(), 6)
  await page.goto(`${base}/lists/new?template=${template.id}`)
  await page.locator('.alignment-edit-cell').first().waitFor()
  await page.locator('.alignment-pick').first().click()
  await page.locator('.cl-modal-grid-item').filter({ hasText: 'Héroe' }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.waitForURL('**/share?**')
  const published = page.waitForResponse(response => response.url().includes('/rest/v1/user_lists') && response.request().method() === 'POST')
  await page.locator('.share-post-button').click()
  // The request payload is the persistence boundary; the list is reopened from it.
  await published
  assert.ok(savedList)
  assert.equal(savedList.list_type, 'alignment')
  assert.equal(Object.values(savedList.content).filter(Boolean).length, 1)
  await page.goto(`${base}/lists/${savedList.id}/edit`)
  await page.locator('.alignment-edit-cell').first().waitFor()
  assert.equal(await page.locator('.alignment-edit-cell img').count(), 1)
  assert.equal(await page.locator('.alignment-edit-cell').count(), 6)
  assert.equal(await page.locator('.alignment-label-input').count(), 0)
  assert.equal(await page.locator('.alignment-size-controls').count(), 0)
  await page.screenshot({ path: 'output/alignment/editor-rectangular.png', fullPage: true })
  // A missing/private source template must not unlock a template-backed list.
  const templatePattern = '**/rest/v1/list_templates?**'
  await page.route(templatePattern, route => route.fulfill({ status: 403, json: { message: 'Template unavailable in this test' } }))
  await page.goto(`${base}/lists/${savedList.id}/edit`)
  await page.locator('.alignment-edit-cell').first().waitFor()
  assert.equal(await page.locator('.alignment-label-input').count(), 0)
  assert.equal(await page.locator('.alignment-size-controls').count(), 0)
  const savedWithSource = page.waitForResponse(response => response.url().includes('/rest/v1/user_lists') && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await savedWithSource
  assert.equal(savedList.template_id, template.id)
  await page.unroute(templatePattern)
  await page.goto(`${base}/templates/${template.id}/edit`)
  await page.getByRole('button', { name: 'Añadir una columna', exact: true }).waitFor()
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Añadir una columna', exact: true }).click()
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: 'Añadir una fila', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Añadir una columna', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Añadir una fila', exact: true }).isDisabled(), true)
  await page.getByLabel('Texto de columna 1', { exact: true }).fill('Categoría muy larga para comprobar el ajuste de texto')
  await page.getByLabel('Texto de fila 1', { exact: true }).fill('ExtraordinariamentePersonalizado')
  await page.screenshot({ path: 'output/alignment/template-builder.png', fullPage: true })
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.waitForURL(`**/templates/${template.id}`)
  // Previously published lists retain their own axes after their template changes.
  await page.goto(`${base}/lists/${savedList.id}/edit`)
  await page.locator('.alignment-edit-cell').first().waitFor()
  assert.equal(await page.locator('.alignment-edit-cell').count(), 6)
  await page.goto(`${base}/lists/new?template=${template.id}`)
  await page.locator('.alignment-edit-cell').first().waitFor()
  assert.equal(await page.locator('.alignment-edit-cell').count(), 36)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.waitForURL('**/share?**')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.alignment-board').waitFor()
  assert.equal(await page.locator('.alignment-cell').count(), 36)
  const fittedSquares = await page.locator('.alignment-cell').evaluateAll(cells => cells.map(cell => { const r = cell.getBoundingClientRect(); return Math.abs(r.width - r.height) < 1 }))
  assert.ok(fittedSquares.every(Boolean))
  assert.equal(await page.locator('.alignment-corner').innerText(), '')
  assert.ok(await page.locator('.alignment-board').evaluate(el => el.getBoundingClientRect().width <= el.parentElement.clientWidth + 1))
  await page.screenshot({ path: 'output/alignment/preview-6x6-mobile.png', fullPage: true })
  const maximumImage = await page.evaluate(async () => {
    const { generateListImage } = await import('/src/pages/lists/ViewList.jsx')
    const blob = await generateListImage(document.querySelector('.vl-post-visual-wrapper'), 'Alineamiento 6×6', '', null, '#14b8a6', '', '', 'alignment', false)
    return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) })
  })
  await writeFile('output/alignment/export-6x6.png', Buffer.from(maximumImage.split(',')[1], 'base64'))
  await page.goto(`${base}/templates?new=1`)
  await page.locator('.ctm-type-card').filter({ hasText: 'Alineamiento' }).click()
  await page.locator('.ctm-input').first().fill('Mi alineamiento personalizado')
  await page.locator('.ctm-vis-btn').filter({ hasText: 'Privada' }).click()
  await page.locator('.ctm-footer-next').click()
  await page.waitForURL(`**/templates/${template.id}/edit`)
  assert.equal(template.list_type, 'alignment')
  assert.equal(template.visibility, 'private')
  assert.equal(template.type_config.axes.x.entries.length, 3)
  assert.equal(template.type_config.axes.y.entries.length, 3)
  await page.setViewportSize({ width: 1360, height: 1000 })
  await page.goto(`${base}/share?openList=1`)
  await page.getByRole('tab', { name: 'Plantillas', exact: true }).click()
  await page.locator('.share-template-result').filter({ hasText: template.title }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Plantillas de alineamiento', exact: true }).count(), 0)
  await page.screenshot({ path: 'output/alignment/share-templates.png', fullPage: true })
  await page.getByRole('tab', { name: 'Sin plantillas', exact: true }).click()
  assert.equal(await page.locator('.share-list-kind-pill').count(), 4)
  await page.screenshot({ path: 'output/alignment/share-standalone.png', fullPage: true })
  await page.getByRole('button', { name: 'Alineamiento', exact: true }).click()
  await page.waitForURL('**/share?listType=alignment')
  assert.equal(await page.locator('.alignment-cell').count(), 9)
  await page.getByRole('button', { name: 'Editar alineamiento', exact: true }).click()
  await page.waitForURL('**/lists/new?type=alignment')
  await page.locator('.alignment-edit-cell').first().waitFor()
  await page.getByRole('button', { name: 'Quitar una columna', exact: true }).click()
  await page.getByRole('button', { name: 'Quitar una fila', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir una columna', exact: true }).click()
  assert.equal(await page.locator('.alignment-edit-cell').count(), 6)
  await page.getByLabel('Texto de columna 1', { exact: true }).fill('')
  await page.getByLabel('Texto de columna 1', { exact: true }).fill('Mi categoría')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.waitForURL('**/share?**')
  const standalonePublished = page.waitForResponse(response => response.url().includes('/rest/v1/user_lists') && response.request().method() === 'POST')
  await page.locator('.share-post-button').click()
  await standalonePublished
  assert.equal(savedList.template_id, null)
  assert.equal(savedList.type_config.axes.x.entries[0].label, 'Mi categoría')
  assert.equal(savedList.list_type, 'alignment')
  await page.goto(`${base}/lists/${savedList.id}/edit`)
  await page.locator('.alignment-edit-cell').first().waitFor()
  assert.equal(await page.locator('.alignment-edit-cell').count(), 6)
  assert.equal(await page.getByLabel('Texto de columna 1', { exact: true }).inputValue(), 'Mi categoría')
  assert.equal(await page.locator('.alignment-help').count(), 0)
  const rowTitle = page.getByLabel('Texto de fila 1', { exact: true })
  for (const label of ['Fila 1', 'Texto en dos\nlíneas']) {
    await rowTitle.fill(label)
    const centered = await rowTitle.evaluate(input => {
      const box = input.getBoundingClientRect()
      const heading = input.closest('[role="rowheader"]').getBoundingClientRect()
      return Math.abs(box.y + box.height / 2 - heading.y - heading.height / 2) < 1
    })
    assert.equal(centered, true)
  }
  await rowTitle.fill('Fila 1')
  await page.screenshot({ path: 'output/alignment/standalone-inline-editor.png', fullPage: true })
  // Compare artwork against the actual grid editor, rather than a second custom style.
  const alignmentRecord = savedList
  const artworkStyle = () => page.locator('.cl-grid-drop-wrapper .cl-item img').first().evaluate(img => {
    const style = getComputedStyle(img)
    const item = img.closest('.cl-item')
    const wrapper = img.closest('.cl-grid-drop-wrapper')
    return {
      fit: style.objectFit, radius: style.borderRadius, aspect: style.aspectRatio,
      background: getComputedStyle(item).backgroundColor,
      padding: getComputedStyle(wrapper).padding,
      fillsWidth: Math.abs(img.getBoundingClientRect().width - item.getBoundingClientRect().width) < 1,
      fillsHeight: Math.abs(img.getBoundingClientRect().height - item.getBoundingClientRect().height) < 1,
    }
  })
  savedList = { ...alignmentRecord, content: { ...alignmentRecord.content, [Object.keys(alignmentRecord.content)[0]]: items[0] } }
  await page.goto(`${base}/lists/${savedList.id}/edit`)
  await page.locator('.alignment-edit-cell img').first().waitFor()
  await page.mouse.move(0, 0)
  const alignmentArtwork = await artworkStyle()
  assert.equal(alignmentArtwork.padding, '0px')
  assert.equal(alignmentArtwork.radius, '0px')
  assert.equal(alignmentArtwork.fillsWidth && alignmentArtwork.fillsHeight, true)
  await page.screenshot({ path: 'output/alignment/artwork-like-grid.png', fullPage: true })
  savedList = { ...alignmentRecord, list_type: 'grid', type_config: { columns: 2, cells: [{ id: 'c1', label: 'Grid 1' }, { id: 'c2', label: 'Grid 2' }] }, content: { c0: items[0], c1: null } }
  await page.goto(`${base}/lists/${savedList.id}/edit`)
  await page.locator('.cl-grid-drop-wrapper .cl-item img').first().waitFor()
  await page.mouse.move(0, 0)
  assert.deepEqual(alignmentArtwork, await artworkStyle())
  savedList = alignmentRecord
  await signedIn.context.close()
  const regression = await setup(false)
  for (const [type, selector, count] of [['tierlist', '.cl-tier-row', 5], ['grid', '.cl-grid-cell', 4], ['ranking', '.cl-ranking-row', 3]]) {
    await regression.page.goto(`${base}/lists/new?type=${type}`)
    await regression.page.locator(selector).first().waitFor()
    assert.equal(await regression.page.locator(selector).count(), count)
    await regression.page.getByRole('button', { name: 'Terminar', exact: true }).click()
    await regression.page.locator('.cl-guest-download-btn:enabled').waitFor({ timeout: 30000 })
  }
  await regression.context.close()
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, writes: writes.map(write => write.table), export: { bytes: exportResult.bytes, width: exportResult.width, height: exportResult.height } }))
} finally {
  await browser.close()
}
