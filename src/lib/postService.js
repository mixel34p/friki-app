import { supabase } from './supabase'

export async function createPost(post) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: post.user_id,
      body: post.body || '',
      media: Array.isArray(post.media) ? post.media : [],
      contains_spoiler: Boolean(post.contains_spoiler),
      is_sensitive: Boolean(post.is_sensitive),
      spoiler_work_id: post.spoiler_work_id || null,
      spoiler_work_type: post.spoiler_work_type || null,
      spoiler_work_title: post.spoiler_work_title || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function getPostById(id) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .eq('id', data.user_id)
    .maybeSingle()
  if (profileError) throw profileError
  return { ...data, author: profile || null }
}

export async function getRecentPosts(limit = 6) {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, body, media, contains_spoiler, is_sensitive, spoiler_work_title, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const posts = data || []
  const userIds = [...new Set(posts.map(post => post.user_id).filter(Boolean))]
  if (!userIds.length) return posts.map(post => ({ ...post, author: null }))

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .in('id', userIds)
  if (profilesError) throw profilesError
  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]))
  return posts.map(post => ({ ...post, author: profileById.get(post.user_id) || null }))
}
