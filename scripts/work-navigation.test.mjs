import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { transformSync } from 'esbuild'

const code = transformSync(await readFile(new URL('../src/lib/pwaRouteTransition.js', import.meta.url), 'utf8'), { format: 'cjs' }).code
const tick = () => new Promise(resolve => setTimeout(resolve, 15))

function environment({ standalone = true, transitions = true, index = 1, pathname = '/game/7' } = {}) {
  class PopEvent extends Event { constructor(type, { state }) { super(type); this.state = state } }
  const window = Object.assign(new EventTarget(), {
    location: new URL('https://example.test' + pathname), history: { state: { idx: index, key: 'work' }, scrollRestoration: 'auto' },
    matchMedia: query => ({ matches: query.includes('display-mode') && standalone }),
    scrollY: 0, innerHeight: 800, setTimeout, clearTimeout,
    scrollTo(position, y) { this.scrollY = typeof position === 'object' ? position.top : y },
  })
  let visibleRoute = pathname
  let routerCalls = 0
  const snapshots = []
  const surfaces = Array.from({ length: 3 }, () => ({ scrollTop: 0, scrollTo(position) { this.scrollTop = position.top } }))
  const document = { documentElement: { dataset: {}, scrollHeight: 3000 }, body: {}, querySelector: () => null, querySelectorAll: () => surfaces }
  if (transitions) document.startViewTransition = callback => {
    snapshots.push({ route: visibleRoute, direction: document.documentElement.dataset.pwaWorkDirection })
    const updateCallbackDone = Promise.resolve().then(callback)
    return { updateCallbackDone, finished: updateCallbackDone.then(tick) }
  }
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module, exports: module.exports, URL, navigator: {}, window, document, PopStateEvent: PopEvent,
    MutationObserver: class { observe() {} disconnect() {} },
    require: () => ({ navigateBackOrHome: navigate => index > 0 ? navigate(-1) : navigate('/home', { replace: true }) }),
  })
  const controller = module.exports
  const cleanup = controller.installWorkHistoryTransitions()
  // This listener models the router: it must only receive one committed traversal.
  window.addEventListener('popstate', event => {
    routerCalls++
    visibleRoute = window.location.pathname
    controller.completePwaNavigation(visibleRoute)
  })
  return { controller, window, document, surfaces, snapshots, cleanup, calls: () => routerCalls, pop(pathname, idx, key) {
    window.location.pathname = pathname
    window.history.state = { idx, key }
    window.dispatchEvent(new PopEvent('popstate', { state: window.history.state }))
  } }
}

test('work details join the existing transition routes without capturing unrelated subpages', () => {
  const env = environment()
  for (const route of ['/game/7', '/anime/10', '/posts/post-1', '/reviews/review-1', '/share', '/discover/anime', '/discover/games?order=rated', '/discover/lists?tab=templates']) assert.ok(env.controller.isPwaTransitionRoute(route))
  for (const route of ['/game/7/reviews', '/game/7/edit', '/search', '/lists/new', '/discover/users', '/discover/games/extra', '/discover/lists/extra']) assert.equal(env.controller.isPwaTransitionRoute(route), false)
  env.cleanup()
})

test('discovery screens use directional native back and forward without capturing filter history', async () => {
  const env = environment({ pathname: '/discover/games' })
  env.pop('/discover/games', 0, 'filter')
  assert.equal(env.calls(), 1)
  assert.equal(env.snapshots.length, 0)
  env.pop('/search', 0, 'search')
  await tick(); await tick()
  assert.equal(env.calls(), 2)
  assert.equal(env.snapshots[0].direction, 'back')
  env.pop('/discover/games', 1, 'catalog')
  await tick(); await tick()
  assert.equal(env.calls(), 3)
  assert.equal(env.snapshots[1].direction, 'forward')
  env.cleanup()
})

test('native back captures the old work screen, replays once and supports forward', async () => {
  const env = environment()
  env.pop('/search', 0, 'search')
  assert.equal(env.calls(), 0)
  await tick(); await tick()
  assert.equal(env.calls(), 1)
  assert.deepEqual(env.snapshots, [{ route: '/game/7', direction: 'back' }])
  env.pop('/game/7', 1, 'work')
  await tick(); await tick()
  assert.equal(env.calls(), 2)
  assert.equal(env.snapshots[1].direction, 'forward')
  assert.equal(env.document.documentElement.dataset.pwaWorkDirection, undefined)
  env.cleanup()
})

test('browser navigation stays ordinary outside an installed PWA', async () => {
  const env = environment({ standalone: false })
  env.pop('/search', 0, 'search')
  assert.equal(env.calls(), 1)
  assert.equal(env.snapshots.length, 0)
  env.cleanup()
})

test('direct-entry back falls home even without view-transition support', async () => {
  const env = environment({ index: 0, transitions: false })
  const calls = []
  env.controller.navigateWorkBack((to, options) => {
    calls.push({ to, options })
    env.controller.completePwaNavigation('/home')
  })
  await tick()
  assert.equal(calls[0].to, '/home')
  assert.equal(calls[0].options.replace, true)
  assert.equal(env.document.documentElement.dataset.pwaWorkDirection, undefined)
  env.cleanup()
})

test('PWA page changes reset window and standalone surfaces, including native back and forward', async () => {
  const env = environment({ pathname: '/discover/lists' })
  assert.equal(env.window.history.scrollRestoration, 'manual')
  env.controller.completePwaNavigation('/discover/lists')
  env.window.scrollY = 700
  env.surfaces.forEach(surface => { surface.scrollTop = 500 })
  env.controller.completePwaNavigation('/lists/1')
  assert.equal(env.window.scrollY, 0)
  assert.ok(env.surfaces.every(surface => surface.scrollTop === 0))
  env.window.scrollY = 800
  env.surfaces.forEach(surface => { surface.scrollTop = 600 })
  env.pop('/discover/lists', 0, 'catalog')
  await tick(); await tick()
  assert.equal(env.window.scrollY, 0)
  assert.ok(env.surfaces.every(surface => surface.scrollTop === 0))
  env.surfaces[0].scrollTop = 450
  env.pop('/lists/1', 1, 'list')
  await tick(); await tick()
  assert.equal(env.surfaces[0].scrollTop, 0)
  env.cleanup()
  assert.equal(env.window.history.scrollRestoration, 'auto')
})

test('same-page filter changes and ordinary browser scrolling remain untouched', () => {
  for (const standalone of [true, false]) {
    const env = environment({ standalone, pathname: '/discover/games' })
    env.controller.completePwaNavigation('/discover/games')
    env.window.scrollY = 500
    env.surfaces[0].scrollTop = 400
    env.controller.completePwaNavigation('/discover/games')
    assert.equal(env.window.scrollY, 500)
    assert.equal(env.surfaces[0].scrollTop, 400)
    if (!standalone) {
      env.controller.completePwaNavigation('/search')
      assert.equal(env.window.scrollY, 500)
      assert.equal(env.window.history.scrollRestoration, 'auto')
    }
    env.cleanup()
  }
})
