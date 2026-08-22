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
                <div className="container header-content">
                    <Link to="/home" className="logo">
                        <img src="/icons/logo.png" alt="GeekSphere" className="logo-img" />
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
                            to="/library"
                            className={`nav-link ${isActive('/library') ? 'active' : ''}`}
                        >
                            Mi Biblioteca
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
                            to="/create-tierlist"
                            className={`nav-link ${isActive('/create-tierlist') ? 'active' : ''}`}
                        >
                            + Crear
                        </Link>
                    </nav>

                    {/* Mobile Navigation */}
                    <div className="mobile-nav-wrapper" ref={mobileNavRef}>
                        <button
                            className="hamburger-btn"
                            onClick={() => setMobileNavOpen(!mobileNavOpen)}
                            aria-label="Menú"
                        >
                            {mobileNavOpen ? '✕' : '☰'}
                        </button>

                        {mobileNavOpen && (
                            <nav className="nav-mobile-dropdown">

                                <Link
                                    to="/home"
                                    className={`mobile-nav-link ${isActive('/home') ? 'active' : ''}`}
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    🏠 Inicio
                                </Link>
                                <Link
                                    to="/library"
                                    className={`mobile-nav-link ${isActive('/library') ? 'active' : ''}`}
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    <img src="/icons/book.png" alt="📚" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '8px' }} /> Mi Biblioteca
                                </Link>
                                <Link
                                    to="/discover"
                                    className={`mobile-nav-link ${isActive('/discover') ? 'active' : ''}`}
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    <img src="/icons/lupa.png" alt="🔍" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '8px' }} /> Descubrir
                                </Link>
                                <Link
                                    to="/debates"
                                    className={`mobile-nav-link ${isActive('/debates') || location.pathname.startsWith('/debate') ? 'active' : ''}`}
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    <img src="/icons/dialog.png" alt="💬" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '8px' }} /> Debates
                                </Link>
                                <Link
                                    to="/create-tierlist"
                                    className={`mobile-nav-link ${isActive('/create-tierlist') ? 'active' : ''}`}
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    ➕ Crear Tierlist
                                </Link>
                                <Link
                                    to="/connections"
                                    className={`mobile-nav-link ${isActive('/connections') ? 'active' : ''}`}
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    <img src="/icons/wishlist.png" alt="🤝" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '8px' }} /> Conexiones
                                </Link>
                            </nav>
                        )}
                    </div>

                    <div className="header-actions">
                        {!user ? (
                            <div className="auth-buttons" style={{ display: 'flex', gap: '8px' }}>
                                <Link to="/login" className="btn btn-ghost" style={{ padding: '8px 16px' }}>Login</Link>
                                <Link to="/register" className="btn btn-primary" style={{ padding: '8px 16px' }}>Registro</Link>
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
                                        <img src="/icons/bell.png" alt="Notificaciones" style={{ width: '30px', height: '30px' }} />
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
                                    >
                                        {profile?.avatar_url ? (
                                            <img src={profile.avatar_url} alt="" className="user-avatar-sm" />
                                        ) : (
                                            <div className="user-avatar-sm user-avatar-placeholder">
                                                {profile?.display_name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        <span className="user-menu-arrow">{menuOpen ? '▲' : '▼'}</span>
                                    </button>

                                    {menuOpen && (
                                        <div className="dropdown-menu">
                                            <div className="dropdown-header">
                                                <span className="dropdown-name">{profile?.display_name}</span>
                                                <span className="dropdown-username">@{profile?.username}</span>
                                            </div>
                                            <div className="dropdown-divider"></div>
                                            <Link to="/library" className="dropdown-item">
                                                <img src="/icons/book.png" alt="📚" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Mi Biblioteca
                                            </Link>
                                            <Link to="/profile" className="dropdown-item">
                                                <img src="/icons/mushroom.png" alt="👤" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Mi perfil
                                            </Link>
                                            <Link to="/edit-profile" className="dropdown-item">
                                                <img src="/icons/gear.gif" alt="⚙️" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Editar perfil
                                            </Link>
                                            <div className="dropdown-divider"></div>
                                            <button className="dropdown-item dropdown-logout" onClick={handleSignOut}>
                                                🚪 Cerrar sesión
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
        </div>
    )
}
