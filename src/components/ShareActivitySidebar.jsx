import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MoreContentCards from './MoreContentCards'
import { getMorePostsByUser } from '../lib/postService'
import { getRecentUserReviews } from '../lib/shareActivityService'
import './ShareActivitySidebar.css'

const DESKTOP_QUERY = '(min-width: 1200px)'

function StarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
}

function ReviewCover({ review }) {
  const [imageFailed, setImageFailed] = useState(false)
  const title = review.work?.title || 'Obra no disponible'
  const rating = review.rating == null ? null : Number(review.rating)
  const label = `${title}${rating != null ? `, tu valoración: ${rating} de 5 estrellas` : ', sin nota'}`
  return <Link to={`/reviews/${review.id}`} className="share-activity-review" aria-label={label} title={label}>
    {review.work?.image && !imageFailed
      ? <img src={review.work.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      : <span className="share-activity-cover-fallback">{title}</span>}
    {rating != null && <span className="share-activity-rating"><StarIcon />{rating.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>}
  </Link>
}

function ActivitySection({ title, kind, result, onRetry, accent }) {
  return <section className="share-activity-section" aria-label={title} aria-busy={!result}>
    <h2>{title}</h2>
    {!result ? <div className={`share-activity-loading${kind === 'review' ? ' is-review' : ''}`} role="status"><span className="share-sr-only">Cargando {title.toLowerCase()}</span>{[0, 1, 2].map(index => <span className="share-activity-skeleton" key={index} aria-hidden="true" />)}</div>
      : result.status === 'rejected' ? <div className="share-activity-state"><p>No se pudo cargar esta sección.</p><button type="button" onClick={onRetry}>Reintentar</button></div>
        : !result.value.length ? <p className="share-activity-empty">{kind === 'review' ? 'Tus próximas reseñas aparecerán aquí.' : 'Lo que compartas aparecerá aquí.'}</p>
          : kind === 'review' ? <div className="share-activity-review-grid">{result.value.map(review => <ReviewCover review={review} key={review.id} />)}</div>
            : <MoreContentCards items={result.value.map(post => ({ type: 'post', data: post, key: `post:${post.id}` }))} accent={accent} className="share-activity-post-grid" />}
  </section>
}

export default function ShareActivitySidebar({ userId, accent, refreshKey = 0 }) {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  const [activity, setActivity] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const requestKey = `${userId}:${refreshKey}:${retryKey}`

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const onChange = event => setIsDesktop(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isDesktop || !userId) return undefined
    let active = true
    Promise.allSettled([getMorePostsByUser(userId, null, 3), getRecentUserReviews(userId)]).then(([shared, reviews]) => {
      if (active) setActivity({ key: requestKey, shared, reviews })
    })
    return () => { active = false }
  }, [isDesktop, userId, requestKey])

  if (!isDesktop || !userId) return null
  const current = activity?.key === requestKey ? activity : null
  const retry = () => setRetryKey(key => key + 1)
  return <aside className="share-activity" aria-label="Tu actividad reciente">
    <ActivitySection title="Lo último que compartiste" kind="post" result={current?.shared} onRetry={retry} accent={accent} />
    <ActivitySection title="Tus últimas reseñas" kind="review" result={current?.reviews} onRetry={retry} />
  </aside>
}
