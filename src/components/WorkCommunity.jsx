import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigationType } from 'react-router-dom'
import { getWorkRatings, getWorkReviews } from '../lib/libraryService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { BADGES_MAP } from '../lib/badges'
import DefaultAvatar from './DefaultAvatar'
import ReviewLikeButton from './ReviewLikeButton'
import SpoilerNotice from './reviews/SpoilerNotice'
import { WorkStars } from './WorkRatings'
import './WorkCommunity.css'

const PAGE_SIZE = 10
const feedHistory = new Map()
const TABS = [{ id: 'reviews', label: 'Reviews' }, { id: 'ratings', label: 'Valoraciones' }]
const score = value => Number(value).toLocaleString('es-ES', { maximumFractionDigits: 1 })

function AuthorAvatar({ author, className }) {
  const [failed, setFailed] = useState(false)
  const style = { borderColor: author?.theme_color || 'var(--work-accent)' }
  return author?.avatar_url && !failed ? <img className={className} style={style} src={author.avatar_url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <DefaultAvatar className={className} style={style} accent={author?.theme_color} />
}

function WorkReview({ review }) {
  const [revealed, setRevealed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const author = review.profiles
  const badge = BADGES_MAP[author?.featured_badge]
  const text = (review.review_text || '').trim()
  const excerpt = !expanded && text.length > 340 ? `${text.slice(0, 340)}…` : text
  return <article className="work-review">
    <header className="work-review-header">
      {author?.username ? <Link className="work-review-author" to={`/profile/${author.username}`}>
        <AuthorAvatar author={author} className="work-review-avatar" />
        <span>{author.display_name || author.username}</span>
        {badge && <span className="work-review-badge" style={{ color: badge.color }} title={badge.title}>{badge.icon}</span>}
      </Link> : <span className="work-review-author">Usuario</span>}
      <time dateTime={review.created_at}>{formatRelativeDate(review.created_at)}</time>
    </header>
    {review.rating != null && <div className="work-review-score"><WorkStars rating={Number(review.rating)} /><span>{score(review.rating)}</span></div>}
    {review.contains_spoiler && !revealed ? <SpoilerNotice text={excerpt} onReveal={() => setRevealed(true)} /> : <>
      <p className="work-review-text">{excerpt}</p>
      {text.length > 340 && <button type="button" className="work-text-button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Leer menos' : 'Leer más'}</button>}
    </>}
    <footer><ReviewLikeButton entryId={review.id} /><Link to={`/reviews/${review.id}`}>Comentarios <span aria-hidden="true">→</span></Link></footer>
  </article>
}

function RatingCard({ entry }) {
  const author = entry.profiles
  const label = author?.display_name || author?.username || 'Usuario'
  const content = <><AuthorAvatar author={author} className="wr-user-avatar" /><span className="work-rating-user-name">{label}</span></>
  return <article className="wr-rating-card">
    {author?.username ? <Link to={`/profile/${author.username}`} className="wr-rating-avatar-link" title={label}>{content}</Link> : <span className="wr-rating-avatar-link">{content}</span>}
    <div className="wr-rating-card-score"><WorkStars rating={Number(entry.rating)} /><span>{score(entry.rating)}</span></div>
  </article>
}

function StarFilter({ label, selected, onSelect }) {
  const [hovered, setHovered] = useState(null)
  const preview = hovered ?? selected ?? 0
  return <div className="wr-star-filter" role="dialog" aria-label={`Filtrar ${label.toLowerCase()} por estrellas`}>
    <div className="wr-star-filter-heading"><div><div className="wr-star-filter-title">Filtrar por estrellas</div><div className="wr-star-filter-current">{preview ? `${score(preview)} de 5` : 'Todas las puntuaciones'}</div></div><button type="button" className="wr-star-filter-clear" onClick={() => onSelect(null)}>Todas</button></div>
    <div className="wr-star-picker" onMouseLeave={() => setHovered(null)}>
      <WorkStars rating={preview} />
      <div className="work-star-filter-hitboxes">{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map(rating => <button key={rating} type="button" aria-label={`${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`} aria-pressed={selected === rating} onMouseEnter={() => setHovered(rating)} onFocus={() => setHovered(rating)} onBlur={() => setHovered(null)} onClick={() => onSelect(rating)} />)}</div>
    </div>
    <div className="wr-star-filter-hint">Pulsa la mitad izquierda o derecha de una estrella</div>
  </div>
}

export default function WorkCommunity({ workId, mediaType, stats, viewerKey }) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const historyKey = `${viewerKey}:${mediaType}:${workId}:${location.key}`
  const [initial] = useState(() => navigationType === 'POP' ? feedHistory.get(historyKey) : null)
  const [kind, setKind] = useState(initial?.kind || 'reviews')
  const [rating, setRating] = useState(initial?.rating ?? null)
  const [page, setPage] = useState(initial?.page || 1)
  const [retry, setRetry] = useState(0)
  const [feed, setFeed] = useState(initial?.feed || null)
  const [knownCounts, setKnownCounts] = useState({ reviews: null, ratings: null })
  const [filterOpen, setFilterOpen] = useState(false)
  const tabsRef = useRef(null)
  const tabRefs = useRef({})
  const id = useId()
  const filterKey = `${kind}:${rating ?? 'all'}`
  const queryId = `${filterKey}:${page}:${retry}`
  const current = feed?.filterKey === filterKey ? feed : null
  const loading = current?.queryId !== queryId
  const items = current?.items || []
  const hasMore = current?.status === 'ready' && current.page * PAGE_SIZE < current.count
  const counts = { reviews: stats?.reviewsCount ?? knownCounts.reviews, ratings: stats?.ratingsCount ?? knownCounts.ratings }

  useEffect(() => {
    if (loading || current?.status !== 'ready') return
    feedHistory.delete(historyKey)
    feedHistory.set(historyKey, { kind, rating, page, feed: current })
    if (feedHistory.size > 20) feedHistory.delete(feedHistory.keys().next().value)
  }, [historyKey, kind, rating, page, current, loading])

  useEffect(() => {
    let active = true
    const request = kind === 'reviews' ? getWorkReviews : getWorkRatings
    request(workId, mediaType, page, PAGE_SIZE, rating, { throwOnError: true }).then(result => {
      if (!active) return
      if (rating == null) setKnownCounts(previous => ({ ...previous, [kind]: result.count }))
      setFeed(previous => {
        const prior = page > 1 && previous?.filterKey === filterKey ? previous.items : []
        const entries = kind === 'reviews' ? result.data.filter(entry => entry.review_text?.trim()) : result.data
        const merged = [...new Map([...prior, ...entries].map(entry => [entry.id, entry])).values()]
        return { filterKey, queryId, status: 'ready', items: merged, page, count: result.count }
      })
    }).catch(() => {
      if (active) setFeed(previous => ({ filterKey, queryId, status: 'error', items: page > 1 && previous?.filterKey === filterKey ? previous.items : [], page, count: previous?.filterKey === filterKey ? previous.count : 0 }))
    })
    return () => { active = false }
  }, [workId, mediaType, kind, rating, page, retry, filterKey, queryId])


  useEffect(() => {
    if (!filterOpen) return undefined
    const outside = event => { if (!tabsRef.current?.contains(event.target)) setFilterOpen(false) }
    const escape = event => { if (event.key === 'Escape') { setFilterOpen(false); tabRefs.current[kind]?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [filterOpen, kind])

  const selectTab = next => {
    if (next === kind) { setFilterOpen(value => !value); return }
    setKind(next)
    setPage(1)
    setFilterOpen(false)
  }
  const selectRating = next => {
    setRating(next)
    setPage(1)
    setFilterOpen(false)
    tabRefs.current[kind]?.focus()
  }
  const tabKeys = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'reviews' : event.key === 'End' ? 'ratings' : kind === 'reviews' ? 'ratings' : 'reviews'
    if (next !== kind) selectTab(next)
    tabRefs.current[next]?.focus()
  }
  const empty = rating != null ? `No hay ${kind === 'reviews' ? 'reseñas' : 'valoraciones'} con ${score(rating)} estrellas.` : kind === 'reviews' ? 'Esta obra todavía no tiene reseñas. La tuya puede ser la primera.' : 'Esta obra todavía no tiene valoraciones.'

  return <section className="work-reviews-section work-community-feed" id="reviews" aria-label="Reviews y valoraciones">
    <div className="wr-tabs" role="tablist" aria-label="Contenido de la obra" ref={tabsRef}>
      {TABS.map(tab => <div className="wr-tab-item" key={tab.id}>
        <button type="button" role="tab" id={`${id}-${tab.id}`} aria-controls={`${id}-panel`} aria-selected={kind === tab.id} aria-expanded={kind === tab.id && filterOpen} aria-haspopup="dialog" tabIndex={kind === tab.id ? 0 : -1} className={`wr-tab${kind === tab.id ? ' active' : ''}`} ref={node => { tabRefs.current[tab.id] = node }} onClick={() => selectTab(tab.id)} onKeyDown={tabKeys}>{tab.label}<span>{counts[tab.id] == null ? '—' : counts[tab.id].toLocaleString('es-ES')}</span></button>
        {kind === tab.id && filterOpen && <StarFilter label={tab.label} selected={rating} onSelect={selectRating} />}
      </div>)}
    </div>
    {rating != null && <div className="work-review-filter-note"><span>{score(rating)} estrellas</span><button type="button" onClick={() => selectRating(null)}>Quitar filtro</button></div>}
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${kind}`} aria-busy={loading}>
      {items.length > 0 && (kind === 'reviews' ? <div className="work-reviews-stack">{items.map(review => <WorkReview key={review.id} review={review} />)}</div> : <div className="wr-ratings-grid">{items.map(entry => <RatingCard key={entry.id} entry={entry} />)}</div>)}
      {loading && !items.length && <div className="work-reviews-loading" role="status" aria-label={`Cargando ${kind === 'reviews' ? 'reseñas' : 'valoraciones'}`}>{[0, 1].map(index => <div key={index} className="work-skeleton" />)}</div>}
      {!loading && current?.status === 'error' && <div className="work-inline-state" role="alert"><p>{items.length ? 'No se pudieron cargar más entradas.' : `No se pudieron cargar las ${kind === 'reviews' ? 'reseñas' : 'valoraciones'}.`}</p><button type="button" className="work-text-button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
      {!loading && current?.status === 'ready' && !items.length && <p className="work-empty">{empty}</p>}
      {(hasMore || loading && items.length > 0) && <div className="work-feed-pagination"><button type="button" className="work-load-more" disabled={loading} aria-busy={loading} onClick={() => { if (!loading && hasMore) setPage(value => value + 1) }}>{loading ? 'Cargando…' : 'Ver más'}</button><span>{items.length} de {current.count.toLocaleString('es-ES')} {kind === 'reviews' ? 'reviews' : 'valoraciones'}</span></div>}
    </div>
  </section>
}
