import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SiKofi } from 'react-icons/si'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getVisibleAccentColor } from '../lib/colorContrast'
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
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function MoreMenu({ profile, image, username, accentColor, onSignOut }) {
  const [accountsOpen, setAccountsOpen] = useState(false)
  const displayName = profile?.display_name || username || 'Mi cuenta'
  if (accountsOpen) return <>
    <div className="more-submenu-heading">
      <button className="more-submenu-back" type="button" aria-label="Volver al menú" onClick={() => setAccountsOpen(false)}>
        <Icon name="arrow" />
      </button>
      <strong>Cuentas</strong>
    </div>
    <div className="more-submenu-divider" />
    <button className="more-current-account" type="button" aria-current="true" aria-label={`${displayName}, cuenta actual`}>
      {image ? <img src={image} alt="" /> : <span className="more-account-avatar-placeholder">{displayName[0]?.toUpperCase() || 'U'}</span>}
      <span className="more-account-copy"><strong>{displayName}</strong><small>@{username || 'usuario'}</small></span>
      <svg className="more-account-check" style={{ color: accentColor }} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
    </button>
    <nav className="more-menu-links more-account-actions" aria-label="Acciones de cuenta">
      <button className="more-menu-link" type="button" aria-disabled="true">Añadir cuenta</button>
      <button className="more-menu-link more-account-signout" type="button" onClick={onSignOut}>Cerrar sesión @{username || 'usuario'}</button>
    </nav>
  </>
  return <>
    <button className="more-account" type="button" aria-haspopup="true" aria-expanded="false" onClick={() => setAccountsOpen(true)}>
      {image ? <img src={image} alt="" /> : <span className="more-account-avatar-placeholder">{displayName[0]?.toUpperCase() || 'U'}</span>}
      <span className="more-account-copy"><strong>{displayName}</strong><small>@{username || 'usuario'}</small></span>
      <svg className="more-account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4-4 4 4M8 14l4 4 4-4"/></svg>
    </button>
    <nav className="more-menu-links" aria-label="Más opciones">
      <Link className="more-menu-link" to="/settings">Ajustes</Link>
      <button className="more-menu-link" type="button" aria-disabled="true">Guardados</button>
      <button className="more-menu-link" type="button" aria-disabled="true">Invitar</button>
      <button className="more-menu-link" type="button" aria-disabled="true">Términos</button>
      <button className="more-menu-link" type="button" aria-disabled="true">Normas</button>
      <a className="more-menu-link more-menu-support" href="https://ko-fi.com/mixel34" target="_blank" rel="noopener noreferrer" aria-label="Apoyar en Ko-fi (se abre en una pestaña nueva)">
        <SiKofi className="more-menu-kofi-icon" aria-hidden="true" />
        <span>Apoyar</span>
        <svg className="more-menu-external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>
      </a>
    </nav>
    <div className="more-menu-divider" />
    <button className="more-menu-signout" type="button" onClick={onSignOut}>Cerrar sesión <Icon name="logout"/></button>
  </>
}

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [registerSearchOpen, setRegisterSearchOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareClosing, setShareClosing] = useState(false)
  const [listsOpen, setListsOpen] = useState(false)
  const menuRef = useRef(null)
  const moreButtonRef = useRef(null)
  const moreMenuContentRef = useRef(null)
  const mobileNavRef = useRef(null)
  const mobileTopbarRef = useRef(null)
  const [moreMenuPosition, setMoreMenuPosition] = useState({ left: 256, bottom: 14 })
  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 960

  const openShareMenu = () => {
    if (!user) {
      navigate('/register')
      return
    }
    if (!profile) {
      navigate('/onboarding')
      return
    }
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
  const profilePath = username ? `/profile/${username}` : (user ? '/onboarding' : '/profile')
  const spacesPath = user && !profile ? '/onboarding' : '/spaces'
  const image = profile?.avatar_url || profile?.profile_picture || '/default-avatar.svg'
  const handleSignOut = async () => { setMoreOpen(false); await signOut(); navigate('/login') }
  const moreMenu = <MoreMenu profile={profile} image={image} username={username} accentColor={getVisibleAccentColor(profile?.theme_color || 'var(--brand-primary)')} onSignOut={handleSignOut} />
  const toggleMoreMenu = () => {
    if (moreOpen) { setMoreOpen(false); return }
    if (isDesktop && moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect()
      setMoreMenuPosition({ left: rect.left, bottom: window.innerHeight - rect.top + 10 })
    }
    setMoreOpen(true)
  }

  const loadUnread = useCallback(async () => {
    if (!user?.id) return
    const [allUnread, followUnread, followRows] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false).eq('type', 'follow'),
      supabase.from('notifications').select('actor_id').eq('user_id', user.id).eq('is_read', false).eq('type', 'follow').limit(1000),
    ])
    const uniqueFollowActors = new Set((followRows.data || []).map(row => row.actor_id).filter(Boolean)).size
    setUnreadCount(Math.max(0, (allUnread.count || 0) - (followUnread.count || 0) + uniqueFollowActors))
  }, [user?.id])

  useEffect(() => {
    setMoreOpen(false)
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
      const inMobileTopbar = mobileTopbarRef.current?.contains(event.target)
      const inMoreMenu = menuRef.current?.contains(event.target) || moreMenuContentRef.current?.contains(event.target)
      if (!inMobileNav && !inMobileTopbar && !inMoreMenu) setMoreOpen(false)
    }
    const handleEscape = event => { if (event.key === 'Escape') { setMoreOpen(false); closeShareMenu() } }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('pointerdown', handlePointer); document.removeEventListener('keydown', handleEscape) }
  }, [])

  const active = path => location.pathname === path || (path !== '/home' && location.pathname.startsWith(path))
  const isAuthEntry = location.pathname === '/login' || location.pathname === '/register'
  const isProfilePage = location.pathname === '/profile' || /^\/profile\/[^/]+$/.test(location.pathname)
  const isWorkPage = /^\/(game|anime)\/[^/]+(\/reviews)?$/.test(location.pathname)
  const mobileNavIndex = shareOpen ? 2 : active('/home') ? 0 : active('/search') ? 1 : active('/spaces') ? 3 : -1

  return (
    <div className="layout" style={{ '--profile-theme-color': profile?.theme_color || 'var(--brand-primary)', '--profile-accent-visible': getVisibleAccentColor(profile?.theme_color || 'var(--brand-primary)') }}>
      <aside className="app-sidebar" aria-label="Navegación principal">
        <Link className="sidebar-brand" to="/home" aria-label="GeekSphere, inicio">
          <span className="sidebar-brand-mark"><img src="/icons/logo.png" alt="" onError={event => { event.currentTarget.style.display = 'none' }} /></span>
          <span className="sidebar-brand-name">GeekSphere</span>
        </Link>

        <div className={`sidebar-top-space ${!user ? 'guest-sidebar-top-space' : ''}`} />
        {!user ? (
          <>
            <nav className="sidebar-nav guest-sidebar-nav" aria-label="Navegación para visitantes">
              <Link className={`sidebar-link ${active('/home') ? 'active current-page' : ''}`} to="/home" aria-current={active('/home') ? 'page' : undefined}><Icon name="home"/><span>Inicio</span></Link>
              <Link className={`sidebar-link ${active('/search') ? 'active current-page' : ''}`} to="/search" aria-current={active('/search') ? 'page' : undefined}><Icon name="search"/><span>Buscar</span></Link>
              <Link className={`sidebar-link ${isAuthEntry ? 'active current-page' : ''}`} to="/register" aria-current={isAuthEntry ? 'page' : undefined}><Icon name="user"/><span>Únete</span></Link>
            </nav>
          </>
        ) : <>
        <nav className="sidebar-nav">
          <Link className={`sidebar-link ${active('/home') ? 'active current-page' : ''}`} to="/home" aria-label="Inicio" aria-current={active('/home') ? 'page' : undefined}><Icon name="home"/><span className="sidebar-label" style={active('/home') ? { fontWeight: 800 } : undefined}>Inicio</span></Link>
          <Link className={`sidebar-link ${active('/spaces') ? 'active current-page' : ''}`} to={spacesPath} aria-label="Espacios" aria-current={active('/spaces') ? 'page' : undefined}><Icon name="spaces"/><span className="sidebar-label" style={active('/spaces') ? { fontWeight: 800 } : undefined}>Espacios</span></Link>
          <Link className={`sidebar-link ${active('/search') ? 'active current-page' : ''}`} to="/search" aria-label="Buscar" aria-current={active('/search') ? 'page' : undefined}><Icon name="search"/><span>Buscar</span></Link>
          <button className="sidebar-link" type="button" aria-label="Compartir" onClick={openShareMenu}><Icon name="share"/><span>Compartir</span></button>
          <Link className={`sidebar-link ${active('/activity') ? 'active current-page' : ''}`} to="/activity" aria-label="Actividad" aria-current={active('/activity') ? 'page' : undefined}>
            <Icon name="activity"/><span>Actividad</span>{unreadCount > 0 && <span className="sidebar-unread">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Link>
        </nav>

        <Link className={`sidebar-link sidebar-profile ${isProfilePage ? 'active current-page' : ''}`} to={profilePath} aria-label="Mi perfil" aria-current={isProfilePage ? 'page' : undefined}>
          {image ? <img className="sidebar-avatar" src={image} alt=""/> : <span className="sidebar-avatar sidebar-avatar-placeholder">{username?.[0]?.toUpperCase() || 'U'}</span>}
          <span className="sidebar-label" style={isProfilePage ? { fontWeight: 800 } : undefined}>Mi perfil</span>
        </Link>
        <div className="sidebar-bottom-space" />
        <div className="sidebar-popover-anchor more-anchor" ref={menuRef}>
          <button ref={moreButtonRef} className="sidebar-link more-link" type="button" aria-label="Más" aria-expanded={moreOpen} onClick={toggleMoreMenu}><Icon name="more"/><span>Más</span></button>
          {moreOpen && !isDesktop && <section className="sidebar-popover more-popover" aria-label="Más opciones">{moreMenu}</section>}
        </div>
        </>}
      </aside>

      <header className="mobile-topbar" ref={mobileTopbarRef}>
        <Link className="mobile-brand" to="/home" aria-label="GeekSphere, inicio">
          <img src="/icons/logo.png" alt="" />
          <span>GeekSphere</span>
        </Link>
        <div className="mobile-topbar-actions">
          {user && <div className="mobile-topbar-anchor">
            <Link className={`mobile-topbar-button ${active('/activity') ? 'active' : ''}`} to="/activity" aria-label="Notificaciones" aria-current={active('/activity') ? 'page' : undefined}>
              <Icon name="activity" />
              {unreadCount > 0 && <i className="mobile-topbar-unread-dot" />}
            </Link>
          </div>}
          {user && <div className="mobile-topbar-anchor">
            <button className={`mobile-topbar-button ${moreOpen ? 'active' : ''}`} type="button" aria-label="Abrir menú" aria-expanded={moreOpen} onClick={toggleMoreMenu}><Icon name="more"/></button>
            {moreOpen && <section className="sidebar-popover mobile-topbar-popover mobile-topbar-menu" aria-label="Menú">{moreMenu}</section>}
          </div>}
        </div>
      </header>

      <nav className="mobile-bottom-nav" ref={mobileNavRef} aria-label="Navegación principal">
        {!user ? <div className="guest-mobile-actions">
          <Link to="/home" aria-label="Inicio"><Icon name="home"/><span>Inicio</span></Link>
          <Link to="/search" aria-label="Buscar"><Icon name="search"/><span>Buscar</span></Link>
          <Link className={isAuthEntry ? 'active' : ''} aria-current={isAuthEntry ? 'page' : undefined} to="/register"><Icon name="user"/><span>Únete</span></Link>
        </div> : <>
        <div className="mobile-nav-dock">
          {mobileNavIndex >= 0 && <span className="mobile-nav-indicator" style={{ '--active-index': mobileNavIndex }} aria-hidden="true" />}
          <Link className={`mobile-nav-item ${active('/home') ? 'active' : ''}`} to="/home" aria-label="Inicio" aria-current={active('/home') ? 'page' : undefined}><Icon name="home"/></Link>
          <Link className={`mobile-nav-item ${active('/search') ? 'active' : ''}`} to="/search" aria-label="Buscar" aria-current={active('/search') ? 'page' : undefined} onClick={() => setMoreOpen(false)}><Icon name="search"/></Link>
          <button className={`mobile-nav-item mobile-share-item ${shareOpen ? 'active' : ''}`} type="button" aria-label="Compartir" aria-pressed={shareOpen} onClick={() => { openShareMenu(); setMoreOpen(false) }}><Icon name="share"/></button>
          <Link className={`mobile-nav-item ${active('/spaces') ? 'active' : ''}`} to={spacesPath} aria-label="Espacios" aria-current={active('/spaces') ? 'page' : undefined}><Icon name="spaces"/></Link>
        </div>
        <Link className={`mobile-profile-link ${isProfilePage ? 'active' : ''}`} to={profilePath} aria-label="Mi perfil" aria-current={isProfilePage ? 'page' : undefined}>
          {image ? <img className="mobile-nav-avatar" src={image} alt=""/> : <span className="mobile-nav-avatar mobile-nav-avatar-placeholder">{username?.[0]?.toUpperCase() || 'U'}</span>}
        </Link>
        </>}
      </nav>

      <main className={`main ${location.pathname === '/onboarding' ? 'onboarding-main' : ''} ${isProfilePage ? 'profile-main' : ''} ${isWorkPage ? 'work-main' : ''} ${location.pathname.startsWith('/discover/anime') || location.pathname.startsWith('/discover/games') ? 'discover-works-main' : ''} ${location.pathname === '/discover/spaces' || location.pathname === '/spaces/explore' ? 'spaces-explore-main' : ''} ${location.pathname === '/spaces' ? 'my-spaces-main' : ''} ${/^\/reviews\/[^/]+/.test(location.pathname) ? 'review-detail-main' : ''}`}><Outlet /></main>

      {shareOpen && <div className={`fullscreen-create-overlay ${shareClosing ? 'closing' : ''}`} onClick={() => closeShareMenu()}>
        <button className="close-fullscreen" aria-label="Cerrar" onClick={event => { event.stopPropagation(); closeShareMenu() }}>&times;</button>
        <div className="fullscreen-create-content" onClick={event => event.stopPropagation()}>
          <h2 className="create-glow-title">Crear Nuevo...</h2>
          <button className="create-huge-btn" type="button" onClick={() => closeShareMenu(() => setRegisterSearchOpen(true))}>
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
      <GlobalSearchModal isOpen={registerSearchOpen} onClose={() => setRegisterSearchOpen(false)} />
      {listsOpen && <ListsEntryModal onClose={() => setListsOpen(false)} />}
      {moreOpen && isDesktop && createPortal(
        <section ref={moreMenuContentRef} className="sidebar-popover more-popover more-popover-desktop" style={moreMenuPosition} aria-label="Más opciones">
          {moreMenu}
        </section>,
        document.body
      )}
    </div>
  )
}
