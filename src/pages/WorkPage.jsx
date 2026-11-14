import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { getWorkById, getSimilarWorks, getWorkStats } from '../lib/workPageService'
import { getWorkLog, getWorkReviews, logWork } from '../lib/libraryService'
import { getSpacesByWork } from '../lib/spaceService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { isStandalonePwa, navigatePwaRoute, navigateWorkBack, restorePwaScroll, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import useSystemBarColor from '../hooks/useSystemBarColor'
import DefaultAvatar from '../components/DefaultAvatar'
import { useToast } from '../components/Toast'
import WorkRatings, { WorkStars } from '../components/WorkRatings'
import ReviewLikeButton from '../components/ReviewLikeButton'
import SpoilerNotice from '../components/reviews/SpoilerNotice'
import SEO from '../components/SEO'
import { BADGES_MAP } from '../lib/badges'
import './WorkPage.css'

function coverImage(url) {
  if (!url) return ''
  return (url.startsWith('//') ? `https:${url}` : url).replace(/\/t_[a-z0-9_]+\//, '/t_cover_big/')
}

function releaseYear(work) {
  let value = work.release_date || work.first_release_date || work.start_date
  if (!value) return null
  if (typeof value === 'object') return value.year || null
  if (/^\d{10}$/.test(String(value))) value = Number(value) * 1000
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getFullYear()
}

function names(values = []) {
  return (Array.isArray(values) ? values : []).map(value => typeof value === 'string' ? value : value?.name).filter(Boolean)
}

function WorkIcon({ name }) {
  const paths = {
    back: 'm15 18-6-6 6-6', plus: 'M12 5v14M5 12h14',
    bookmark: 'm19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
    edit: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5',
    arrow: 'M5 12h14m-5-5 5 5-5 5', check: 'm5 12 4 4L19 6',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.plus} /></svg>
}

function WorkImage({ src, title, className = '' }) {
  const [failed, setFailed] = useState(false)
  return <span className={`work-cover ${className}`}>
    {src && !failed ? <img src={src} alt={title} loading={className === 'work-main-cover' ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <span className="work-cover-fallback">{title}</span>}
  </span>
}

function WorkReview({ review }) {
  const [revealed, setRevealed] = useState(false)
  const author = review.profiles
  const badge = BADGES_MAP[author?.featured_badge]
  const text = (review.review_text || '').trim()
  const excerpt = text.length > 340 ? `${text.slice(0, 340)}…` : text
  return <article className="work-review">
    <header className="work-review-header">
      {author?.username ? <Link className="work-review-author" to={`/profile/${author.username}`}>
        {author.avatar_url ? <img className="work-review-avatar" src={author.avatar_url} alt="" loading="lazy" /> : <DefaultAvatar className="work-review-avatar" accent={author.theme_color} />}
        <span>{author.display_name || author.username}</span>
        {badge && <span className="work-review-badge" style={{ color: badge.color }} title={badge.title}>{badge.icon}</span>}
      </Link> : <span className="work-review-author">Usuario</span>}
      <time dateTime={review.created_at}>{formatRelativeDate(review.created_at)}</time>
    </header>
    {review.rating != null && <div className="work-review-score"><WorkStars rating={Number(review.rating)} /><span>{Number(review.rating).toLocaleString('es-ES')}</span></div>}
    {review.contains_spoiler && !revealed ? <SpoilerNotice text={excerpt} onReveal={() => setRevealed(true)} /> : <p className="work-review-text">{excerpt}</p>}
    <footer><ReviewLikeButton entryId={review.id} /><Link to={`/reviews/${review.id}`}>Leer reseña <WorkIcon name="arrow" /></Link></footer>
  </article>
}

function WorkDetails({ mediaType, workId }) {
  const { user, profile, updateProfile } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const { toast } = useToast()
  const route = `/${mediaType}/${workId}`
  const [isPwa, setIsPwa] = useState(isStandalonePwa)
  const [managedMotion] = useState(() => Boolean(document.documentElement.dataset.pwaWorkDirection))
  const [workResult, setWorkResult] = useState(null)
  const [workVersion, setWorkVersion] = useState(0)
  const [logResult, setLogResult] = useState(null)
  const [logVersion, setLogVersion] = useState(0)
  const [statsResult, setStatsResult] = useState(null)
  const [statsVersion, setStatsVersion] = useState(0)
  const [reviewsResult, setReviewsResult] = useState(null)
  const [reviewsVersion, setReviewsVersion] = useState(0)
  const [similarWorks, setSimilarWorks] = useState(null)
  const [spaces, setSpaces] = useState(null)
  const [expandedSynopsis, setExpandedSynopsis] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [savingWishlist, setSavingWishlist] = useState(false)
  const savingRef = useRef(false)
  const ownerRef = useRef(userId)
  const mountedRef = useRef(true)
  const work = workResult?.version === workVersion ? workResult.data : null
  const workError = workResult?.version === workVersion ? workResult.error : null
  const currentLog = !userId ? { status: 'ready', data: null } : logResult?.userId === userId && logResult.version === logVersion ? logResult : { status: 'loading' }
  const log = currentLog.data
  const stats = statsResult?.version === statsVersion ? statsResult : null
  const reviews = reviewsResult?.version === reviewsVersion ? reviewsResult : null
  const systemBar = useSystemBarColor('#14b8a6')

  useLayoutEffect(() => { ownerRef.current = userId }, [userId])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useLayoutEffect(() => { signalPwaRouteReady(route) }, [route])
  useLayoutEffect(() => { restorePwaScroll() }, [work, stats, reviews, similarWorks, spaces])

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
    const update = () => setIsPwa(isStandalonePwa())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let active = true
    getWorkById(mediaType, Number(workId)).then(data => {
      if (active) setWorkResult({ version: workVersion, data, error: data ? null : 'No encontramos esta obra.' })
    }).catch(() => { if (active) setWorkResult({ version: workVersion, data: null, error: 'No se pudo cargar la obra.' }) })
    return () => { active = false }
  }, [mediaType, workId, workVersion])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    getWorkLog(userId, workId, mediaType, { throwOnError: true }).then(data => {
      if (active) setLogResult({ userId, version: logVersion, status: 'ready', data })
    }).catch(() => { if (active) setLogResult({ userId, version: logVersion, status: 'error' }) })
    return () => { active = false }
  }, [userId, workId, mediaType, logVersion])

  useEffect(() => {
    if (!work) return undefined
    let active = true
    getWorkStats(mediaType, workId).then(data => {
      if (active) setStatsResult({ version: statsVersion, status: 'ready', data })
    }).catch(() => { if (active) setStatsResult({ version: statsVersion, status: 'error' }) })
    return () => { active = false }
  }, [work, mediaType, workId, statsVersion])

  useEffect(() => {
    if (!work) return undefined
    let active = true
    getWorkReviews(workId, mediaType, 1, 3, null, { throwOnError: true }).then(result => {
      if (active) setReviewsResult({ version: reviewsVersion, status: 'ready', data: result.data.filter(entry => entry.review_text?.trim()), count: result.count })
    }).catch(() => { if (active) setReviewsResult({ version: reviewsVersion, status: 'error' }) })
    return () => { active = false }
  }, [work, workId, mediaType, reviewsVersion])

  useEffect(() => {
    if (!work) return undefined
    let active = true
    getSimilarWorks(mediaType, Number(workId), work.genres).then(data => { if (active) setSimilarWorks(data || []) }).catch(() => { if (active) setSimilarWorks([]) })
    getSpacesByWork(Number(workId)).then(data => { if (active) setSpaces(data || []) }).catch(() => { if (active) setSpaces([]) })
    return () => { active = false }
  }, [work, workId, mediaType])

  const ensureProfile = () => {
    if (!user) { navigate('/register'); return false }
    if (!profile) { navigate('/onboarding'); return false }
    return true
  }

  const registerWork = async () => {
    if (!ensureProfile() || currentLog.status !== 'ready' || savingRef.current || log) return
    savingRef.current = true
    setRegistering(true)
    const owner = userId
    try {
      const saved = await logWork(owner, workId, mediaType, { rating: null, review_text: null, contains_spoiler: false, finished_date: format(new Date(), 'yyyy-MM-dd') })
      if (mountedRef.current && ownerRef.current === owner) {
        setLogResult({ userId: owner, version: logVersion, status: 'ready', data: saved })
        setStatsVersion(version => version + 1)
        toast({ title: 'Obra registrada', type: 'success' })
      }
    } catch {
      if (mountedRef.current && ownerRef.current === owner) toast({ title: 'No se pudo registrar la obra', message: 'Inténtalo de nuevo.', type: 'error' })
    } finally {
      savingRef.current = false
      if (mountedRef.current) setRegistering(false)
    }
  }

  const editLog = () => {
    if (!ensureProfile()) return
    navigatePwaRoute(navigate, '/share', { state: { reviewWork: { id: Number(workId), type: mediaType, title: work.name || work.title, image: coverImage(work.cover_url || work.image_url) } } })
  }

  const wishlist = profile?.wishlist || []
  const inWishlist = wishlist.some(item => String(item.id) === String(workId) && item.type === mediaType)
  const toggleWishlist = async () => {
    if (!ensureProfile() || savingWishlist) return
    const owner = userId
    const next = inWishlist ? wishlist.filter(item => !(String(item.id) === String(workId) && item.type === mediaType)) : [...wishlist, { id: String(workId), type: mediaType, title: work.name || work.title, image_url: work.cover_url || work.image_url, added_at: new Date().toISOString() }]
    setSavingWishlist(true)
    try { await updateProfile({ wishlist: next }) }
    catch { if (mountedRef.current && ownerRef.current === owner) toast({ title: 'No se pudo actualizar la wishlist', type: 'error' }) }
    finally { if (mountedRef.current) setSavingWishlist(false) }
  }

  const title = work?.name || work?.title || 'Obra'
  const cover = coverImage(work?.cover_url || work?.image_url)
  const banner = work?.banner_url || cover
  const year = work ? releaseYear(work) : null
  const creators = work ? mediaType === 'anime' ? names(work.studios) : names(work.developers?.length ? work.developers : work.involved_companies?.filter(company => company.developer).map(company => company.company)) : []
  const synopsis = work?.summary || work?.synopsis || 'No hay sinopsis disponible para esta obra.'
  const genres = names(work?.genres)
  const platforms = names(work?.platforms)
  const longSynopsis = synopsis.length > 420 || synopsis.split('\n').length > 5

  return <div className={`work-page${isPwa ? ` work-detail-pwa${managedMotion ? '' : ' work-motion-enter'}` : ''}`} style={{ '--work-system-bar': systemBar }}>
    <SEO title={`${title} (${mediaType === 'game' ? 'Videojuego' : 'Anime'})`} description={`${title} en GeekSphere: valoraciones, reseñas y obras similares.`} />
    <div className={`work-backdrop${work?.banner_url ? ' has-banner' : ''}`} aria-hidden="true">{banner && <img src={banner} alt="" />}</div>
    <div className="work-page-inner">
      <div className="work-topbar"><button type="button" className="work-back" onClick={() => navigateWorkBack(navigate)} aria-label="Volver"><WorkIcon name="back" /><span>Volver</span></button><span className="work-topbar-title">{title === 'Obra' ? '' : title}</span></div>
      {!work ? workError ? <div className="work-page-state"><h1>{workError}</h1><p>Puedes volver a intentarlo o regresar a la página anterior.</p><button type="button" className="work-primary-button" onClick={() => setWorkVersion(version => version + 1)}>Reintentar</button></div> : <div className="work-page-loading" role="status" aria-label="Cargando obra"><div className="work-loading-hero"><span className="work-skeleton work-loading-cover" /><span className="work-loading-copy"><i className="work-skeleton" /><i className="work-skeleton" /><i className="work-skeleton" /></span></div><div className="work-loading-body work-skeleton" /></div> : <>
        <header className="work-hero">
          <WorkImage src={cover} title={title} className="work-main-cover" />
          <div className="work-identity"><p className="work-eyebrow">{mediaType === 'game' ? 'Videojuego' : 'Anime'}{year && <><span>·</span>{year}</>}</p><h1>{title}</h1>{creators.length > 0 && <p className="work-creators">{creators.slice(0, 3).join(' · ')}</p>}</div>
          <div className="work-actions">
            {currentLog.status === 'error' ? <div className="work-log-error"><span>No se pudo comprobar tu registro.</span><button type="button" onClick={() => setLogVersion(version => version + 1)}>Reintentar</button></div> : <button type="button" className={`work-primary-button${log ? ' is-logged' : ''}`} onClick={log ? editLog : registerWork} disabled={registering || currentLog.status === 'loading'} aria-busy={registering || currentLog.status === 'loading'}><WorkIcon name={log ? 'edit' : 'plus'} />{registering ? 'Registrando…' : currentLog.status === 'loading' ? 'Cargando…' : log ? 'Editar registro' : 'Registrar'}</button>}
            <button type="button" className={`work-wishlist-button${inWishlist ? ' is-active' : ''}`} onClick={toggleWishlist} aria-pressed={inWishlist} disabled={savingWishlist}><WorkIcon name="bookmark" />{inWishlist ? 'En wishlist' : 'Wishlist'}</button>
            {log && <div className="work-personal-log">{log.rating != null ? <><span>Tu valoración</span><WorkStars rating={Number(log.rating)} /><strong>{Number(log.rating).toLocaleString('es-ES')}</strong></> : <><WorkIcon name="check" /><span>En tu diario</span></>}</div>}
          </div>
          <WorkRatings state={stats} onRetry={() => setStatsVersion(version => version + 1)} />
        </header>
        <div className="work-community">{stats?.status === 'ready' && <><span className="work-member-avatars">{stats.data.recentMembers.map(member => <Link key={member.id} to={`/profile/${member.username}`} title={member.username}>{member.avatar_url ? <img src={member.avatar_url} alt={member.username} loading="lazy" /> : <DefaultAvatar accent={member.theme_color} />}</Link>)}</span><span><strong>{stats.data.membersCount.toLocaleString('es-ES')}</strong> {stats.data.membersCount === 1 ? 'persona ha registrado esta obra' : 'personas han registrado esta obra'}</span></>}</div>
        <div className="work-body">
          <section className="work-synopsis-section"><h2 className="work-section-heading">Sinopsis</h2><p id="work-synopsis" className={`work-synopsis${longSynopsis && !expandedSynopsis ? ' is-collapsed' : ''}`}>{synopsis}</p>{longSynopsis && <button className="work-text-button" type="button" aria-expanded={expandedSynopsis} aria-controls="work-synopsis" onClick={() => setExpandedSynopsis(value => !value)}>{expandedSynopsis ? 'Leer menos' : 'Leer más'}</button>}{mediaType === 'game' && <p className="work-data-source">Datos de <a href="https://www.igdb.com" target="_blank" rel="noreferrer">IGDB</a></p>}</section>
          <aside className="work-secondary">
            <section className="work-details-section"><h2 className="work-section-heading">Detalles</h2><dl className="work-details"><div><dt>Tipo</dt><dd>{mediaType === 'game' ? 'Videojuego' : 'Anime'}</dd></div>{year && <div><dt>Estreno</dt><dd>{year}</dd></div>}{creators.length > 0 && <div><dt>{mediaType === 'game' ? 'Desarrollo' : 'Estudio'}</dt><dd>{creators.join(', ')}</dd></div>}{genres.length > 0 && <div><dt>Géneros</dt><dd>{genres.join(' · ')}</dd></div>}{platforms.length > 0 && <div><dt>Plataformas</dt><dd>{platforms.join(' · ')}</dd></div>}{mediaType === 'anime' && work.status && <div><dt>Estado</dt><dd>{work.status}</dd></div>}{mediaType === 'anime' && work.episodes != null && <div><dt>Episodios</dt><dd>{work.episodes}</dd></div>}</dl></section>
            {(!similarWorks || similarWorks.length > 0) && <section className="work-similar-section"><h2 className="work-section-heading">Obras similares</h2><div className="work-similar-grid">{similarWorks ? similarWorks.slice(0, 6).map(similar => <Link key={`${similar.media_type || mediaType}:${similar.id}`} to={`/${similar.media_type || mediaType}/${similar.id}`} title={similar.name || similar.title}><WorkImage src={coverImage(similar.cover_url || similar.image_url)} title={similar.name || similar.title} /><span>{similar.name || similar.title}</span></Link>) : [0, 1, 2].map(index => <span key={index} className="work-skeleton work-similar-skeleton" />)}</div></section>}
            {spaces?.length > 0 && <section className="work-spaces-section"><h2 className="work-section-heading">Espacios relacionados</h2><div className="work-spaces">{spaces.map(space => <Link key={space.id} to={`/spaces/${space.id}`}><span className="work-space-image">{space.avatar_url || space.banner_url ? <img src={space.avatar_url || space.banner_url} alt="" loading="lazy" /> : space.name?.slice(0, 1)}</span><span><strong>{space.name}{space.is_verified && <span className="work-space-verified" aria-label="Verificado">✓</span>}</strong><small>{space.member_count ?? 0} {space.member_count === 1 ? 'miembro' : 'miembros'}</small></span><WorkIcon name="arrow" /></Link>)}</div></section>}
          </aside>
          <section className="work-reviews-section"><div className="work-section-header"><h2 className="work-section-heading">Reseñas recientes</h2><Link to={`${route}/reviews`}>Ver todas <WorkIcon name="arrow" /></Link></div>{!reviews ? <div className="work-reviews-loading" role="status" aria-label="Cargando reseñas">{[0, 1].map(index => <div key={index} className="work-skeleton" />)}</div> : reviews.status === 'error' ? <div className="work-inline-state"><p>No se pudieron cargar las reseñas.</p><button type="button" className="work-text-button" onClick={() => setReviewsVersion(version => version + 1)}>Reintentar</button></div> : reviews.data.length ? <div>{reviews.data.map(review => <WorkReview key={review.id} review={review} />)}</div> : <p className="work-empty">Esta obra todavía no tiene reseñas. La tuya puede ser la primera.</p>}</section>
        </div>
      </>}
    </div>
  </div>
}

export default function WorkPage({ mediaType }) {
  const { id } = useParams()
  return <WorkDetails key={`${mediaType}:${id}`} mediaType={mediaType} workId={id} />
}
