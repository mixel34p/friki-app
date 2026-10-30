import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getSearchHighlights, searchPlatform } from '../lib/platformSearchService'
import { getSearchRecommendations } from '../lib/searchRecommendationsService'
import { getDiscoverLists } from '../lib/listService'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import './Search.css'

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'game', label: 'Games' }, { id: 'anime', label: 'Anime' },
  { id: 'spaces', label: 'Spaces' }, { id: 'lists', label: 'Lists' }, { id: 'users', label: 'Users' },
]
const FILTER_IDS = new Set(FILTERS.map(filter => filter.id))
const CATEGORY_LABELS = { works: 'Obras', spaces: 'Espacios', users: 'Usuarios', lists: 'Listas' }
const nameOf = item => item.title || item.name || item.display_name || item.username || 'Sin nombre'

function resultHref(item) {
  if (item.type === 'list') return `/lists/${item.id}`
  if (item.type === 'game') return `/game/${item.id}`
  if (item.type === 'anime') return `/anime/${item.id}`
  if (item.username) return `/profile/${item.username}`
  return `/spaces/${item.id}`
}

function getListCollageImages(content) {
  const images = []
  const addImage = item => {
    if (!item) return
    const image = item.image_url || item.cover_url || item.cover?.url
    if (image && !images.includes(image)) images.push(image)
  }
  const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
  const groups = Array.isArray(content) ? [content] : [
    ...priorities.filter(key => content?.[key] != null).map(key => content[key]),
    ...Object.keys(content || {}).filter(key => !priorities.includes(key)).map(key => content[key]),
  ]
  for (const group of groups) {
    for (const item of Array.isArray(group) ? group : [group]) {
      addImage(item)
      if (images.length === 4) return images
    }
  }
  return images
}

