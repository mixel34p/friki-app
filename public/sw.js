/* Only the public offline page is cached. Accounts, API responses and HTML
   navigation always use the network so updates and private data stay fresh.
   Bump this version when changing offline.html. */
const CACHE = 'geeksphere-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_URL)))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('geeksphere-offline-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body: event.data?.text() || '' } }
  const title = payload.title || 'Nueva actividad en GeekSphere'
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || 'Tienes una nueva notificación.',
    icon: '/icons/pwa-192.png',
    badge: '/icons/pwa-192.png',
    tag: payload.tag || 'geeksphere-activity',
    data: { url: payload.url || '/activity' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const requestedUrl = new URL(event.notification.data?.url || '/activity', self.location.origin)
  const targetUrl = requestedUrl.origin === self.location.origin ? requestedUrl.href : `${self.location.origin}/activity`
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      await client.navigate(targetUrl)
      return client.focus()
    }
    return self.clients.openWindow(targetUrl)
  })())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    try {
      return await fetch(event.request)
    } catch {
      return (await caches.match(OFFLINE_URL, { cacheName: CACHE })) || Response.error()
    }
  })())
})
