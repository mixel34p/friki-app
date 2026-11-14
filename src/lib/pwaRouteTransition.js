import { navigateBackOrHome } from './navigation'

const SCREEN_ROUTE = /^\/(?:game|anime)\/[^/?#]+\/?$|^\/discover\/(?:anime|games)\/?$/
const TRANSITION_ROUTE = /^\/share(?:[?#].*)?$|^\/(?:posts|reviews)\/[^/?#]+(?:[?#].*)?$|^\/(?:game|anime)\/[^/?#]+\/?(?:[?#].*)?$|^\/discover\/(?:anime|games)\/?(?:[?#].*)?$|^\/(?:lists|templates)\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/
let pendingRoute = null
let pendingHistory = null
let currentPath = null
let currentKey = null
let currentIndex = 0
const scrollPositions = new Map()
const replayedEvents = new WeakSet()
let pendingScroll = null
let scrollObserver = null
let scrollTimer = null

export function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true
}

function reducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
function historyKey() { return window.history.state?.key || 'default' }
function getPathname(to) {
  if (typeof to === 'string') return new URL(to, window.location.href).pathname
  return to?.pathname || window.location.pathname
}

function rememberScroll() {
  const surface = document.querySelector('.work-detail-pwa, .discover-detail-pwa')
  scrollPositions.set(currentKey || historyKey(), { windowY: window.scrollY, workY: surface?.scrollTop || 0 })
  if (scrollPositions.size > 40) scrollPositions.delete(scrollPositions.keys().next().value)
}

function clearScrollRestore() {
  pendingScroll = null
  scrollObserver?.disconnect()
  scrollObserver = null
  window.clearTimeout(scrollTimer)
}

export function restorePwaScroll(force = false) {
  if (!pendingScroll) return
  const surface = document.querySelector('.work-detail-pwa, .discover-detail-pwa')
  const top = surface ? pendingScroll.workY : pendingScroll.windowY
  const available = surface ? surface.scrollHeight - surface.clientHeight : document.documentElement.scrollHeight - window.innerHeight
  if (!force && available + 1 < top) return
  window.scrollTo(0, pendingScroll.windowY)
  if (surface) surface.scrollTop = top
  clearScrollRestore()
}

export function completePwaNavigation(key, pathname, navigationType) {
  currentPath = pathname
  currentKey = key
  currentIndex = window.history.state?.idx ?? 0
  if (isStandalonePwa() && navigationType === 'POP') {
    clearScrollRestore()
    const saved = scrollPositions.get(key)
    if (saved) {
      pendingScroll = saved
      restorePwaScroll()
      if (pendingScroll) {
        scrollObserver = new MutationObserver(() => restorePwaScroll())
        scrollObserver.observe(document.querySelector('.main') || document.body, { childList: true, subtree: true })
        scrollTimer = window.setTimeout(() => restorePwaScroll(true), 3000)
      }
    }
  } else clearScrollRestore()
  pendingHistory?.resolve()
}

export function navigatePwaRoute(navigate, to, options) {
  const pathname = getPathname(to)
  if (pathname === window.location.pathname || !isStandalonePwa() || !TRANSITION_ROUTE.test(pathname) || typeof document.startViewTransition !== 'function' || reducedMotion()) {
    if (isStandalonePwa()) rememberScroll()
    return navigate(to, options)
  }
  rememberScroll()
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
  rememberScroll()
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
  currentKey = historyKey()
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
  window.addEventListener('popstate', onPop, true)
  return () => { window.removeEventListener('popstate', onPop, true); clearScrollRestore() }
}

export function signalPwaRouteReady(pathname) {
  if (pendingRoute?.pathname === pathname) pendingRoute.resolve()
}
export function isPwaTransitionRoute(pathname) { return TRANSITION_ROUTE.test(pathname) }
