export const INVITATION_KEY = 'geeksphere.pending-invitation'
export const INVITATION_TTL = 7 * 24 * 60 * 60 * 1000
export const INVITATION_REWARDS = [
    { count: 1, badge: 'connector', title: 'Conector', description: 'Tu primera persona invitada.' },
    { count: 5, badge: 'host', title: 'Anfitrión', description: 'Cinco personas nuevas en tu esfera.' },
    { count: 10, badge: 'ambassador', title: 'Embajador', description: 'Diez personas nuevas en la comunidad.' },
]

export function isInvitationCode(code) {
    return typeof code === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code)
}

export function readInvitation(storage = globalThis.localStorage, now = Date.now()) {
    try {
        const value = JSON.parse(storage.getItem(INVITATION_KEY))
        if (!value) return null
        if (!isInvitationCode(value.code) || !Number.isFinite(value.savedAt) || now - value.savedAt > INVITATION_TTL || value.savedAt > now) {
            storage.removeItem(INVITATION_KEY)
            return null
        }
        return { ...value, autoFollow: value.autoFollow !== false }
    } catch { return null }
}

export function rememberInvitation(value, storage = globalThis.localStorage, now = Date.now()) {
    if (!isInvitationCode(value?.code)) return null
    const previous = readInvitation(storage, now)
    // First accepted invitation wins until it expires or is attached to an account.
    const next = previous || { code: value.code, username: value.username || '', autoFollow: value.autoFollow !== false, savedAt: now }
    try { storage.setItem(INVITATION_KEY, JSON.stringify(next)) } catch { /* URL and signup metadata still carry the invitation. */ }
    return next
}

export function setInvitationFollow(autoFollow, storage = globalThis.localStorage) {
    const pending = readInvitation(storage)
    if (!pending) return null
    const next = { ...pending, autoFollow: Boolean(autoFollow) }
    try { storage.setItem(INVITATION_KEY, JSON.stringify(next)) } catch { /* Storage can be disabled. */ }
    return next
}

export function clearInvitation(code, storage = globalThis.localStorage) {
    if (readInvitation(storage)?.code !== code) return
    try { storage.removeItem(INVITATION_KEY) } catch { /* Storage can be disabled. */ }
}

export function invitationRedirect(path, invitation, origin = globalThis.location?.origin) {
    const url = new URL(path, origin)
    if (invitation && isInvitationCode(invitation.code)) {
        url.searchParams.set('ref', invitation.code)
        url.searchParams.set('follow', invitation.autoFollow === false ? '0' : '1')
    }
    return url.href
}

export function invitationFromSearch(search) {
    const params = new URLSearchParams(search)
    const code = params.get('ref')
    return isInvitationCode(code) ? { code, autoFollow: params.get('follow') !== '0' } : null
}

export function profileFavorites(profile, limit = 6) {
    const anime = Array.isArray(profile?.favorite_animes) ? profile.favorite_animes : []
    const games = Array.isArray(profile?.favorite_games) ? profile.favorite_games : []
    const result = []
    for (let i = 0; i < Math.max(anime.length, games.length); i++) {
        for (const item of [anime[i], games[i]]) {
            if (!item || typeof item !== 'object') continue
            const image = item.cover_url || item.image_url || item.image || item.images?.jpg?.large_image_url || item.cover?.url
            if (typeof image !== 'string' || !/^https?:\/\//i.test(image)) continue
            result.push({ image, title: item.title || item.name || 'Favorito' })
        }
    }
    return result.slice(0, limit)
}
