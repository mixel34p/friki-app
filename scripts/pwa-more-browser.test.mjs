// Exercise the real Layout with local account fixtures; no remote data is read or changed.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const runtime = process.env.PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(/^[A-Z]:/i.test(runtime) ? pathToFileURL(runtime).href : runtime)
const root = process.cwd()
const out = path.join(root, 'output/pwa-more-qa')
await mkdir(out, { recursive: true })

const auth = `
const params = new URLSearchParams(location.search);
const scenario = params.get('scenario');
globalThis.__accountCalls = [];
const profile = { username: 'mixel', display_name: scenario === 'long' ? 'UnNombreDePerfilMuyLargoSinEspaciosQueDebeCaberEnElPanel' : 'Miguel', theme_color: params.get('accent') || '#a78bfa', avatar_url: scenario === 'photo' ? '/icons/pwa-192.png' : null };
const accounts = [{ id: 'me', profile }, { id: 'second', profile: { username: 'marina', display_name: 'Marina', theme_color: '#14b8a6' } }];
if (scenario === 'limit') accounts.push({ id: 'third', profile: { username: 'alex', display_name: 'Alex' } });
export const useAuth = () => ({ user: scenario === 'guest' ? null : { id: 'me' }, profile: scenario === 'guest' ? null : profile, accounts,
 signOut: async () => { globalThis.__accountCalls.push('signOut'); },
 rememberCurrentAccount: async () => { globalThis.__accountCalls.push('remember'); },
 switchAccount: id => { globalThis.__accountCalls.push(id); return new Promise((resolve, reject) => { globalThis.__finishSwitch = () => resolve({ username: 'marina' }); globalThis.__failSwitch = () => reject(new Error('Synthetic account failure')); }); }
});`
const database = `
const query = { select() { return this; }, eq() { return this; }, limit() { return this; }, then(resolve) { return Promise.resolve({ data: [], count: 0 }).then(resolve); } };
export const supabase = { from: () => Object.create(query), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };`
const entry = `
import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './src/components/Layout';
import PwaNavigation from './src/components/PwaNavigation';
import { signalPwaRouteReady } from './src/lib/pwaRouteTransition';
import './src/index.css';
function Page() {
 const location = useLocation();
 useLayoutEffect(() => signalPwaRouteReady(location.pathname), [location.pathname]);
 return <div style={{ minHeight: 2400, padding: '32px 20px' }}><h1>Tu universo friki</h1><p>Comparte lo que te apasiona.</p><div style={{ marginTop: 24, padding: 24, borderRadius: 16, background: '#17151e' }}>Tus juegos, anime y manga en un mismo lugar.</div><button type="button" onClick={() => { globalThis.__backgroundClicked = true; }}>Contenido de fondo</button><p data-route>{location.pathname}</p></div>;
}
createRoot(document.getElementById('app')).render(<React.StrictMode><BrowserRouter><PwaNavigation /><Routes><Route element={<Layout />}><Route path="*" element={<Page />} /></Route></Routes></BrowserRouter></React.StrictMode>);`

const bundle = await build({
  stdin: { contents: entry, loader: 'jsx', resolveDir: root },
  outfile: path.join(out, 'preview.js'), write: false, bundle: true, format: 'iife', jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  plugins: [{ name: 'local-fixtures', setup(builder) {
    builder.onResolve({ filter: /[\\/]AuthContext(?:\.jsx)?$/ }, () => ({ path: 'auth', namespace: 'fixtures' }))
    builder.onResolve({ filter: /[\\/]supabase(?:\.js)?$/ }, () => ({ path: 'db', namespace: 'fixtures' }))
    builder.onResolve({ filter: /[\\/]ListsEntry(?:\.jsx)?$/ }, () => ({ path: 'lists', namespace: 'fixtures' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixtures' }, args => ({ contents: args.path === 'auth' ? auth : args.path === 'db' ? database : 'export const ListsEntryModal = () => null;', loader: 'js' }))
  } }],
})

const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/preview.css"></head><body><div id="app"></div><script src="/preview.js"></script></body></html>'
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
const errors = []
let checks = 0
const base = 'https://pwa-more.test'

async function setup({ width = 390, height = 844, pwa = true, ios = false, reducedMotion = 'reduce', hasTouch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, hasTouch })
  await context.addInitScript(({ pwa, ios }) => {
    if (ios) Object.defineProperty(navigator, 'standalone', { value: true })
    else if (pwa) {
      const original = window.matchMedia.bind(window)
      window.matchMedia = query => {
        const result = original(query)
        if (query.includes('display-mode:')) Object.defineProperty(result, 'matches', { value: true })
        return result
      }
    }
  }, { pwa, ios })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== base) return route.abort()
    if (url.pathname === '/preview.js' || url.pathname === '/preview.css') return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: bundle.outputFiles.find(file => path.basename(file.path) === url.pathname.slice(1)).text })
    if (url.pathname.startsWith('/icons/')) return route.fulfill({ contentType: 'image/png', body: await readFile(path.join(root, 'public', url.pathname)) })
    return route.fulfill({ contentType: 'text/html', body: html })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const trigger = () => page.getByRole('button', { name: width > 960 ? 'Más' : 'Abrir menú', exact: true })
  const open = async () => { await trigger().click(); await page.locator('dialog.pwa-more-overlay[open]').waitFor() }
  return { context, page, trigger, open }
}

