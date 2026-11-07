import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')

function worker(fetch) {
  const handlers = {}
  const deleted = []
  const cached = []
  const offline = new Response('Sin conexión')
  vm.runInNewContext(source, {
    URL, Response, fetch,
    self: {
      location: { origin: 'https://geeksphere.example' },
      addEventListener: (name, handler) => { handlers[name] = handler },
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({ add: async url => { cached.push(url) } }),
      match: async () => offline,
      keys: async () => ['other-app-cache', 'geeksphere-offline-v0', 'geeksphere-offline-v1'],
      delete: async key => { deleted.push(key) },
    },
  })
  return { handlers, deleted, cached, offline }
}

test('manifest has standalone launch and icons of the declared sizes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url)))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/home')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.prefer_related_applications, false)
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
})

test('installation caches only the public offline page', async () => {
  const sw = worker()
  let done
  sw.handlers.install({ waitUntil: promise => { done = promise } })
  await done
  assert.deepEqual(sw.cached, ['/offline.html'])
})

test('activation removes only obsolete GeekSphere offline caches', async () => {
  const sw = worker()
  let done
  sw.handlers.activate({ waitUntil: promise => { done = promise } })
  await done
  assert.deepEqual(sw.deleted, ['geeksphere-offline-v0'])
})

test('deep links use the network and fall back offline on network failure', async () => {
  for (const online of [true, false]) {
    const live = new Response('Live page')
    const sw = worker(async () => {
      if (!online) throw new TypeError('Failed to fetch')
      return live
    })
    let response
    sw.handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'https://geeksphere.example/profile/example' },
      respondWith: promise => { response = promise },
    })
    assert.equal(await response, online ? live : sw.offline)
  }
})

test('API calls, mutations, scripts and external requests bypass the worker', () => {
  const sw = worker(() => assert.fail('Should not call fetch'))
  for (const request of [
    { mode: 'cors', method: 'GET', url: 'https://geeksphere.example/api/user' },
    { mode: 'cors', method: 'POST', url: 'https://geeksphere.example/api/posts' },
    { mode: 'navigate', method: 'POST', url: 'https://geeksphere.example/login' },
    { mode: 'no-cors', url: 'https://geeksphere.example/assets/index.js' },
    { mode: 'navigate', method: 'GET', url: 'https://external.example/' },
  ]) {
    sw.handlers.fetch({ request, respondWith: () => assert.fail('Should bypass worker') })
  }
})
