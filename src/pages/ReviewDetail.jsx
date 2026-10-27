import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getVisibleAccentColor } from '../lib/colorContrast'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { addLibraryReviewComment, deleteLibraryReviewComment, getLibraryReview, getLibraryReviewComments, updateLibraryReviewComment } from '../lib/libraryReviewService'
import { getWorkLog } from '../lib/libraryService'
import LoadingSpinner from '../components/LoadingSpinner'
import LogModal from '../components/LogModal'
import ReviewLikeButton from '../components/ReviewLikeButton'
import SpoilerNotice from '../components/reviews/SpoilerNotice'
import SEO from '../components/SEO'
import '../components/LibraryGrid.css'
import './ReviewDetail.css'

function ReviewStars({ rating }) {
  const value = rating == null ? 0 : Math.max(0, Math.min(5, Number(rating)))
  return <span className="review-detail-stars" aria-label={`${rating == null ? 'Sin nota' : `${value.toFixed(1)} de 5`} estrellas`}>
    <span className="review-detail-stars-icons">
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, value - index))
        const gradientId = `review-star-${index}`
        return <svg key={index} viewBox="0 0 24 24" aria-hidden="true">
          {fill > 0 && fill < 1 && <defs><linearGradient id={gradientId}><stop offset={`${fill * 100}%`} stopColor="var(--review-page-accent)"/><stop offset={`${fill * 100}%`} stopColor="transparent"/></linearGradient></defs>}
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={fill === 1 ? 'var(--review-page-accent)' : fill > 0 ? `url(#${gradientId})` : 'none'} />
        </svg>
      })}
    </span>
    <strong>{rating == null ? '—' : value.toFixed(1)}</strong>
  </span>
}

function getReleaseYear(work, workType) {
  const release = workType === 'game'
    ? work?.release_date || work?.first_release_date
    : work?.release_date || work?.start_date
  if (!release) return null
  if (typeof release === 'number') {
    const date = new Date(release > 9999999999 ? release : release * 1000)
    return Number.isNaN(date.getTime()) ? null : date.getFullYear()
  }
  const value = String(release).trim()
  if (/^\d{4}$/.test(value)) return value
  const year = value.match(/^(\d{4})/)
  if (year) return year[1]
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getFullYear()
}

function ProfileAvatar({ profile, size = 'normal' }) {
  const name = profile?.display_name || profile?.username || 'Usuario'
  return <span className={`review-detail-avatar ${size}`} style={{ '--review-author-theme': profile?.theme_color || 'var(--brand-primary)' }}>
    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
  </span>
}

