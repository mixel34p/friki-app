import { supabase } from './supabase'

function getLocalDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function attachWorks(entries) {
  const result = await Promise.all(['anime', 'game'].map(async type => {
    const ids = [...new Set(entries.filter(entry => entry.work_type === type).map(entry => String(entry.work_id)))]
    if (!ids.length) return []
    const table = type === 'anime' ? 'anime' : 'games'
    const fields = type === 'anime' ? 'id, title, image_url' : 'id, name, cover_url'
    const { data, error } = await supabase.from(table).select(fields).in('id', ids)
    if (error) throw error
    return (data || []).map(work => ({
      id: String(work.id),
      type,
      title: type === 'anime' ? work.title : work.name,
      image: type === 'anime' ? work.image_url : work.cover_url,
    }))
  }))
  return new Map(result.flat().map(work => [`${work.type}:${work.id}`, work]))
}

async function attachProfiles(entries) {
  const ids = [...new Set(entries.map(entry => entry.user_id).filter(Boolean))]
  if (!ids.length) return entries.map(entry => ({ ...entry, profile: null }))
  const { data, error } = await supabase.from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .in('id', ids)
  if (error) throw error
  const profiles = new Map((data || []).map(profile => [profile.id, profile]))
  return entries.map(entry => ({ ...entry, profile: profiles.get(entry.user_id) || null }))
}

export async function getHomeSnapshot() {
  const { start, end } = getLocalDayRange()
  const [reviewResult, todayResult, recentListResult] = await Promise.all([
    supabase.from('library_entries')
      .select('id, user_id, work_id, work_type, rating, review_text, created_at')
      .not('review_text', 'is', null).neq('review_text', '')
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('library_entries')
      .select('work_id, work_type')
      .gte('created_at', start).lt('created_at', end).limit(1000),
    supabase.from('user_lists')
      .select('id, title, list_type, media_type, content, user_id, created_at')
      .eq('visibility', 'public').order('created_at', { ascending: false }).limit(1),
  ])
  for (const result of [reviewResult, todayResult, recentListResult]) if (result.error) throw result.error

  const review = (reviewResult.data || [])[0] || null
  const recentList = (recentListResult.data || [])[0] || null
  const todayCounts = new Map()
  for (const entry of todayResult.data || []) {
    const key = `${entry.work_type}:${entry.work_id}`
    todayCounts.set(key, (todayCounts.get(key) || 0) + 1)
  }
  const dailyLeaders = ['anime', 'game'].flatMap(type => {
    const candidates = [...todayCounts.entries()].filter(([key]) => key.startsWith(`${type}:`))
      .sort((a, b) => b[1] - a[1])
    return candidates[0] ? [{ key: candidates[0][0], count: candidates[0][1], type }] : []
  })
  const dailyLeader = dailyLeaders.length
    ? dailyLeaders[Math.floor(Math.random() * dailyLeaders.length)]
    : null
  const dailyRatingsResult = dailyLeader
    ? await supabase.from('library_entries').select('rating')
      .eq('work_id', dailyLeader.key.slice(dailyLeader.type.length + 1))
      .eq('work_type', dailyLeader.type).not('rating', 'is', null).limit(1000)
    : { data: [], error: null }
  if (dailyRatingsResult.error) throw dailyRatingsResult.error
  const dailyRatings = (dailyRatingsResult.data || []).map(entry => Number(entry.rating)).filter(Number.isFinite)
  const dailyRatingAverage = dailyRatings.length
    ? dailyRatings.reduce((sum, rating) => sum + rating, 0) / dailyRatings.length
    : null
  const workKeys = [...new Set([...(review ? [`${review.work_type}:${review.work_id}`] : []), ...(dailyLeader ? [dailyLeader.key] : [])])]
  const workEntries = workKeys.map(key => {
    const [work_type, work_id] = key.split(':')
    return { work_type, work_id }
  })
  const profileEntries = await attachProfiles([review, recentList].filter(Boolean))
  const reviewWithProfile = review ? profileEntries.find(entry => entry.id === review.id) : null
  const recentListWithProfile = recentList ? profileEntries.find(entry => entry.id === recentList.id) : null
  const works = await attachWorks(workEntries)
  const addWork = entry => ({ ...entry, work: works.get(`${entry.work_type}:${entry.work_id}`) || null })

  return {
    review: reviewWithProfile ? addWork(reviewWithProfile) : null,
    recentList: recentListWithProfile || null,
    daily: dailyLeader ? { work: works.get(dailyLeader.key) || null, count: dailyLeader.count, ratingAverage: dailyRatingAverage } : null,
  }
}

export async function getFollowingUserIds(userId) {
  if (!userId) return []
  const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  if (error) throw error
  return [...new Set((data || []).map(row => row.following_id).filter(id => id !== userId))]
}

export async function getMutualFriends(userId, limit = 5) {
  if (!userId) return []
  const [{ data: following, error: followingError }, { data: followers, error: followersError }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
  ])
  if (followingError) throw followingError
  if (followersError) throw followersError
  const followerIds = new Set((followers || []).map(row => row.follower_id))
  const friendIds = [...new Set((following || []).map(row => row.following_id).filter(id => id !== userId && followerIds.has(id)))].slice(0, limit)
  if (!friendIds.length) return []
  const { data, error } = await supabase.from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .in('id', friendIds)
  if (error) throw error
  const profileById = new Map((data || []).map(profile => [profile.id, profile]))
  return friendIds.map(id => profileById.get(id)).filter(Boolean)
}