function ListPoster({ list, compact = false }) {
  const images = getListCollageImages(list.content)
  const countClass = images.length === 3 ? ' count-three' : images.length === 2 ? ' count-two' : ''
  return <span className={`search-list-poster${compact ? ' compact' : ''}${countClass}`} aria-hidden="true">
    {images.length ? images.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" loading="lazy" />) : <span className="search-list-poster-empty">Lista</span>}
  </span>
}

function resultImage(item) {
  return item.image || item.cover_url || item.image_url || item.avatar_url || null
}

function highResolutionArtwork(item, kind) {
  const src = resultImage(item)
  if (!src) return null
  if (kind === 'games') return src.replace(/\/t_[^/]+\//, '/t_original/')
  if (kind === 'anime') return src.replace('/cover/large/', '/cover/original/').replace('/cover/medium/', '/cover/original/')
  return src
}

function getSecondary(item) {
  if (item.type === 'list') return item.author?.username ? `@${item.author.username}` : '@usuario'
  if (item.type === 'game' || item.type === 'anime') {
    return getYear(item)
  }
  if (item.username) return `@${item.username}`
  if (item.owner_id) return `${item.member_count ?? 0} ${item.member_count === 1 ? 'usuario' : 'usuarios'}`
  return item.description || 'Espacio de la comunidad'
}

function getYear(item) {
  const date = item.release_date || item.first_release_date
  return typeof date === 'number' ? new Date(date * 1000).getFullYear() : date ? String(date).slice(0, 4) : ''
}

function VerifiedBadge({ className = 'search-space-verified' }) {
  return <span className={className} title="Espacio verificado" aria-label="Espacio verificado">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1d9bf0" d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6-.86 2.07-3.14 3.47 1.5 3.47-1.5 2.07 3.14 3.6.86-.57 3.65 2.43 2.8z"/><path fill="#fff" d="M10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z"/></svg>
  </span>
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
}

function ResultLink({ item, active, id, onClick, display = 'row' }) {
  const isCard = display === 'card'
  if (item.type === 'list') {
    const listType = item.list_type === 'ranking' ? 'Ranking' : item.list_type === 'grid' ? 'Grid' : 'Tierlist'
    const authorName = item.author?.username || 'usuario'
    const authorAvatar = item.author?.avatar_url
    const typeIcon = item.list_type === 'ranking'
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      : item.list_type === 'grid'
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
    if (isCard) return <Link id={id} role="option" aria-selected={active} to={resultHref(item)} className={`search-result search-list-result search-list-card${active ? ' is-active' : ''}`} onClick={onClick}>
      <ListPoster list={item}/>
      <span className="search-list-card-content">
        <strong>{nameOf(item)}</strong>
        <span className="search-list-card-author"><span className="search-list-author-avatar">{authorAvatar ? <img src={authorAvatar} alt="" loading="lazy"/> : authorName.slice(0, 1).toUpperCase()}</span>@{authorName}</span>
        <span className="search-list-tags"><span className={`search-list-tag type-${item.list_type || 'tierlist'}`}>{typeIcon}{listType}</span>{item.media_type && <span className={`search-list-tag media-${item.media_type}`}>{item.media_type === 'game' ? 'Videojuegos' : item.media_type === 'anime' ? 'Anime' : item.media_type}</span>}</span>
      </span>
    </Link>
    const username = item.author?.username || 'usuario'
    const avatar = item.author?.avatar_url
    return <Link id={id} role="option" aria-selected={active} to={resultHref(item)} className={`search-result search-list-result search-list-row${active ? ' is-active' : ''}`} onClick={onClick}>
      <ListPoster list={item} compact/>
      <span className="search-result-copy"><strong>{nameOf(item)}</strong><small className="search-list-author"><span className="search-list-author-avatar">{avatar ? <img src={avatar} alt="" loading="lazy"/> : username.slice(0, 1).toUpperCase()}</span><span>@{username}</span></small></span>
      <span className="search-kind list-kind">{listType}</span>
    </Link>
  }
  const image = isCard && item.owner_id ? item.avatar_url || item.banner_url || resultImage(item) : resultImage(item)
  const title = nameOf(item)
  const imageType = item.type || (item.username ? 'user' : 'space')
  const artwork = image ? <img className={`search-result-image ${imageType}`} src={image} alt="" loading="lazy" /> : <span className={`search-result-fallback ${imageType}`} aria-hidden="true">{item.type === 'anime' ? '▣' : item.type === 'game' ? '▤' : item.username ? title.slice(0, 1).toUpperCase() : '◈'}</span>
  const titleContent = item.owner_id ? <span className="search-space-title-line"><strong>{title}</strong>{item.is_verified && <VerifiedBadge />}</span> : <strong>{title}</strong>
  const profileAccent = item.username ? { '--search-user-accent': item.theme_color || 'var(--brand-primary)' } : undefined
  return <Link id={id} role="option" aria-selected={active} to={resultHref(item)} className={`search-result${active ? ' is-active' : ''}${isCard ? ' search-result-card' : ''}`} onClick={onClick} style={profileAccent}>
    {isCard ? <>
      <span className={`search-result-artwork${item.type ? ' work-artwork' : ' space-artwork'}`}>{artwork}</span>
      <span className="search-result-copy">{titleContent}{item.type && getYear(item) && <small>{getYear(item)}</small>}{item.owner_id && <small>{getSecondary(item)}</small>}</span>
    </> : <>
      {artwork}
      <span className="search-result-copy">{titleContent}{getSecondary(item) && <small>{getSecondary(item)}</small>}</span>
      {(item.type === 'game' || item.type === 'anime') && <span className={`search-kind ${item.type}`}>{item.type === 'game' ? 'VIDEOJUEGO' : 'ANIME'}</span>}
    </>}
  </Link>
}

function SearchInput({ value, onChange, onFocus, onKeyDown, inputRef, resultsId, isOpen, activeDescendant }) {
  return <div className="search-input-shell">
    <SearchIcon />
    <input ref={inputRef} type="search" role="combobox" aria-autocomplete="list" aria-expanded={isOpen} aria-controls={resultsId} aria-activedescendant={activeDescendant || undefined} aria-label="Buscar obras, espacios y usuarios" placeholder="Busca cualquier cosa" value={value} onChange={event => onChange(event.target.value)} onFocus={onFocus} onKeyDown={onKeyDown} autoComplete="off" />
    {value && <button className="search-clear" type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda">×</button>}
  </div>
}

function SearchSkeleton() {
  return <div className="search-skeleton-list" aria-label="Cargando resultados"><span/><span/><span/><span/></div>
}

function Preview({ query, data, loading, error, activeIndex, onSelect, onViewAll, listRef }) {
  const groups = [
    ['works', data.works.slice(0, 8)], ['spaces', data.spaces.slice(0, 8)], ['lists', data.lists.slice(0, 8)], ['users', data.users.slice(0, 8)],
  ].filter(([, items]) => items?.length)
  const flat = groups.flatMap(([, items]) => items)
  return <div className="search-preview" ref={listRef} id="search-preview" role="listbox" aria-label="Resultados sugeridos">
    {loading && <SearchSkeleton />}
    {!loading && groups.map(([key, items]) => <section className="search-preview-group" key={key} aria-label={CATEGORY_LABELS[key]}>
      <h3>{CATEGORY_LABELS[key]}<span>{items.length}</span></h3>
      {items.map(item => <ResultLink key={`${item.type || key}-${item.id}`} item={item} id={`search-option-${flat.indexOf(item)}`} active={activeIndex === flat.indexOf(item)} onClick={onSelect} />)}
      {data.errors?.[key] && <p className="search-inline-error">No se pudo cargar esta categoría.</p>}
    </section>)}
    {!loading && Object.keys(data.errors || {}).length > 0 && <p className="search-preview-error">Algunos resultados no están disponibles ahora mismo.</p>}
    {!loading && !flat.length && (error ? <p className="search-preview-empty">No se han podido cargar los resultados. Inténtalo de nuevo.</p> : <p className="search-preview-empty">No hay resultados para «{query}».</p>)}
    {!loading && <button id="search-view-all" type="button" className={`search-view-all${activeIndex === flat.length ? ' is-active' : ''}`} role="option" aria-selected={activeIndex === flat.length} onClick={onViewAll}>
      Ver todo sobre «{query}»
    </button>}
  </div>
}

function CategoryCard({ kind, title, items, to, wide = false }) {
  const entries = items || []
  const visuals = kind === 'users' || kind === 'spaces' ? entries.slice(0, 3) : entries.slice(0, wide ? 3 : 2)
  return <Link to={to} className={`search-category-card${wide ? ' wide' : ''} ${kind}`}>
    <span className="category-art" aria-hidden="true">
      {kind === 'lists' ? <span className="category-art-list-icons">
        <svg className="list-type-tier" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        <svg className="list-type-ranking" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        <svg className="list-type-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      </span> : null}
      {visuals.length ? visuals.map((item, index) => {
        const image = highResolutionArtwork(item, kind)
        return <span className={`category-art-tile tile-${index + 1}`} key={item.id || index}>{image ? <img src={image} alt="" loading="lazy" decoding="async" onError={event => { if (event.currentTarget.src !== resultImage(item)) event.currentTarget.src = resultImage(item) }}/> : <span>{kind === 'anime' ? '▣' : kind === 'games' ? '▤' : kind === 'users' ? '◎' : '◈'}</span>}</span>
      }) : kind === 'users' ? <span className="category-art-people-fallback"><span>◎</span><span>◎</span><span>◎</span></span> : kind !== 'lists' ? <span className="category-art-fallback">{kind === 'anime' ? '▣' : kind === 'games' ? '▤' : '◈'}</span> : null}
    </span>
    <span className="category-card-copy"><strong>{title}</strong></span>
  </Link>
}

function SpotlightRow({ kind, items = [], loading = false }) {
  const people = kind === 'people'
  const orderedItems = people ? [...items].sort((a, b) => (b.commonWorks || 0) - (a.commonWorks || 0)) : items
  const title = people ? 'Personas' : 'Espacios'
  const href = people ? '/discover/users' : '/discover/spaces'
  const mobileItems = orderedItems.slice(0, 3)
  return <section className={`search-spotlight ${kind}`} aria-labelledby={`search-${kind}-title`}>
    <Link to={href} className={`search-spotlight-mobile-link ${people ? 'people' : 'spaces'}`}>
      <span className="search-spotlight-mobile-avatars" aria-hidden="true">
        {(mobileItems.length ? mobileItems : Array.from({ length: 3 }, (_, index) => ({ id: `loading-${index}` }))).map((item, index) => <span className={`mobile-avatar${loading ? ' loading' : ''}`} key={item.user_id || item.id} style={{ '--avatar-index': index }}>
          {!loading && item.avatar_url && <img src={item.avatar_url} alt="" loading="lazy"/>}
        </span>)}
      </span>
      <span className="search-spotlight-mobile-copy">
        <strong>{title}</strong>
        <small>{people ? 'Tienen mucho en común contigo' : 'Comparte tus aficiones'}</small>
      </span>
      <svg className="search-spotlight-mobile-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </Link>
    <div className="search-spotlight-heading">
      <h2 id={`search-${kind}-title`}>{title}</h2>
      <Link to={href} className="search-spotlight-view-more">Ver todas <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></Link>
    </div>
    {loading ? <div className="search-spotlight-row is-loading" aria-label={`Cargando ${title}`} aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => <div className={`search-spotlight-skeleton ${people ? 'person' : 'space'}`} key={index} aria-hidden="true">
        {people ? <><span className="skeleton-avatar"/><i className="skeleton-title"/><b className="skeleton-subtitle"/></>
          : <><span className="skeleton-cover"/><i className="skeleton-title"/></>}
      </div>)}
    </div> : orderedItems.length ? <div className="search-spotlight-row">
      {orderedItems.slice(0, 8).map(item => {
        const name = item.display_name || item.name || item.username || 'Usuario'
        const image = item.avatar_url
        const destination = people ? `/profile/${item.username || item.user_id || item.id}` : `/spaces/${item.id}`
        const subtitle = `${item.commonWorks || 0} en común`
        return <Link className={`search-spotlight-card ${people ? 'person' : 'space'}`} to={destination} key={item.user_id || item.id} title={name}>
          {people ? <span className="search-spotlight-avatar" style={{ '--person-theme': item.theme_color || 'var(--brand-primary)' }}>{image ? <img src={image} alt="" loading="lazy"/> : <span>{name.slice(0, 1).toUpperCase()}</span>}</span>
            : <span className="search-spotlight-cover">{image ? <img src={image} alt="" loading="lazy"/> : <span>{name.slice(0, 1).toUpperCase()}</span>}</span>}
          <strong>{name}</strong>
          {people && <small>{subtitle}</small>}
        </Link>
      })}
    </div> : <p className="search-spotlight-empty">Todavía no hay {people ? 'personas para mostrar' : 'espacios para mostrar'}.</p>}
  </section>
}


function RecommendationItem({ work }) {
  const isAnime = work.type === 'anime' || work.media_type === 'anime'
  const href = isAnime ? `/anime/${work.id}` : `/game/${work.id}`
  const image = work.image || work.cover_url || work.image_url
  return (
    <Link to={href} className="srec-card" title={work.title} aria-label={work.title}>
      <div className="srec-card-poster">
        {image ? (
          <img src={image} alt={work.title} loading="lazy" />
        ) : (
          <div className="srec-card-fallback">{isAnime ? '▣' : '▤'}</div>
        )}
        <div className="srec-card-overlay">
          <span className="srec-card-title">{work.title}</span>
        </div>
      </div>
    </Link>
  )
}

function FeaturedListCard({ list }) {
  const author = list.author?.username || 'comunidad'
  return <Link className="search-featured-list-card" to={`/lists/${list.id}`} title={list.title || 'Lista sin título'}>
    <span className="search-featured-list-art"><ListPoster list={list}/></span>
    <strong>{list.title || 'Lista sin título'}</strong>
    <small className="search-featured-list-author"><span className="search-featured-list-avatar">{list.author?.avatar_url ? <img src={list.author.avatar_url} alt="" loading="lazy"/> : author.slice(0, 1).toUpperCase()}</span><span>@{author}</span></small>
  </Link>
}

function FeaturedLists({ lists, loading }) {
  return <section className="search-featured-lists" aria-labelledby="featured-lists-title">
    <div className="search-explore-heading">
      <div><h2 id="featured-lists-title">LISTAS</h2></div>
      <Link to="/discover/lists" className="search-spotlight-view-more">Ver todas <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></Link>
    </div>
    {loading ? <div className="search-featured-list-row" aria-label="Cargando listas">{Array.from({ length: 4 }, (_, index) => <div className="search-featured-list-skeleton" key={index}><span/><i/><b/></div>)}</div>
      : lists.length ? <div className="search-featured-list-row">{lists.map(list => <FeaturedListCard list={list} key={list.id}/>)}</div>
        : <p className="search-spotlight-empty">Todavía no hay listas públicas para mostrar.</p>}
  </section>
}

function FeaturedListsMobile({ lists, loading }) {
  const images = []
  lists.forEach(list => getListCollageImages(list.content).forEach(image => { if (!images.includes(image) && images.length < 3) images.push(image) }))
  return <Link to="/discover/lists" className="search-spotlight-mobile-link lists">
    <span className="search-spotlight-mobile-avatars" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => <span className={`mobile-avatar${loading ? ' loading' : ''}`} key={index} style={{ '--avatar-index': index }}>{!loading && images[index] && <img src={images[index]} alt="" loading="lazy"/>}</span>)}
    </span>
    <span className="search-spotlight-mobile-copy"><strong>Listas</strong><small>Descubre listas de la comunidad</small></span>
    <svg className="search-spotlight-mobile-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
  </Link>
}

