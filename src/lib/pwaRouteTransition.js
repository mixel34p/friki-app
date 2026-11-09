const DETAIL_ROUTE = /^\/share(?:[?#].*)?$|^\/(?:posts|reviews)\/[^/?#]+(?:[?#].*)?$|^\/(?:lists|templates)\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/;
const SNAPSHOT_ATTRIBUTE = 'data-pwa-route-snapshot';

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
}

export function capturePwaRouteSnapshot(pathname) {
  if (!isStandalonePwa() || !DETAIL_ROUTE.test(pathname)) return;

  document.querySelector(`[${SNAPSHOT_ATTRIBUTE}]`)?.remove();
  const currentLayout = document.querySelector('.layout');
  if (!currentLayout) return;

  const snapshot = currentLayout.cloneNode(true);
  const sourceFields = currentLayout.querySelectorAll('input, textarea, select');
  const snapshotFields = snapshot.querySelectorAll('input, textarea, select');
  sourceFields.forEach((field, index) => {
    const copy = snapshotFields[index];
    if (!copy) return;
    if (field.type === 'checkbox' || field.type === 'radio') copy.checked = field.checked;
    else if (field.type !== 'file') copy.value = field.value;
  });
  const sourceNodes = [currentLayout, ...currentLayout.querySelectorAll('*')];
  const snapshotNodes = [snapshot, ...snapshot.querySelectorAll('*')];
  sourceNodes.forEach((node, index) => {
    const copy = snapshotNodes[index];
    if (!copy) return;
    copy.scrollTop = node.scrollTop;
    copy.scrollLeft = node.scrollLeft;
    const computed = window.getComputedStyle(node);
    if (computed.animationName !== 'none') {
      copy.style.animation = 'none';
      copy.style.opacity = computed.opacity;
      copy.style.transform = computed.transform;
    }
  });
  snapshot.setAttribute(SNAPSHOT_ATTRIBUTE, '');
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.inert = true;
  snapshot.style.cssText += ';position:fixed!important;inset:0!important;z-index:1400!important;width:100vw!important;height:100dvh!important;min-height:100dvh!important;margin:0!important;overflow:hidden!important;pointer-events:none!important;transform:none!important;animation:none!important;';
  document.body.append(snapshot);
}

export function clearPwaRouteSnapshot() {
  document.querySelector(`[${SNAPSHOT_ATTRIBUTE}]`)?.remove();
}

export function isPwaSnapshotRoute(pathname) {
  return DETAIL_ROUTE.test(pathname);
}
