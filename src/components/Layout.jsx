import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import GlobalSearchModal from './GlobalSearchModal'
import { ListsEntryModal } from '../pages/lists/ListsEntry'
import './Layout.css'

const Icon = ({ name }) => {
  const common = { width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h5v-7h4v7h5V9"/></>,
    reviews: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z"/>,
    spaces: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20z"/><path d="M16 5a3.5 3.5 0 0 1 0 6.8M18 14a5.5 5.5 0 0 1 3.5 5.1V20H19"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></>,
    share: <><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></>,
    activity: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    more: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    arrow: <><path d="m9 18 6-6-6-6"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function notificationTarget(item) {
  if (item.type === 'follow') return `/profile/${item.actor?.username}`
  if (item.type === 'like' || item.type === 'comment') return item.resource_id ? `/lists/${item.resource_id}` : '/home'
  if (item.type === 'connection_request') return '/connections?tab=requests'
  if (item.type === 'connection_accepted') return item.resource_id ? `/chat/${item.resource_id}` : '/chat'
  return '/home'
}

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareClosing, setShareClosing] = useState(false)
  const [listsOpen, setListsOpen] = useState(false)
  const menuRef = useRef(null)
  const activityRef = useRef(null)
  const mobileNavRef = useRef(null)

  const openShareMenu = () => {
    setShareClosing(false)
    setShareOpen(true)
  }

  const closeShareMenu = afterClose => {
    setShareClosing(true)
    window.setTimeout(() => {
      setShareOpen(false)
      setShareClosing(false)
      afterClose?.()
    }, 300)
  }

  const username = profile?.username
  const profilePath = username ? `/profile/${username}` : '/profile'
  const image = profile?.avatar_url || profile?.profile_picture

  const loadUnread = useCallback(async () => {
    if (!user?.id) return
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)
    setUnreadCount(count || 0)
  }, [user?.id])

  const openActivity = async () => {
    setActivityOpen(v => !v)
    setMoreOpen(false)
    if (activityOpen || !user?.id) return
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    const rows = data || []
    const actorIds = [...new Set(rows.map(row => row.actor_id).filter(Boolean))]
    let actors = {}
    if (actorIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', actorIds)
      actors = Object.fromEntries((profiles || []).map(actor => [actor.id, actor]))
    }
    setNotifications(rows.map(row => ({ ...row, actor: actors[row.actor_id] })))
    if (rows.some(row => !row.is_read)) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
      setUnreadCount(0)
    }
  }

  useEffect(() => {
    setMoreOpen(false)
    setActivityOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('createlist') === 'true') {
      setListsOpen(true)
      navigate(location.pathname, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    loadUnread()
    if (!user?.id) return undefined
    const channel = supabase.channel(`sidebar-notifications-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadUnread).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadUnread])

  useEffect(() => {
    const handlePointer = event => {
      const inMobileNav = mobileNavRef.current?.contains(event.target)
      if (!inMobileNav && menuRef.current && !menuRef.current.contains(event.target)) setMoreOpen(false)
      if (!inMobileNav && activityRef.current && !activityRef.current.contains(event.target)) setActivityOpen(false)
    }
    const handleEscape = event => { if (event.key === 'Escape') { setMoreOpen(false); setActivityOpen(false); closeShareMenu() } }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('pointerdown', handlePointer); document.removeEventListener('keydown', handleEscape) }
  }, [])

  const active = path => location.pathname === path || (path !== '/home' && location.pathname.startsWith(path))
  const isProfilePage = location.pathname === '/profile' || /^\/profile\/[^/]+$/.test(location.pathname)
  const isWorkPage = /^\/(game|anime)\/[^/]+(\/reviews)?$/.test(location.pathname)

  return (
    <div className="layout" style={{ '--profile-theme-color': profile?.theme_color || 'var(--brand-primary)' }}>
      <aside className="app-sidebar" aria-label="Navegación principal">
        <Link className="sidebar-brand" to="/home" aria-label="GeekSphere, inicio">
          <span className="sidebar-brand-mark"><img src="/icons/logo.png" alt="" onError={event => { event.currentTarget.style.display = 'none' }} /></span>
          <span className="sidebar-brand-name">GeekSphere</span>
        </Link>

        <div className="sidebar-top-space" />
        <nav className="sidebar-nav">
          <Link className={`sidebar-link ${active('/home') ? 'active current-page' : ''}`} to="/home" aria-label="Inicio" aria-current={active('/home') ? 'page' : undefined}><Icon name="home"/><span className="sidebar-label" style={active('/home') ? { fontWeight: 800 } : undefined}>Inicio</span></Link>
          <Link className={`sidebar-link ${active('/spaces') ? 'active current-page' : ''}`} to="/spaces" aria-label="Espacios" aria-current={active('/spaces') ? 'page' : undefined}><Icon name="spaces"/><span className="sidebar-label" style={active('/spaces') ? { fontWeight: 800 } : undefined}>Espacios</span></Link>
          <button className="sidebar-link" type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)}><Icon name="search"/><span>Buscar</span></button>
          <button className="sidebar-link" type="button" aria-label="Compartir" onClick={openShareMenu}><Icon name="share"/><span>Compartir</span></button>
          <div className="sidebar-popover-anchor" ref={activityRef}>
            <button className={`sidebar-link ${activityOpen ? 'active' : ''}`} type="button" aria-label="Actividad" aria-expanded={activityOpen} onClick={openActivity}>
              <Icon name="activity"/><span>Actividad</span>{unreadCount > 0 && <span className="sidebar-unread">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {activityOpen && <section className="sidebar-popover activity-popover" aria-label="Actividad reciente">
              <div className="popover-heading"><strong>Actividad</strong><button type="button" aria-label="Cerrar" onClick={() => setActivityOpen(false)}><Icon name="close"/></button></div>
              {notifications.length ? notifications.map(item => <Link className="activity-row" key={item.id} to={notificationTarget(item)} onClick={() => setActivityOpen(false)}>
                {item.actor?.avatar_url ? <img src={item.actor.avatar_url} alt=""/> : <span className="activity-avatar">{item.actor?.username?.[0]?.toUpperCase() || '•'}</span>}
                <span><b>{item.actor?.username || 'Alguien'}</b> {item.message || item.type?.replaceAll('_', ' ') || 'ha interactuado contigo'}<small>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</small></span>
              </Link>) : <p className="popover-empty">No hay actividad reciente.</p>}
            </section>}
          </div>
        </nav>

        <Link className={`sidebar-link sidebar-profile ${isProfilePage ? 'active current-page' : ''}`} to={profilePath} aria-label="Mi perfil" aria-current={isProfilePage ? 'page' : undefined}>
          {image ? <img className="sidebar-avatar" src={image} alt=""/> : <span className="sidebar-avatar sidebar-avatar-placeholder">{username?.[0]?.toUpperCase() || 'U'}</span>}
          <span className="sidebar-label" style={isProfilePage ? { fontWeight: 800 } : undefined}>Mi perfil</span>
        </Link>
        <div className="sidebar-bottom-space" />
        <div className="sidebar-popover-anchor more-anchor" ref={menuRef}>
          <button className={`sidebar-link more-link ${moreOpen ? 'active' : ''}`} type="button" aria-label="Más" aria-expanded={moreOpen} onClick={() => { setMoreOpen(v => !v); setActivityOpen(false) }}><Icon name="more"/><span>Más</span></button>
          {moreOpen && <section className="sidebar-popover more-popover" aria-label="Más opciones">
            <Link className="more-option" to={profilePath} onClick={() => setMoreOpen(false)}>Mi perfil <Icon name="arrow"/></Link>
            <Link className="more-option" to="/profile?edit=true" onClick={() => setMoreOpen(false)}>Editar perfil <Icon name="arrow"/></Link>
            <button className="more-option" type="button" onClick={async () => { setMoreOpen(false); await signOut(); navigate('/login') }}>Cerrar sesión <Icon name="logout"/></button>
          </section>}
        </div>
      </aside>

      <header className="mobile-topbar">
        <Link className="mobile-brand" to="/home" aria-label="GeekSphere, inicio">
          <img src="/icons/logo.png" alt="" />
          <span>GeekSphere</span>
        </Link>
      </header>

      <nav className="mobile-bottom-nav" ref={mobileNavRef} aria-label="Navegación principal">
        <Link className={`mobile-nav-item ${active('/home') ? 'active' : ''}`} to="/home" aria-label="Inicio"><Icon name="home"/><span>Inicio</span></Link>
        <Link className={`mobile-nav-item ${active('/spaces') ? 'active' : ''}`} to="/spaces" aria-label="Espacios"><Icon name="spaces"/><span>Espacios</span></Link>
        <button className="mobile-nav-item" type="button" aria-label="Buscar" onClick={() => { setSearchOpen(true); setActivityOpen(false); setMoreOpen(false) }}><Icon name="search"/><span>Buscar</span></button>
        <button className="mobile-nav-item mobile-share-item" type="button" aria-label="Compartir" onClick={() => { openShareMenu(); setActivityOpen(false); setMoreOpen(false) }}><Icon name="share"/><span>Compartir</span></button>
        <div className="mobile-nav-anchor">
          <button className={`mobile-nav-item ${activityOpen ? 'active' : ''}`} type="button" aria-label="Actividad" aria-expanded={activityOpen} onClick={openActivity}>
            <Icon name="activity"/><span>Actividad</span>{unreadCount > 0 && <i className="mobile-unread-dot"/>}
          </button>
          {activityOpen && <section className="sidebar-popover mobile-action-popover" aria-label="Actividad reciente">
            <div className="popover-heading"><strong>Actividad</strong><button type="button" aria-label="Cerrar" onClick={() => setActivityOpen(false)}><Icon name="close"/></button></div>
            {notifications.length ? notifications.map(item => <Link className="activity-row" key={item.id} to={notificationTarget(item)} onClick={() => setActivityOpen(false)}>
              {item.actor?.avatar_url ? <img src={item.actor.avatar_url} alt=""/> : <span className="activity-avatar">{item.actor?.username?.[0]?.toUpperCase() || '•'}</span>}
              <span><b>{item.actor?.username || 'Alguien'}</b> {item.message || item.type?.replaceAll('_', ' ') || 'ha interactuado contigo'}<small>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</small></span>
            </Link>) : <p className="popover-empty">No hay actividad reciente.</p>}
          </section>}
        </div>
        <Link className={`mobile-nav-item ${active('/profile') && !location.pathname.endsWith('/reviews') ? 'active' : ''}`} to="/profile" aria-label="Mi perfil">
          {image ? <img className="mobile-nav-avatar" src={image} alt=""/> : <span className="mobile-nav-avatar mobile-nav-avatar-placeholder">{username?.[0]?.toUpperCase() || 'U'}</span>}
          <span>Mi perfil</span>
        </Link>
        <div className="mobile-nav-anchor mobile-more-anchor">
          <button className={`mobile-nav-item ${moreOpen ? 'active' : ''}`} type="button" aria-label="Más" aria-expanded={moreOpen} onClick={() => { setMoreOpen(v => !v); setActivityOpen(false) }}><Icon name="more"/><span>Más</span></button>
          {moreOpen && <section className="sidebar-popover mobile-action-popover mobile-more-popover" aria-label="Más opciones">
            <Link className="more-option" to={profilePath} onClick={() => setMoreOpen(false)}>Mi perfil <Icon name="arrow"/></Link>
            <Link className="more-option" to="/profile?edit=true" onClick={() => setMoreOpen(false)}>Editar perfil <Icon name="arrow"/></Link>
            <button className="more-option" type="button" onClick={async () => { setMoreOpen(false); await signOut(); navigate('/login') }}>Cerrar sesión <Icon name="logout"/></button>
          </section>}
        </div>
      </nav>

      <main className={`main ${isProfilePage ? 'profile-main' : ''} ${isWorkPage ? 'work-main' : ''} ${location.pathname === '/spaces/explore' ? 'spaces-explore-main' : ''} ${location.pathname === '/spaces' ? 'my-spaces-main' : ''}`}><Outlet /></main>

      {shareOpen && <div className={`fullscreen-create-overlay ${shareClosing ? 'closing' : ''}`} onClick={() => closeShareMenu()}>
        <button className="close-fullscreen" aria-label="Cerrar" onClick={event => { event.stopPropagation(); closeShareMenu() }}>&times;</button>
        <div className="fullscreen-create-content" onClick={event => event.stopPropagation()}>
          <h2 className="create-glow-title">Crear Nuevo...</h2>
          <button className="create-huge-btn" type="button" onClick={() => closeShareMenu(() => setSearchOpen(true))}>
            <div className="huge-btn-bg game-bg" />
            <div className="huge-btn-content">
              <h3><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" className="icon-gradient"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>Registrar Obra</h3>
              <p>Busca y añade a tu diario</p>
            </div>
          </button>
          <button className="create-huge-btn" type="button" onClick={() => closeShareMenu(() => setListsOpen(true))}>
            <div className="huge-btn-bg tier-bg" />
            <div className="huge-btn-content">
              <h3><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" className="icon-gradient"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>Nueva Lista</h3>
              <p>Crea tu ranking, tier o grid</p>
            </div>
          </button>
        </div>
      </div>}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      {listsOpen && <ListsEntryModal onClose={() => setListsOpen(false)} />}
    </div>
  )
}
