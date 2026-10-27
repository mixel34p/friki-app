import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaFacebookF, FaRedditAlien, FaTelegram, FaWhatsapp, FaXTwitter } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
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

function getReviewShareCover(url) {
  if (!url) return null
  let source = url.startsWith('//') ? `https:${url}` : url
  if (source.includes('images.igdb.com')) source = source.replace(/t_[a-z0-9_]+/i, 't_cover_big').replace(/t_thumb/i, 't_cover_big')
  if (/anilist\.co/i.test(source)) source = source.replace('/cover/medium/', '/cover/large/')
  return source
}

function ProfileAvatar({ profile, size = 'normal' }) {
  const name = profile?.display_name || profile?.username || 'Usuario'
  return <span className={`review-detail-avatar ${size}`} style={{ '--review-author-theme': profile?.theme_color || 'var(--brand-primary)' }}>
    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
  </span>
}

async function loadShareImage(source) {
  if (!source) return null
  try {
    const normalizedSource = new URL(source, window.location.href).href
    let blob
    try {
      const { data, error, response } = await supabase.functions.invoke('igdb-proxy', { body: { imageUrl: normalizedSource } })
      if (error) throw error
      const imageType = response?.headers?.get('x-image-content-type') || 'image/jpeg'
      blob = data instanceof Blob ? new Blob([data], { type: imageType }) : data ? new Blob([data], { type: imageType }) : null
    } catch {
      const response = await fetch(normalizedSource, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
      if (!response.ok) return null
      blob = await response.blob()
    }
    if (!blob?.type?.startsWith('image/')) return null
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = dataUrl
    })
    return image
  } catch { return null }
}

function wrapCanvasText(ctx, text, maxWidth) {
  const lines = []
  String(text || '').split(/\s+/).forEach(word => {
    if (!word) return
    if (ctx.measureText(word).width > maxWidth) {
      let fragment = ''
      for (const character of word) {
        const next = fragment + character
        if (fragment && ctx.measureText(next).width > maxWidth) {
          lines.push(fragment)
          fragment = character
        } else fragment = next
      }
      if (fragment) lines.push(fragment)
      return
    }
    const current = lines.at(-1)
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > maxWidth) lines.push(word)
    else if (current) lines[lines.length - 1] = candidate
    else lines.push(word)
  })
  return lines
}

function canvasRoundedRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  const r = Math.min(radius, width / 2, height / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawShareStar(ctx, x, y, radius, fillAmount, color) {
  const points = []
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5
    const pointRadius = index % 2 === 0 ? radius : radius * .46
    points.push([x + Math.cos(angle) * pointRadius, y + Math.sin(angle) * pointRadius])
  }
  ctx.beginPath()
  points.forEach(([pointX, pointY], index) => index ? ctx.lineTo(pointX, pointY) : ctx.moveTo(pointX, pointY))
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8
  ctx.stroke()
  if (fillAmount > 0) {
    ctx.save()
    ctx.clip()
    ctx.fillStyle = color
    ctx.fillRect(x - radius, y - radius, radius * 2 * Math.min(1, fillAmount), radius * 2)
    ctx.restore()
  }
}

