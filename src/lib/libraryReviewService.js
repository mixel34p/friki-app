import { supabase } from './supabase'
import { getWorkById } from './workPageService'

async function attachProfiles(comments) {
  const userIds = [...new Set(comments.map(comment => comment.user_id).filter(Boolean))]
  if (!userIds.length) return comments.map(comment => ({ ...comment, profile: null }))

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, theme_color')
    .in('id', userIds)
  if (error) throw error

  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]))
  return comments.map(comment => ({ ...comment, profile: profileById.get(comment.user_id) || null }))
}

export async function getLibraryReview(reviewId) {
  const { data: entry, error } = await supabase
    .from('library_entries')
    .select('id, user_id, work_id, work_type, rating, review_text, contains_spoiler, finished_date, created_at, updated_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (error) throw error
  if (!entry?.review_text?.trim()) return null

  const [profileResult, work] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, theme_color, featured_badge')
      .eq('id', entry.user_id)
      .maybeSingle(),
    getWorkById(entry.work_type, Number(entry.work_id)),
  ])

  if (profileResult.error) throw profileResult.error
  return { ...entry, profile: profileResult.data, work }
}

export async function getLibraryReviewComments(reviewId) {
  const { data, error } = await supabase
    .from('library_review_comments')
    .select('id, review_entry_id, user_id, parent_comment_id, content, created_at')
    .eq('review_entry_id', reviewId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return attachProfiles(data || [])
}

export async function addLibraryReviewComment(reviewId, userId, content, parentCommentId = null) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Escribe un comentario antes de enviarlo.')
  if (trimmed.length > 2000) throw new Error('El comentario no puede superar los 2000 caracteres.')

  const { data, error } = await supabase
    .from('library_review_comments')
    .insert({ review_entry_id: reviewId, user_id: userId, parent_comment_id: parentCommentId, content: trimmed })
    .select('id, review_entry_id, user_id, parent_comment_id, content, created_at')
    .single()

  if (error) throw error
  return (await attachProfiles([data]))[0]
}

export async function updateLibraryReviewComment(commentId, userId, content) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('El comentario no puede estar vacío.')
  if (trimmed.length > 2000) throw new Error('El comentario no puede superar los 2000 caracteres.')

  const { data, error } = await supabase
    .from('library_review_comments')
    .update({ content: trimmed })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select('id, review_entry_id, user_id, parent_comment_id, content, created_at')
    .single()

  if (error) throw error
  return (await attachProfiles([data]))[0]
}

export async function deleteLibraryReviewComment(commentId, userId) {
  const { error } = await supabase
    .from('library_review_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)

  if (error) throw error
}
