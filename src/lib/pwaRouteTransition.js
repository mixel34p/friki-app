import { navigateBackOrHome } from './navigation'

const SCREEN_ROUTE = /^\/(?:game|anime)\/[^/?#]+\/?$|^\/discover\/(?:anime|games|lists)\/?$/
const TRANSITION_ROUTE = /^\/share(?:[?#].*)?$|^\/(?:posts|reviews)\/[^/?#]+(?:[?#].*)?$|^\/(?:game|anime)\/[^/?#]+\/?(?:[?#].*)?$|^\/discover\/(?:anime|games|lists)\/?(?:[?#].*)?$|^\/(?:lists|templates)\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/
let pendingRoute = null
let pendingHistory = null
let currentPath = null
let currentIndex = 0
const replayedEvents = new WeakSet()
let hasCommitted = false

export function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true
}

function reducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
function getPathname(to) {
  if (typeof to === 'string') return new URL(to, window.location.href).pathname
  return to?.pathname || window.location.pathname
}

export function completePwaNavigation(pathname) {
  const changedPage = !hasCommitted || currentPath !== pathname
  currentPath = pathname
  hasCommitted = true
  currentIndex = window.history.state?.idx ?? 0
  if (changedPage && isStandalonePwa()) {
    const position = { top: 0, left: 0, behavior: 'instant' }
    window.scrollTo(position)
    for (const surface of document.querySelectorAll('.work-detail-pwa, .discover-detail-pwa, .pwa-detail-screen')) surface.scrollTo(position)
  }
  pendingHistory?.resolve()
}

export function navigatePwaRoute(navigate, to, options) {
  const pathname = getPathname(to)
  if (pathname === window.location.pathname || !isStandalonePwa() || !TRANSITION_ROUTE.test(pathname) || typeof document.startViewTransition !== 'function' || reducedMotion()) {
    return navigate(to, options)
  }
  let resolveReady
  const ready = new Promise(resolve => { resolveReady = resolve })
  const request = { pathname, resolve: resolveReady }
  pendingRoute = request
  const workTransition = SCREEN_ROUTE.test(pathname) || SCREEN_ROUTE.test(window.location.pathname)
  if (workTransition) document.documentElement.dataset.pwaWorkDirection = 'forward'
  const timer = window.setTimeout(resolveReady, 3000)
  const clear = () => {
    window.clearTimeout(timer)
    if (pendingRoute === request) pendingRoute = null
    if (workTransition && !pendingHistory) delete document.documentElement.dataset.pwaWorkDirection
  }
  try {
    const transition = document.startViewTransition(async () => { navigate(to, options); await ready })
    transition.finished.then(clear, clear)
    transition.updateCallbackDone.catch(clear)
    return transition
  } catch {
    clear()
    return navigate(to, options)
  }
}

function transitionWorkHistory(action, direction = 'back') {
  if (pendingHistory) return
  let resolveReady
  const ready = new Promise(resolve => { resolveReady = resolve })
  const request = { resolve: resolveReady }
  pendingHistory = request
  document.documentElement.dataset.pwaWorkDirection = direction
  const timer = window.setTimeout(resolveReady, 3000)
  const clear = () => {
    window.clearTimeout(timer)
    if (pendingHistory === request) {
      pendingHistory = null
      delete document.documentElement.dataset.pwaWorkDirection
    }
  }
  if (typeof document.startViewTransition === 'function' && !reducedMotion()) {
    try {
      const transition = document.startViewTransition(async () => { action(); await ready })
      transition.finished.then(clear, clear)
      transition.updateCallbackDone.catch(clear)
      return transition
    } catch { /* Use the screen animation on browsers without working view transitions. */ }
  }
  const surface = document.querySelector('.work-detail-pwa, .discover-detail-pwa')
  if (surface?.animate && !reducedMotion() && direction === 'back') {
    const animation = surface.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { duration: 280, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'forwards' })
    animation.finished.then(() => { action(); ready.then(clear) }, () => { action(); ready.then(clear) })
  } else { action(); ready.then(clear) }
}

export function navigateWorkBack(navigate, fallback = '/home') {
  if (!isStandalonePwa()) return navigateBackOrHome(navigate, fallback)
  return transitionWorkHistory(() => navigateBackOrHome(navigate, fallback))
}

// Capture native history before the router so the outgoing work screen can be
// snapshotted. Replay once inside the transition; the URL/history are unchanged.
export function installWorkHistoryTransitions() {
  currentPath = window.location.pathname
  hasCommitted = false
  currentIndex = window.history.state?.idx ?? 0
  const onPop = event => {
    if (replayedEvents.has(event) || pendingHistory || !isStandalonePwa()) return
    if (currentPath === window.location.pathname) return
    if (!SCREEN_ROUTE.test(currentPath || '') && !SCREEN_ROUTE.test(window.location.pathname)) return
    event.stopImmediatePropagation()
    const replay = new PopStateEvent('popstate', { state: event.state })
    replayedEvents.add(replay)
    const direction = (event.state?.idx ?? 0) > currentIndex ? 'forward' : 'back'
    transitionWorkHistory(() => window.dispatchEvent(replay), direction)
  }
  const previousRestoration = window.history.scrollRestoration
  const media = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
  const syncRestoration = () => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = isStandalonePwa() ? 'manual' : previousRestoration
  }
  syncRestoration()
  media.addEventListener?.('change', syncRestoration)
  window.addEventListener('popstate', onPop, true)
  return () => {
    window.removeEventListener('popstate', onPop, true)
    media.removeEventListener?.('change', syncRestoration)
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = previousRestoration
  }
}

export function signalPwaRouteReady(pathname) {
  if (pendingRoute?.pathname === pathname) pendingRoute.resolve()
}
export function isPwaTransitionRoute(pathname) { return TRANSITION_ROUTE.test(pathname) }