async function createReviewShareImage({ authorName, username, avatarUrl, accent, workName, workYear, workType, coverUrl, rating, reviewText }) {
  await document.fonts?.ready
  const titleStyle = getComputedStyle(document.querySelector('.review-post-work-title') || document.body)
  const reviewStyle = getComputedStyle(document.querySelector('.review-post-text') || document.body)
  const headingStyle = getComputedStyle(document.querySelector('.review-post-review-heading') || document.body)
  const authorStyle = getComputedStyle(document.querySelector('.review-post-author-copy strong') || document.body)
  const brandStyle = getComputedStyle(document.querySelector('.sidebar-brand-name') || document.body)
  const accentProbe = document.createElement('span')
  accentProbe.style.color = accent
  document.body.appendChild(accentProbe)
  const canvasAccent = getComputedStyle(accentProbe).color || '#14b8a6'
  accentProbe.remove()
  const cover = await loadShareImage(coverUrl)
  const avatar = await loadShareImage(avatarUrl)
  const canvas = document.createElement('canvas')
  const width = 960
  const sideMargin = 58
  const coverX = sideMargin
  const coverY = 174
  const coverWidth = 270
  const coverHeight = 372
  const copyX = 365
  const copyWidth = width - copyX - sideMargin
  const completeReview = String(reviewText || '').trim()
  // Match the normal review preview length and keep the exported card at a fixed size.
  const review = completeReview.slice(0, 460)
  const measure = canvas.getContext('2d')
  const titleFamily = titleStyle.fontFamily || 'Arial, sans-serif'
  const reviewFamily = reviewStyle.fontFamily || 'Arial, sans-serif'
  const authorFamily = authorStyle.fontFamily || titleFamily
  const headingFamily = headingStyle.fontFamily || titleFamily
  const brandFamily = brandStyle.fontFamily || titleFamily
  measure.font = `400 25px ${reviewFamily}`
  const lines = wrapCanvasText(measure, review, copyWidth)
  const visibleLines = lines.slice(0, 8)
  const reviewIsTruncated = completeReview.length > review.length || lines.length > visibleLines.length
  const height = 900
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, width, height)
  if (cover) {
    ctx.save()
    ctx.filter = 'blur(74px)'
    ctx.globalAlpha = .32
    ctx.drawImage(cover, -80, -80, width + 160, height + 160)
    ctx.restore()
    ctx.fillStyle = 'rgba(5, 6, 9, .84)'
    ctx.fillRect(0, 0, width, height)
  }
  const glow = ctx.createRadialGradient(680, 110, 0, 680, 110, 600)
  glow.addColorStop(0, canvasAccent)
  glow.addColorStop(1, 'rgba(10,10,10,0)')
  ctx.globalAlpha = .16
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.globalAlpha = 1

  const avatarX = sideMargin
  const avatarY = 57
  const avatarSize = 62
  if (avatar) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.1)'
    ctx.beginPath()
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = canvasAccent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 - 1.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#f4f4f5'
  ctx.font = `${authorStyle.fontWeight || 700} 24px ${authorFamily}`
  ctx.fillText(authorName || 'Usuario', avatarX + avatarSize + 20, 77, width - avatarX - avatarSize - 40)
  ctx.fillStyle = '#a1a1aa'
  ctx.font = `400 17px ${authorFamily}`
  ctx.fillText(`@${username || 'usuario'}`, avatarX + avatarSize + 20, 105, width - avatarX - avatarSize - 40)
  ctx.fillStyle = 'rgba(255,255,255,.12)'
  ctx.fillRect(sideMargin, 143, width - sideMargin * 2, 1)

  ctx.fillStyle = 'rgba(0,0,0,.32)'
  ctx.beginPath()
  canvasRoundedRect(ctx, coverX + 7, coverY + 10, coverWidth, coverHeight, 16)
  ctx.fill()
  if (cover) {
    ctx.save()
    ctx.translate(coverX + coverWidth / 2, coverY + coverHeight / 2)
    ctx.rotate(-.035)
    ctx.beginPath()
    canvasRoundedRect(ctx, -coverWidth / 2, -coverHeight / 2, coverWidth, coverHeight, 15)
    ctx.clip()
    const scale = Math.max(coverWidth / cover.width, coverHeight / cover.height)
    const drawWidth = cover.width * scale
    const drawHeight = cover.height * scale
    ctx.drawImage(cover, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.beginPath()
    canvasRoundedRect(ctx, coverX, coverY, coverWidth, coverHeight, 15)
    ctx.fill()
  }

  const titleText = workName || 'Obra'
  let titleSize = 40
  const titleWeight = titleStyle.fontWeight || 700
  let titleLines
  do {
    ctx.font = `${titleWeight} ${titleSize}px ${titleFamily}`
    titleLines = wrapCanvasText(ctx, titleText, copyWidth)
    if (titleLines.length > 2 && titleSize > 30) titleSize -= 2
    else break
  } while (titleSize > 28)
  const titleWasClipped = titleLines.length > 2
  titleLines = titleLines.slice(0, 2)
  if (titleWasClipped && titleLines.length) {
    let last = titleLines[titleLines.length - 1]
    while (last && ctx.measureText(`${last}…`).width > copyWidth) last = last.slice(0, -1)
    titleLines[titleLines.length - 1] = `${last}…`
  }
  ctx.fillStyle = titleStyle.color || '#f5f5f5'
  ctx.font = `${titleWeight} ${titleSize}px ${titleFamily}`
  const titleLineHeight = Math.round(titleSize * 1.18)
  titleLines.forEach((line, index) => ctx.fillText(line, copyX, coverY + 48 + index * titleLineHeight))
  let metaY = coverY + 48 + titleLines.length * titleLineHeight
  if (workYear) {
    ctx.fillStyle = getComputedStyle(document.querySelector('.review-post-year') || document.body).color || '#b4b4bc'
    ctx.font = `500 22px ${reviewFamily}`
    ctx.fillText(String(workYear), copyX, metaY)
    metaY += 44
  }
  if (rating != null) {
    const numericRating = Math.max(0, Math.min(5, Number(rating)))
    for (let index = 0; index < 5; index += 1) drawShareStar(ctx, copyX + 15 + index * 39, metaY - 8, 14, Math.max(0, Math.min(1, numericRating - index)), canvasAccent)
    ctx.fillStyle = '#ededed'
    ctx.font = `700 20px ${reviewFamily}`
    ctx.fillText(numericRating.toFixed(1), copyX + 190, metaY)
    metaY += 55
  } else metaY += 8
  ctx.fillStyle = 'rgba(255,255,255,.13)'
  ctx.fillRect(copyX, metaY, copyWidth, 1)
  metaY += 36
  ctx.fillStyle = headingStyle.color || '#f4f4f5'
  ctx.font = `${headingStyle.fontWeight || 700} 22px ${headingFamily}`
  ctx.fillText(`Review de ${authorName || 'Usuario'}`, copyX, metaY)
  metaY += 38
  ctx.fillStyle = reviewStyle.color || '#d3d3d8'
  ctx.font = `${reviewStyle.fontWeight || 400} 25px ${reviewFamily}`
  visibleLines.forEach((line, index) => {
    let displayLine = line
    if (reviewIsTruncated && index === visibleLines.length - 1) {
      while (displayLine && ctx.measureText(`${displayLine}…`).width > copyWidth) displayLine = displayLine.slice(0, -1)
      displayLine = `${displayLine}…`
    }
    ctx.fillText(displayLine, copyX, metaY + index * 38)
  })

  const footerY = height - 68
  ctx.fillStyle = 'rgba(255,255,255,.12)'
  ctx.fillRect(sideMargin, footerY - 35, width - sideMargin * 2, 1)
  const logo = await loadShareImage('/icons/logo.png')
  const brand = 'GeekSphere'
  ctx.font = `750 25px ${brandFamily}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  const brandX = width - sideMargin
  const brandWidth = ctx.measureText(brand).width
  ctx.fillText(brand, brandX, footerY)
  if (logo) ctx.drawImage(logo, brandX - brandWidth - 48, footerY - 21, 42, 42)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo crear el PNG')), 'image/png'))
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
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
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
    if (!shareOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setShareOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [shareOpen])

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
  const shareCover = getReviewShareCover(workCover)
  const workYear = getReleaseYear(review.work, review.work_type)
  const workPath = `/${review.work_type === 'game' ? 'game' : 'anime'}/${review.work_id}`
  const authorName = author?.display_name || author?.username || 'Usuario'
  const authorPath = author?.username ? `/profile/${author.username}` : '/profile'
  const pageAccent = getVisibleAccentColor(author?.theme_color || '#14b8a6')
  const wishlist = currentProfile?.wishlist || []
  const wishlistIndex = wishlist.findIndex(item => String(item.id) === String(review.work_id) && item.type === review.work_type)
  const isInWishlist = wishlistIndex >= 0
  const shareUrl = window.location.href
  const encodedShareUrl = encodeURIComponent(shareUrl)
  const shareTitle = `Review de ${authorName}: ${workName || 'una obra'}`
  const encodedShareTitle = encodeURIComponent(shareTitle)

  const copyReviewLink = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl)
      else {
        const input = document.createElement('textarea')
        input.value = shareUrl
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch (err) {
      console.error('No se pudo copiar el enlace de la review', err)
    }
  }

  const downloadReviewImage = async () => {
    if (shareBusy) return
    setShareBusy(true)
    try {
      const image = await createReviewShareImage({
        authorName,
        username: author?.username,
        avatarUrl: author?.avatar_url,
        accent: pageAccent,
        workName,
        workYear,
        workType: review.work_type,
        coverUrl: shareCover,
        rating: review.rating,
        reviewText,
      })
      const imageUrl = URL.createObjectURL(image)
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `review-${String(workName || 'obra').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1500)
    } catch (err) {
      console.error('No se pudo generar la imagen de la review', err)
      window.alert('No se pudo generar la imagen de la review. Inténtalo de nuevo.')
    } finally {
      setShareBusy(false)
    }
  }

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
          <button type="button" className="review-post-action review-share-trigger" onClick={() => setShareOpen(true)} aria-label="Compartir review">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>Compartir
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
      {shareOpen && createPortal((
        <div className="review-share-overlay" onClick={() => setShareOpen(false)}>
          <section className="review-share-dialog" style={{ '--review-page-accent': pageAccent }} role="dialog" aria-modal="true" aria-labelledby="review-share-title" onClick={event => event.stopPropagation()}>
            <header className="review-share-heading">
              <div><span className="review-share-eyebrow">COMPARTIR REVIEW</span><h2 id="review-share-title">Una opinión que merece compartirse</h2></div>
              <button className="review-share-close" type="button" onClick={() => setShareOpen(false)} aria-label="Cerrar menú de compartir"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
            </header>
            <div className="review-share-preview">
              <div className="review-share-preview-cover">{shareCover && <img src={shareCover} alt="" />}</div>
              <div className="review-share-preview-copy">
                <div className="review-share-preview-author"><ProfileAvatar profile={author} size="small" /><span>{authorName}<small>@{author?.username || 'usuario'}</small></span></div>
                <strong>{workName || 'Review'}</strong>
                <span>{review.work_type === 'game' ? 'Videojuego' : 'Anime'}{workYear ? ` · ${workYear}` : ''}</span>
                <ReviewStars rating={review.rating} />
              </div>
            </div>
            <button className="review-share-link" type="button" onClick={copyReviewLink} aria-label="Copiar enlace de la review">
              <span>{shareCopied ? 'ENLACE COPIADO' : 'ENLACE DE LA REVIEW'}</span><strong>{shareUrl}</strong>
              <i>{shareCopied ? '✓' : '↗'}</i>
            </button>
            <div className="review-share-section-label">Compartir directamente</div>
            <div className="review-share-networks">
              <a className="whatsapp" href={`https://wa.me/?text=${encodedShareTitle}%20${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaWhatsapp /></b><span>WhatsApp</span></a>
              <a className="x-twitter" href={`https://twitter.com/intent/tweet?text=${encodedShareTitle}&url=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaXTwitter /></b><span>X</span></a>
              <a className="telegram" href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaTelegram /></b><span>Telegram</span></a>
              <a className="reddit" href={`https://www.reddit.com/submit?url=${encodedShareUrl}&title=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaRedditAlien /></b><span>Reddit</span></a>
              <a className="facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaFacebookF /></b><span>Facebook</span></a>
            </div>
            <div className="review-share-divider" />
            <button className="review-share-download" type="button" onClick={downloadReviewImage} disabled={shareBusy}>
              <span className="review-share-download-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></span>
              <span><strong>{shareBusy ? 'Preparando imagen…' : 'Descargar imagen'}</strong><small>Una tarjeta con la portada, nota y tu reseña</small></span>
              <svg className="review-share-download-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </section>
        </div>
      ), document.body)}
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