try {
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 1800]]) {
    const { context, page, trigger, open } = await setup({ width, height })
    await page.goto(base + '/home')
    await page.evaluate(() => window.scrollTo(0, 240))
    const scrollBefore = await page.evaluate(() => scrollY)
    await open()
    assert.equal(await page.locator('.pwa-more-overlay').count(), 1)
    assert.equal(await page.locator('.sidebar-popover').count(), 0)
    assert.equal(await page.locator('.pwa-more-overlay').evaluate(node => node.parentElement === document.body), true)
    const geometry = await page.locator('.pwa-more-drawer').evaluate(node => {
      const box = node.getBoundingClientRect()
      return { width: box.width, right: box.right, height: box.height, overflow: node.scrollWidth > node.clientWidth }
    })
    assert.ok(Math.abs(geometry.width - Math.min(width * .88, 380)) < 1)
    assert.equal(geometry.right, width)
    assert.equal(geometry.height, height)
    assert.equal(geometry.overflow, false)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden')
    assert.equal(await page.locator('.pwa-more-drawer').evaluate(node => getComputedStyle(node).animationName), 'none')
    assert.deepEqual(await page.locator('.pwa-more-drawer .more-menu-links a').allTextContents(), ['Mi perfil', 'Invitar amigos', 'Guardados', 'Grupos', 'Ajustes', 'Apoyar'])
    assert.equal(await page.locator('.pwa-more-drawer .more-menu-link').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 54 && getComputedStyle(node).fontSize === '17px')), true)
    await page.screenshot({ path: path.join(out, `pwa-${width}.png`) })
    await page.locator('.pwa-more-drawer').hover()
    await page.mouse.wheel(0, 500)
    assert.equal(await page.evaluate(() => scrollY), scrollBefore)
    await page.getByRole('link', { name: 'Créditos', exact: true }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.getByRole('button', { name: 'Cerrar menú' }).evaluate(node => node === document.activeElement), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.getByRole('link', { name: 'Créditos', exact: true }).evaluate(node => node === document.activeElement), true)
    await page.locator('.mobile-brand').evaluate(node => node.focus())
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('.pwa-more-overlay')), true)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.pwa-more-overlay').count(), 0)
    assert.equal(await trigger().evaluate(node => node === document.activeElement), true)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.equal(await page.evaluate(() => scrollY), scrollBefore)
    await open()
    await page.mouse.click(8, height / 2)
    assert.equal(await page.locator('.pwa-more-overlay').count(), 0)
    assert.equal(await page.evaluate(() => globalThis.__backgroundClicked), undefined)
    await open()
    await page.getByRole('button', { name: 'Cerrar menú' }).click()
    assert.equal(await trigger().getAttribute('aria-expanded'), 'false')
    checks++
    await context.close()
  }

  const { context, page, open } = await setup()
  await page.goto(base + '/profile/mixel')
  await page.evaluate(() => { document.body.style.overflow = 'clip'; document.documentElement.style.overflow = 'auto' })
  await open()
  await page.locator('.pwa-more-drawer .more-menu-link[href="/profile/mixel"]').click()
  assert.equal(await page.locator('.pwa-more-overlay').count(), 0)
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip')
  assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'auto')
  for (const [label, destination] of [['Invitar amigos', '/invite'], ['Guardados', '/saved'], ['Grupos', '/groups'], ['Ajustes', '/settings'], ['Privacidad', '/privacy'], ['Términos', '/terms'], ['Normas de la comunidad', '/community-guidelines'], ['Créditos', '/credits']]) {
    await open()
    await page.locator('.pwa-more-drawer').getByRole('link', { name: label, exact: true }).click()
    await page.waitForURL(base + destination)
    assert.equal(await page.locator('.pwa-more-overlay').count(), 0)
  }
  await open()
  const support = page.getByRole('link', { name: 'Apoyar en Ko-fi (se abre en una pestaña nueva)' })
  assert.equal(await support.getAttribute('href'), 'https://ko-fi.com/mixel34')
  const popupPromise = context.waitForEvent('page')
  await support.click()
  const popup = await popupPromise
  await popup.close()
  assert.equal(await page.locator('.pwa-more-overlay').count(), 0)
  checks++

  await open()
  await page.getByRole('button', { name: 'Cambiar de cuenta', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Volver al menú' }).evaluate(node => node === document.activeElement), true)
  assert.equal(await page.locator('.more-account-actions .more-menu-link').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 54)), true)
  await page.getByRole('button', { name: 'Cambiar a Marina', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Cambiar a Marina' }).getAttribute('aria-busy'), 'true')
  assert.equal(await page.getByRole('status', { name: 'Cambiando de cuenta' }).count(), 1)
  await page.evaluate(() => globalThis.__failSwitch())
  await page.waitForFunction(() => document.querySelector('[aria-label="Cambiar a Marina"]').getAttribute('aria-busy') === 'false')
  await page.getByRole('button', { name: 'Volver al menú' }).click()
  assert.equal(await page.getByRole('button', { name: 'Cambiar de cuenta', exact: true }).evaluate(node => node === document.activeElement), true)
  await page.getByRole('button', { name: 'Cambiar de cuenta', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir cuenta', exact: true }).click()
  await page.waitForURL(base + '/login?addAccount=1')
  assert.deepEqual(await page.evaluate(() => globalThis.__accountCalls), ['second', 'remember'])
  await open()
  await page.getByRole('button', { name: 'Cambiar de cuenta', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar sesión @mixel', exact: true }).click()
  await page.waitForURL(base + '/login')
  assert.deepEqual(await page.evaluate(() => globalThis.__accountCalls), ['second', 'remember', 'signOut'])
  assert.equal(await page.locator('.pwa-more-overlay').count(), 0)
  checks++
  await context.close()

  const switched = await setup()
  await switched.page.goto(base + '/home')
  await switched.open()
  await switched.page.getByRole('button', { name: 'Cambiar de cuenta', exact: true }).click()
  await switched.page.getByRole('button', { name: 'Cambiar a Marina', exact: true }).click()
  await switched.page.evaluate(() => globalThis.__finishSwitch())
  await switched.page.waitForURL(base + '/profile/marina')
  assert.equal(await switched.page.evaluate(() => sessionStorage.getItem('geeksphere.account-switched-toast')), '@marina')
  assert.equal(await switched.page.locator('.pwa-more-overlay').count(), 0)
  await switched.context.close()
  checks++

  for (const scenario of ['long', 'photo', 'limit']) {
    const { context, page, open } = await setup({ width: 320, height: 568 })
    await page.goto(base + '/home?scenario=' + scenario + '&accent=%23161616')
    await open()
    assert.equal(await page.locator('.pwa-more-drawer').evaluate(node => node.scrollWidth > node.clientWidth), false)
    assert.equal(await page.locator('.pwa-more-profile > img').evaluate(node => node.complete && node.naturalWidth > 0), true)
    if (scenario === 'limit') {
      await page.getByRole('button', { name: 'Cambiar de cuenta', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Límite de cuentas alcanzado' }).isDisabled(), true)
      assert.equal(await page.locator('.more-current-account').count(), 3)
    }
    await page.screenshot({ path: path.join(out, `pwa-${scenario}.png`) })
    checks++
    await context.close()
  }

  const ios = await setup({ pwa: false, ios: true, hasTouch: true, reducedMotion: 'no-preference' })
  await ios.page.goto(base + '/home?accent=%23ffffff')
  await ios.open()
  assert.equal(await ios.page.locator('.pwa-more-drawer').evaluate(node => getComputedStyle(node).animationDuration), '0.22s')
  await ios.page.waitForFunction(() => document.querySelector('.pwa-more-drawer').getBoundingClientRect().right <= innerWidth + 1)
  await ios.page.touchscreen.tap(8, 400)
  assert.equal(await ios.page.locator('.pwa-more-overlay').count(), 0)
  checks++
  await ios.context.close()

  for (const width of [390, 1360]) {
    const web = await setup({ width, height: 980, pwa: false })
    await web.page.goto(base + '/home')
    await web.trigger().click()
    assert.equal(await web.page.locator('.pwa-more-overlay').count(), 0)
    const menu = web.page.locator(width > 960 ? '.more-popover-desktop' : '.mobile-topbar-menu')
    assert.equal(await menu.isVisible(), true)
    assert.deepEqual(await menu.locator('.more-menu-links a').allTextContents(), ['Ajustes', 'Guardados', 'Grupos', 'Invitar', 'Apoyar'])
    await web.page.screenshot({ path: path.join(out, `web-${width}.png`) })
    await web.page.keyboard.press('Escape')
    assert.equal(await menu.count(), 0)
    checks++
    await web.context.close()
  }

  const guest = await setup()
  await guest.page.goto(base + '/home?scenario=guest')
  assert.equal(await guest.page.getByRole('button', { name: 'Abrir menú' }).count(), 0)
  assert.equal(await guest.page.locator('.guest-mobile-actions').isVisible(), true)
  assert.equal(await guest.page.locator('.pwa-more-overlay').count(), 0)
  await guest.context.close()
  checks++
  assert.deepEqual(errors, [])
  await writeFile(path.join(out, 'result.json'), JSON.stringify({ checks, errors }, null, 2))
  console.log(`PASS ${checks} groups: PWA layouts, focus, scroll, closing, routes, accounts, iOS detection, motion, avatars and browser/guest regressions. Screenshots: ${out}`)
} finally {
  await browser.close()
}