function RecommendationSidebar({ userId }) {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSearchRecommendations(userId, 6).then(items => {
      if (!cancelled) {
        setRecs(items)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  return (
    <aside className="search-sidebar" aria-label="Te puede gustar">
      <div className="search-explore-heading">
        <div><h2>TE PUEDE GUSTAR</h2></div>
      </div>
      <div className="srec-grid">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="srec-skeleton" aria-hidden="true" />
        ))}
        {!loading && recs.length === 0 && (
          <p className="srec-empty">Sin recomendaciones disponibles</p>
        )}
        {!loading && recs.map(work => (
          <RecommendationItem key={`${work.type}-${work.id}`} work={work} />
        ))}
      </div>
    </aside>
  )
}

export default function Search() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const normalizedPath = location.pathname.replace(/\/+$/, '')
  const isResults = normalizedPath === '/search/results' || (normalizedPath === '/search' && params.has('filter'))
  const urlQuery = params.get('q') || ''
  const filter = FILTER_IDS.has(params.get('filter')) ? params.get('filter') : 'all'
  const [localQuery, setLocalQuery] = useState(urlQuery)
  const [resultsDraft, setResultsDraft] = useState(urlQuery)
  const query = isResults ? resultsDraft : localQuery
  const searchTerm = isResults ? urlQuery : localQuery
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery)
  const [debouncedResultsDraft, setDebouncedResultsDraft] = useState(urlQuery)
  const [data, setData] = useState({ works: [], spaces: [], users: [], lists: [], errors: {} })
  const [draftData, setDraftData] = useState({ works: [], spaces: [], users: [], lists: [], errors: {} })
  const [loading, setLoading] = useState(urlQuery.trim().length >= 2)
  const [draftLoading, setDraftLoading] = useState(false)
  const [highlightData, setHighlightData] = useState({})
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [featuredLists, setFeaturedLists] = useState([])
  const [featuredListsLoading, setFeaturedListsLoading] = useState(true)
  const [isFocused, setIsFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const requestRef = useRef(0)
  const previewQuery = isResults ? debouncedResultsDraft : debouncedQuery
  const draftPreviewActive = isResults && previewQuery.trim() !== urlQuery.trim()
  const previewData = draftPreviewActive ? draftData : data
  const previewLoading = draftPreviewActive ? draftLoading : loading
  const previewOpen = isFocused && previewQuery.trim().length >= 2

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(searchTerm.trim()), 300); return () => window.clearTimeout(timer) }, [searchTerm])
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedResultsDraft(resultsDraft.trim()), 300); return () => window.clearTimeout(timer) }, [resultsDraft])

  useEffect(() => { setResultsDraft(urlQuery) }, [urlQuery])

  useEffect(() => {
    const term = debouncedResultsDraft.trim()
    if (!isResults || term.length < 2 || term === urlQuery.trim()) {
      setDraftData({ works: [], spaces: [], users: [], lists: [], errors: {} })
      setDraftLoading(false)
      return undefined
    }
    let cancelled = false
    const controller = new AbortController()
    setDraftLoading(true)
    searchPlatform(term, 8, controller.signal).then(result => {
      if (!cancelled) setDraftData(result)
    }).catch(error => {
      if (!cancelled) setDraftData({ works: [], spaces: [], users: [], lists: [], errors: { all: error } })
    }).finally(() => { if (!cancelled) setDraftLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [debouncedResultsDraft, isResults, urlQuery])

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) return undefined
    const requestId = ++requestRef.current
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    searchPlatform(debouncedQuery, isResults ? 20 : 8, controller.signal, isResults ? filter : 'all').then(result => {
      if (!cancelled && requestId === requestRef.current) setData(result)
    }).catch(error => {
      if (!cancelled && requestId === requestRef.current) setData({ works: [], spaces: [], users: [], lists: [], errors: { all: error } })
    }).finally(() => { if (!cancelled && requestId === requestRef.current) setLoading(false) })
    return () => { cancelled = true; controller.abort(); requestRef.current += 1 }
  }, [debouncedQuery, isResults, filter])

  useEffect(() => {
    let cancelled = false
    setHighlightsLoading(true)
    getSearchHighlights(user?.id).then(samples => { if (!cancelled) setHighlightData(samples) }).catch(() => {}).finally(() => { if (!cancelled) setHighlightsLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    if (isResults) return undefined
    let cancelled = false
    const controller = new AbortController()
    setFeaturedListsLoading(true)
    getDiscoverLists({ page: 1, pageSize: 6, signal: controller.signal })
      .then(result => { if (!cancelled) setFeaturedLists(result.items || []) })
      .catch(() => { if (!cancelled) setFeaturedLists([]) })
      .finally(() => { if (!cancelled) setFeaturedListsLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [isResults])

  useEffect(() => {
    const onPointer = event => { if (!rootRef.current?.contains(event.target)) setIsFocused(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [])

  const flatResults = useMemo(() => [...previewData.works.slice(0, 8), ...previewData.spaces.slice(0, 8), ...previewData.lists.slice(0, 8), ...previewData.users.slice(0, 8)], [previewData])
  const viewAll = useCallback(() => {
    const next = new URLSearchParams({ q: query.trim(), filter: 'all' })
    setIsFocused(false)
    setLoading(true)
    navigate(`/search/results?${next.toString()}`)
  }, [navigate, query])
  const onInputChange = value => {
    setActiveIndex(-1)
    if (isResults) {
      setResultsDraft(value)
    } else {
      requestRef.current += 1
      if (value.trim().length < 2) setLoading(false)
      else setLoading(true)
      setLocalQuery(value)
    }
  }
  const onInputKeyDown = event => {
    if (event.key === 'Escape') { setIsFocused(false); setActiveIndex(-1); inputRef.current?.blur(); return }
    if (!previewOpen) { if (event.key === 'Enter' && query.trim()) viewAll(); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, flatResults.length)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)) }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeIndex >= 0 && activeIndex < flatResults.length) navigate(resultHref(flatResults[activeIndex]))
      else viewAll()
    }
  }
  useEffect(() => {
    if (activeIndex < 0) return
    const option = document.getElementById(activeIndex === flatResults.length ? 'search-view-all' : `search-option-${activeIndex}`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, flatResults.length])

  const selectedItems = filter === 'game' ? data.works.filter(item => item.type === 'game')
    : filter === 'anime' ? data.works.filter(item => item.type === 'anime')
      : filter === 'spaces' ? data.spaces : filter === 'users' ? data.users : filter === 'lists' ? data.lists : null
  const sections = filter === 'all'
    ? [['works', data.works], ['spaces', data.spaces], ['lists', data.lists], ['users', data.users]]
    : filter === 'game' || filter === 'anime' ? [['works', selectedItems]]
      : [[filter, selectedItems]]
  const hasVisibleResults = sections.some(([, items]) => items?.length > 0)
  const activeDescendant = previewOpen && activeIndex >= 0
    ? activeIndex === flatResults.length ? 'search-view-all' : `search-option-${activeIndex}`
    : undefined

  return <div className={`search-page${isResults ? ' results-page' : ''}`} ref={rootRef}>
    <SEO title="Busca tus aficiones" description="Encuentra obras, espacios, personas y listas en GeekSphere." />
    {isResults ? <div className="search-results-layout">
      <div className="search-results-main">
      <section className={`search-universal${previewOpen ? ' has-preview' : ''}`} aria-label="Búsqueda global">
        <SearchInput value={query} onChange={onInputChange} onFocus={() => setIsFocused(true)} onKeyDown={onInputKeyDown} inputRef={inputRef} resultsId="search-preview" isOpen={previewOpen} activeDescendant={activeDescendant} />
        {previewOpen && <Preview query={previewQuery} data={previewData} loading={previewLoading} error={Object.keys(previewData.errors || {}).length > 0} activeIndex={activeIndex} onSelect={() => setIsFocused(false)} onViewAll={viewAll} listRef={listRef} />}
      </section>
      <section className="search-results-content" aria-live="polite">
        <nav className="search-filters" aria-label="Filtrar resultados" style={{ '--filter-index': FILTERS.findIndex(item => item.id === filter), '--filter-count': FILTERS.length }}>
          {FILTERS.map(item => <button type="button" key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => { setResultsDraft(urlQuery); const next = new URLSearchParams(params); next.set('filter', item.id); if (urlQuery.trim()) next.set('q', urlQuery.trim()); setParams(next) }}>{item.label}</button>)}
        </nav>
        {urlQuery.trim().length < 2 ? <div className="search-full-empty"><span>⌕</span><h2>Empieza con dos letras o más</h2><p>Busca títulos, espacios y usuarios.</p></div>
          : loading && !data.works.length && !data.spaces.length && !data.users.length && !data.lists.length ? <SearchSkeleton />
            : Object.keys(data.errors || {}).length === 4 && !data.works.length && !data.spaces.length && !data.users.length && !data.lists.length ? <div className="search-full-empty"><span>!</span><h2>No se pudo completar la búsqueda</h2><p>Comprueba tu conexión e inténtalo de nuevo.</p></div>
              : <>
                {sections.map(([key, items]) => items?.length > 0 && <section className={`search-result-section ${key}`} data-result-category={key} key={key}>
                  <div className="search-section-heading"><div className="search-section-title"><h2>{CATEGORY_LABELS[key]}</h2><span className="search-section-count">{items.length}</span></div></div>
                  <div className="search-result-grid">{items.map(item => <ResultLink key={`${item.type || key}-${item.id}`} item={item} display={key === 'users' ? 'row' : 'card'} />)}</div>
                </section>)}
                {!loading && Object.keys(data.errors || {}).length > 0 && <p className="search-full-error">Algunos catálogos no respondieron. Los resultados disponibles siguen visibles.</p>}
                {!loading && !hasVisibleResults && <p className="search-no-results">Sin resultados para «{urlQuery}»</p>}
                {loading && <SearchSkeleton />}
              </>}
      </section>
      </div>
      <div className="search-landing-divider" aria-hidden="true" />
      <RecommendationSidebar userId={user?.id}/>
    </div> : <div className="search-landing-layout">
      <div className="search-landing-main">
        <section className={`search-universal${previewOpen ? ' has-preview' : ''}`} aria-label="Búsqueda global">
          <SearchInput value={query} onChange={onInputChange} onFocus={() => setIsFocused(true)} onKeyDown={onInputKeyDown} inputRef={inputRef} resultsId="search-preview" isOpen={previewOpen} activeDescendant={activeDescendant} />
          {previewOpen && <Preview query={previewQuery} data={previewData} loading={previewLoading} error={Object.keys(previewData.errors || {}).length > 0} activeIndex={activeIndex} onSelect={() => setIsFocused(false)} onViewAll={viewAll} listRef={listRef} />}
        </section>
        <section className="search-explore" aria-labelledby="explore-title">
          <div className="search-explore-heading"><div><h2 id="explore-title">EXPLORAR</h2></div></div>
          <div className="search-category-grid">
            <CategoryCard kind="anime" title="Animes" items={highlightData.anime} to="/discover/anime" />
            <CategoryCard kind="games" title="Juegos" items={highlightData.games} to="/discover/games" />
          </div>
        </section>
        <div className="search-spotlight-mobile-panel">
          <SpotlightRow kind="people" items={highlightData.users} loading={highlightsLoading}/>
          <SpotlightRow kind="spaces" items={highlightData.spaces} loading={highlightsLoading}/>
          <FeaturedListsMobile lists={featuredLists} loading={featuredListsLoading}/>
        </div>
        <FeaturedLists lists={featuredLists} loading={featuredListsLoading}/>
      </div>
      <div className="search-landing-divider" aria-hidden="true" />
      <RecommendationSidebar userId={user?.id}/>
    </div>}
  </div>
}
