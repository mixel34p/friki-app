import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getDiscoverWorks } from '../lib/discoverWorksService'
import { communityRating, compareDiscoverWorks, releaseYear } from '../lib/discoverWorksCatalog'
import { isStandalonePwa, navigateWorkBack, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import CatalogPicker from '../components/CatalogPicker'
import SEO from '../components/SEO'
import './DiscoverWorks.css'
import './DiscoverCatalog.css'

const PAGE_SIZE = 24
const TYPES = ['anime', 'games']
const SORT_OPTIONS = [{ value: 'popular', label: 'Más registrado' }, { value: 'rated', label: 'Mejor valorado' }]

const catalogCache = new Map()

function catalogCover(work, mediaType) {
  if (!work.image) return null
  return mediaType === 'games'
    ? work.image.replace(/\/t_[^/]+\//, '/t_cover_big/')
    : work.image.replace('/cover/medium/', '/cover/large/')
}

function SkeletonGrid() {
  return <div className="discover-work-grid" aria-label="Cargando obras">{Array.from({ length: 12 }, (_, index) => <div className="discover-work-skeleton" key={index}><span/><i/><b/></div>)}</div>
}

function WorkRating({ rating }) {
  if (rating == null) return <span className="discover-work-unrated" aria-label="Sin valoraciones"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span>–</span></span>
  return <span className="discover-work-rating" aria-label={`${rating.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de 5 estrellas`}>
    <svg className="discover-work-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--brand-primary)" stroke="var(--brand-primary)" strokeWidth="1.5" strokeLinejoin="round"/></svg>
    <strong>{rating.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
  </span>
}

function WorkCard({ work, mediaType }) {
  const cover = catalogCover(work, mediaType)
  const [fallback, setFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const rating = communityRating(work)
  return <Link className="discover-work-card" to={`/${mediaType === 'games' ? 'game' : 'anime'}/${work.id}`}>
    <span className="discover-work-art">
      {cover && !failed ? <img src={fallback ? work.image : cover} alt={`Portada de ${work.title}`} loading="lazy" decoding="async" onError={() => { if (!fallback && cover !== work.image) setFallback(true); else setFailed(true) }} /> : <span className="discover-cover-fallback" aria-hidden="true">{work.title.slice(0, 1)}</span>}
      <span className="discover-cover-score"><WorkRating rating={rating} /></span>
    </span>
    <span className="discover-work-copy"><strong>{work.title}</strong><span className="discover-work-details"><small>{releaseYear(work) || 'Sin fecha'}</small>{work.ratingCount > 0 && <><span className="discover-work-separator" aria-hidden="true">·</span><small>{work.ratingCount.toLocaleString('es-ES')} {work.ratingCount === 1 ? 'valoración' : 'valoraciones'}</small></>}</span></span>
  </Link>
}

export default function DiscoverWorks() {
  const { category } = useParams()
  const mediaType = category === 'games' ? 'game' : 'anime'
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const surfaceRef = useRef(null)
  const [isPwa, setIsPwa] = useState(isStandalonePwa)
  const [managedMotion] = useState(() => Boolean(document.documentElement.dataset.pwaWorkDirection))
  const [catalog, setCatalog] = useState(() => ({ type: mediaType, loading: !catalogCache.has(mediaType), error: '', works: catalogCache.get(mediaType) || [] }))
  const [version, setVersion] = useState(0)
  const works = useMemo(() => catalog.type === mediaType ? catalog.works : catalogCache.get(mediaType) || [], [catalog, mediaType])
  const loading = catalog.type !== mediaType ? !catalogCache.has(mediaType) : catalog.loading
  const error = catalog.type === mediaType ? catalog.error : ''
  const selectedGenre = params.get('genre') || params.get('genres')?.split(',')[0] || 'all'
  const order = params.get('order') === 'rated' ? 'rated' : 'popular'
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)

  useLayoutEffect(() => { signalPwaRouteReady(location.pathname) }, [location.pathname])
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
    const update = () => setIsPwa(isStandalonePwa())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let active = true
    getDiscoverWorks(mediaType).then(result => {
      if (!active) return
      catalogCache.set(mediaType, result)
      setCatalog({ type: mediaType, loading: false, error: '', works: result })
    }).catch(() => {
      if (active) setCatalog({ type: mediaType, loading: false, error: 'No se pudo cargar el catálogo. Inténtalo de nuevo.', works: [] })
    })
    return () => { active = false }
  }, [mediaType, version])

  const genres = useMemo(() => [...new Set(works.flatMap(work => work.genres))].sort((a, b) => a.localeCompare(b, 'es')), [works])
  const filtered = useMemo(() => works.filter(work => selectedGenre === 'all' || work.genres.includes(selectedGenre)).sort((a, b) => compareDiscoverWorks(a, b, order)), [works, selectedGenre, order])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const scrollToResults = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = reduceMotion ? 'instant' : 'smooth'
    if (isPwa) surfaceRef.current?.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }
  const updateParams = updates => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    next.delete('page')
    setParams(next, { replace: true })
    scrollToResults()
  }
  const selectGenre = genre => updateParams({ genre: genre === 'all' ? '' : genre, genres: '' })
  const switchType = type => {
    if (type === category) return
    navigate('/discover/' + type + (order === 'popular' ? '' : '?order=rated'), { replace: true })
    scrollToResults()
  }
  const setPage = nextPage => {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next, { replace: true })
    scrollToResults()
  }
  const retry = () => {
    setCatalog({ type: mediaType, loading: true, error: '', works: [] })
    setVersion(value => value + 1)
  }
  const title = category === 'games' ? 'Juegos' : 'Anime'

  return <section ref={surfaceRef} className={'discover-works-page discover-catalog-page' + (isPwa ? ' discover-detail-pwa' + (managedMotion ? '' : ' discover-screen-enter') : '')} aria-label="Explorar obras">
    <SEO title={'Explorar ' + title} description={'Descubre ' + title.toLocaleLowerCase() + ' de la comunidad.'} />
    <div className="discover-catalog-inner">
      <header className="discover-works-header">
        <div className="discover-title-group"><button type="button" className="discover-back-button" onClick={() => navigateWorkBack(navigate, '/search')} aria-label="Volver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><h1>Explorar obras</h1></div>
        <div className={'discover-type-switch' + (category === 'games' ? ' games-selected' : '')} role="group" aria-label="Tipo de obra">{TYPES.map(type => <button key={type} type="button" className={category === type ? 'active' : ''} aria-pressed={category === type} onClick={() => switchType(type)}>{type === 'anime' ? 'Anime' : 'Juegos'}</button>)}</div>
      </header>
      <section className="discover-works-controls" aria-label="Filtros y orden del catálogo">
        <div className="discover-genre-control"><CatalogPicker pill value={selectedGenre} onChange={selectGenre} label="Género" options={[{ value: 'all', label: 'Todos los géneros' }, ...(selectedGenre !== 'all' && !genres.includes(selectedGenre) ? [{ value: selectedGenre, label: selectedGenre }] : []), ...genres.map(genre => ({ value: genre, label: genre }))]} />{selectedGenre !== 'all' && <button type="button" className="discover-clear-genre" onClick={() => selectGenre('all')} aria-label="Quitar filtro de género"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7" /></svg></button>}</div>
        <CatalogPicker options={SORT_OPTIONS} label="Ordenar resultados" value={order} onChange={value => updateParams({ order: value === 'popular' ? '' : value })} />
      </section>
      <section className="discover-catalog-results" aria-busy={loading}>
        <div className="discover-grid-toolbar"><h2>{title}</h2><p role="status">{loading ? 'Cargando obras…' : error ? 'Catálogo no disponible' : filtered.length.toLocaleString('es-ES') + (filtered.length === 1 ? ' obra' : ' obras') + (selectedGenre === 'all' ? '' : ' · ' + selectedGenre)}</p></div>
        {loading ? <SkeletonGrid /> : error ? <div className="discover-empty" role="alert"><span>!</span><h2>No pudimos cargar las obras</h2><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div> : visible.length ? <div className="discover-work-grid">{visible.map(work => <WorkCard key={mediaType + ':' + work.id} work={work} mediaType={category} />)}</div> : <div className="discover-empty"><span aria-hidden="true">⌕</span><h2>No hay obras para estos filtros</h2><p>Prueba con otro género para descubrir más obras.</p>{selectedGenre !== 'all' && <button type="button" onClick={() => selectGenre('all')}>Quitar filtro</button>}</div>}
        {!loading && !error && totalPages > 1 && <nav className="discover-pagination" aria-label="Paginación"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button><span>Página {currentPage} de {totalPages}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente</button></nav>}
      </section>
    </div>
  </section>
}
