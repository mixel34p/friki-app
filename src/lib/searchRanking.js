export function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchMatchScore(query, candidates = []) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 0
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  let best = 0

  for (const candidate of candidates) {
    const title = normalizeSearchText(candidate)
    if (!title) continue
    if (title === normalizedQuery) best = Math.max(best, 10000)
    else if (title.startsWith(normalizedQuery)) best = Math.max(best, 8500 - Math.min(500, title.length - normalizedQuery.length))
    else if (title.includes(normalizedQuery)) best = Math.max(best, 7000 - Math.min(1000, title.indexOf(normalizedQuery) * 10))

    const titleTokens = title.split(' ').filter(Boolean)
    const matched = queryTokens.filter(token => titleTokens.some(titleToken => titleToken.startsWith(token)))
    const coverage = matched.length / queryTokens.length
    if (coverage === 1) {
      best = Math.max(best, 6000 - Math.min(1000, Math.max(0, titleTokens.length - queryTokens.length) * 40))
    } else if (coverage > 0) {
      best = Math.max(best, 3000 * coverage)
    }
  }

  return best
}

export function matchesAllSearchTokens(query, candidates = []) {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean)
  if (!tokens.length) return false
  return candidates.some(candidate => {
    const titleTokens = normalizeSearchText(candidate).split(' ').filter(Boolean)
    return tokens.every(token => titleTokens.some(titleToken => titleToken.startsWith(token)))
  })
}

export function rankSearchResults(items, query, getCandidates, getPopularity = () => 0) {
  return [...items].sort((a, b) => {
    const scoreDifference = searchMatchScore(query, getCandidates(b)) - searchMatchScore(query, getCandidates(a))
    if (scoreDifference) return scoreDifference
    return (Number(getPopularity(b)) || 0) - (Number(getPopularity(a)) || 0)
  })
}
