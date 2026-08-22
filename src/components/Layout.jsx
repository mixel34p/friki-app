import { useState, useRef, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

    // Close menus on route change
    useEffect(() => {
        setMenuOpen(false)
        setNotifOpen(false)
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
    const mobileNavRef = useRef(null)

    const handleSignOut = async () => {
        setMenuOpen(false)
        await signOut()
    }

    // Close mobile nav on click outside
    useEffect(() => {
        const handleClickOutsideMobileNav = (e) => {
            if (mobileNavRef.current && !mobileNavRef.current.contains(e.target)) {
                setMobileNavOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutsideMobileNav)
        return () => document.removeEventListener('mousedown', handleClickOutsideMobileNav)
    }, [])

    // Close mobile nav on route change
    useEffect(() => {
        setMobileNavOpen(false)
    }, [location])

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
                            to="/debates"
                            className={`nav-link ${isActive('/debates') || location.pathname.startsWith('/debate') ? 'active' : ''}`}
                        >
                            Debates
                        </Link>
                        <Link
                            to="/library"
                            className={`nav-link ${isActive('/library') ? 'active' : ''}`}
                        >
                            Biblioteca
                        </Link>
                        <Link
                            to="/create-tierlist"
                            className="create-btn-pill"
                        >
                            + Nueva lista
                        </Link>
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
                                        <div className="dropdown-menu">
                                            <div className="dropdown-header">
                                                <span className="dropdown-name">{profile?.display_name}</span>
                                                <span className="dropdown-username">@{profile?.username}</span>
                                            </div>
                                            <div className="dropdown-divider"></div>
                                            <Link to="/library" className="dropdown-item">
                                                <img src="/icons/book.png" alt="" style={{ width: '16px', height: '16px' }} /> Mi Biblioteca
                                            </Link>
                                            <Link to="/profile" className="dropdown-item">
                                                <img src="/icons/mushroom.png" alt="" style={{ width: '16px', height: '16px' }} /> Mi perfil
                                            </Link>
                                            <Link to="/edit-profile" className="dropdown-item">
                                                <img src="/icons/gear.gif" alt="" style={{ width: '16px', height: '16px' }} /> Editar perfil
                                            </Link>
                                            <div className="dropdown-divider"></div>
                                            <button className="dropdown-item dropdown-logout" onClick={handleSignOut}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Cerrar sesión
                                            </button>
                                        </div>
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
                <Link to="/create-tierlist" className="bottom-nav-item bottom-nav-fab">
                    <div className="fab-inner">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                </Link>
                <Link to="/debates" className={`bottom-nav-item ${isActive('/debates') || location.pathname.startsWith('/debate') ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </Link>
                <Link to="/library" className={`bottom-nav-item ${isActive('/library') ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                </Link>
            </nav>
        </div>
    )
}
