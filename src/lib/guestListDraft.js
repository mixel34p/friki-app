const PENDING_KEY = 'geeksphere.pending-guest-list-draft'
const SESSION_TOKEN_KEY = 'geeksphere.pending-guest-list-token'
const SESSION_DRAFT_KEY = 'geeksphere.session-guest-list-draft'
const MAX_AGE_MS = 48 * 60 * 60 * 1000

export function saveGuestListDraft(draft) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const record = { token, createdAt: Date.now(), draft }
    const serialized = JSON.stringify(record)
    localStorage.setItem(PENDING_KEY, serialized)
    sessionStorage.setItem(SESSION_DRAFT_KEY, serialized)
    sessionStorage.setItem(SESSION_TOKEN_KEY, token)
    return token
}

export function readGuestListDraft(token = null, { requireRegistration = false } = {}) {
    try {
        const raw = sessionStorage.getItem(SESSION_DRAFT_KEY) || localStorage.getItem(PENDING_KEY)
        if (!raw) return null
        const record = JSON.parse(raw)
        if (!record?.draft || (token && record.token !== token) || (requireRegistration && !record.registerRequested) || Date.now() - record.createdAt > MAX_AGE_MS) {
            if (Date.now() - (record?.createdAt || 0) > MAX_AGE_MS) clearGuestListDraft()
            return null
        }
        return record.draft
    } catch {
        return null
    }
}

export function requestGuestListRegistration(token) {
    try {
        const record = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
        if (!record?.draft || record.token !== token || Date.now() - record.createdAt > MAX_AGE_MS) return false
        record.registerRequested = true
        const serialized = JSON.stringify(record)
        localStorage.setItem(PENDING_KEY, serialized)
        sessionStorage.setItem(SESSION_DRAFT_KEY, serialized)
        sessionStorage.setItem(SESSION_TOKEN_KEY, token)
        return true
    } catch {
        return false
    }
}

export function getPendingGuestListToken() {
    try {
        return sessionStorage.getItem(SESSION_TOKEN_KEY) || JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')?.token || null
    } catch {
        return null
    }
}

export function clearGuestListDraft() {
    localStorage.removeItem(PENDING_KEY)
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
    sessionStorage.removeItem(SESSION_DRAFT_KEY)
}
