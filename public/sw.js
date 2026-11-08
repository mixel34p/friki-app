/* Only the public offline page is cached. Accounts, API responses and HTML
   navigation always use the network so updates and private data stay fresh.
   Bump this version when changing offline.html. */
const CACHE = 'geeksphere-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.add(OFFLINE_URL)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('geeksphere-offline-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

async function notificationImageData(url, shape = 'square') {
  if (!url || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return url
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.signal })
    if (!response.ok) return url
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 5_000_000) return url
    const bitmap = await createImageBitmap(await response.blob())
    const size = shape === 'circle' ? 256 : 512
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d')
    if (!context) return url
    if (shape === 'circle') {
      context.beginPath()
      context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      context.clip()
    }
    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height)
    bitmap.close?.()
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return `data:image/png;base64,${btoa(binary)}`
  } catch {
    return url
  } finally {
    clearTimeout(timeout)
  }
}

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body: event.data?.text() || '' } }
  const title = payload.title || 'Nueva actividad en GeekSphere'
  const notificationUrl = payload.url || '/activity'
  const toSafeImageUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return undefined
    try {
      const url = new URL(value, self.location.origin)
      return url.protocol === 'https:' || url.origin === self.location.origin ? url.href : undefined
    } catch { return undefined }
  }
  event.waitUntil((async () => {
    const isFollow = payload.type === 'follow'
    const avatarUrl = toSafeImageUrl(payload.icon)
    const previewUrl = toSafeImageUrl(payload.image)
    const [avatar, preview] = await Promise.all([
      avatarUrl ? notificationImageData(avatarUrl, 'circle') : undefined,
      !isFollow && previewUrl ? notificationImageData(previewUrl, 'square') : undefined,
    ])
    return self.registration.showNotification(title, {
      body: payload.body || 'Tienes una nueva notificación.',
      icon: avatar || avatarUrl || '/icons/pwa-192.png',
      badge: '/icons/push-badge.svg',
      image: isFollow ? undefined : preview || previewUrl,
      tag: payload.tag || 'geeksphere-activity',
      timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
      dir: 'auto',
      renotify: false,
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
      data: { url: notificationUrl },
    })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
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
