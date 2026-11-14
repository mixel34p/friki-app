export function summarizeWorkRatings(entries) {
  const distribution = Array.from({ length: 10 }, (_, index) => ({ rating: (index + 1) / 2, count: 0 }))
  let total = 0
  let sum = 0
  for (const entry of entries) {
    if (entry.rating == null) continue
    const rating = Number(entry.rating)
    if (!Number.isFinite(rating) || rating < .5 || rating > 5 || !Number.isInteger(rating * 2)) continue
    distribution[rating * 2 - 1].count++
    total++
    sum += rating
  }
  return { distribution, ratingsCount: total, avgRating: total ? sum / total : null }
}
