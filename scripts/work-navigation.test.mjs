import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { transformSync } from 'esbuild'

const code = transformSync(await readFile(new URL('../src/lib/pwaRouteTransition.js', import.meta.url), 'utf8'), { format: 'cjs' }).code
const tick = () => new Promise(resolve => setTimeout(resolve, 15))

function environment({ standalone = true, transitions = true, index = 1 } = {}) {
  class PopEvent extends Event { constructor(type, { state }) { super(type); this.state = state } }
  const window = Object.assign(new EventTarget(), {
    location: new URL('https://example.test/game/7'), history: { state: { idx: index, key: 'work' } },
    matchMedia: query => ({ matches: query.includes('display-mode') && standalone }),
    scrollY: 0, innerHeight: 800, setTimeout, clearTimeout,
    scrollTo(x, y) { this.scrollY = y },
  })
  let visibleRoute = '/game/7'
  let routerCalls = 0
  const snapshots = []
  const document = { documentElement: { dataset: {}, scrollHeight: 3000 }, body: {}, querySelector: () => null }
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
    controller.completePwaNavigation(event.state.key, visibleRoute, 'POP')
  })
  return { controller, window, document, snapshots, cleanup, calls: () => routerCalls, pop(pathname, idx, key) {
    window.location.pathname = pathname
    window.history.state = { idx, key }
    window.dispatchEvent(new PopEvent('popstate', { state: window.history.state }))
  } }
}

test('work details join the existing transition routes without capturing unrelated subpages', () => {
  const env = environment()
  for (const route of ['/game/7', '/anime/10', '/posts/post-1', '/reviews/review-1', '/share']) assert.ok(env.controller.isPwaTransitionRoute(route))
  for (const route of ['/game/7/reviews', '/game/7/edit', '/search', '/lists/new']) assert.equal(env.controller.isPwaTransitionRoute(route), false)
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
    env.controller.completePwaNavigation('home', '/home', 'REPLACE')
  })
  await tick()
  assert.equal(calls[0].to, '/home')
  assert.equal(calls[0].options.replace, true)
  assert.equal(env.document.documentElement.dataset.pwaWorkDirection, undefined)
  env.cleanup()
})
