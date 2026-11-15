import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'file:///C:/Users/Equipo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Equipo/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const report = []
try {
  for (const width of [1360, 390, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } })
    const errors = [], catalogCalls = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', req => { if (req.url().includes('/functions/v1/manga-catalog')) catalogCalls.push(req.url()) })
    await page.goto('http://127.0.0.1:5174/search')
    const tile = page.locator('.search-category-card.manga')
    await page.waitForFunction(() => document.querySelectorAll('.search-category-card.manga img').length === 2 && [...document.querySelectorAll('.search-category-card.manga img')].every(img => img.naturalWidth > 0))
    const layout = await page.locator('.search-category-grid').evaluate(grid => [...grid.children].map(card => ({ title: card.innerText, width: card.getBoundingClientRect().width, top: card.getBoundingClientRect().top })))
    assert.equal(layout.length, 3)
    assert.ok(layout.every(card => Math.abs(card.width - layout[0].width) < 1 && Math.abs(card.top - layout[0].top) < 1))
    assert.equal(catalogCalls.length, 0, 'Search decoration must use local catalog, no provider requests')
    await page.screenshot({ path: `output/manga/real-search-${width}.png`, fullPage: true })
    await tile.click()
    await page.waitForURL('**/discover/manga')
    await page.locator('.discover-work-card').first().waitFor()
    const cards = page.locator('.discover-work-card')
    assert.equal(await cards.count(), 24)
    const buttons = page.getByRole('group', { name: 'Tipo de obra' }).getByRole('button')
    const tabs = await buttons.evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, pressed: node.getAttribute('aria-pressed'), width: node.getBoundingClientRect().width, background: getComputedStyle(node).backgroundColor })))
    assert.equal(tabs.length, 3)
    assert.ok(tabs.every(tab => Math.abs(tab.width - tabs[0].width) < 1))
    assert.equal(tabs[2].pressed, 'true')
    assert.notEqual(tabs[2].background, tabs[0].background)
    const berserk = page.locator('.discover-work-card').filter({ has: page.locator('strong').getByText('Berserk', { exact: true }) })
    assert.equal(await berserk.getAttribute('href'), '/manga/mal:manga:2')
    for (const img of await cards.locator('img').all()) {
      await img.scrollIntoViewIfNeeded()
      await img.evaluate(async image => { await image.decode() })
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: `output/manga/real-discover-${width}.png`, fullPage: true })
    await berserk.click()
    await page.getByRole('heading', { name: 'Berserk', exact: true }).waitFor()
    assert.match(await page.locator('.work-details').innerText(), /Capítulos/)
    assert.deepEqual(errors, [])
    report.push({ width, layout, cards: 24, mangaCoverImages: 2, providerRequestsForDecoration: 0, correctDetailLink: true, errors })
    await page.close()
  }
  await writeFile('output/manga/real-explore-verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }
