export function hasCustomAvatar(avatarUrl) {
  if (!avatarUrl) return false
  return !/\/default-avatar\.svg(?:[?#].*)?$/i.test(String(avatarUrl))
}
