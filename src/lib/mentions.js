// Usernames follow the same 3–20 character rule as onboarding.
export function findMentions(value) {
  return [...String(value || '').matchAll(/(^|[^a-zA-Z0-9_@/])@([a-zA-Z0-9_]{3,20})(?![a-zA-Z0-9_])/g)]
    .map(match => ({ username: match[2], start: match.index + match[1].length, end: match.index + match[0].length }))
}

export function getActiveMention(value, selectionStart, selectionEnd = selectionStart) {
  if (selectionStart !== selectionEnd) return null
  const before = value.slice(0, selectionStart)
  const match = before.match(/(^|[^a-zA-Z0-9_@/])@([a-zA-Z0-9_]{0,20})$/)
  if (!match) return null
  const suffix = value.slice(selectionStart).match(/^[a-zA-Z0-9_]*/)[0]
  if (match[2].length + suffix.length > 20) return null
  return { start: selectionStart - match[2].length - 1, end: selectionStart + suffix.length, query: match[2] }
}

export function completeMention(value, active, username, maxLength) {
  const suffix = value.slice(active.end)
  const inserted = `@${username}${/^[\s.,!?;:)\]}]/.test(suffix) ? '' : ' '}`
  const text = value.slice(0, active.start) + inserted + suffix
  if (text.length > maxLength) return null
  return { text, caret: active.start + inserted.length + (/^[ \t]/.test(suffix) ? 1 : 0) }
}
