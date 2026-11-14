import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import { getDiscoverLists, getDiscoverTemplates } from '../lib/listService'
import { isStandalonePwa, navigatePwaRoute, navigateWorkBack, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import ListLikeButton from '../components/ListLikeButton'
import CreateTemplateModal from './lists/CreateTemplateModal'
import CatalogPicker from '../components/CatalogPicker'
import { collectListPreviewImages, templatePreviewImages } from '../lib/discoverListPreview'
import SEO from '../components/SEO'
import '../components/LibraryGrid.css'
import './DiscoverWorks.css'
import './Search.css'
import './DiscoverLists.css'
import './DiscoverCatalog.css'
import './DiscoverListCatalog.css'

const PAGE_SIZE = 24
const TYPES = [
  { value: '', label: 'Todos los formatos' },
  { value: 'tierlist', label: 'Tierlist' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'grid', label: 'Grid' },
]
const MEDIA = [
  { value: '', label: 'Todo el contenido' },
  { value: 'anime', label: 'Anime' },
  { value: 'game', label: 'Juegos' },
]

function listTypeName(type) {
  return type === 'ranking' ? 'Ranking' : type === 'grid' ? 'Grid' : 'Tierlist'
}

function ListTypeIcon({ type }) {
  if (type === 'ranking') return <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  if (type === 'grid') return <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  return <svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
}

function Author({ profile }) {
  const [failed, setFailed] = useState(false)
  const username = profile?.username
  const Wrapper = username ? Link : 'span'
  return <Wrapper className="discover-list-author" {...(username ? { to: '/profile/' + username } : {})}>
    <span className="discover-list-author-avatar" style={{ borderColor: profile?.theme_color || 'var(--brand-primary)' }}>{profile?.avatar_url && !failed ? <img src={profile.avatar_url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <DefaultAvatar accent={profile?.theme_color} />}</span>
    <span>{username ? '@' + username : 'Anónimo'}</span>
  </Wrapper>
}

function ListArtwork({ images, type }) {
  const [failed, setFailed] = useState([])
  const visible = images.filter(image => !failed.includes(image))
  return <span className="discover-list-artwork" data-count={visible.length} style={visible.length === 1 ? { '--list-single-cover': 'url(' + JSON.stringify(visible[0]) + ')' } : undefined} aria-hidden="true">
    {visible.length ? visible.map(image => <img key={image} src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(previous => previous.includes(image) ? previous : [...previous, image])} />) : <span className="discover-list-artwork-empty"><ListTypeIcon type={type} /></span>}
  </span>
}

function ListCard({ item, template = false }) {
  const images = template ? templatePreviewImages(item) : collectListPreviewImages(item.content)
  const profile = template ? item.profiles : item.author
  return <article className="discover-list-card">
    <Link to={(template ? '/templates/' : '/lists/') + item.id} className="discover-list-card-link">
      <ListArtwork images={images} type={item.list_type} />
      <span className="discover-list-card-copy">
        <strong>{item.title || (template ? 'Plantilla sin título' : 'Lista sin título')}</strong>
        <span className="discover-list-card-tags"><span>{listTypeName(item.list_type)}</span>{item.media_type && <><span aria-hidden="true">·</span><span>{item.media_type === 'game' ? 'Juegos' : item.media_type === 'anime' ? 'Anime' : item.media_type}</span></>}</span>
      </span>
    </Link>
    <footer className="discover-list-card-footer">
      <Author key={profile?.id || 'anonymous'} profile={profile} />
      {template ? <span className="discover-list-uses">{Number(item.uses_count || 0).toLocaleString('es-ES')} {Number(item.uses_count) === 1 ? 'uso' : 'usos'}</span> : <div className="discover-list-like"><ListLikeButton listId={item.id} compact /></div>}
    </footer>
  </article>
}

function ListSkeletons() {
  return <div className="discover-list-grid" aria-label="Cargando catálogo">{Array.from({ length: 6 }, (_, index) => <div className="discover-list-skeleton" key={index}><span /><i /><b /><em /></div>)}</div>
}

const catalogCache = new Map()

export default function DiscoverLists() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const surfaceRef = useRef(null)
  const [isPwa, setIsPwa] = useState(isStandalonePwa)
  const [managedMotion] = useState(() => Boolean(document.documentElement.dataset.pwaWorkDirection))
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const mode = params.get('tab') === 'templates' ? 'templates' : 'lists'
  const requestedType = TYPES.some(option => option.value === params.get('type')) ? params.get('type') : ''
  const type = mode === 'templates' && requestedType === 'ranking' ? '' : requestedType
  const typeOptions = mode === 'templates' ? TYPES.filter(option => option.value !== 'ranking') : TYPES
  const media = MEDIA.some(option => option.value === params.get('media')) ? params.get('media') : ''
  const query = params.get('q') || ''
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
  const cacheKey = JSON.stringify([user?.id || 'guest', mode, type, media, query, page])
  const requestKey = cacheKey + ':' + retryToken
  const [catalog, setCatalog] = useState({ key: '', items: [], total: 0, loading: true, error: '' })
  const result = useMemo(() => catalog.key === requestKey ? catalog : catalogCache.get(cacheKey) || { items: [], total: 0, loading: true, error: '' }, [catalog, cacheKey, requestKey])
  const loading = result.loading

  useLayoutEffect(() => { signalPwaRouteReady(location.pathname) }, [location.pathname])
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
    const update = () => setIsPwa(isStandalonePwa())
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const fetchCatalog = mode === 'templates' ? getDiscoverTemplates : getDiscoverLists
      fetchCatalog({ type: type || null, mediaType: media || null, query, page, pageSize: PAGE_SIZE, signal: controller.signal })
        .then(data => {
          if (cancelled) return
          const next = { key: requestKey, items: data.items, total: data.total, loading: false, error: '' }
          catalogCache.set(cacheKey, next)
          if (catalogCache.size > 20) catalogCache.delete(catalogCache.keys().next().value)
          setCatalog(next)
        })
        .catch(error => { if (!cancelled && error?.name !== 'AbortError') setCatalog({ key: requestKey, items: [], total: 0, loading: false, error: 'No se pudo cargar el catálogo. Inténtalo de nuevo.' }) })
    }, query ? 220 : 0)
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort() }
  }, [requestKey, cacheKey, mode, type, media, query, page])

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const hasFilters = Boolean(type || media || query)
  const scrollToTop = () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    if (isPwa) surfaceRef.current?.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }
  const updateParams = updates => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setParams(next, { replace: true })
    if (!Object.hasOwn(updates, 'q')) scrollToTop()
  }
  const selectMode = nextMode => updateParams({ tab: nextMode === 'lists' ? '' : nextMode, type: nextMode === 'templates' && requestedType === 'ranking' ? '' : type })
  const create = () => {
    if (!user) return navigate('/register')
    if (mode === 'templates') setShowTemplateModal(true)
    else navigatePwaRoute(navigate, '/share?openList=1')
  }
  const retry = () => {
    catalogCache.delete(cacheKey)
    setCatalog({ key: '', items: [], total: 0, loading: true, error: '' })
    setRetryToken(value => value + 1)
  }
  const title = mode === 'templates' ? 'Plantillas' : 'Listas'

  return <section ref={surfaceRef} className={'discover-works-page discover-lists-page discover-catalog-page discover-list-catalog' + (isPwa ? ' discover-detail-pwa' + (managedMotion ? '' : ' discover-screen-enter') : '')} aria-label="Explorar listas">
    <SEO title={'Explorar ' + title.toLocaleLowerCase()} description="Descubre listas y plantillas creadas por la comunidad de GeekSphere." />
    <div className="discover-catalog-inner">
      <header className="discover-works-header discover-lists-header">
        <div className="discover-title-group"><button type="button" className="discover-back-button" onClick={() => navigateWorkBack(navigate, '/search')} aria-label="Volver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><h1>Explorar listas</h1></div>
        <button type="button" className="discover-list-create" onClick={create} aria-label={mode === 'templates' ? 'Crear plantilla' : 'Crear lista'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>Crear</span></button>
      </header>
      <div className="discover-list-controls">
        <div className={'discover-list-mode' + (mode === 'templates' ? ' templates-selected' : '')} role="group" aria-label="Tipo de catálogo"><span aria-hidden="true" /><button type="button" className={mode === 'lists' ? 'active' : ''} aria-pressed={mode === 'lists'} onClick={() => selectMode('lists')}>Listas</button><button type="button" className={mode === 'templates' ? 'active' : ''} aria-pressed={mode === 'templates'} onClick={() => selectMode('templates')}>Plantillas</button></div>
        <div className="discover-list-filter-row">
          <label className="discover-list-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3" /><path d="m16.2 16.2 4.3 4.3" /></svg><input type="search" value={query} placeholder={mode === 'templates' ? 'Buscar plantillas…' : 'Buscar listas…'} aria-label={mode === 'templates' ? 'Buscar plantillas' : 'Buscar listas'} onChange={event => updateParams({ q: event.target.value })} />{query && <button type="button" onClick={() => updateParams({ q: '' })} aria-label="Borrar búsqueda">×</button>}</label>
          <div className="discover-list-filter-pickers"><CatalogPicker pill value={type} options={typeOptions} label="Formato" onChange={value => updateParams({ type: value })} /><CatalogPicker pill value={media} options={MEDIA} label="Contenido" onChange={value => updateParams({ media: value })} /></div>
        </div>
      </div>
      <section className="discover-list-results" aria-busy={loading}>
        <div className="discover-grid-toolbar"><h2>{title}</h2><p role="status">{loading ? 'Cargando…' : result.error ? 'Catálogo no disponible' : result.total.toLocaleString('es-ES') + (mode === 'templates' ? result.total === 1 ? ' plantilla' : ' plantillas' : result.total === 1 ? ' lista' : ' listas')}</p></div>
        {loading ? <ListSkeletons /> : result.error ? <div className="discover-empty" role="alert"><span>!</span><h2>No pudimos cargar el catálogo</h2><p>{result.error}</p><button type="button" onClick={retry}>Reintentar</button></div> : result.items.length ? <div className="discover-list-grid">{result.items.map(item => <ListCard key={mode + ':' + item.id} item={item} template={mode === 'templates'} />)}</div> : <div className="discover-empty"><span aria-hidden="true"><ListTypeIcon type={type} /></span><h2>{hasFilters ? 'No hay coincidencias' : 'Todavía no hay ' + title.toLocaleLowerCase()}</h2><p>{hasFilters ? 'Prueba otra búsqueda o quita los filtros.' : 'Sé el primero en compartir una con la comunidad.'}</p>{hasFilters ? <button type="button" onClick={() => updateParams({ q: '', type: '', media: '' })}>Limpiar filtros</button> : page > 1 ? <button type="button" onClick={() => updateParams({ page: '1' })}>Volver al principio</button> : <button type="button" onClick={create}>{mode === 'templates' ? 'Crear plantilla' : 'Crear lista'}</button>}</div>}
        {!loading && !result.error && totalPages > 1 && <nav className="discover-pagination" aria-label="Paginación"><button type="button" onClick={() => updateParams({ page: String(page - 1) })} disabled={page <= 1}>Anterior</button><span>Página {page} de {totalPages}</span><button type="button" onClick={() => updateParams({ page: String(page + 1) })} disabled={page >= totalPages}>Siguiente</button></nav>}
      </section>
    </div>
    {showTemplateModal && <CreateTemplateModal onClose={() => setShowTemplateModal(false)} onSuccess={data => { setShowTemplateModal(false); if (data?.id) navigatePwaRoute(navigate, '/templates/' + data.id); else retry() }} />}
  </section>
}