export default function ReviewDetail() {
  const { reviewId } = useParams()
  const navigate = useNavigate()
  const { user, profile: currentProfile, updateProfile } = useAuth()
  const [review, setReview] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [commentsError, setCommentsError] = useState('')
  const [showSpoiler, setShowSpoiler] = useState(false)
  const [showFullReview, setShowFullReview] = useState(false)
  const [existingLog, setExistingLog] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [savingCommentEdit, setSavingCommentEdit] = useState(false)
  const deleteTimerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    setCommentsError('')
    try {
      setComments(await getLibraryReviewComments(reviewId))
    } catch (err) {
      console.error('Error loading review comments:', err)
      setCommentsError('No se pudieron cargar los comentarios.')
    } finally {
      setCommentsLoading(false)
    }
  }, [reviewId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getLibraryReview(reviewId)
      .then(data => { if (active) setReview(data) })
      .catch(err => {
        console.error('Error loading review:', err)
        if (active) setError('No se pudo cargar esta review.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reviewId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  useEffect(() => {
    let active = true
    if (!user?.id || !review?.work_id || !review?.work_type) {
      setExistingLog(null)
      return undefined
    }
    getWorkLog(user.id, Number(review.work_id), review.work_type)
      .then(log => { if (active) setExistingLog(log) })
      .catch(err => console.error('Error loading user work entry:', err))
    return () => { active = false }
  }, [user?.id, review?.work_id, review?.work_type])

  const handleSubmit = async event => {
    event.preventDefault()
    if (!user || !commentText.trim() || submitting) return
    setSubmitting(true)
    setCommentsError('')
    try {
      const comment = await addLibraryReviewComment(reviewId, user.id, commentText, replyTo?.id || null)
      setComments(current => [...current, comment].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      setCommentText('')
      setReplyTo(null)
    } catch (err) {
      console.error('Error posting review comment:', err)
      setCommentsError(err.message || 'No se pudo publicar el comentario.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async comment => {
    if (!user || comment.user_id !== user.id || pendingDelete) return
    setComments(current => current.filter(item => item.id !== comment.id))
    setPendingDelete(comment)
    deleteTimerRef.current = setTimeout(async () => {
      if (mountedRef.current) setPendingDelete(current => current?.id === comment.id ? null : current)
      try {
        await deleteLibraryReviewComment(comment.id, user.id)
        if (mountedRef.current) setComments(current => current.map(item => item.parent_comment_id === comment.id ? { ...item, parent_comment_id: null } : item))
      } catch (err) {
        console.error('Error deleting review comment:', err)
        if (mountedRef.current) {
          setComments(current => [...current, comment].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
          setCommentsError('No se pudo eliminar el comentario.')
        }
      } finally {
        deleteTimerRef.current = null
      }
    }, 4000)
  }

  const handleUndoDelete = () => {
    if (!pendingDelete) return
    clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = null
    setComments(current => [...current, pendingDelete].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    setPendingDelete(null)
  }

  const handleUpdateComment = async (event, comment) => {
    event.preventDefault()
    if (!user || savingCommentEdit) return
    setSavingCommentEdit(true)
    setCommentsError('')
    try {
      const updated = await updateLibraryReviewComment(comment.id, user.id, editingText)
      setComments(current => current.map(item => item.id === updated.id ? updated : item))
      setEditingCommentId(null)
      setEditingText('')
    } catch (err) {
      console.error('Error editing review comment:', err)
      setCommentsError(err.message || 'No se pudo editar el comentario.')
    } finally {
      setSavingCommentEdit(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error || !review) {
    return <main className="review-detail-page"><div className="review-detail-state"><h1>{error ? 'Error al cargar la review' : 'Review no encontrada'}</h1><Link to="/search">Volver a descubrir</Link></div></main>
  }

  const author = review.profile
  const workName = review.work_type === 'game' ? review.work?.name : review.work?.title
  const reviewText = String(review.review_text || '')
  const reviewTextLimit = 460
  const shouldTrimReview = reviewText.length > reviewTextLimit
  const reviewPreviewEnd = shouldTrimReview ? reviewText.lastIndexOf(' ', reviewTextLimit) : reviewText.length
  const reviewPreview = shouldTrimReview && reviewPreviewEnd > 300 ? reviewText.slice(0, reviewPreviewEnd).trimEnd() : reviewText.slice(0, reviewTextLimit).trimEnd()
  const reviewPreviewText = shouldTrimReview && !showFullReview ? `${reviewPreview}… Ver más` : reviewText
  const workCover = review.work_type === 'game' ? review.work?.cover_url : review.work?.image_url
  const reviewBackdrop = workCover
  const workYear = getReleaseYear(review.work, review.work_type)
  const workPath = `/${review.work_type === 'game' ? 'game' : 'anime'}/${review.work_id}`
  const authorName = author?.display_name || author?.username || 'Usuario'
  const authorPath = author?.username ? `/profile/${author.username}` : '/profile'
  const pageAccent = getVisibleAccentColor(author?.theme_color || '#14b8a6')
  const wishlist = currentProfile?.wishlist || []
  const wishlistIndex = wishlist.findIndex(item => String(item.id) === String(review.work_id) && item.type === review.work_type)
  const isInWishlist = wishlistIndex >= 0

  const toggleWishlist = async () => {
    if (!user || !currentProfile || !review.work) return
    const updatedWishlist = [...wishlist]
    if (isInWishlist) updatedWishlist.splice(wishlistIndex, 1)
    else updatedWishlist.push({
      id: String(review.work_id),
      type: review.work_type,
      title: workName || 'Obra',
      image_url: workCover,
      added_at: new Date().toISOString(),
    })
    try {
      await updateProfile({ wishlist: updatedWishlist })
    } catch (err) {
      console.error('Error updating wishlist:', err)
    }
  }

  const handleLogSaved = savedLog => {
    setExistingLog(savedLog)
    setShowLogModal(false)
  }

  return (
    <main className="review-detail-page" style={{ '--review-page-accent': pageAccent, '--review-backdrop-image': reviewBackdrop ? `url("${reviewBackdrop}")` : 'none' }}>
      <SEO title={`${authorName}: review de ${workName || 'una obra'}`} description={review.review_text.slice(0, 150)} />
      <button className="review-detail-back" type="button" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Volver
      </button>

      <article className="review-post">
        <header className="review-post-header">
          <Link to={authorPath} className="review-post-author">
            <ProfileAvatar profile={author} />
            <span className="review-post-author-copy">
              <strong>{authorName}</strong>
              {author?.username && <span>@{author.username}</span>}
            </span>
          </Link>
          {review.finished_date && <time className="review-post-finished" dateTime={review.finished_date}>Terminada el {new Date(review.finished_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}
        </header>

        <div className="review-post-main">
          <div className="review-post-copy">
            <Link className="review-post-work-title" to={workPath}>{workName || 'Obra'}</Link>
            <div className="review-post-year-row">
              {workYear && <span className="review-post-year">{workYear}</span>}
            </div>
            <div className="review-post-rating-row">
              <ReviewStars rating={review.rating} />
              <div className="review-post-work-actions">
                <button type="button" className="review-work-action primary" onClick={() => setShowLogModal(true)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  {existingLog ? 'Editar registro' : 'Registrar obra'}
                </button>
                <button type="button" className={`review-work-action${isInWishlist ? ' selected' : ''}`} onClick={toggleWishlist} title={isInWishlist ? 'Quitar de la wishlist' : 'Añadir a la wishlist'}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z"/></svg>
                  {isInWishlist ? 'En wishlist' : 'Wishlist'}
                </button>
              </div>
            </div>
            <h2 className="review-post-review-heading">Review de {authorName}</h2>
            {review.contains_spoiler && !showSpoiler ? (
              <SpoilerNotice text={reviewPreviewText} onReveal={() => setShowSpoiler(true)} />
            ) : <>
              <p className="review-post-text">{shouldTrimReview && !showFullReview ? `${reviewPreview}…` : reviewText}</p>
              {shouldTrimReview && <button type="button" className="review-post-more" onClick={() => setShowFullReview(value => !value)}>{showFullReview ? 'Ver menos' : 'Ver más'}</button>}
            </>}
          </div>
          <Link to={workPath} className="review-post-cover" aria-label={`Ver ${workName || 'la obra'}`}>
            {workCover ? <img src={workCover} alt={`Portada de ${workName || 'la obra'}`} /> : <span>Sin portada</span>}
          </Link>
        </div>

        <div className="review-post-actions">
          <ReviewLikeButton entryId={review.id} />
          <span className="review-post-action-spacer" />
          <button type="button" className="review-post-action upcoming" disabled title="Guardar reviews estará disponible próximamente">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z"/></svg>Guardar
          </button>
          <button type="button" className="review-post-action upcoming" disabled title="Repostear estará disponible próximamente">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>Repostear
          </button>
        </div>

      <section className="review-comments" aria-labelledby="review-comments-title">
        <div className="review-comments-heading"><h2 id="review-comments-title">Comentarios</h2></div>
        {commentsError && <div className="review-comments-error" role="alert">{commentsError}{commentsError.includes('cargar') && <button type="button" onClick={loadComments}>Reintentar</button>}</div>}
        {commentsLoading ? <div className="review-comments-loading">Cargando comentarios…</div> : comments.length === 0 ? <div className="review-comments-empty">No hay comentarios.</div> : (
          <div className="review-comments-list">
            {comments.map(comment => {
              const name = comment.profile?.display_name || comment.profile?.username || 'Usuario'
              const isOwnComment = user?.id === comment.user_id
              const isEditing = editingCommentId === comment.id
              const hasReplies = comments.some(item => item.parent_comment_id === comment.id)
              return <article className={`review-comment${comment.parent_comment_id ? ' is-reply' : ''}${hasReplies ? ' has-replies' : ''}`} key={comment.id}>
                <Link to={comment.profile?.username ? `/profile/${comment.profile.username}` : '/profile'} className="review-comment-avatar-link"><ProfileAvatar profile={comment.profile} size="small" /></Link>
                <div className="review-comment-body">
                  <div className="review-comment-topline"><Link to={comment.profile?.username ? `/profile/${comment.profile.username}` : '/profile'}>{name}</Link><time dateTime={comment.created_at}>{formatRelativeDate(comment.created_at)}</time></div>
                  {isEditing ? (
                    <form className="review-comment-edit-form" onSubmit={event => handleUpdateComment(event, comment)}>
                      <textarea aria-label="Editar comentario" value={editingText} onChange={event => setEditingText(event.target.value)} maxLength={2000} rows={2} />
                      <div><button type="button" onClick={() => { setEditingCommentId(null); setEditingText('') }}>Cancelar</button><button type="submit" disabled={!editingText.trim() || savingCommentEdit}>{savingCommentEdit ? 'Guardando…' : 'Guardar'}</button></div>
                    </form>
                  ) : <>
                    <p>{comment.content}</p>
                    <div className="review-comment-actions">
                      {user && <button type="button" onClick={() => { setReplyTo(comment); setCommentText('') }}>Responder</button>}
                      {isOwnComment && <>
                        <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingText(comment.content) }}>Editar</button>
                        <button type="button" onClick={() => handleDeleteComment(comment)} disabled={Boolean(pendingDelete)}>Eliminar</button>
                      </>}
                    </div>
                  </>}
                </div>
              </article>
            })}
          </div>
        )}
        {user ? (
          <>
          {replyTo && <div className="review-comment-reply-context">Respondiendo a {replyTo.profile?.display_name || replyTo.profile?.username || 'Usuario'}<button type="button" onClick={() => setReplyTo(null)}>Cancelar</button></div>}
          <form className="review-comment-form" onSubmit={handleSubmit}>
            <ProfileAvatar profile={currentProfile} size="small" />
            <label className="review-comment-input-wrap">
              <textarea aria-label="Escribe un comentario" value={commentText} onChange={event => setCommentText(event.target.value)} maxLength={2000} rows={1} placeholder="Escribe un comentario…" />
            </label>
            <button type="submit" disabled={!commentText.trim() || submitting}>{submitting ? 'Enviando…' : 'Comentar'}</button>
          </form>
          </>
        ) : <p className="review-comments-signin"><Link to="/login">Inicia sesión</Link> para comentar.</p>}
      </section>
      {pendingDelete && <div className="review-comment-undo-toast" role="status"><span>Comentario borrado</span><button type="button" onClick={handleUndoDelete}>Deshacer</button></div>}
      </article>
      {showLogModal && <LogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        work={{ id: Number(review.work_id), type: review.work_type, title: workName, image: workCover, banner_url: review.work?.banner_url }}
        existingLog={existingLog}
        onSaveComplete={handleLogSaved}
      />}
    </main>
  )
}
