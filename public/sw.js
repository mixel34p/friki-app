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
