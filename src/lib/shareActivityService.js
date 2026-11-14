import { supabase } from './supabase'

export async function getRecentUserReviews(userId, limit = 3) {
  if (!userId) return []
  const { data, error } = await supabase.from('library_entries')
    .select('id, work_id, work_type, rating, review_text, contains_spoiler, created_at')
    .eq('user_id', userId)
    .not('review_text', 'is', null)
    .neq('review_text', '')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  const reviews = (data || []).filter(entry => entry.review_text?.trim())
  const workGroups = await Promise.all(['game', 'anime'].map(async type => {
    const ids = [...new Set(reviews.filter(entry => entry.work_type === type).map(entry => String(entry.work_id)))]
    if (!ids.length) return []
    const { data: works, error: worksError } = await supabase.from(type === 'game' ? 'games' : 'anime')
      .select(type === 'game' ? 'id, name, cover_url' : 'id, title, image_url')
      .in('id', ids)
    if (worksError) throw worksError
    return (works || []).map(work => [`${type}:${work.id}`, {
      title: work.name || work.title,
      image: work.cover_url || work.image_url,
    }])
  }))
  const worksById = new Map(workGroups.flat())
  return reviews.map(review => ({ ...review, work: worksById.get(`${review.work_type}:${review.work_id}`) || null }))
}
