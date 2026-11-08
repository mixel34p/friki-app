const encoder = new TextEncoder()

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function toBase64Url(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function jsonPart(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)))
}

async function createVapidToken(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const keyBytes = fromBase64Url(publicKey)
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: toBase64Url(keyBytes.slice(1, 33)),
    y: toBase64Url(keyBytes.slice(33, 65)),
    d: privateKey,
    ext: true,
  }
  const signingKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = jsonPart({ typ: 'JWT', alg: 'ES256' })
  const audience = new URL(endpoint).origin
  const claims = jsonPart({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject })
  const unsigned = `${header}.${claims}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(unsigned))
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`
}

async function encryptPayload(subscription: { p256dh: string; auth: string }, payload: string): Promise<Uint8Array> {
  const subscriberPublicBytes = fromBase64Url(subscription.p256dh)
  const authSecret = fromBase64Url(subscription.auth)
  const subscriberPublicKey = await crypto.subtle.importKey('raw', subscriberPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ephemeralKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const ephemeralPublicBytes = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeralKeys.publicKey))
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberPublicKey }, ephemeralKeys.privateKey, 256)

  const sharedKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])
  const webPushPrefix = encoder.encode('WebPush: info\0')
  const webPushInfo = new Uint8Array(webPushPrefix.length + subscriberPublicBytes.length + ephemeralPublicBytes.length)
  webPushInfo.set(webPushPrefix)
  webPushInfo.set(subscriberPublicBytes, webPushPrefix.length)
  webPushInfo.set(ephemeralPublicBytes, webPushPrefix.length + subscriberPublicBytes.length)
  const inputKeyingMaterial = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: webPushInfo }, sharedKey, 256)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const ikmKey = await crypto.subtle.importKey('raw', inputKeyingMaterial, 'HKDF', false, ['deriveBits'])
  const contentKey = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: aes128gcm\0') }, ikmKey, 128)
  const nonce = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: nonce\0') }, ikmKey, 96)
  const aesKey = await crypto.subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['encrypt'])
  const plaintext = new Uint8Array(encoder.encode(payload).length + 1)
  plaintext.set(encoder.encode(payload))
  plaintext[plaintext.length - 1] = 2
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext))

  // RFC 8291 aes128gcm record: salt, record size, key id length, ephemeral key, encrypted payload.
  const body = new Uint8Array(16 + 4 + 1 + ephemeralPublicBytes.length + ciphertext.length)
  body.set(salt, 0)
  new DataView(body.buffer).setUint32(16, 4096, false)
  body[20] = ephemeralPublicBytes.length
  body.set(ephemeralPublicBytes, 21)
  body.set(ciphertext, 21 + ephemeralPublicBytes.length)
  return body
}

function notificationCopy(type: string, actorName: string) {
  const actions: Record<string, string> = {
    follow: 'ha empezado a seguirte',
    like_post: 'le ha gustado tu publicación',
    comment_post: 'ha comentado en tu publicación',
    like_list: 'le ha gustado tu lista',
    comment_list: 'ha comentado en tu lista',
    like_tierlist: 'le ha gustado tu tierlist',
    like_review: 'le ha gustado tu reseña',
    comment_review: 'ha comentado en tu reseña',
    mention_post: 'te ha mencionado en una publicación',
    connection_request: 'quiere conectar contigo',
    connection_accepted: 'ha aceptado tu solicitud de conexión',
  }
  return { title: actorName || 'Nueva actividad', body: actions[type] || 'ha interactuado contigo' }
}

function targetFor(notification: Record<string, unknown>): string {
  const type = String(notification.type || '')
  const resourceId = typeof notification.resource_id === 'string' ? notification.resource_id : ''
  const resourceType = String(notification.resource_type || '')
  if (type === 'follow') {
    const username = typeof notification.actor_username === 'string' ? notification.actor_username : ''
    return username ? `/profile/${encodeURIComponent(username)}` : '/activity'
  }
  if (type === 'connection_request') return '/connections?tab=requests'
  if (type === 'connection_accepted') return resourceId ? `/chat/${encodeURIComponent(resourceId)}` : '/chat'
  if (resourceType === 'post' || type === 'like_post' || type === 'comment_post' || type === 'mention_post') return resourceId ? `/posts/${encodeURIComponent(resourceId)}` : '/activity'
  if (resourceType === 'list' || type === 'like_list' || type === 'comment_list' || type === 'like' || type === 'comment') return resourceId ? `/lists/${encodeURIComponent(resourceId)}` : '/activity'
  if (resourceType === 'tierlist' || type === 'like_tierlist') return resourceId ? `/tierlist/${encodeURIComponent(resourceId)}` : '/activity'
  if (resourceType === 'review' || type === 'like_review' || type === 'comment_review') return resourceId ? `/reviews/${encodeURIComponent(resourceId)}` : '/activity'
  return '/activity'
}

async function sendOne(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string, keys: { publicKey: string; privateKey: string; subject: string }) {
  const token = await createVapidToken(subscription.endpoint, keys.publicKey, keys.privateKey, keys.subject)
  const body = await encryptPayload(subscription, payload)
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${token}, k=${keys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  })
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const { job_id, token } = await request.json()
    if (typeof job_id !== 'string' || typeof token !== 'string' || token.length < 32) {
      return Response.json({ error: 'Invalid delivery job' }, { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) return Response.json({ error: 'Supabase configuration is missing' }, { status: 500 })

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_push_delivery_job`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_job_id: job_id, p_token: token }),
    })
    if (!rpcResponse.ok) return Response.json({ error: 'Could not claim delivery job' }, { status: 502 })
    const job = await rpcResponse.json()
    if (!job?.notification) return Response.json({ ok: true, delivered: 0 })

    const copy = notificationCopy(job.notification.type, job.notification.actor_name)
    const payload = JSON.stringify({ ...copy, url: targetFor(job.notification), tag: job.notification.id })
    const keys = {
      publicKey: job.vapid_public_key,
      privateKey: job.vapid_private_key,
      subject: job.vapid_subject,
    }
    if (!keys.publicKey || !keys.privateKey || !keys.subject) {
      return Response.json({ error: 'VAPID configuration is missing' }, { status: 503 })
    }

    const results = await Promise.all((job.subscriptions || []).map(async (subscription: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        const response = await sendOne(subscription, payload, keys)
        return { ok: response.ok, status: response.status }
      } catch {
        return { ok: false, status: 0 }
      }
    }))
    const delivered = results.filter(result => result.ok).length
    return Response.json({ ok: true, delivered, attempted: results.length })
  } catch (error) {
    console.error('Push delivery failed:', error)
    return Response.json({ error: 'Push delivery failed' }, { status: 500 })
  }
})
