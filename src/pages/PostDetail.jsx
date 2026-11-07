import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import MentionSuggestions from '../components/MentionSuggestions'
import MentionHighlights from '../components/MentionHighlights'
import MentionText from '../components/MentionText'
import useMentionAutocomplete from '../hooks/useMentionAutocomplete'
import { getMoreListsByUser } from '../lib/listService'
import LoadingSpinner from '../components/LoadingSpinner'
import MoreContentCards, { normalizeMoreContent } from '../components/MoreContentCards'
import SpoilerNotice from '../components/reviews/SpoilerNotice'
import useAutoResizeTextarea from '../hooks/useAutoResizeTextarea'
import { addPostComment, deletePost, deletePostComment, getMorePostsByUser, getPostById, getPostComments, getPostLikeState, togglePostLike, updatePostBody, updatePostFlags, updatePostComment } from '../lib/postService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import './ReviewDetail.css'
import './PostDetail.css'

function Avatar({ profile, size = '' }) {
  const name = profile?.display_name || profile?.username || 'Usuario'
  return <span className={`review-detail-avatar ${size}`} style={{ '--review-author-theme': profile?.theme_color || 'var(--brand-primary)' }}>
    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <DefaultAvatar accent={profile?.theme_color} />}
  </span>
}

function formatPostTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${time} · ${day}/${month}/${year}`
}

function getBubbleTextColor(color) {
  let channels = null
  const hex = String(color || '').match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    let value = hex[1]
    if (value.length === 3) value = [...value].map(char => char + char).join('')
    channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16))
  } else {
    const rgb = String(color || '').match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (rgb) channels = rgb.slice(1, 4).map(Number)
  }
  if (!channels) return '#111111'
  const luminance = channels.map(value => {
    const channel = value / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
  const blackContrast = (luminance + .05) / .05
  const whiteContrast = 1.05 / (luminance + .05)
  return blackContrast >= whiteContrast ? '#111111' : '#ffffff'
}

export default function PostDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { user, profile: currentProfile } = useAuth()
  const isPwaStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  const [isExitingPwa, setIsExitingPwa] = useState(false)
  const [post, setPost] = useState(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [failedMediaUrls, setFailedMediaUrls] = useState(() => new Set())
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [moreItems, setMoreItems] = useState([])
  const [morePostsLoading, setMorePostsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')
  const [commentText, setCommentText] = useState('')
  const commentInputRef = useRef(null)
  const [replyTo, setReplyTo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const handleBack = () => {
    if (!isPwaStandalone) return navigate(-1)
    setIsExitingPwa(true)
    window.setTimeout(() => navigate(-1), 280)
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [editPostOpen, setEditPostOpen] = useState(false)
  const [editPostBody, setEditPostBody] = useState('')
  const editPostInputRef = useRef(null)
  const editMentions = useMentionAutocomplete({ inputRef: editPostInputRef, value: editPostBody, onValueChange: setEditPostBody, enabled: editPostOpen, userId: user?.id })
  const [postActionError, setPostActionError] = useState('')
  const [savingPost, setSavingPost] = useState(false)
  const [updatingPostFlags, setUpdatingPostFlags] = useState(false)
  const [postFlagsError, setPostFlagsError] = useState('')
  const [deletePostOpen, setDeletePostOpen] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)
  useAutoResizeTextarea(commentInputRef, commentText)

  useEffect(() => {
    if (!isPwaStandalone || !screen.orientation?.lock) return undefined
    screen.orientation.lock('portrait').catch(() => {})
    return () => screen.orientation.unlock?.()
  }, [isPwaStandalone])

  useEffect(() => {
    let active = true
    setActiveMediaIndex(0)
    setFailedMediaUrls(new Set())
    setLightboxOpen(false)
    setLoading(true); setError('')
    getPostById(postId).then(result => { if (active) setPost(result) })
      .catch(err => { console.error('No se pudo cargar la publicación:', err); if (active) setError('No se pudo cargar la publicación.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [postId])

  useEffect(() => {
    if (!lightboxOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = event => {
      if (event.key === 'Escape') setLightboxOpen(false)
      if (event.key === 'ArrowLeft' && Array.isArray(post?.media) && post.media.length > 1) {
        setActiveMediaIndex(index => (index - 1 + post.media.length) % post.media.length)
      }
      if (event.key === 'ArrowRight' && Array.isArray(post?.media) && post.media.length > 1) {
        setActiveMediaIndex(index => (index + 1) % post.media.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [lightboxOpen, post?.media])

  useEffect(() => {
    if (!post?.user_id) { setMoreItems([]); return }
    let active = true
    setMorePostsLoading(true)
    Promise.allSettled([
      getMorePostsByUser(post.user_id, post.id, 5),
      getMoreListsByUser(post.user_id, null, 5),
    ]).then(([postsResult, listsResult]) => {
      if (!active) return
      const posts = postsResult.status === 'fulfilled' ? postsResult.value : []
      const lists = listsResult.status === 'fulfilled' ? listsResult.value : []
      setMoreItems(normalizeMoreContent({ posts, lists, limit: 3 }))
      if (postsResult.status === 'rejected') console.error('No se pudieron cargar más posts del autor:', postsResult.reason)
      if (listsResult.status === 'rejected') console.error('No se pudieron cargar listas del autor:', listsResult.reason)
    }).finally(() => { if (active) setMorePostsLoading(false) })
    return () => { active = false }
  }, [post?.user_id, post?.id])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true); setCommentsError('')
    try { setComments(await getPostComments(postId)) }
    catch (err) { console.error(err); setCommentsError('No se pudieron cargar los comentarios.') }
    finally { setCommentsLoading(false) }
  }, [postId])

  useEffect(() => { loadComments() }, [loadComments])
  useEffect(() => {
    let active = true
    getPostLikeState(postId, user?.id).then(state => {
      if (active) { setLikeCount(state.count); setLiked(state.liked) }
    }).catch(err => console.error('No se pudo cargar el like del post:', err))
    return () => { active = false }
  }, [postId, user?.id])

  async function handleLike() {
    if (!user) { navigate('/register'); return }
    if (!currentProfile) { navigate('/onboarding'); return }
    if (likeBusy) return
    const wasLiked = liked
    setLikeBusy(true); setLiked(!wasLiked); setLikeCount(count => Math.max(0, count + (wasLiked ? -1 : 1)))
    try { await togglePostLike(postId, user.id) }
    catch (err) {
      console.error(err); setLiked(wasLiked); setLikeCount(count => Math.max(0, count + (wasLiked ? 1 : -1)))
    } finally { setLikeBusy(false) }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1600)
    } catch (err) { console.error('No se pudo copiar el enlace:', err) }
  }

  async function handleCopyPostLink() {
    await handleShare()
    setMenuOpen(false)
  }

  function openPostEditor() {
    setEditPostBody(post?.body || '')
    setPostActionError('')
    setMenuOpen(false)
    setEditPostOpen(true)
  }

  async function handleSavePost(event) {
    event.preventDefault()
    if (!user || savingPost || editPostBody.length > 2000) return
    setSavingPost(true); setPostActionError('')
    try {
      const updated = await updatePostBody(postId, user.id, editPostBody)
      setPost(current => ({ ...current, body: updated.body, mentions: updated.mentions }))
      setEditPostOpen(false)
    } catch (err) {
      console.error('No se pudo editar la publicación:', err)
      setPostActionError(err.message || 'No se pudo guardar la publicación.')
    } finally { setSavingPost(false) }
  }

  async function handleToggleSensitive() {
    if (!user || updatingPostFlags) return
    const nextValue = !post.is_sensitive
    setUpdatingPostFlags(true); setPostFlagsError(''); setMenuOpen(false)
    try {
      const updated = await updatePostFlags(postId, user.id, { is_sensitive: nextValue })
      setPost(current => ({ ...current, is_sensitive: updated.is_sensitive }))
      setRevealed(false)
    } catch (err) {
      console.error('No se pudo cambiar la advertencia de contenido sensible:', err)
      setPostFlagsError('No se pudo actualizar la advertencia del post.')
    } finally { setUpdatingPostFlags(false) }
  }

  async function handleDeletePost() {
    if (!user || deletingPost) return
    setDeletingPost(true); setPostActionError('')
    try {
      await deletePost(postId, user.id)
      setDeletePostOpen(false)
      navigate(-1)
    } catch (err) {
      console.error('No se pudo eliminar la publicación:', err)
      setPostActionError(err.message || 'No se pudo eliminar la publicación.')
      setDeletingPost(false)
    }
  }

  async function handleSubmitComment(event) {
    event.preventDefault()
    if (!user || !commentText.trim() || submitting) return
    setSubmitting(true); setCommentsError('')
    try {
      const comment = await addPostComment(postId, user.id, commentText, replyTo?.id || null)
      setComments(items => [...items, comment]); setCommentText(''); setReplyTo(null)
    } catch (err) { console.error(err); setCommentsError(err.message || 'No se pudo publicar el comentario.') }
    finally { setSubmitting(false) }
  }

  async function handleEdit(event, comment) {
    event.preventDefault()
    if (!editingText.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const updated = await updatePostComment(comment.id, user.id, editingText)
      setComments(items => items.map(item => item.id === updated.id ? updated : item))
      setEditingId(null); setEditingText('')
    } catch (err) { console.error(err); setCommentsError(err.message || 'No se pudo editar el comentario.') }
    finally { setSavingEdit(false) }
  }

  async function handleDelete(comment) {
    if (deletingId) return
    setDeletingId(comment.id)
    try {
      await deletePostComment(comment.id, user.id)
      setComments(items => items.filter(item => item.id !== comment.id && item.parent_comment_id !== comment.id))
      if (replyTo?.id === comment.id) setReplyTo(null)
    } catch (err) { console.error(err); setCommentsError('No se pudo borrar el comentario.') }
    finally { setDeletingId(null) }
  }

  if (loading) return isPwaStandalone ? null : <div className="post-detail-state"><LoadingSpinner /></div>
  if (error || !post) return <main className={`review-detail-page post-detail-page${isPwaStandalone ? ` pwa-post-detail${isExitingPwa ? ' is-exiting' : ''}` : ''}`}><div className="review-post"><button className="review-detail-back" type="button" onClick={handleBack}>← Volver</button><h1>{error || 'Publicación no encontrada'}</h1></div></main>

  const author = post.author || {}
  const displayName = author.display_name || author.username || 'Usuario'
  const media = Array.isArray(post.media) ? post.media : []
  const authorPath = author.username ? `/profile/${author.username}` : '/profile'
  const isOwnPost = user?.id === post.user_id
  const hasContentWarning = Boolean(post.contains_spoiler || post.is_sensitive)
  const warningTitle = post.contains_spoiler
    ? `Spoiler de ${post.spoiler_work_title || 'la publicación'}${post.is_sensitive ? ' · contenido sensible' : ''}`
    : 'Contenido sensible'
  const warningLabel = post.contains_spoiler && post.spoiler_work_title
    ? `Spoiler de ${post.spoiler_work_title}`
    : post.contains_spoiler ? 'Spoiler de la publicación' : 'Contenido sensible'
  const warningAriaLabel = post.contains_spoiler ? 'Mostrar publicación con spoiler' : 'Mostrar contenido sensible'
  const contentHidden = hasContentWarning && !revealed

  const activeMedia = media[activeMediaIndex] || media[0]
  const activeMediaFailed = Boolean(activeMedia?.url && failedMediaUrls.has(activeMedia.url))
  const commentComposer = user && currentProfile && <form className={`review-comment-form${isPwaStandalone ? ' pwa-comment-composer' : ''}`} style={{ '--comment-accent': currentProfile.theme_color || 'var(--brand-primary)' }} onSubmit={handleSubmitComment}>
    <Avatar profile={currentProfile} size="small"/><label className="review-comment-input-wrap"><textarea ref={commentInputRef} aria-label="Escribe un comentario" value={commentText} onChange={event => setCommentText(event.target.value)} maxLength={300} rows={1} placeholder="Escribe un comentario…"/></label>
    <button type="submit" disabled={!commentText.trim() || submitting}>{submitting ? 'Enviando…' : 'Comentar'}</button>
  </form>
  return <main className={`review-detail-page post-detail-page${isPwaStandalone ? ' pwa-post-detail' : ''}${isExitingPwa ? ' is-exiting' : ''}`} style={{ '--review-page-accent': author.theme_color || 'var(--brand-primary)', '--post-bubble-text': getBubbleTextColor(author.theme_color), '--review-backdrop-image': activeMedia?.url ? `url("${activeMedia.url}")` : 'none' }}>
    <article className="review-post post-detail-card">
      <div className="post-detail-topbar">
        <button className="review-detail-back" type="button" onClick={handleBack}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Volver</button>
        <div className="post-detail-menu-wrap">
          <button className="post-detail-dots" type="button" aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
          {menuOpen && <div className="post-detail-menu">
            <button type="button" onClick={handleCopyPostLink}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>Copiar enlace</button>
            {isOwnPost && <>
              <button type="button" onClick={openPostEditor}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>Editar</button>
              <button type="button" className="is-unavailable" disabled title="Fijar publicaciones estará disponible próximamente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-4 1-4 4-1 5-2-2-5 5-2-2 5-5-2-2 5-1 4-4Z"/></svg>Fijar</button>
              <button type="button" className="is-sensitive" onClick={handleToggleSensitive} disabled={updatingPostFlags} title={post.is_sensitive ? 'Quitar advertencia de contenido sensible' : 'Marcar como sensible'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2.1h16a1.4 1.4 0 0 0 1.2-2.1L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>{post.is_sensitive ? 'Quitar marca de sensible' : 'Marcar como sensible'}</button>
              <button type="button" className="is-danger" onClick={() => { setMenuOpen(false); setPostActionError(''); setDeletePostOpen(true) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>Eliminar</button>
            </>}
          </div>}
        </div>
      </div>
      <header className="review-post-header post-detail-author">
        <Link className="review-post-author" to={authorPath}><Avatar profile={author} />
          <span className="review-post-author-copy"><strong>{displayName}</strong><span>@{author.username || 'usuario'} · {formatRelativeDate(post.created_at)}</span></span>
        </Link>
      </header>
      {postFlagsError && <p className="post-detail-flags-error" role="alert">{postFlagsError}</p>}
      {post.body && (contentHidden
        ? <SpoilerNotice text={post.body} label={`${warningLabel} · pulsa para ver`} ariaLabel={warningAriaLabel} onReveal={() => setRevealed(true)} />
        : <>{media.length === 0
          ? <p className="post-detail-body is-text-only"><MentionText text={post.body} mentions={post.mentions} /></p>
          : <p className="post-detail-body"><MentionText text={post.body} mentions={post.mentions} /></p>}</>)}
      {post.body && media.length === 0 && !contentHidden && <><time className="post-detail-text-date" dateTime={post.created_at}>{formatPostTimestamp(post.created_at)}</time><div className="post-detail-content-divider" aria-hidden="true" /></>}
      {!!media.length && <div className={`post-detail-gallery${contentHidden ? ' is-obscured' : ''}${activeMediaFailed ? ' has-load-error' : ''}`} aria-label="Imágenes de la publicación">
            {activeMediaFailed && !contentHidden
              ? <div className="post-detail-image-failed" role="img" aria-label="No se pudo cargar la imagen"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="m4 4 16 16"/></svg><span>No se pudo cargar la imagen</span></div>
              : <button className={`post-detail-gallery-image${contentHidden ? ' is-obscured' : ''}${activeMediaFailed ? ' is-load-error' : ''}`} type="button" onClick={() => contentHidden ? setRevealed(true) : setLightboxOpen(true)} aria-label={contentHidden ? warningAriaLabel : `Ampliar imagen ${activeMediaIndex + 1} de ${media.length}`}>
                <img src={activeMedia?.url} alt={contentHidden ? '' : activeMedia?.name || ''} loading="lazy" onError={() => setFailedMediaUrls(current => new Set(current).add(activeMedia?.url))} />
                {contentHidden && <span className="post-detail-image-warning"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3 21 21"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11.3 11.3 0 0 1 12 5c5.5 0 9.5 4.5 10 7-.2 1.1-1.2 2.6-2.6 3.9"/><path d="M6.6 6.6C3.9 8.2 2.2 10.6 2 12c.5 2.5 4.5 7 10 7 1.2 0 2.3-.2 3.3-.6"/></svg><strong>{warningTitle}</strong><small>Pulsa para ver</small></span>}
              </button>}
            {media.length > 1 && <>
              <span className="post-detail-gallery-count">{activeMediaIndex + 1}/{media.length}</span>
              <button className="post-detail-gallery-arrow previous" type="button" onClick={() => setActiveMediaIndex(index => (index - 1 + media.length) % media.length)} aria-label="Imagen anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
              <button className="post-detail-gallery-arrow next" type="button" onClick={() => setActiveMediaIndex(index => (index + 1) % media.length)} aria-label="Imagen siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
            </>}
          </div>}

      <div className="review-post-actions post-detail-actions">
        <button className={`review-like-btn${liked ? ' liked' : ''}`} type="button" onClick={handleLike} disabled={likeBusy} aria-pressed={liked} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'} title={liked ? 'Quitar like' : 'Dar like'}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill={liked ? 'var(--review-page-accent)' : 'none'} stroke={liked ? 'var(--review-page-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>{likeCount > 0 ? likeCount : 'Like'}</span>
        </button>
        <span className="review-post-action-spacer" />
        <button type="button" className="review-post-action upcoming" disabled title="Guardar posts estará disponible próximamente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z"/></svg>Guardar</button>
        <button type="button" className="review-post-action upcoming" disabled title="Repostear estará disponible próximamente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>Repostear</button>
        <button type="button" className="review-post-action review-share-trigger" onClick={handleShare} aria-label="Compartir publicación"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>{shareCopied ? 'Enlace copiado' : 'Compartir'}</button>
      </div>

      <section className="review-comments" aria-label="Comentarios">
        {user && currentProfile ? <>
          {replyTo && <div className="review-comment-reply-context">Respondiendo a {replyTo.profile?.display_name || replyTo.profile?.username || 'Usuario'}<button type="button" onClick={() => setReplyTo(null)}>Cancelar</button></div>}
          {isPwaStandalone ? createPortal(commentComposer, document.body) : commentComposer}
        </> : <p className="review-comments-signin"><Link to={user ? '/onboarding' : '/register'}>Inicia sesión para comentar</Link></p>}
        {commentsError && <div className="review-comments-error" role="alert">{commentsError}{commentsError.includes('cargar') && <button type="button" onClick={loadComments}>Reintentar</button>}</div>}
        {commentsLoading ? <div className="review-comments-loading">Cargando comentarios…</div>
          : comments.length === 0 ? <div className="review-comments-empty">No hay comentarios aún.</div>
            : <div className="review-comments-list">{comments.map(comment => {
              const commentProfile = comment.profile || {}
              const name = commentProfile.display_name || commentProfile.username || 'Usuario'
              const own = user?.id === comment.user_id
              const editing = editingId === comment.id
              const hasReplies = comments.some(item => item.parent_comment_id === comment.id)
              const profilePath = commentProfile.username ? `/profile/${commentProfile.username}` : '/profile'
              return <article key={comment.id} className={`review-comment${comment.parent_comment_id ? ' is-reply' : ''}${hasReplies ? ' has-replies' : ''}`}>
                <Link to={profilePath} className="review-comment-avatar-link"><Avatar profile={commentProfile} size="small" /></Link>
                <div className="review-comment-body">
                  <div className="review-comment-topline"><Link to={profilePath}>{name}</Link><time dateTime={comment.created_at}>{formatRelativeDate(comment.created_at)}</time></div>
                  {editing ? <form className="review-comment-edit-form" onSubmit={event => handleEdit(event, comment)}><textarea value={editingText} onChange={event => setEditingText(event.target.value)} maxLength={300} rows={2} aria-label="Editar comentario"/><div><button type="button" onClick={() => { setEditingId(null); setEditingText('') }}>Cancelar</button><button type="submit" disabled={!editingText.trim() || savingEdit}>{savingEdit ? 'Guardando…' : 'Guardar'}</button></div></form>
                    : <><p>{comment.content}</p><div className="review-comment-actions">{user && <button type="button" onClick={() => { setReplyTo(comment); setCommentText('') }}>Responder</button>}{own && <><button type="button" onClick={() => { setEditingId(comment.id); setEditingText(comment.content) }}>Editar</button><button type="button" disabled={Boolean(deletingId)} onClick={() => handleDelete(comment)}>{deletingId === comment.id ? 'Borrando…' : 'Eliminar'}</button></>}</div></>}
                </div>
              </article>
            })}</div>}
      </section>
    </article>
    <aside className="post-more-author" aria-label={`Más posts de ${displayName}`} style={{ '--post-more-accent': author.theme_color || 'var(--brand-primary)', '--post-more-text': getBubbleTextColor(author.theme_color) }}>
      <div className="post-more-panel">
        <Link className="post-more-profile" to={authorPath}>
          <Avatar profile={author} />
          <span><strong>Más de {displayName}</strong><small>@{author.username || 'usuario'}</small></span>
        </Link>
        {morePostsLoading ? <p className="post-more-state">Cargando publicaciones…</p>
          : moreItems.length ? <MoreContentCards items={moreItems} accent={author.theme_color} />
            : <p className="post-more-state">Aún no hay más publicaciones.</p>}
      </div>
    </aside>
    {editPostOpen && <div className="post-action-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !savingPost) setEditPostOpen(false) }}>
      <section className="post-action-dialog" role="dialog" aria-modal="true" aria-labelledby="post-edit-title">
        <h2 id="post-edit-title">Editar publicación</h2>
        <form onSubmit={handleSavePost}>
          <div className="mention-input-wrap"><textarea className="has-mention-highlights" ref={editPostInputRef} autoFocus value={editPostBody} {...editMentions.inputProps} maxLength={2000} rows={5} aria-label="Texto de la publicación" placeholder="Añade texto a tu publicación…" /><MentionHighlights inputRef={editPostInputRef} value={editPostBody} /><MentionSuggestions autocomplete={editMentions} /></div>
          <div className="post-action-dialog-meta"><span>{editPostBody.length}/2000</span>{postActionError && <p role="alert">{postActionError}</p>}</div>
          {!media.length && !editPostBody.trim() && <p className="post-action-error" role="status">Escribe algo para mantener la publicación.</p>}
          <div className="post-action-dialog-buttons"><button type="button" onClick={() => setEditPostOpen(false)} disabled={savingPost}>Cancelar</button><button type="submit" disabled={savingPost || (!media.length && !editPostBody.trim())}>{savingPost ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </form>
      </section>
    </div>}
    {deletePostOpen && createPortal(<div className="post-action-overlay post-delete-overlay" style={{ '--review-page-accent': author.theme_color || 'var(--brand-primary)' }} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deletingPost) setDeletePostOpen(false) }}>
      <section className="post-action-dialog post-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="post-delete-title" aria-describedby="post-delete-description">
        <h2 id="post-delete-title">¿Eliminar esta publicación?</h2>
        <p id="post-delete-description">La publicación y sus comentarios y me gusta se eliminarán.</p>
        {postActionError && <p className="post-action-error" role="alert">{postActionError}</p>}
        <div className="post-action-dialog-buttons"><button type="button" onClick={() => setDeletePostOpen(false)} disabled={deletingPost}>Cancelar</button><button className="is-danger" type="button" onClick={handleDeletePost} disabled={deletingPost}>{deletingPost ? 'Eliminando…' : 'Eliminar'}</button></div>
      </section>
    </div>, document.body)}
    {lightboxOpen && media.length > 0 && createPortal(
      <div className="post-image-lightbox" style={{ '--post-lightbox-accent': author.theme_color || 'var(--brand-primary)' }} role="presentation" onClick={() => setLightboxOpen(false)}>
        <section className="post-image-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Imagen ampliada">
          <header className="post-image-lightbox-topbar">
            {media.length > 1 && <span>{activeMediaIndex + 1} <i>/</i> {media.length}</span>}
            <button type="button" onClick={() => setLightboxOpen(false)} aria-label="Cerrar imagen ampliada"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
          </header>
          {media.length > 1 && <button className="post-image-lightbox-arrow previous" type="button" onClick={event => { event.stopPropagation(); setActiveMediaIndex(index => (index - 1 + media.length) % media.length) }} aria-label="Imagen anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>}
          {activeMediaFailed
            ? <div className="post-image-lightbox-failed"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="m4 4 16 16"/></svg><span>No se pudo cargar la imagen</span></div>
            : <img className="post-image-lightbox-image" src={activeMedia?.url} alt={activeMedia?.name || ''} onError={() => setFailedMediaUrls(current => new Set(current).add(activeMedia?.url))} />}
          {media.length > 1 && <button className="post-image-lightbox-arrow next" type="button" onClick={event => { event.stopPropagation(); setActiveMediaIndex(index => (index + 1) % media.length) }} aria-label="Imagen siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>}
        </section>
      </div>,
      document.body
    )}
  </main>
}
