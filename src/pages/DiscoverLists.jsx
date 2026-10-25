import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDiscoverLists, getDiscoverTemplates } from '../lib/listService'
import ListLikeButton from '../components/ListLikeButton'
import CreateTemplateModal from './lists/CreateTemplateModal'
import SEO from '../components/SEO'
import '../components/LibraryGrid.css'
import './DiscoverWorks.css'
import './Search.css'
import './DiscoverLists.css'

const PAGE_SIZE = 24
const TYPES = [
  { value: '', label: 'Todas' },
  { value: 'tierlist', label: 'Tierlist' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'grid', label: 'Grid' },
]
const MEDIA = [
  { value: '', label: 'Todo' },
  { value: 'anime', label: 'Anime' },
  { value: 'game', label: 'Juegos' },
]

function collectImages(content) {
  const images = []
  const add = item => {
    const src = item?.image_url || item?.cover_url || item?.cover?.url
    if (src && !images.includes(src)) images.push(src)
  }
  const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
  const groups = Array.isArray(content) ? [content] : [
    ...priorities.filter(key => content?.[key] != null).map(key => content[key]),
    ...Object.keys(content || {}).filter(key => !priorities.includes(key)).map(key => content[key]),
  ]
  for (const group of groups) {
    for (const item of Array.isArray(group) ? group : [group]) {
      add(item)
      if (images.length === 4) return images
    }
  }
  return images
}

function listTypeName(type) {
  return type === 'ranking' ? 'Ranking' : type === 'grid' ? 'Grid' : 'Tierlist'
}

function ListTypeIcon({ type }) {
  if (type === 'ranking') return <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  if (type === 'grid') return <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  return <svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
}

function collectTemplateImages(template) {
  return collectImages(template.cover_items?.length ? template.cover_items : template.default_items || [])
}

function TypePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, TYPES.findIndex(option => option.value === value)))
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = Math.max(0, TYPES.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    optionRefs.current[activeIndex]?.focus()
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, activeIndex])

  const choose = index => {
    onChange(TYPES[index].value)
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
      setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + TYPES.length) % TYPES.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : TYPES.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    }
  }

  return <div className="discover-sort-picker discover-list-type-picker" ref={rootRef}>
    <button ref={triggerRef} type="button" className="discover-sort-trigger" aria-label="Filtrar por formato" aria-haspopup="listbox" aria-expanded={open} aria-controls="discover-list-type-options" onClick={() => { setActiveIndex(selectedIndex); setOpen(current => !current) }} onKeyDown={onTriggerKeyDown}>
      {TYPES[selectedIndex]?.label}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>
    {open && <div id="discover-list-type-options" className="discover-sort-options" role="listbox" aria-label="Formato de lista" onKeyDown={onOptionsKeyDown}>{TYPES.map((option, index) => <div key={option.value || 'all'} ref={node => { optionRefs.current[index] = node }} className={`discover-sort-option${value === option.value ? ' active' : ''}`} role="option" aria-selected={value === option.value} tabIndex={index === activeIndex ? 0 : -1} onFocus={() => setActiveIndex(index)} onClick={() => choose(index)}>{option.label}</div>)}</div>}
  </div>
}

function Author({ profile, fallback = 'Anónimo' }) {
  const username = profile?.username
  return <span className="discover-list-author">
    <span className="discover-list-author-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy"/> : (username?.[0] || fallback[0] || 'A').toUpperCase()}</span>
    <span>{username ? `@${username}` : fallback}</span>
  </span>
}

