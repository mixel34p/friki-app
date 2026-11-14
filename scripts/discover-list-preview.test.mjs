import test from 'node:test'
import assert from 'node:assert/strict'
import { collectListPreviewImages, templatePreviewImages } from '../src/lib/discoverListPreview.js'

test('list previews prefer the top tiers and ranks, deduplicate and omit the unused pool', () => {
  const content = { pool: [{ image_url: 'unused.png' }], B: [{ image_url: 'b.png' }], '#1': { cover_url: 'winner.png' }, S: [{ image_url: '//images.test/s.png' }, { cover: { url: 'winner.png' } }], A: [{ image_url: 'a.png' }], C: [{ image_url: 'c.png' }] }
  assert.deepEqual(collectListPreviewImages(content), ['https://images.test/s.png', 'winner.png', 'a.png', 'b.png'])
})

test('grid previews accept sparse cells, cover objects and legacy string images', () => {
  assert.deepEqual(collectListPreviewImages([null, {}, { cover_url: 'first.png' }, 'second.png', { cover: { url: 'third.png' } }]), ['first.png', 'second.png', 'third.png'])
  for (const value of [null, undefined, {}, [], 4]) assert.deepEqual(collectListPreviewImages(value), [])
})

test('template artwork uses chosen covers and falls back when they contain no usable images', () => {
  const defaults = [{ image_url: 'default.png' }]
  assert.deepEqual(templatePreviewImages({ cover_items: [{ name: 'missing' }], default_items: defaults }), ['default.png'])
  assert.deepEqual(templatePreviewImages({ cover_items: ['cover.png'], default_items: defaults }), ['cover.png'])
})
