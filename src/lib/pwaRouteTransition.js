const TRANSITION_ROUTE = /^\/share(?:[?#].*)?$|^\/(?:posts|reviews)\/[^/?#]+(?:[?#].*)?$|^\/(?:lists|templates)\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/;

let pendingRoute = null;

export function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
}

function getPathname(to) {
  if (typeof to === 'string') return new URL(to, window.location.href).pathname;
  return to?.pathname || window.location.pathname;
}

export function navigatePwaRoute(navigate, to, options) {
  const pathname = getPathname(to);
  if (pathname === window.location.pathname || !isStandalonePwa() || !TRANSITION_ROUTE.test(pathname) || typeof document.startViewTransition !== 'function') {
    return navigate(to, options);
  }

  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  pendingRoute = { pathname, resolve: resolveReady };

  try {
    const transition = document.startViewTransition(async () => {
      navigate(to, options);
      await ready;
    });
    const clearPending = () => {
      if (pendingRoute?.pathname === pathname) pendingRoute = null;
    };
    transition.finished.then(clearPending, clearPending);
    transition.updateCallbackDone.catch(clearPending);
    return transition;
  } catch {
    pendingRoute = null;
    return navigate(to, options);
  }
}

export function signalPwaRouteReady(pathname) {
  if (!pendingRoute || pendingRoute.pathname !== pathname) return;
  pendingRoute.resolve();
}

export function isPwaTransitionRoute(pathname) {
  return TRANSITION_ROUTE.test(pathname);
}
