import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSearchRecommendations, rankSearchCandidates } from '../src/lib/searchRecommendationRanking.js'

const work = (type, id, genres, extra = {}) => ({ type, id, title: `${type} ${id}`, genres, rating: 90, score: 90, external_score: 9, ...extra })

test('different favorites change the first recommendation, ahead of unrelated highly scored works', () => {
  const candidates = [work('anime', 1, ['Horror'], { score: 60 }), work('anime', 2, ['Romance'], { score: 100 })]
  for (const [genre, expected] of [['Horror', 1], ['Romance', 2]]) {
    const result = rankSearchCandidates(candidates, [work('anime', 99, [genre], { favorite: true })], new Set(), 1)
    assert.equal(result[0].id, expected)
    assert.equal(result.personalized, true)
    assert.equal(result[0].recommendationKind, 'taste')
  }
})

test('low ratings reduce similarity instead of acting as a positive taste signal', () => {
  const candidates = [work('anime', 1, ['Horror', 'Action']), work('anime', 2, ['Horror', 'Romance'])]
  const seeds = [work('anime', 98, ['Horror'], { rating: 5 }), work('anime', 99, ['Action'], { rating: 1 })]
  assert.equal(rankSearchCandidates(candidates, seeds)[0].id, 2)
  assert.equal(rankSearchCandidates(candidates, [seeds[1]]).personalized, false)
})

test('all three media share discovery slots; no manga-first block and no duplicate identities', () => {
  const candidates = ['manga', 'game', 'anime'].flatMap(type => Array.from({ length: 9 }, (_, i) => work(type, type === 'manga' ? `mal:manga:${i + 1}` : i + 1, ['Adventure'])))
  const result = rankSearchCandidates([...candidates, candidates[0]], [])
  assert.equal(result.length, 6)
  assert.equal(result.personalized, false)
  for (const type of ['game', 'anime', 'manga']) assert.equal(result.filter(item => item.type === type).length, 2)
  assert.equal(new Set(result.map(item => `${item.type}:${item.id}`)).size, 6)
})

test('real matches outrank unrelated fallback; colon manga IDs and cross-media numeric IDs remain distinct', () => {
  const candidates = [work('manga', 'mal:manga:2', ['Adventure']), work('anime', 2, ['Adventure']), work('game', 2, ['Sport'])]
  const result = rankSearchCandidates(candidates, [work('anime', 99, ['Adventure'], { rating: 5 })], new Set(['manga:mal:manga:2']), 2)
  assert.deepEqual(result.map(item => item.type), ['anime', 'game'])
  assert.deepEqual(result.map(item => item.recommendationKind), ['taste', 'discovery'])
})

function database({ entries = [], profiles = [], games = [], anime = [], manga = [], fail = [] } = {}) {
  const tables = { library_entries: entries, profiles, games, anime, manga }
  const queries = []
  return { queries, from(table) {
    const q = { table, filters: [], orders: [], max: Infinity }
    queries.push(q)
    const builder = {
      select(fields) { q.fields = fields; assert.ok(!fields.includes('first_release_date')); return builder },
      eq(field, value) { q.filters.push(row => row[field] === value); return builder },
      in(field, values) { q.filters.push(row => values.map(String).includes(String(row[field]))); return builder },
      overlaps(field, values) { q.filters.push(row => row[field].some(value => values.includes(value))); return builder },
      order(field) { q.orders.push(field); return builder }, limit(max) { q.max = max; return builder },
      maybeSingle() { q.single = true; return builder },
      then(resolve, reject) {
        const data = tables[table].filter(row => q.filters.every(filter => filter(row))).slice(0, q.max)
        return Promise.resolve({ data: q.single ? data[0] || null : data, error: fail.includes(table) ? new Error('Fixture unavailable') : null }).then(resolve, reject)
      },
    }
    return builder
  } }
}

test('service uses favorites without logs, loads similar local titles and tolerates one failed medium', async () => {
  const db = database({ profiles: [{ id: 'user', favorite_games: [], favorite_animes: [], favorite_manga: [{ id: 'mal:manga:2' }] }], manga: [{ id: 'mal:manga:2', title: 'Liked', genres: ['Horror'] }, { id: 'mal:manga:3', title: 'Similar', genres: ['Horror'] }, { id: 'mal:manga:4', title: 'Unrelated', genres: ['Romance'] }], fail: ['games'] })
  const result = await loadSearchRecommendations(db, 2, 'user')
  assert.equal(result[0].id, 'mal:manga:3')
  assert.equal(result.personalized, true)
  assert.ok(!result.some(item => item.id === 'mal:manga:2'))
  assert.ok(db.queries.some(q => q.table === 'manga' && q.filters.length && q.max === 60))
  assert.ok(db.queries.filter(q => q.table === 'library_entries').every(q => q.filters.length >= 2))
})

test('games use the real release_date column; guest results include all three media', async () => {
  const db = database({ games: [{ id: 1, name: 'Game', genres: [], rating: 85, release_date: '2001-01-01' }], anime: [{ id: 1, title: 'Anime', genres: [], score: 90 }], manga: [{ id: 'mal:manga:1', title: 'Manga', genres: [], external_score: 9.5 }] })
  const result = await loadSearchRecommendations(db)
  assert.deepEqual(new Set(result.map(item => item.type)), new Set(['game', 'anime', 'manga']))
  assert.equal(result.find(item => item.type === 'game').year, '2001')
  assert.ok(db.queries.every(q => q.max <= 60))
  assert.ok(db.queries.every(q => q.table !== 'library_entries'))
})

test('candidate ownership check excludes a registration older than the 500 taste seeds', async () => {
  const entries = Array.from({ length: 500 }, (_, i) => ({ user_id: 'user', work_type: 'anime', work_id: String(i + 1), rating: 5 }))
  entries.push({ user_id: 'user', work_type: 'manga', work_id: 'mal:manga:2', rating: 5 })
  const db = database({ entries, manga: [{ id: 'mal:manga:2', title: 'Already logged', genres: [] }, { id: 'mal:manga:3', title: 'New', genres: [] }] })
  const result = await loadSearchRecommendations(db, 6, 'user')
  assert.deepEqual(result.map(item => item.id), ['mal:manga:3'])
})

test('failed ownership verification never leaks registered works into suggestions', async () => {
  const db = database({ fail: ['library_entries'], manga: [{ id: 'mal:manga:2', title: 'Unknown ownership', genres: [] }] })
  assert.equal((await loadSearchRecommendations(db, 6, 'user')).length, 0)
})
