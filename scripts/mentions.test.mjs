import test from 'node:test'
import assert from 'node:assert/strict'
import { completeMention, findMentions, getActiveMention } from '../src/lib/mentions.js'

test('recognizes usernames with punctuation, uppercase, underscores and line breaks', () => {
  const text = 'Hola (@Mixel), @a_ri\n@polot!'
  assert.deepEqual(findMentions(text).map(match => match.username), ['Mixel', 'a_ri', 'polot'])
  for (const mention of findMentions(text)) assert.equal(text.slice(mention.start, mention.end), `@${mention.username}`)
})

test('does not turn emails, URLs, escaped at signs or invalid usernames into mentions', () => {
  assert.deepEqual(findMentions('user@mixel.com https://site/@polot @@mixel @ab @abcdefghijklmnopqrstu'), [])
  assert.equal(getActiveMention('user@mi', 7), null)
  assert.equal(getActiveMention('https://site/@mi', 16), null)
})

test('offers suggestions from a bare at sign and partial username', () => {
  assert.deepEqual(getActiveMention('Hola @', 6), { start: 5, end: 6, query: '' })
  assert.deepEqual(getActiveMention('Hola @mi', 8), { start: 5, end: 8, query: 'mi' })
  assert.equal(getActiveMention('Hola @mi ', 9), null)
  assert.equal(getActiveMention('@mi', 1, 3), null)
})

test('completes the entire token when editing in the middle and keeps surrounding text', () => {
  const text = 'Hola @mixel, ¿qué tal?'
  const active = getActiveMention(text, 8)
  assert.deepEqual(active, { start: 5, end: 11, query: 'mi' })
  assert.deepEqual(completeMention(text, active, 'polot', 2000), { text: 'Hola @polot, ¿qué tal?', caret: 11 })
})

test('keeps existing whitespace and respects the character limit without truncating', () => {
  assert.deepEqual(completeMention('@mi amigo', { start: 0, end: 3 }, 'mixel', 20), { text: '@mixel amigo', caret: 7 })
  assert.equal(completeMention('@mi', { start: 0, end: 3 }, 'mixel', 6), null)
  assert.deepEqual(completeMention('@mi', { start: 0, end: 3 }, 'mixel', 7), { text: '@mixel ', caret: 7 })
})

test('rejects a token over the username limit even with the caret in the middle', () => {
  assert.equal(getActiveMention('@abcdefghijklmnopqrstu', 4), null)
  assert.equal(getActiveMention('@abcdefghijklmnopqrstu', 22), null)
})
