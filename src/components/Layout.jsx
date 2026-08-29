import { useState, useRef, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GlobalSearchModal from './GlobalSearchModal'
import { ListsEntryModal } from '../pages/lists/ListsEntry'
import { supabase } from '../lib/supabase'
import './Layout.css'

export default function Layout() {
    const { user, profile, signOut } = useAuth()
    const location = useLocation()

    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)

    const [notifOpen, setNotifOpen] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const notifRef = useRef(null)

    const isActive = (path) => location.pathname === path

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false)
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close menus on route change and check for modal trigger
    useEffect(() => {
        setMenuOpen(false)
        setNotifOpen(false)
        setMobileNavOpen(false)
        
        const searchParams = new URLSearchParams(location.search)
        if (searchParams.get('createlist') === 'true') {
            setListsEntryModalOpen(true)
            window.history.replaceState({}, '', location.pathname)
        }
    }, [location])

    // Fetch notifications count
    useEffect(() => {
        if (!user) return

        const fetchCount = async () => {
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('read', false)

            setUnreadCount(count || 0)
        }

        fetchCount()

        // Subscribe to new notifications
        const subscription = supabase
            .channel('public:notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, () => {
                setUnreadCount(prev => prev + 1)
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [user])

    // Load notifications when opening panel
    useEffect(() => {
        if (notifOpen && user) {
            loadNotifications()
        }
    }, [notifOpen, user])

    const loadNotifications = async () => {
        // Fetch notifications (raw)
        const { data: rawNotifs, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) {
            console.error("Error fetching notifications:", error)
            return
        }

        if (!rawNotifs || rawNotifs.length === 0) {
            setNotifications([])
            return
        }

        // Manually fetch actors to avoid FK issues
        const actorIds = [...new Set(rawNotifs.map(n => n.actor_id).filter(Boolean))]

        let actorsMap = {}
        if (actorIds.length > 0) {
            const { data: actors } = await supabase
                .from('profiles')
                .select('user_id, username, display_name, avatar_url')
                .in('user_id', actorIds)

            if (actors) {
                actors.forEach(a => {
                    actorsMap[a.user_id] = a
                })
            }
        }

        // Join
        const enrichedNotifs = rawNotifs.map(n => ({
            ...n,
            actor: actorsMap[n.actor_id] || { display_name: 'Usuario', username: 'unknown' }
        }))

        setNotifications(enrichedNotifs)

        // Mark as read
        if (unreadCount > 0) {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false)

            setUnreadCount(0)
        }
    }

    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [createModalClosing, setCreateModalClosing] = useState(false)
    const [searchModalOpen, setSearchModalOpen] = useState(false)
    const [listsEntryModalOpen, setListsEntryModalOpen] = useState(false)

    const closeCreateModal = () => {
        setCreateModalClosing(true)
        setTimeout(() => {
            setCreateModalOpen(false)
            setCreateModalClosing(false)
        }, 300)
    }

    const mobileNavRef = useRef(null)

    const handleSignOut = async () => {
        setMenuOpen(false)
        await signOut()
    }

    // Prevent body scrolling when drawer is open (mobile & PC)
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [menuOpen])

    return (
        <div className="layout">
            <header className="header">
                <div className="header-content" style={{ padding: '0 5%' }}>
                    {/* Logo */}
                    <Link to="/home" className="logo">
                        <img src="/icons/logo.png" alt="GeekSphere" className="logo-img" />
                        <span className="logo-text">GeekSphere</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="nav nav-desktop">
                        <Link
                            to="/home"
                            className={`nav-link ${isActive('/home') ? 'active' : ''}`}
                        >
                            Inicio
                        </Link>
                        <Link
                            to="/discover"
                            className={`nav-link ${isActive('/discover') ? 'active' : ''}`}
                        >
                            Descubrir
                        </Link>
                        <Link
                            to="/spaces"
                            className={`nav-link ${isActive('/spaces') || location.pathname.startsWith('/spaces') ? 'active' : ''}`}
                        >
                            Espacios
                        </Link>
                        <Link
                            to="/library"
                            className={`nav-link ${isActive('/library') ? 'active' : ''}`}
                        >
                            Biblioteca
                        </Link>
                        <button 
                            className="create-btn-pill"
                            onClick={() => setCreateModalOpen(true)}
                        >
                            + Crear
                        </button>
                    </nav>

                    {/* Header Actions */}
                    <div className="header-actions">
                        {!user ? (
                            <div className="auth-buttons">
                                <Link to="/login" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 'var(--text-sm)' }}>Entrar</Link>
                                <Link to="/register" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 'var(--text-sm)' }}>Registro</Link>
                            </div>
                        ) : (
                            <>
                                {/* Notifications */}
                                <div className="notif-wrapper" ref={notifRef}>
                                    <button
                                        className="notif-btn"
                                        onClick={() => setNotifOpen(!notifOpen)}
                                        title="Notificaciones"
                                    >
                                        {/* Bell SVG */}
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                        </svg>
                                        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                                    </button>

                                    {notifOpen && (
                                        <div className="notif-dropdown">
                                            <div className="notif-header">Notificaciones</div>
                                            <div className="notif-list">
                                                {notifications.length === 0 ? (
                                                    <div className="notif-empty">Sin notificaciones nuevas</div>
                                                ) : (
                                                    notifications.map(notif => {
                                                        let linkTo = `/profile/${notif.actor?.username}`
                                                        let text = 'interactuó contigo'

                                                        if (notif.type === 'follow') {
                                                            text = 'comenzó a seguirte'
                                                        } else if (notif.type === 'like') {
                                                            text = 'le dio ❤️ a tu tierlist'
                                                            if (notif.resource_id) linkTo = `/tierlist/${notif.resource_id}`
                                                        } else if (notif.type === 'comment') {
                                                            if (notif.resource_id) linkTo = `/tierlist/${notif.resource_id}`
                                                        } else if (notif.type === 'connection_request') {
                                                            text = 'te envió una solicitud de conexión'
                                                            linkTo = '/connections?tab=requests'
                                                        } else if (notif.type === 'connection_accepted') {
                                                            text = 'aceptó tu solicitud de conexión'
                                                            linkTo = `/chat/${notif.resource_id}`
                                                        }

                                                        return (
                                                            <Link
                                                                key={notif.id}
                                                                to={linkTo}
                                                                className={`notif-item ${!notif.read ? 'unread' : ''}`}
                                                                onClick={() => setNotifOpen(false)}
                                                            >
                                                                <div className="notif-avatar">
                                                                    {notif.actor?.avatar_url ? (
                                                                        <img src={notif.actor.avatar_url} alt="" />
                                                                    ) : (
                                                                        <div className="notif-avatar-placeholder">
                                                                            {notif.actor?.display_name?.charAt(0) || '?'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="notif-content">
                                                                    <span className="notif-text">
                                                                        <strong>{notif.actor?.display_name}</strong> {text}
                                                                    </span>
                                                                    <span className="notif-date">
                                                                        {new Date(notif.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            </Link>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* User Menu */}
                                <div className="user-menu" ref={menuRef}>
                                    <button
                                        className="user-menu-btn"
                                        onClick={() => setMenuOpen(!menuOpen)}
                                        title={profile?.display_name}
                                    >
                                        {profile?.avatar_url ? (
                                            <img src={profile.avatar_url} alt="" className="user-avatar-sm" />
                                        ) : (
                                            <div className="user-avatar-sm user-avatar-placeholder">
                                                {profile?.display_name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        <span className="user-menu-name">{profile?.display_name}</span>
                                    </button>

                                    {menuOpen && (
                                        <>
                                            <div className="drawer-overlay" onClick={() => setMenuOpen(false)}></div>
                                            <div className="dropdown-menu">
                                                <div className="dropdown-header">
                                                    {profile?.avatar_url ? (
                                                        <img src={profile.avatar_url} alt="" className="dropdown-avatar-lg" />
                                                    ) : (
                                                        <div className="dropdown-avatar-lg user-avatar-placeholder">
                                                            {profile?.display_name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <div className="dropdown-user-info">
                                                        <span className="dropdown-name">{profile?.display_name}</span>
                                                        <span className="dropdown-username">@{profile?.username}</span>
                                                    </div>
                                                </div>
                                                                                        <div className="dropdown-body">
                                                    <Link to="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                        Ver perfil
                                                    </Link>
                                                    <Link to="/profile?edit=true" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                                        Configuración
                                                    </Link>

                                                    <div className="dropdown-divider"></div>
                                                    
                                                    <div className="dropdown-footer">
                                                        <button className="dropdown-item dropdown-logout" onClick={handleSignOut}>
                                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Cerrar sesión
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="main">
                <Outlet />
            </main>

            {/* Bottom Nav for Mobile (Only visible on max-width 768px) */}
            <nav className="bottom-nav">
                <Link to="/home" className={`bottom-nav-item ${isActive('/home') ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </Link>
                <Link to="/discover" className={`bottom-nav-item ${isActive('/discover') ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                </Link>
                <button onClick={() => setCreateModalOpen(true)} className="bottom-nav-item bottom-nav-fab" style={{ background: 'none', border: 'none', padding: 0 }}>
                    <div className="fab-inner">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                </button>
                <Link to="/spaces" className={`bottom-nav-item ${isActive('/spaces') || location.pathname.startsWith('/spaces') ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </Link>

                <Link to="/library" className={`bottom-nav-item ${isActive('/library') ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                </Link>
            </nav>

            {createModalOpen && (
                <div className={`fullscreen-create-overlay ${createModalClosing ? 'closing' : ''}`} onClick={closeCreateModal}>
                    <button className="close-fullscreen" onClick={closeCreateModal}>&times;</button>
                    <div className="fullscreen-create-content" onClick={e => e.stopPropagation()}>
                        <h2 className="create-glow-title">Crear Nuevo...</h2>
                        
                        <button 
                            className="create-huge-btn" 
                            onClick={() => { closeCreateModal(); setSearchModalOpen(true); }}
                        >
                            <div className="huge-btn-bg game-bg"></div>
                            <div className="huge-btn-content">
                                <h3><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" className="icon-gradient"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Registrar Obra</h3>
                                <p>Busca y añade a tu diario</p>
                            </div>
                        </button>

                        <button 
                            className="create-huge-btn" 
                            onClick={() => { closeCreateModal(); setListsEntryModalOpen(true); }}
                        >
                            <div className="huge-btn-bg tier-bg"></div>
                            <div className="huge-btn-content">
                                <h3><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" className="icon-gradient"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> Nueva Lista</h3>
                                <p>Crea tu ranking, tier o grid</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
            
            <GlobalSearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
            
            {listsEntryModalOpen && (
                <ListsEntryModal onClose={() => setListsEntryModalOpen(false)} standalone={false} />
            )}
        </div>
    )
}
