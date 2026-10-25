import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getDiscoverWorks } from '../lib/discoverWorksService'
import SEO from '../components/SEO'
import './DiscoverWorks.css'

const PAGE_SIZE = 24
const TYPES = ['anime', 'games']
const SORT_OPTIONS = [{ value: 'popular', label: 'Más registrado' }, { value: 'rated', label: 'Mejor valorado' }]

function releaseYear(work) {
  const date = work.start_date || work.release_date || work.first_release_date
  if (!date) return ''
  if (typeof date === 'number') {
    if (date >= 1000 && date <= 9999) return Math.trunc(date)
    const timestamp = date > 999999999999 ? date : date * 1000
    const year = new Date(timestamp).getFullYear()
    return Number.isNaN(year) ? '' : year
  }
  const value = String(date).trim()
  if (/^\d{4}$/.test(value)) return value
  if (/^\d{10,13}$/.test(value)) {
    const timestamp = Number(value.length === 13 ? value : Number(value) * 1000)
    const year = new Date(timestamp).getFullYear()
    return Number.isNaN(year) ? '' : year
  }
  return value.match(/^(\d{4})/)?.[1] || ''
}

function originalCover(work, mediaType) {
  if (!work.image) return null
  return mediaType === 'games'
    ? work.image.replace(/\/t_[^/]+\//, '/t_original/')
    : work.image.replace('/cover/large/', '/cover/original/').replace('/cover/medium/', '/cover/original/')
}

function SkeletonGrid() {
  return <div className="discover-work-grid" aria-label="Cargando obras">{Array.from({ length: 12 }, (_, index) => <div className="discover-work-skeleton" key={index}><span/><i/><b/></div>)}</div>
}

function WorkRating({ rating }) {
  if (rating === null) return <span className="discover-work-unrated" aria-label="Sin valoraciones"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span>–</span></span>
  return <span className="discover-work-rating" aria-label={`${rating.toFixed(1)} de 5 estrellas`}>
    <svg className="discover-work-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--brand-primary)" stroke="var(--brand-primary)" strokeWidth="1.5" strokeLinejoin="round"/></svg>
    <strong>{rating.toFixed(1)}</strong>
  </span>
}

function WorkCard({ work, mediaType }) {
  const cover = originalCover(work, mediaType)
  return <Link className="discover-work-card" to={`/${mediaType === 'games' ? 'game' : 'anime'}/${work.id}`}>
    <span className="discover-work-art">{cover ? <img src={cover} data-fallback={work.image} alt={`Portada de ${work.title}`} loading="lazy" decoding="async" onError={event => { const fallback = event.currentTarget.dataset.fallback; if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback; else event.currentTarget.hidden = true }}/> : <span aria-hidden="true">{mediaType === 'games' ? '▤' : '▣'}</span>}</span>
    <span className="discover-work-copy"><strong>{work.title}</strong><span className="discover-work-details"><WorkRating rating={work.userRating}/><span className="discover-work-separator" aria-hidden="true">·</span><small>{releaseYear(work) || 'Año desconocido'}</small></span></span>
  </Link>
}

function SortPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => SORT_OPTIONS.findIndex(option => option.value === value))
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = SORT_OPTIONS.findIndex(option => option.value === value)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    optionRefs.current[activeIndex]?.focus()
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, activeIndex])

  const choose = index => {
    onChange(SORT_OPTIONS[index].value)
    setActiveIndex(index)
    setOpen(false)
    triggerRef.current?.focus()
  }
  const onTriggerKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(selectedIndex)
      setOpen(true)
    }
  }
  const onOptionsKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + SORT_OPTIONS.length) % SORT_OPTIONS.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : SORT_OPTIONS.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    }
  }

  return <div className="discover-sort-picker" ref={rootRef}>
    <button ref={triggerRef} type="button" className="discover-sort-trigger" aria-label="Ordenar resultados" aria-haspopup="listbox" aria-expanded={open} aria-controls="discover-sort-options" onClick={() => { setActiveIndex(selectedIndex); setOpen(current => !current) }} onKeyDown={onTriggerKeyDown}>
      {SORT_OPTIONS[selectedIndex]?.label}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>
    {open && <div id="discover-sort-options" className="discover-sort-options" role="listbox" aria-label="Orden de resultados" onKeyDown={onOptionsKeyDown}>{SORT_OPTIONS.map((option, index) => <div key={option.value} ref={node => { optionRefs.current[index] = node }} className={`discover-sort-option${value === option.value ? ' active' : ''}`} role="option" aria-selected={value === option.value} tabIndex={index === activeIndex ? 0 : -1} onFocus={() => setActiveIndex(index)} onClick={() => choose(index)}>{option.label}</div>)}</div>}
  </div>
}

