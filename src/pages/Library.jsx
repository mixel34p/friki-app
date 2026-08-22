import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import './Library.css'

const STATUSES = [
    { id: 'playing', label: 'Jugando/Viendo', color: '#3b82f6', emoji: <img src="/icons/play.png" alt="▶️" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} /> },
    { id: 'completed', label: 'Terminado', color: '#10b981', emoji: <img src="/icons/check.png" alt="✅" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} /> },
    { id: 'backlog', label: 'Pendiente', color: '#f59e0b', emoji: <img src="/icons/checklist.png" alt="📋" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} /> },
    { id: 'dropped', label: 'Abandonado', color: '#ef4444', emoji: <img src="/icons/cross.png" alt="❌" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} /> },
    { id: 'wishlist', label: 'Wishlist', color: '#8b5cf6', emoji: <img src="/icons/wishlist.png" alt="💜" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} /> }
]

export default function Library() {
    const { username } = useParams()
    const { user, profile: myProfile, updateProfile } = useAuth()

    // State for viewing other libraries
    const [viewProfile, setViewProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Derived state - handle case when viewing other's library without being logged in
    const isOwner = user && myProfile && (!username || username === myProfile.username)
    const currentProfile = isOwner ? myProfile : viewProfile

    // UI State
    const [activeMediaType, setActiveMediaType] = useState('game') // 'game' | 'anime'
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)

    // Get current library based on media type
    const library = activeMediaType === 'game'
        ? (currentProfile?.library || [])
        : (currentProfile?.anime_library || [])

    const privacy = currentProfile?.library_privacy || 'public'

    // Load profile if viewing someone else's library
    useEffect(() => {
        // If no username provided and user is logged in with profile, use their own
        if (!username && user && myProfile) {
            setLoading(false)
            return
        }

        // If no username and not logged in, error
        if (!username && !user) {
            setError('Debes iniciar sesión para ver tu biblioteca')
            setLoading(false)
            return
        }

        // If username matches current user's profile, use own
        if (username && myProfile && username === myProfile.username) {
            setLoading(false)
            return
        }

        const fetchProfile = async () => {
            setLoading(true)
            setError(null)
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single()

                if (error) throw error
                // Basic privacy check handled in UI for now
                if (data.library_privacy === 'private') {
                    setError('Esta biblioteca es privada.')
                } else {
                    setViewProfile(data)
                }
            } catch (err) {
                console.error(err)
                setError('Perfil no encontrado o error al cargar.')
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [username, user, myProfile])

    // Search logic (only for owner)
    useEffect(() => {
        if (!isOwner) return
        const timeoutId = setTimeout(async () => {
            if (searchQuery.trim().length >= 3) {
                setIsSearching(true)
                let results = []
                if (activeMediaType === 'game') {
                    results = await searchGames(searchQuery)
                } else {
                    results = await searchAnime(searchQuery)
                }
                setSearchResults(results)
                setIsSearching(false)
            } else {
                setSearchResults([])
            }
        }, 500)
        return () => clearTimeout(timeoutId)
    }, [searchQuery, isOwner, activeMediaType])

    const addItem = async (item, status = 'backlog') => {
        if (!isOwner) return

        try {
            // Check duplication
            const exists = library.find(i => i.id === item.id.toString())
            if (exists) {
                alert('Este ítem ya está en tu biblioteca')
                return
            }

            const newEntry = {
                id: item.id.toString(),
                title: item.name || item.title, // Handle game vs anime property differences
                image_url: item.image_url || item.cover_url,
                status,
                rating: null,
                added_at: new Date().toISOString()
            }

            const newLibrary = [...library, newEntry]

            const updateData = activeMediaType === 'game'
                ? { library: newLibrary }
                : { anime_library: newLibrary }

            await updateProfile(updateData)
            setSearchQuery('')
            setShowAddModal(false)
        } catch (error) {
            console.error('Add item error:', error)
            alert('Error al añadir. Posiblemente falta la columna anime_library en la base de datos. Ejecuta el SQL.')
        }
    }

    const updateItemStatus = async (itemId, newStatus) => {
        if (!isOwner) return
        const newLibrary = library.map(i =>
            i.id === itemId ? { ...i, status: newStatus } : i
        )

        const updateData = activeMediaType === 'game'
            ? { library: newLibrary }
            : { anime_library: newLibrary }

        await updateProfile(updateData)
    }

    const removeItem = async (itemId) => {
        if (!isOwner) return
        const newLibrary = library.filter(i => i.id !== itemId)

        const updateData = activeMediaType === 'game'
            ? { library: newLibrary }
            : { anime_library: newLibrary }

        await updateProfile(updateData)
    }

    const updatePrivacy = async (newPrivacy) => {
        if (!isOwner) return
        await updateProfile({ library_privacy: newPrivacy })
    }

    const filteredLibrary = activeFilter === 'all'
        ? library
        : library.filter(i => i.status === activeFilter)

    const getStatusInfo = (statusId) => STATUSES.find(s => s.id === statusId) || STATUSES[2]

    if (loading) return <div className="container loading-state">Cargando biblioteca...</div>

    if (error) {
        return (
            <div className="container error-state">
                <div className="error-banner">{error}</div>
                <Link to="/home" className="btn btn-secondary">Volver al inicio</Link>
            </div>
        )
    }

    if (!currentProfile) return null // Should not happen

    return (
        <div className="library-page">
            <div className="container">
                <div className="library-header">
                    <div>
                        <h1>
                            {isOwner ? 'Mi Biblioteca' : `Biblioteca de ${currentProfile.display_name}`}
                        </h1>
                        {!isOwner && (
                            <Link to={`/profile/${currentProfile.username}`} className="library-subtitle">
                                @{currentProfile.username}
                            </Link>
                        )}
                    </div>

                    <div className="header-actions-wrapper">
                        {/* Privacy control removed to avoid issues - libraries are public by default */}
                        {isOwner && (
                            <div className="header-actions">
                                {/* Using hidden input or just omitted */}
                            </div>
                        )}

                        {/* Media Type Toggle */}
                        <div className="media-toggle">
                            <button
                                className={`media-tab ${activeMediaType === 'game' ? 'active' : ''}`}
                                onClick={() => setActiveMediaType('game')}
                            >
                                <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Juegos
                            </button>
                            <button
                                className={`media-tab ${activeMediaType === 'anime' ? 'active' : ''}`}
                                onClick={() => setActiveMediaType('anime')}
                            >
                                <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Anime
                            </button>
                        </div>
                    </div>
                </div>

                {isOwner && (
                    <div className="floating-add-btn">
                        <button className="btn btn-primary btn-add-main" onClick={() => setShowAddModal(true)}>
                            + Añadir {activeMediaType === 'anime' ? 'Anime' : 'Juego'}
                        </button>
                    </div>
                )}

                {/* Status Filter Tabs */}
                <div className="status-tabs">
                    <button
                        className={`status-tab ${activeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveFilter('all')}
                    >
                        Todos ({library.length})
                    </button>
                    {STATUSES.map(status => {
                        const count = library.filter(i => i.status === status.id).length
                        if (count === 0 && !isOwner) return null // Hide empty tabs for visitors
                        return (
                            <button
                                key={status.id}
                                className={`status-tab ${activeFilter === status.id ? 'active' : ''}`}
                                onClick={() => setActiveFilter(status.id)}
                                style={{ '--tab-color': status.color }}
                            >
                                {status.emoji} <span>{status.label} ({count})</span>
                            </button>
                        )
                    })}
                </div>

                {/* Library Grid */}
                <div className="library-grid">
                    {filteredLibrary.map((item, index) => {
                        const statusInfo = getStatusInfo(item.status)
                        const imageUrl = item.image_url || item.cover_url
                        // Handle potential ID variations from legacy data
                        const safeId = item.id || item.game_id || item.anime_id || item.work_id
                        const safeTitle = item.title || item.name || 'Sin título'

                        // If no ID, we can't link, but we can still show the card
                        const CardWrapper = ({ children }) => safeId ? (
                            <Link
                                to={`/${activeMediaType}/${safeId}`}
                                className="library-card-link"
                                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                            >
                                {children}
                            </Link>
                        ) : (
                            <div className="library-card-link">{children}</div>
                        )

                        return (
                            <div key={safeId || index} className="library-card">
                                <div className="library-card-status" style={{ background: statusInfo.color }}>
                                    {statusInfo.emoji}
                                </div>
                                <CardWrapper>
                                    {imageUrl ? (
                                        <img src={imageUrl} alt={safeTitle} className="library-card-img" />
                                    ) : (
                                        <div className="library-card-placeholder">
                                            {activeMediaType === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '40px', height: '40px', opacity: 0.5 }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '40px', height: '40px', opacity: 0.5 }} />}
                                        </div>
                                    )}
                                    <div className="library-card-content">
                                        <h3 className="library-card-title">{safeTitle}</h3>
                                    </div>
                                </CardWrapper>

                                {isOwner && (
                                    <div className="library-card-controls">
                                        <select
                                            className="status-select"
                                            value={item.status}
                                            onChange={(e) => updateItemStatus(safeId, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {STATUSES.map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                removeItem(safeId)
                                            }}
                                        >
                                            Quitar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {filteredLibrary.length === 0 && (
                        <div className="library-empty">
                            <p>No tienes {activeMediaType === 'anime' ? 'animes' : 'juegos'} en esta categoría</p>
                            {isOwner && (
                                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                                    Añadir primer {activeMediaType === 'anime' ? 'Anime' : 'Juego'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Modal - Only for Owner */}
            {showAddModal && isOwner && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Añadir a Biblioteca ({activeMediaType === 'anime' ? 'Anime' : 'Juegos'})</h2>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <input
                                type="text"
                                className="input"
                                placeholder={`Buscar ${activeMediaType === 'anime' ? 'anime' : 'juego'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />

                            <div className="search-results">
                                {isSearching && <div className="loading">Buscando...</div>}

                                {searchResults.map(item => {
                                    const alreadyAdded = library.find(i => i.id === item.id.toString())
                                    return (
                                        <div key={item.id} className={`search-result ${alreadyAdded ? 'disabled' : ''}`}>
                                            {(item.image_url || item.cover_url) && (
                                                <img src={item.image_url || item.cover_url} alt="" className="result-img" />
                                            )}
                                            <div className="result-info">
                                                <span className="result-name">{item.name || item.title}</span>
                                                <span className="result-year">
                                                    {activeMediaType === 'game'
                                                        ? item.release_date?.substring(0, 4)
                                                        : item.start_date?.substring(0, 4)}
                                                </span>
                                            </div>
                                            {alreadyAdded ? (
                                                <span className="result-added">✓ Añadido</span>
                                            ) : (
                                                <div className="result-actions">
                                                    {STATUSES.slice(0, 3).map(s => (
                                                        <button
                                                            key={s.id}
                                                            className="add-status-btn"
                                                            style={{ background: s.color }}
                                                            onClick={() => addItem(item, s.id)}
                                                            title={s.label}
                                                        >
                                                            {s.emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