function ListCard({ item, template = false }) {
  const images = template ? collectTemplateImages(item) : collectImages(item.content)
  const label = listTypeName(item.list_type)
  const href = template ? `/templates/${item.id}` : `/lists/${item.id}`
  const profile = template ? item.profiles : item.author
  return <article className="discover-list-card">
    <Link to={href} className="discover-list-card-link">
      <span className={`search-list-poster discover-list-poster${images.length === 3 ? ' count-three' : images.length === 2 ? ' count-two' : ''}`} aria-hidden="true">
        {images.length ? images.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" loading="lazy"/>) : <span className="discover-list-poster-fallback"><ListTypeIcon type={item.list_type}/></span>}
      </span>
      <span className="discover-list-card-copy">
        <strong>{item.title || 'Lista sin título'}</strong>
        <Author profile={profile}/>
        <span className="search-list-tags">
          <span className={`search-list-tag type-${item.list_type || 'tierlist'}`}>{label}</span>
          {item.media_type && <span className={`search-list-tag media-${item.media_type}`}>{item.media_type === 'game' ? 'Videojuegos' : item.media_type === 'anime' ? 'Anime' : item.media_type}</span>}
        </span>
        {template && <small className="discover-list-uses">{item.uses_count || 0} usos</small>}
      </span>
    </Link>
    {!template && <div className="discover-list-like"><ListLikeButton listId={item.id} compact/></div>}
  </article>
}

function ListSkeletons() {
  return <div className="discover-list-grid" aria-label="Cargando listas">{Array.from({ length: 8 }, (_, index) => <div className="discover-list-skeleton" key={index}><span/><i/><b/><em/></div>)}</div>
}

export default function DiscoverLists() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [catalog, setCatalog] = useState({ key: '', items: [], total: 0, loading: true, error: '' })
  const mode = params.get('tab') === 'templates' ? 'templates' : 'lists'
  const type = TYPES.some(option => option.value === params.get('type')) ? params.get('type') : ''
  const media = MEDIA.some(option => option.value === params.get('media')) ? params.get('media') : ''
  const query = params.get('q') || ''
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
  const requestKey = `${mode}:${type}:${media}:${query}:${page}:${retryToken}`
  const loading = catalog.key !== requestKey || catalog.loading

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setCatalog(current => ({ ...current, key: requestKey, loading: true, error: '' }))
      const fetchCatalog = mode === 'templates' ? getDiscoverTemplates : getDiscoverLists
      fetchCatalog({ type: type || null, mediaType: media || null, query, page, pageSize: PAGE_SIZE, signal: controller.signal })
        .then(result => { if (!cancelled) setCatalog({ key: requestKey, items: result.items, total: result.total, loading: false, error: '' }) })
        .catch(error => { if (!cancelled && error?.name !== 'AbortError') setCatalog({ key: requestKey, items: [], total: 0, loading: false, error: 'No se pudo cargar el catálogo. Inténtalo de nuevo.' }) })
    }, query ? 220 : 0)
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort() }
  }, [requestKey, mode, type, media, query, page])

  const totalPages = Math.max(1, Math.ceil((catalog.key === requestKey ? catalog.total : 0) / PAGE_SIZE))
  const visibleItems = useMemo(() => catalog.key === requestKey ? catalog.items : [], [catalog, requestKey])

  const updateParams = updates => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setParams(next)
  }
  const selectMode = nextMode => updateParams({ tab: nextMode === 'lists' ? '' : nextMode })
  const setPage = nextPage => {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const create = () => {
    if (!user) return navigate('/login')
    if (mode === 'templates') setShowTemplateModal(true)
    else navigate('/lists/new')
  }

  return <main className="discover-works-page discover-lists-page">
    <SEO title={mode === 'templates' ? 'Explorar plantillas' : 'Explorar listas'} description="Descubre listas y plantillas creadas por la comunidad de GeekSphere."/>
    <header className="discover-works-header discover-lists-header">
      <div className="discover-title-group">
        <button type="button" className="discover-back-button" onClick={() => navigate('/discover')} aria-label="Volver">
          <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h1>Listas</h1>
      </div>
    </header>

    <div className="discover-list-controls">
      <div className={`discover-list-mode${mode === 'templates' ? ' templates-selected' : ''}`} role="group" aria-label="Tipo de catálogo">
        <span aria-hidden="true"/>
        <button type="button" className={mode === 'lists' ? 'active' : ''} aria-pressed={mode === 'lists'} onClick={() => selectMode('lists')}>Creaciones</button>
        <button type="button" className={mode === 'templates' ? 'active' : ''} aria-pressed={mode === 'templates'} onClick={() => selectMode('templates')}>Plantillas</button>
      </div>

      <div className="discover-list-filter-row">
        <TypePicker value={type} onChange={value => updateParams({ type: value })}/>
        <div className="discover-genre-list media" role="group" aria-label="Filtrar por medio">{MEDIA.map(option => <button key={option.value || 'all'} type="button" className={`discover-chip${media === option.value ? ' active' : ''}`} aria-pressed={media === option.value} onClick={() => updateParams({ media: option.value })}>{option.label}</button>)}</div>
        <div className="discover-list-filter-actions">
          <label className="discover-list-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
            <input type="search" value={query} placeholder="Buscar listas..." aria-label="Buscar listas" onChange={event => updateParams({ q: event.target.value })}/>
            {query && <button type="button" onClick={() => updateParams({ q: '' })} aria-label="Borrar búsqueda">×</button>}
          </label>
          <button type="button" className="discover-list-create" onClick={create} aria-label={mode === 'templates' ? 'Crear plantilla' : 'Crear lista'} title={mode === 'templates' ? 'Crear plantilla' : 'Crear lista'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>
    </div>

    <section className="discover-list-results" aria-live="polite">
      <div className="discover-grid-toolbar"><p>{mode === 'templates' ? 'Plantillas en Geeksphere' : 'Listas en Geeksphere'}</p></div>
      {loading ? <ListSkeletons/> : catalog.error ? <div className="discover-empty" role="alert"><span>!</span><h2>Error al cargar</h2><p>{catalog.error}</p><button type="button" onClick={() => setRetryToken(value => value + 1)}>Reintentar</button></div>
        : visibleItems.length ? <div className="discover-list-grid">{visibleItems.map(item => <ListCard key={item.id} item={item} template={mode === 'templates'}/>)}</div>
          : <div className="discover-empty discover-list-no-results"><p>{mode === 'templates' ? 'Sin plantillas' : 'Sin listas'}</p></div>}
      {!loading && !catalog.error && totalPages > 1 && <nav className="discover-pagination" aria-label="Paginación"><button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>Anterior</button><span>Página {page} de {totalPages}</span><button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Siguiente</button></nav>}
    </section>

    {showTemplateModal && <CreateTemplateModal onClose={() => setShowTemplateModal(false)} onSuccess={result => {
      setShowTemplateModal(false)
      if (result?.id) navigate(`/templates/${result.id}`)
      else setRetryToken(value => value + 1)
    }}/>}
  </main>
}