export default function DiscoverWorks() {
  const { category } = useParams()
  const mediaType = category === 'games' ? 'game' : 'anime'
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState({ type: null, loading: true, error: '', works: [] })
  const works = catalog.works
  const loading = catalog.type !== mediaType || catalog.loading
  const error = catalog.type === mediaType ? catalog.error : ''
  const selectedGenre = params.get('genre') || params.get('genres')?.split(',')[0] || 'all'
  const order = params.get('order') === 'rated' ? 'rated' : 'popular'
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)

  useEffect(() => {
    let active = true
    getDiscoverWorks(mediaType).then(result => { if (active) setCatalog({ type: mediaType, loading: false, error: '', works: result }) }).catch(() => { if (active) setCatalog({ type: mediaType, loading: false, error: 'No se pudo cargar el catálogo. Inténtalo de nuevo.', works: [] }) })
    return () => { active = false }
  }, [mediaType])

  const genres = useMemo(() => [...new Set(works.flatMap(work => work.genres))].sort((a, b) => a.localeCompare(b, 'es')), [works])
  const filtered = useMemo(() => {
    const matching = works.filter(work => selectedGenre === 'all' || work.genres.includes(selectedGenre))
    matching.sort((a, b) => {
      if (order === 'rated') {
        const aRating = a.userRating ?? a.databaseRating
        const bRating = b.userRating ?? b.databaseRating
        if (aRating === null && bRating !== null) return 1
        if (bRating === null && aRating !== null) return -1
        if (aRating !== bRating) return (bRating || 0) - (aRating || 0)
        if (a.ratingCount !== b.ratingCount) return b.ratingCount - a.ratingCount
        if (a.databasePopularity !== b.databasePopularity) return b.databasePopularity - a.databasePopularity
        if (a.registrations !== b.registrations) return b.registrations - a.registrations
      } else {
        if (a.registrations !== b.registrations) return b.registrations - a.registrations
        if (a.databasePopularity !== b.databasePopularity) return b.databasePopularity - a.databasePopularity
        if (a.databaseRating !== b.databaseRating) return (b.databaseRating || 0) - (a.databaseRating || 0)
      }
      const aYear = Number(releaseYear(a)) || 0
      const bYear = Number(releaseYear(b)) || 0
      if (aYear !== bYear) return bYear - aYear
      return a.title.localeCompare(b.title, 'es')
    })
    return matching
  }, [works, selectedGenre, order])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const updateParams = updates => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    next.delete('page')
    setParams(next)
  }
  const selectGenre = genre => updateParams({ genre: genre === 'all' ? '' : genre, genres: '' })
  const switchType = type => navigate(`/discover/${type}${order === 'popular' ? '' : '?order=rated'}`)
  const goBack = () => navigate('/discover')
  const setPage = nextPage => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const retry = () => {
    setCatalog({ type: mediaType, loading: true, error: '', works: [] })
    getDiscoverWorks(mediaType).then(result => setCatalog({ type: mediaType, loading: false, error: '', works: result })).catch(() => setCatalog({ type: mediaType, loading: false, error: 'No se pudo cargar el catálogo. Inténtalo de nuevo.', works: [] }))
  }
  const title = category === 'games' ? 'Juegos' : 'Animes'

  return <main className="discover-works-page">
    <SEO title={`Explorar ${title}`} description={`Descubre ${title.toLocaleLowerCase()} de la comunidad.`}/>
    <header className="discover-works-header"><div className="discover-title-group"><button type="button" className="discover-back-button" onClick={goBack} aria-label="Volver"><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button><h1>{title}</h1></div></header>
    <section className="discover-works-controls" aria-label="Filtros y orden del catálogo">
      <div className={`discover-type-switch${category === 'games' ? ' games-selected' : ''}`} role="group" aria-label="Tipo de obra">{TYPES.map(type => <button key={type} type="button" className={(category === type ? 'active' : '')} aria-pressed={category === type} onClick={() => switchType(type)}>{type === 'anime' ? 'Anime' : 'Juegos'}</button>)}</div>
      <div className="discover-genre-list" role="group" aria-label="Filtrar por género"><button type="button" className={`discover-chip${selectedGenre === 'all' ? ' active' : ''}`} aria-pressed={selectedGenre === 'all'} onClick={() => selectGenre('all')}>All</button>{genres.map(genre => <button type="button" key={genre} className={`discover-chip${selectedGenre === genre ? ' active' : ''}`} aria-pressed={selectedGenre === genre} onClick={() => selectGenre(genre)}>{genre}</button>)}</div>
    </section>
    <section className="discover-catalog-results" aria-live="polite" key={`${category}-${selectedGenre}-${order}`}>
      <div className="discover-grid-toolbar"><p>{title} en Geeksphere</p><SortPicker value={order} onChange={value => updateParams({ order: value === 'popular' ? '' : value, genre: selectedGenre === 'all' ? '' : selectedGenre, genres: '' })}/></div>
      {loading ? <SkeletonGrid/> : error ? <div className="discover-empty" role="alert"><span>!</span><h2>Error al cargar</h2><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div> : visible.length ? <div className="discover-work-grid">{visible.map(work => <WorkCard key={work.id} work={work} mediaType={category}/>)}</div> : <div className="discover-empty"><span>⌕</span><h2>No hay obras para estos filtros</h2><p>Prueba con otra categoría.</p><button type="button" onClick={() => selectGenre('all')}>Quitar filtro</button></div>}
      {!loading && !error && totalPages > 1 && <nav className="discover-pagination" aria-label="Paginación"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button><span>Página {currentPage} de {totalPages}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente</button></nav>}
    </section>
  </main>
}
