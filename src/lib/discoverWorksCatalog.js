export function releaseYear(work) {
  const date = work.start_date || work.release_date || work.first_release_date
  if (!date) return ''
  if (typeof date === 'object') return date.year || ''
  if (typeof date === 'number' && date >= 1000 && date <= 9999) return Math.trunc(date)
  const value = String(date).trim()
  if (/^\d{10,13}$/.test(value)) {
    const year = new Date(Number(value) * (value.length === 13 ? 1 : 1000)).getFullYear()
    return Number.isNaN(year) ? '' : year
  }
  return value.match(/^(\d{4})/)?.[1] || ''
}

export function communityRating(work) {
  const rating = Number(work.userRating)
  return work.userRating != null && work.userRating !== '' && work.ratingCount > 0 && Number.isFinite(rating) && rating >= .5 && rating <= 5 ? rating : null
}

export function compareDiscoverWorks(a, b, order = 'popular') {
  if (order === 'rated') {
    const aRating = communityRating(a)
    const bRating = communityRating(b)
    if (aRating === null && bRating !== null) return 1
    if (bRating === null && aRating !== null) return -1
    if (aRating !== bRating) return bRating - aRating
    if (a.ratingCount !== b.ratingCount) return b.ratingCount - a.ratingCount
    if (a.registrations !== b.registrations) return b.registrations - a.registrations
  } else {
    if (a.registrations !== b.registrations) return b.registrations - a.registrations
    if (a.databasePopularity !== b.databasePopularity) return b.databasePopularity - a.databasePopularity
    if (a.databaseRating !== b.databaseRating) return (b.databaseRating || 0) - (a.databaseRating || 0)
  }
  const yearDifference = (Number(releaseYear(b)) || 0) - (Number(releaseYear(a)) || 0)
  return yearDifference || a.title.localeCompare(b.title, 'es') || String(a.id).localeCompare(String(b.id))
}
