import test from 'node:test'
import assert from 'node:assert/strict'
import { communityRating, compareDiscoverWorks, releaseYear } from '../src/lib/discoverWorksCatalog.js'

const work = (id, overrides = {}) => ({ id, title: id, userRating: null, ratingCount: 0, registrations: 0, databaseRating: 5, databasePopularity: 1000, ...overrides })

test('best rated puts community ratings ahead of unrated works with high external scores', () => {
  const works = [work('unrated'), work('low', { userRating: 2, ratingCount: 3 }), work('high', { userRating: 4.5, ratingCount: 1 }), work('no-score', { databaseRating: null })]
  assert.deepEqual(works.sort((a, b) => compareDiscoverWorks(a, b, 'rated')).map(item => item.id), ['high', 'low', 'no-score', 'unrated'])
})

test('ties use vote count and registrations before title and remain deterministic', () => {
  const works = [work('a', { userRating: 4, ratingCount: 2, registrations: 2 }), work('z', { userRating: 4, ratingCount: 2, registrations: 9 }), work('b', { userRating: 4, ratingCount: 3 })]
  assert.deepEqual(works.sort((a, b) => compareDiscoverWorks(a, b, 'rated')).map(item => item.id), ['b', 'z', 'a'])
})

test('invalid or missing community scores never become a displayed rating', () => {
  for (const value of [null, undefined, '', 'bad', NaN, Infinity, 0, 7]) assert.equal(communityRating(work('invalid', { userRating: value, ratingCount: 1 })), null)
  assert.equal(communityRating(work('no-votes', { userRating: 5 })), null)
  assert.equal(communityRating(work('half', { userRating: .5, ratingCount: 1 })), .5)
})

test('most registered keeps its existing registration priority', () => {
  const a = work('more', { registrations: 10, userRating: 1, ratingCount: 1 })
  const b = work('less', { registrations: 2, userRating: 5, ratingCount: 2 })
  assert.ok(compareDiscoverWorks(a, b, 'popular') < 0)
})

test('release years handle catalog dates without breaking tie sorting', () => {
  for (const date of ['2017-02-24', 1487894400, 1487894400000, 2017, { year: 2017 }]) assert.equal(Number(releaseYear({ release_date: date })), 2017)
  assert.equal(releaseYear({ release_date: 'bad' }), '')
})
