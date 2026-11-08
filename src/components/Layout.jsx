import { createPostgresChannel } from '../lib/postgresChannel'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SiKofi } from 'react-icons/si'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getAccentTextColor, getVisibleAccentColor } from '../lib/colorContrast'
import { hasCustomAvatar } from '../lib/avatar'
import { ListsEntryModal } from '../pages/lists/ListsEntry'
import DefaultAvatar from './DefaultAvatar'
import InstallApp from './InstallApp'
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

function MoreMenu({ profile, image, username, accentColor, onSignOut, accounts = [], userId, onSwitchAccount, onAddAccount, switchingAccountId }) {
  const [accountsOpen, setAccountsOpen] = useState(false)
  const displayName = profile?.display_name || username || 'Mi cuenta'
  const accountCount = new Set([...accounts.map(account => account.id), userId].filter(Boolean)).size
  const canAddAccount = accountCount < 3
  if (accountsOpen) return <>
    <div className="more-submenu-heading">
      <button className="more-submenu-back" type="button" aria-label="Volver al menú" onClick={() => setAccountsOpen(false)}>
        <Icon name="arrow" />
      </button>
      <strong>Cuentas</strong>
    </div>
    <div className="more-submenu-divider" />
    <button className={`more-current-account ${switchingAccountId === userId ? 'is-switching' : ''}`} type="button" aria-current="true" aria-busy={switchingAccountId === userId} aria-label={`${displayName}, cuenta actual`}>
      {image ? <img src={image} alt="" /> : <DefaultAvatar className="more-account-avatar-placeholder" accent={profile?.theme_color} />}
      <span className="more-account-copy"><strong>{displayName}</strong><small>@{username || 'usuario'}</small></span>
      {switchingAccountId === userId
        ? <span className="more-account-loading-spinner" role="status" aria-label="Cambiando de cuenta" />
        : <svg className="more-account-check" style={{ color: accentColor }} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
    </button>
    {accounts.filter(account => account.id !== userId).map(account => {
      const savedProfile = account.profile
      const savedName = savedProfile?.display_name || savedProfile?.username || account.email || 'Cuenta'
      const savedUsername = savedProfile?.username
      const savedImage = (hasCustomAvatar(savedProfile?.avatar_url) && savedProfile.avatar_url) || (hasCustomAvatar(savedProfile?.profile_picture) && savedProfile.profile_picture) || null
      const isSwitching = account.id === switchingAccountId
      return <button key={account.id} className={`more-current-account ${isSwitching ? 'is-switching' : ''}`} type="button" onClick={() => onSwitchAccount(account.id)} aria-label={`Cambiar a ${savedName}`} aria-busy={isSwitching}>
        {savedImage ? <img src={savedImage} alt="" /> : <DefaultAvatar className="more-account-avatar-placeholder" accent={savedProfile?.theme_color} />}
        <span className="more-account-copy"><strong>{savedName}</strong><small>{savedUsername ? `@${savedUsername}` : account.email}</small></span>
        {isSwitching && <span className="more-account-loading-spinner" role="status" aria-label="Cambiando de cuenta" />}
      </button>
    })}
    <nav className="more-menu-links more-account-actions" aria-label="Acciones de cuenta">
      <button className="more-menu-link" type="button" onClick={onAddAccount} disabled={!canAddAccount}>{canAddAccount ? 'Añadir cuenta' : 'Límite de cuentas alcanzado'}</button>
      {!canAddAccount && <small className="more-account-limit">Máximo 3 cuentas por navegador.</small>}
      <button className="more-menu-link more-account-signout" type="button" onClick={onSignOut}>Cerrar sesión @{username || 'usuario'}</button>
    </nav>
  </>
  return <>
    <button className="more-account" type="button" aria-haspopup="true" aria-expanded="false" onClick={() => setAccountsOpen(true)}>
      {image ? <img src={image} alt="" /> : <DefaultAvatar className="more-account-avatar-placeholder" accent={profile?.theme_color} />}
      <span className="more-account-copy"><strong>{displayName}</strong><small>@{username || 'usuario'}</small></span>
      <svg className="more-account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4-4 4 4M8 14l4 4 4-4"/></svg>
    </button>
    <nav className="more-menu-links" aria-label="Más opciones">
      <Link className="more-menu-link" to="/settings">Ajustes</Link>
      <button className="more-menu-link" type="button" aria-disabled="true">Guardados</button>
      <Link className="more-menu-link" to="/groups">Grupos</Link>
      <Link className="more-menu-link" to="/invite">Invitar</Link>
      <a className="more-menu-link more-menu-support" href="https://ko-fi.com/mixel34" target="_blank" rel="noopener noreferrer" aria-label="Apoyar en Ko-fi (se abre en una pestaña nueva)">
        <SiKofi className="more-menu-kofi-icon" aria-hidden="true" />
        <span>Apoyar</span>
        <svg className="more-menu-external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>
      </a>
    </nav>
    <div className="more-menu-divider" />
    <nav className="more-menu-legal-links" aria-label="Información legal">
      <Link to="/privacy">Privacidad</Link>
      <Link to="/terms">Términos</Link>
      <Link to="/community-guidelines">Normas de la comunidad</Link>
      <Link to="/credits">Créditos</Link>
    </nav>
  </>
}

export default function Layout() {
  const { user, profile, signOut, accounts, rememberCurrentAccount, switchAccount } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [switchingAccountId, setSwitchingAccountId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [listsOpen, setListsOpen] = useState(false)
  const menuRef = useRef(null)
  const moreButtonRef = useRef(null)
  const moreMenuContentRef = useRef(null)
  const mobileNavRef = useRef(null)
  const mobileTopbarRef = useRef(null)
  const [moreMenuPosition, setMoreMenuPosition] = useState({ left: 256, bottom: 14 })
  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 960

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)')
    const landscapeQuery = window.matchMedia('(orientation: landscape)')
    const updateOrientationLock = () => {
      const isInstalledPwa = standaloneQuery.matches || navigator.standalone === true
      document.body.classList.toggle('pwa-landscape-lock', isInstalledPwa && landscapeQuery.matches)
      if (isInstalledPwa) screen.orientation?.lock?.('portrait').catch(() => {})
    }
    updateOrientationLock()
    standaloneQuery.addEventListener?.('change', updateOrientationLock)
    landscapeQuery.addEventListener?.('change', updateOrientationLock)
    return () => {
      standaloneQuery.removeEventListener?.('change', updateOrientationLock)
      landscapeQuery.removeEventListener?.('change', updateOrientationLock)
      document.body.classList.remove('pwa-landscape-lock')
    }
  }, [])

  const username = profile?.username
  const profilePath = username ? `/profile/${username}` : (user ? '/onboarding' : '/profile')
  const spacesPath = user && !profile ? '/onboarding' : '/spaces'
  const image = (hasCustomAvatar(profile?.avatar_url) && profile.avatar_url) || (hasCustomAvatar(profile?.profile_picture) && profile.profile_picture) || null
  const handleSignOut = async () => { setMoreOpen(false); await signOut(); navigate('/login') }
  const addAccount = async () => {
    await rememberCurrentAccount()
    setMoreOpen(false)
    navigate('/login?addAccount=1')
  }
  const changeAccount = async accountId => {
    setSwitchingAccountId(accountId)
    try {
      const accountProfile = await switchAccount(accountId)
      const username = accountProfile?.username
      sessionStorage.setItem('geeksphere.account-switched-toast', username ? `@${username}` : '')
      window.location.assign(username ? `/profile/${encodeURIComponent(username)}` : '/onboarding')
    } catch (error) {
      console.error('No se pudo cambiar de cuenta:', error)
      setSwitchingAccountId(null)
    }
  }
  const moreMenu = <MoreMenu profile={profile} image={image} username={username} userId={user?.id} accounts={accounts} onSwitchAccount={changeAccount} onAddAccount={addAccount} switchingAccountId={switchingAccountId} accentColor={getVisibleAccentColor(profile?.theme_color || 'var(--brand-primary)')} onSignOut={handleSignOut} />
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
    const channel = createPostgresChannel(supabase, `sidebar-notifications-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadUnread).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadUnread])

  useEffect(() => {
    const handlePointer = event => {
      const inMobileNav = mobileNavRef.current?.contains(event.target)
      const inMobileTopbar = mobileTopbarRef.current?.contains(event.target)
      const inMoreMenu = menuRef.current?.contains(event.target) || moreMenuContentRef.current?.contains(event.target)
      if (!inMobileNav && !inMobileTopbar && !inMoreMenu) setMoreOpen(false)
    }
    const handleEscape = event => { if (event.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('pointerdown', handlePointer); document.removeEventListener('keydown', handleEscape) }
  }, [])

  const active = path => location.pathname === path || (path !== '/home' && location.pathname.startsWith(path))
  const isAuthEntry = ['/login', '/register', '/forgot-password', '/confirm-email', '/update-password'].includes(location.pathname)
  const isProfilePage = location.pathname === '/profile' || /^\/profile\/[^/]+$/.test(location.pathname)
  const isWorkPage = /^\/(game|anime)\/[^/]+(\/reviews)?$/.test(location.pathname)
  const mobileNavIndex = active('/home') ? 0 : active('/search') ? 1 : active('/share') ? 2 : active('/spaces') ? 3 : -1

  return (
    <div className="layout" style={{ '--profile-theme-color': profile?.theme_color || 'var(--brand-primary)', '--profile-accent-visible': getVisibleAccentColor(profile?.theme_color || '#14b8a6'), '--profile-accent-text': getAccentTextColor(profile?.theme_color || '#14b8a6') }}>
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
            <nav className="guest-legal-links" aria-label="Información legal">
              <Link to="/terms">Términos</Link><Link to="/privacy">Privacidad</Link><Link to="/community-guidelines">Normas</Link>
            </nav>
          </>
        ) : <>
        <nav className="sidebar-nav">
          <Link className={`sidebar-link ${active('/home') ? 'active current-page' : ''}`} to="/home" aria-label="Inicio" aria-current={active('/home') ? 'page' : undefined}><Icon name="home"/><span className="sidebar-label" style={active('/home') ? { fontWeight: 800 } : undefined}>Inicio</span></Link>
          <Link className={`sidebar-link ${active('/spaces') ? 'active current-page' : ''}`} to={spacesPath} aria-label="Espacios" aria-current={active('/spaces') ? 'page' : undefined}><Icon name="spaces"/><span className="sidebar-label" style={active('/spaces') ? { fontWeight: 800 } : undefined}>Espacios</span></Link>
          <Link className={`sidebar-link ${active('/search') ? 'active current-page' : ''}`} to="/search" aria-label="Buscar" aria-current={active('/search') ? 'page' : undefined}><Icon name="search"/><span>Buscar</span></Link>
          <Link className={`sidebar-link ${active('/share') ? 'active current-page' : ''}`} to="/share" aria-label="Compartir" aria-current={active('/share') ? 'page' : undefined}><Icon name="share"/><span>Compartir</span></Link>
          <Link className={`sidebar-link ${active('/activity') ? 'active current-page' : ''}`} to="/activity" aria-label="Actividad" aria-current={active('/activity') ? 'page' : undefined}>
            <Icon name="activity"/><span>Actividad</span>{unreadCount > 0 && <span className="sidebar-unread">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Link>
        </nav>

        <Link className={`sidebar-link sidebar-profile ${isProfilePage ? 'active current-page' : ''}`} to={profilePath} aria-label="Mi perfil" aria-current={isProfilePage ? 'page' : undefined}>
          {image ? <img className="sidebar-avatar" src={image} alt=""/> : <DefaultAvatar className="sidebar-avatar" accent={profile?.theme_color} />}
          <span className="sidebar-label" style={isProfilePage ? { fontWeight: 800 } : undefined}>Mi perfil</span>
        </Link>
        <div className="sidebar-bottom-space" />
        <div className="sidebar-popover-anchor more-anchor" ref={menuRef}>
          <button ref={moreButtonRef} className="sidebar-link more-link" type="button" aria-label="Más" aria-expanded={moreOpen} onClick={toggleMoreMenu}><Icon name="more"/><span>Más</span></button>
          {moreOpen && !isDesktop && <section className="sidebar-popover more-popover" aria-label="Más opciones">{moreMenu}</section>}
        </div>
        </>}
        <InstallApp className="sidebar-install" />
      </aside>

      <header className="mobile-topbar" ref={mobileTopbarRef}>
        <Link className="mobile-brand" to="/home" aria-label="GeekSphere, inicio">
          <img src="/icons/logo.png" alt="" />
          <span>GeekSphere</span>
        </Link>
        <div className="mobile-topbar-actions">
          <InstallApp className="topbar-install" />
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
          <Link className={`mobile-nav-item mobile-share-item ${active('/share') ? 'active' : ''}`} to="/share" aria-label="Compartir" aria-current={active('/share') ? 'page' : undefined} onClick={() => setMoreOpen(false)}><Icon name="share"/></Link>
          <Link className={`mobile-nav-item ${active('/spaces') ? 'active' : ''}`} to={spacesPath} aria-label="Espacios" aria-current={active('/spaces') ? 'page' : undefined}><Icon name="spaces"/></Link>
        </div>
        <Link className={`mobile-profile-link ${isProfilePage ? 'active' : ''}`} to={profilePath} state={{ fromBottomNav: true }} aria-label="Mi perfil" aria-current={isProfilePage ? 'page' : undefined}>
          {image ? <img className="mobile-nav-avatar" src={image} alt=""/> : <DefaultAvatar className="mobile-nav-avatar" accent={profile?.theme_color} />}
        </Link>
        </>}
      </nav>

      <main className={`main ${['/terms', '/privacy', '/community-guidelines'].includes(location.pathname) ? 'legal-main' : ''} ${location.pathname === '/onboarding' ? 'onboarding-main' : ''} ${location.pathname === '/invite' ? 'invite-main' : ''} ${isProfilePage ? 'profile-main' : ''} ${isWorkPage ? 'work-main' : ''} ${location.pathname.startsWith('/discover/anime') || location.pathname.startsWith('/discover/games') ? 'discover-works-main' : ''} ${location.pathname === '/discover/spaces' || location.pathname === '/spaces/explore' ? 'spaces-explore-main' : ''} ${location.pathname === '/spaces' ? 'my-spaces-main' : ''} ${/^\/reviews\/[^/]+/.test(location.pathname) ? 'review-detail-main' : ''} ${/^\/posts\/[^/]+$/.test(location.pathname) ? 'post-detail-main' : ''} ${/^\/lists\/[^/]+$/.test(location.pathname) ? 'list-detail-main' : ''} ${location.pathname === '/share' ? 'share-main' : ''}`}><Outlet /></main>

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
