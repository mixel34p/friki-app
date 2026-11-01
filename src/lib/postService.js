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

export async function updatePostBody(postId, userId, body) {
  const text = String(body || '')
  if (text.length > 2000) throw new Error('La publicación no puede superar los 2000 caracteres.')
  const { data, error } = await supabase.from('posts')
    .update({ body: text })
    .eq('id', postId)
    .eq('user_id', userId)
    .select('id, body')
    .single()
  if (error) throw error
  return data
}

export async function updatePostFlags(postId, userId, flags) {
  const updates = {}
  if (typeof flags?.is_sensitive === 'boolean') updates.is_sensitive = flags.is_sensitive
  if (typeof flags?.contains_spoiler === 'boolean') updates.contains_spoiler = flags.contains_spoiler
  if (!Object.keys(updates).length) return null
  const { data, error } = await supabase.from('posts')
    .update(updates)
    .eq('id', postId)
    .eq('user_id', userId)
    .select('id, is_sensitive, contains_spoiler')
    .single()
  if (error) throw error
  return data
}

export async function deletePost(postId, userId) {
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId)
  if (error) throw error
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

export async function getHomePosts(limit = 30, authorIds = null, excludedAuthorId = null) {
  if (Array.isArray(authorIds) && !authorIds.length) return []
  const now = Date.now()
  const recentCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const olderCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  let request = supabase.from('posts')
    .select('id, user_id, body, media, contains_spoiler, is_sensitive, spoiler_work_title, created_at')
    .gte('created_at', olderCutoff)
    .order('created_at', { ascending: false })
  if (authorIds) request = request.in('user_id', authorIds)
  if (excludedAuthorId) request = request.neq('user_id', excludedAuthorId)
  const { data, error } = await request.limit(Math.max(limit * 3, 60))
  if (error) throw error

  const posts = data || []
  const newer = posts.filter(post => post.created_at >= recentCutoff)
  const older = posts.filter(post => post.created_at < recentCutoff)
  const mixed = []
  let recentIndex = 0
  let olderIndex = 0
  // Keep the feed current while adding a steady sample of posts from earlier in the month.
  while (mixed.length < limit && (recentIndex < newer.length || olderIndex < older.length)) {
    for (let count = 0; count < 2 && recentIndex < newer.length && mixed.length < limit; count++) mixed.push(newer[recentIndex++])
    if (olderIndex < older.length && mixed.length < limit) mixed.push(older[olderIndex++])
    if (recentIndex >= newer.length && olderIndex < older.length && mixed.length < limit) mixed.push(older[olderIndex++])
  }

  const userIds = [...new Set(mixed.map(post => post.user_id).filter(Boolean))]
  if (!userIds.length) return mixed.map(post => ({ ...post, author: null }))
  const { data: profiles, error: profilesError } = await supabase.from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .in('id', userIds)
  if (profilesError) throw profilesError
  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]))
  return mixed.map(post => ({ ...post, author: profileById.get(post.user_id) || null }))
}

export async function getPostsByUser(userId, limit = 30) {
  if (!userId) return []
  const { data, error } = await supabase.from('posts')
    .select('id, user_id, body, media, contains_spoiler, is_sensitive, spoiler_work_title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  const { data: author, error: profileError } = await supabase.from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  return (data || []).map(post => ({ ...post, author: author || null }))
}

export async function getMorePostsByUser(userId, currentPostId, limit = 5) {
  if (!userId) return []
  let request = supabase.from('posts')
    .select('id, user_id, body, media, contains_spoiler, is_sensitive, spoiler_work_title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (currentPostId) request = request.neq('id', currentPostId)
  const { data, error } = await request.limit(limit)
  if (error) throw error
  return data || []
}

export async function getPostLikeState(postId, userId) {
  const [{ count, error: countError }, { data, error: ownError }] = await Promise.all([
    supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    userId
      ? supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (countError) throw countError
  if (ownError) throw ownError
  return { count: count || 0, liked: Boolean(data) }
}

export async function togglePostLike(postId, userId) {
  const { data, error } = await supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) {
    const { error: deleteError } = await supabase.from('post_likes').delete().eq('id', data.id)
    if (deleteError) throw deleteError
    return false
  }
  const { error: insertError } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
  if (insertError) throw insertError
  return true
}

async function attachPostCommentProfiles(comments) {
  const userIds = [...new Set(comments.map(comment => comment.user_id).filter(Boolean))]
  if (!userIds.length) return comments.map(comment => ({ ...comment, profile: null }))
  const { data, error } = await supabase.from('profiles')
    .select('id, username, display_name, avatar_url, theme_color').in('id', userIds)
  if (error) throw error
  const profiles = new Map((data || []).map(profile => [profile.id, profile]))
  return comments.map(comment => ({ ...comment, profile: profiles.get(comment.user_id) || null }))
}

export async function getPostComments(postId) {
  const { data, error } = await supabase.from('post_comments')
    .select('id, post_id, user_id, parent_comment_id, content, created_at, updated_at')
    .eq('post_id', postId).order('created_at', { ascending: true })
  if (error) throw error
  return attachPostCommentProfiles(data || [])
}

export async function addPostComment(postId, userId, content, parentCommentId = null) {
  const text = content.trim()
  if (!text) throw new Error('Escribe un comentario antes de enviarlo.')
  if (text.length > 2000) throw new Error('El comentario no puede superar los 2000 caracteres.')
  const { data, error } = await supabase.from('post_comments')
    .insert({ post_id: postId, user_id: userId, parent_comment_id: parentCommentId, content: text })
    .select('id, post_id, user_id, parent_comment_id, content, created_at, updated_at').single()
  if (error) throw error
  return (await attachPostCommentProfiles([data]))[0]
}

export async function updatePostComment(commentId, userId, content) {
  const text = content.trim()
  if (!text) throw new Error('El comentario no puede estar vacío.')
  if (text.length > 2000) throw new Error('El comentario no puede superar los 2000 caracteres.')
  const { data, error } = await supabase.from('post_comments').update({ content: text })
    .eq('id', commentId).eq('user_id', userId)
    .select('id, post_id, user_id, parent_comment_id, content, created_at, updated_at').single()
  if (error) throw error
  return (await attachPostCommentProfiles([data]))[0]
}

export async function deletePostComment(commentId, userId) {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', userId)
  if (error) throw error
}
