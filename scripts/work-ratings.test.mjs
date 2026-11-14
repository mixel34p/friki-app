import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { summarizeWorkRatings } from '../src/lib/workRatings.js'

test('counts all ten half-star buckets and excludes entries without a valid rating', () => {
  const result = summarizeWorkRatings([
    ...Array.from({ length: 10 }, (_, index) => ({ rating: String((index + 1) / 2) })),
    { rating: 4.5 }, ...[null, undefined, '', 0, 6, 'bad', 1.2].map(rating => ({ rating })),
  ])
  assert.equal(result.ratingsCount, 11)
  assert.equal(result.distribution[8].count, 2)
  assert.equal(result.distribution.reduce((sum, bin) => sum + bin.count, 0), 11)
  assert.equal(result.avgRating, 32 / 11)
})

test('unrated works have ten empty buckets and no invented mean', () => {
  const result = summarizeWorkRatings([{ rating: null }])
  assert.equal(result.avgRating, null)
  assert.equal(result.ratingsCount, 0)
  assert.ok(result.distribution.every(bin => bin.count === 0))
})

const source = await readFile(new URL('../src/lib/workPageService.js', import.meta.url), 'utf8')
const code = transformSync(source, { format: 'cjs' }).code
function service({ fail = false } = {}) {
  const entries = [
    ...Array.from({ length: 1205 }, (_, index) => ({ id: index, user_id: 'member', work_type: 'game', work_id: '7', rating: index < 1000 ? '5' : '.5', review_text: index < 12 ? `Review ${index}` : null })),
    { id: 1206, user_id: 'member', work_type: 'game', work_id: '7', rating: null },
    { id: 1207, user_id: 'other', work_type: 'anime', work_id: '7', rating: 1 },
    { id: 1208, user_id: 'other', work_type: 'game', work_id: '8', rating: 1 },
  ]
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.start = 0; this.end = Infinity }
    select(fields, options = {}) { this.options = options; return this }
    eq(key, value) { this.filters.push(row => row[key] === value); return this }
    neq(key, value) { this.filters.push(row => row[key] !== value); return this }
    not(key, operator, value) { this.filters.push(row => row[key] != value); return this }
    in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
    order() { return this }
    limit(count) { this.end = count - 1; return this }
    range(start, end) { this.start = start; this.end = end; return this }
    then(resolve) {
      const rows = (this.table === 'profiles' ? [{ id: 'member', username: 'member' }] : entries).filter(row => this.filters.every(filter => filter(row)))
      return Promise.resolve({ error: fail ? new Error('Unavailable') : null, count: this.options.count ? rows.length : null, data: this.options.head ? null : rows.slice(this.start, this.end + 1) }).then(resolve)
    }
  }
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === './supabase' ? { supabase: { from: table => new Query(table) } } : name === './workRatings' ? { summarizeWorkRatings } : {} })
  return module.exports
}

test('statistics cover more than 1000 ratings, exact member counts and both work identifiers', async () => {
  const result = await service().getWorkStats('game', 7)
  assert.equal(result.membersCount, 1206)
  assert.equal(result.ratingsCount, 1205)
  assert.equal(result.reviewsCount, 12)
  assert.equal(result.avgRating, (1000 * 5 + 205 * .5) / 1205)
  assert.equal(result.distribution[0].count, 205)
  assert.equal(result.distribution[9].count, 1000)
  assert.equal(result.recentMembers[0].username, 'member')
})

test('a failed statistics query is reported as unavailable, not zero ratings', async () => {
  await assert.rejects(service({ fail: true }).getWorkStats('game', 7), /Unavailable/)
})
