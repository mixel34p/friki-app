import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSavedItems } from '../context/SavedItemsContext'
import { getSavedContent, mergeSavedItems } from '../lib/savedItemsService'
import { isStandalonePwa, navigatePwaRoute, navigateWorkBack, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import usePwaSettingsScreen from '../hooks/usePwaSettingsScreen'
import { useToast } from '../components/Toast'
import { savedHref } from '../lib/savedItemsPresentation'
import SEO from '../components/SEO'
import SavedMasonry from '../components/SavedMasonry'
import './SavedPage.css'

const EMPTY = []
const PAGE_SIZE = 24
const FILTERS = [{ id: 'all', label: 'Todo' }, { id: 'work', label: 'Obras' }, { id: 'post', label: 'Posts' }, { id: 'list', label: 'Listas' }, { id: 'review', label: 'Reviews' }]
function SavedPageContent() {
  const { user, profile, updateProfile } = useAuth()
  const { items, status, changeSaved, reload } = useSavedItems()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [isPwa] = useState(isStandalonePwa)
  const [managedMotion] = useState(() => Boolean(document.documentElement.dataset.pwaWorkDirection))
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [result, setResult] = useState(null)
  const cache = useRef(new Map())
  const [retry, setRetry] = useState(0)
  const [removing, setRemoving] = useState(null)
  const { toast } = useToast()
  usePwaSettingsScreen(isPwa)
  const filter = FILTERS.some(item => item.id === params.get('filter')) ? params.get('filter') : 'all'
  const entries = useMemo(() => mergeSavedItems(items, profile?.wishlist || EMPTY), [items, profile?.wishlist])
  const filtered = useMemo(() => filter === 'all' ? entries : entries.filter(entry => entry.type === filter), [entries, filter])
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit])
  const signature = `${user.id}:${visible.map(entry => `${entry.key}:${entry.created_at || ''}`).join(',')}`
  const current = result?.signature === signature ? result : null
  const open = useCallback(entry => navigatePwaRoute(navigate, savedHref(entry)), [navigate])
  useEffect(() => { signalPwaRouteReady(location.pathname) }, [location.pathname])
  useEffect(() => {
    const controller = new AbortController()
    const missing = visible.filter(entry => entry.type !== 'work' && !cache.current.has(entry.key))
    getSavedContent(missing, controller.signal).then(data => {
      if (controller.signal.aborted) return
      for (const entry of data) cache.current.set(entry.key, entry)
      setResult({ signature, items: visible.map(entry => entry.type === 'work' ? entry : cache.current.get(entry.key)) })
    }).catch(() => { if (!controller.signal.aborted) setResult({ signature, error: true }) })
    return () => controller.abort()
  }, [visible, signature, retry])
  const remove = async entry => {
    if (removing) return
    setRemoving(entry.key)
    try {
      if (entry.type === 'work') {
        await updateProfile({ wishlist: (profile?.wishlist || EMPTY).filter(item => !(item.type === entry.workType && String(item.id) === String(entry.targetId))) })
      } else await changeSaved(entry.type, entry.targetId, false)
      toast({ title: entry.type === 'work' ? 'Obra quitada de la wishlist' : 'Quitado de guardados', type: 'success' })
    } catch { toast({ title: 'No se pudo quitar el guardado. Inténtalo de nuevo.', type: 'error' }) }
    finally { setRemoving(null) }
  }
  const page = <div className={`saved-page${isPwa ? ` saved-page--pwa${managedMotion ? '' : ' saved-page-enter'}` : ''}`}>
    <SEO title="Guardados" description="Tus posts, listas, reviews y obras pendientes en un mismo lugar." />
    <div className="saved-page-inner">
      <header className="saved-page-header">{isPwa && <button type="button" className="saved-icon-button" onClick={() => navigateWorkBack(navigate, '/home')} aria-label="Volver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}<h1>Guardados</h1></header>
      <nav className="saved-filters" aria-label="Tipo de guardado">{FILTERS.map(item => <button key={item.id} type="button" className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => { setLimit(PAGE_SIZE); setParams(item.id === 'all' ? {} : { filter: item.id }, { replace: true }) }}>{item.label}<span>{item.id === 'all' ? entries.length : entries.filter(entry => entry.type === item.id).length}</span></button>)}</nav>
      {status === 'error' && <div className="saved-state saved-state--error" role="alert"><p>No se pudieron cargar tus publicaciones guardadas. Tu wishlist sigue disponible.</p><button type="button" onClick={reload}>Reintentar</button></div>}
      {status === 'loading' || !current ? <div className="saved-grid" role="status" aria-label="Cargando guardados">{[0,1,2,3,4,5].map(index => <div className="saved-skeleton" key={index} />)}</div> : current.error ? <div className="saved-state" role="alert"><p>No se pudo cargar el contenido guardado.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : !filtered.length ? <div className="saved-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z" /></svg><h2>{filter === 'all' ? 'Todavía no has guardado nada' : `Todavía no has guardado ${FILTERS.find(item => item.id === filter).label.toLowerCase()}`}</h2><p>Guarda publicaciones para volver a ellas cuando quieras. Las obras de tu wishlist también aparecerán aquí.</p></div> : <><SavedMasonry items={current.items} onOpen={open} onRemove={remove} removing={removing} />{filtered.length > limit && <button type="button" className="saved-load-more" onClick={() => setLimit(value => value + PAGE_SIZE)}>Ver más guardados</button>}</>}
    </div>
  </div>
  return isPwa ? createPortal(page, document.body) : page
}
export default function SavedPage() {
  const { user } = useAuth()
  return user ? <SavedPageContent key={user.id} /> : null
}
