import test from 'node:test'
import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { INVITATION_KEY, INVITATION_TTL, clearInvitation, invitationFromSearch, invitationRedirect, isInvitationCode, profileFavorites, readInvitation, rememberInvitation, setInvitationFollow } from '../src/lib/invitations.js'

const code = '11111111-2222-4333-8444-555555555555'
const otherCode = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
function memoryStorage() {
    const data = new Map()
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

test('accepts only well-formed invitation UUIDs, including uppercase', () => {
    assert.ok(isInvitationCode(code))
    assert.ok(isInvitationCode(otherCode.toUpperCase()))
    for (const invalid of [null, '', '../login', 'javascript:alert(1)', code + '/extra', code.replace('-4333-', '-1333-')]) assert.equal(isInvitationCode(invalid), false)
})
test('remembers the first accepted invitation without resetting its expiry', () => {
    const storage = memoryStorage()
    rememberInvitation({ code, username: 'mixel' }, storage, 100)
    rememberInvitation({ code: otherCode }, storage, 200)
    assert.deepEqual(readInvitation(storage, 300), { code, username: 'mixel', autoFollow: true, savedAt: 100 })
    assert.equal(readInvitation(storage, 101 + INVITATION_TTL), null)
    assert.equal(storage.getItem(INVITATION_KEY), null)
})
test('invalid, corrupt, future and unavailable storage never crash registration', () => {
    const storage = memoryStorage()
    storage.setItem(INVITATION_KEY, '{bad json')
    assert.equal(readInvitation(storage), null)
    storage.setItem(INVITATION_KEY, JSON.stringify({ code, savedAt: Date.now() + 10000 }))
    assert.equal(readInvitation(storage), null)
    const blocked = { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } }
    assert.equal(readInvitation(blocked), null)
    assert.equal(rememberInvitation({ code, autoFollow: false }, blocked).autoFollow, false)
})
test('follow opt-out and clearing preserve the intended invitation', () => {
    const storage = memoryStorage()
    rememberInvitation({ code }, storage)
    setInvitationFollow(false, storage)
    assert.equal(readInvitation(storage).autoFollow, false)
    clearInvitation(otherCode, storage)
    assert.ok(readInvitation(storage))
    clearInvitation(code, storage)
    assert.equal(readInvitation(storage), null)
})
test('email and OAuth return URLs preserve referral and follow choice safely', () => {
    const target = invitationRedirect('/confirm-email', { code, autoFollow: false }, 'https://geeksphere.test')
    assert.deepEqual(invitationFromSearch(new URL(target).search), { code, autoFollow: false })
    assert.equal(new URL(target).pathname, '/confirm-email')
    assert.equal(invitationFromSearch('?ref=https://evil.test'), null)
    assert.equal(invitationRedirect('/onboarding', null, 'https://geeksphere.test'), 'https://geeksphere.test/onboarding')
})
test('favorite artwork interleaves categories, handles missing fields and ignores unsafe URLs', () => {
    assert.deepEqual(profileFavorites(null), [])
    const favorites = profileFavorites({ favorite_animes: [{ title: 'Anime', image_url: 'https://a.test/a.jpg' }, { image_url: 'javascript:alert(1)' }], favorite_games: [{ name: 'Game', cover_url: 'https://g.test/g.jpg' }] }, 2)
    assert.deepEqual(favorites.map(item => item.title), ['Anime', 'Game'])
    assert.equal(favorites.length, 2)
})
test('QR generation supports the full permanent invitation URL', async () => {
    const url = `https://geeksphere.example/invite/${code}`
    const result = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 })
    assert.match(result, /^<svg/)
    assert.ok(QRCode.create(url).modules.size >= 21)
})
