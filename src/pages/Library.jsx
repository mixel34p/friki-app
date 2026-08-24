import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import { getUserReview } from '../lib/reviewService'
import QuickReviewModal from '../components/reviews/QuickReviewModal'
import './Library.css'

const STATUSES = [
    { id: 'playing', label: 'Jugando/Viendo', color: 'var(--status-playing, #3b82f6)' },
    { id: 'completed', label: 'Terminado', color: 'var(--status-completed, #22c55e)' },
    { id: 'backlog', label: 'Pendiente', color: 'var(--status-backlog, #f59e0b)' },
    { id: 'dropped', label: 'Abandonado', color: 'var(--status-dropped, #ef4444)' },
    
]

const StarRating = ({ rating, onChange }) => {
    const [hover, setHover] = useState(0);
    return (
        <div className="star-rating" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(star => (
                <svg
                    key={star}
                    width="20" height="20" viewBox="0 0 24 24"
                    fill={(hover || rating) >= star ? '#fbbf24' : 'transparent'}
                    stroke="#fbbf24" strokeWidth="2"
                    onMouseEnter={() => setHover(star)}
                    onClick={() => onChange(star)}
                    style={{ cursor: 'pointer' }}
                >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
        </div>
    )
}

export default function Library() {
    const { username } = useParams()
    const { user, profile: myProfile, updateProfile } = useAuth()

    const [viewProfile, setViewProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const isOwner = user && myProfile && (!username || username === myProfile.username)
    const currentProfile = isOwner ? myProfile : viewProfile

    const [searchParams] = useSearchParams()
    
    const [activeMediaType, setActiveMediaType] = useState('game')
    const [activeFilter, setActiveFilter] = useState(() => searchParams.get('status') || 'all')
    const [viewMode, setViewMode] = useState('grid') // grid | list
    const [sortBy, setSortBy] = useState('recent') // recent | title | rating
    const [ratingFilter, setRatingFilter] = useState('all') // all | rated | unrated
    
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    
    const [reviewedIds, setReviewedIds] = useState(new Set())
    
    const [reviewModalData, setReviewModalData] = useState(null)

    const library = activeMediaType === 'game'
        ? (currentProfile?.library || [])
        : (currentProfile?.anime_library || [])

    // Load profile
    useEffect(() => {
        if (!username && user && myProfile) {
            setLoading(false)
            return
        }
        if (!username && !user) {
            setError('Debes iniciar sesiÃ³n para ver tu biblioteca')
            setLoading(false)
            return
        }
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

    // Load reviewed works
    const fetchReviewedIds = async () => {
        if (!currentProfile) return
        const { data, error } = await supabase
            .from('reviews')
            .select('work_id')
            .eq('user_id', currentProfile.user_id)
            .eq('work_type', activeMediaType)
        if (!error && data) {
            setReviewedIds(new Set(data.map(r => r.work_id)))
        }
    }

    useEffect(() => {
        if (!loading) {
            fetchReviewedIds()
        }
    }, [activeMediaType, currentProfile, loading])

    // Search logic
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

    const addItem = async (item, status = 'backlog', rating = null) => {
        if (!isOwner) return

        try {
            const exists = library.find(i => i.id === item.id.toString())
            if (exists) {
                alert('Este ítem ya está en tu biblioteca')
                return
            }

            const newEntry = {
                id: item.id.toString(),
                title: item.name || item.title,
                image_url: item.image_url || item.cover_url,
                status,
                rating,
                added_at: new Date().toISOString()
            }

            const newLibrary = [...library, newEntry]
            const updateData = activeMediaType === 'game'
                ? { library: newLibrary }
                : { anime_library: newLibrary }
                
            // Remove from wishlist if present
            if (myProfile.wishlist) {
                const wishlistIndex = myProfile.wishlist.findIndex(i => i.id === item.id.toString() && i.type === activeMediaType);
                if (wishlistIndex >= 0) {
                    const newWishlist = [...myProfile.wishlist];
                    newWishlist.splice(wishlistIndex, 1);
                    updateData.wishlist = newWishlist;
                }
            }

            await updateProfile(updateData)
            setSearchQuery('')
            setShowAddModal(false)
        } catch (error) {
            console.error('Add item error:', error)
            alert('Error al añadir.')
        }
    }

    const updateItemStatus = async (itemId, newStatus) => {
        if (!isOwner) return
        const newLibrary = library.map(i =>
            i.id === itemId ? { ...i, status: newStatus } : i
        )
        const updateData = activeMediaType === 'game' ? { library: newLibrary } : { anime_library: newLibrary }
        await updateProfile(updateData)
    }

    const updateItemRating = async (itemId, newRating) => {
        if (!isOwner) return
        const newLibrary = library.map(i =>
            i.id === itemId ? { ...i, rating: newRating } : i
        )
        const updateData = activeMediaType === 'game' ? { library: newLibrary } : { anime_library: newLibrary }
        await updateProfile(updateData)
    }

    const removeItem = async (itemId) => {
        if (!isOwner) return
        const newLibrary = library.filter(i => i.id !== itemId)
        const updateData = activeMediaType === 'game' ? { library: newLibrary } : { anime_library: newLibrary }
        await updateProfile(updateData)
    }

    const openReviewModal = async (item) => {
        const safeId = item.id || item.game_id || item.anime_id || item.work_id
        const safeTitle = item.title || item.name || 'Sin tÃ­tulo'
        
        let existingReview = null
        try {
            existingReview = await getUserReview(safeId, activeMediaType, currentProfile.user_id)
        } catch(e) {
            console.error(e)
        }

        setReviewModalData({
            workId: safeId,
            workType: activeMediaType,
            workTitle: safeTitle,
            imageUrl: item.image_url || item.cover_url,
            existingReview
        })
    }

    const onReviewSaved = () => {
        setReviewModalData(null)
        fetchReviewedIds()
    }

    // Filtering and Sorting
    let processedLibrary = activeFilter === 'all'
        ? library
        : library.filter(i => i.status === activeFilter)

    if (ratingFilter === 'rated') {
        processedLibrary = processedLibrary.filter(i => i.rating > 0)
    } else if (ratingFilter === 'unrated') {
        processedLibrary = processedLibrary.filter(i => !i.rating)
    }

    processedLibrary = [...processedLibrary].sort((a, b) => {
        if (sortBy === 'recent') {
            return new Date(b.added_at || 0) - new Date(a.added_at || 0)
        } else if (sortBy === 'title') {
            const titleA = a.title || a.name || ''
            const titleB = b.title || b.name || ''
            return titleA.localeCompare(titleB)
        } else if (sortBy === 'rating') {
            return (b.rating || 0) - (a.rating || 0)
        }
        return 0
    })

    const getStatusInfo = (statusId) => STATUSES.find(s => s.id === statusId) || STATUSES[2]

    // Compute average rating
    const ratedItems = library.filter(i => i.rating > 0)
    const avgRating = ratedItems.length > 0 
        ? (ratedItems.reduce((acc, i) => acc + i.rating, 0) / ratedItems.length).toFixed(1)
        : 0

    if (loading) return <div className="container loading-state">Cargando biblioteca...</div>

    if (error) {
        return (
            <div className="container error-state">
                <div className="error-banner">{error}</div>
                <Link to="/home" className="btn btn-secondary">Volver al inicio</Link>
            </div>
        )
    }

    if (!currentProfile) return null

    return (
        <div className="library-page">
            <div className="container">
                {/* Header Row */}
                <div className="library-header">
                    <div>
                        <h1>
                            {isOwner ? 'Mi Biblioteca' : `Biblioteca de ${currentProfile.display_name}`}
                        </h1>
                        {!isOwner && (
                            <Link to={`/profile/${currentProfile.username}`} className="library-subtitle" style={{ color: 'var(--text-muted)' }}>
                                @{currentProfile.username}
                            </Link>
                        )}
                        <div className="lib-stats-line" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {library.length} {activeMediaType === 'game' ? 'juegos' : 'animes'} Â· {avgRating}â­ promedio
                        </div>
                    </div>

                    <div className="library-controls-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="lib-media-toggle" style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '999px', padding: '4px' }}>
                            <button
                                className={`media-pill ${activeMediaType === 'game' ? 'active' : ''}`}
                                onClick={() => setActiveMediaType('game')}
                                style={{ padding: '6px 16px', borderRadius: '999px', border: 'none', background: activeMediaType === 'game' ? 'var(--bg-card)' : 'transparent', color: activeMediaType === 'game' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}
                            >
                                Juegos
                            </button>
                            <button
                                className={`media-pill ${activeMediaType === 'anime' ? 'active' : ''}`}
                                onClick={() => setActiveMediaType('anime')}
                                style={{ padding: '6px 16px', borderRadius: '999px', border: 'none', background: activeMediaType === 'anime' ? 'var(--bg-card)' : 'transparent', color: activeMediaType === 'anime' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}
                            >
                                Anime
                            </button>
                        </div>

                        <div className="lib-view-toggle" style={{ display: 'flex', gap: '4px' }}>
                            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Vista Grid">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                            <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Vista Lista">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                        </div>

                        {isOwner && (
                            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                                + AÃ±adir
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="lib-filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                    <div className="lib-filter-tabs" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
                        <button
                            className={`lib-filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('all')}
                        >
                            Todos
                        </button>
                        {STATUSES.map(status => {
                            const isActive = activeFilter === status.id
                            return (
                                <button
                                    key={status.id}
                                    className={`lib-filter-tab ${isActive ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(status.id)}
                                    style={{ '--tab-color': status.color }}
                                >
                                    {status.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="lib-sort-filters" style={{ display: 'flex', gap: '0.5rem' }}>
                        <select className="input lib-sort-select" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.9rem' }}>
                            <option value="all">Rating: Todos</option>
                            <option value="rated">Con rating</option>
                            <option value="unrated">Sin rating</option>
                        </select>
                        <select className="input lib-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.9rem' }}>
                            <option value="recent">MÃ¡s reciente</option>
                            <option value="title">TÃ­tulo A-Z</option>
                            <option value="rating">Mayor rating</option>
                        </select>
                    </div>
                </div>

                {/* Library Content */}
                {processedLibrary.length === 0 ? (
                    <div className="lib-empty-state" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                        <p>No se encontraron resultados en esta categorÃ­a.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="covers-grid">
                        {processedLibrary.map((item, index) => {
                            const safeId = item.id || item.game_id || item.anime_id || item.work_id
                            const safeTitle = item.title || item.name || 'Sin tÃ­tulo'
                            const imageUrl = item.image_url || item.cover_url
                            const statusInfo = getStatusInfo(item.status)
                            const hasReview = reviewedIds.has(String(safeId))
                            
                            return (
                                <div key={safeId || index} className="cover-cell">
                                    {imageUrl ? (
                                        <img src={imageUrl} alt={safeTitle} className="cover-img" loading="lazy" />
                                    ) : (
                                        <div className="cover-placeholder" style={{ background: 'linear-gradient(to bottom right, var(--bg-card), var(--bg-tertiary))', width: '100%', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '2rem', opacity: 0.2 }}>?</span>
                                        </div>
                                    )}
                                    
                                    <div className="cover-status-dot" style={{ backgroundColor: statusInfo.color }} title={statusInfo.label}></div>
                                    
                                    {hasReview && (
                                        <div className="cover-review-indicator" title="Tiene reseÃ±a">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </div>
                                    )}

                                    <div className="cover-overlay">
                                        <div className="cover-overlay-content">
                                            <Link to={`/${activeMediaType}/${safeId}`} style={{ color: 'white', textDecoration: 'none' }}>
                                                <h3 className="overlay-title">{safeTitle}</h3>
                                            </Link>
                                            
                                            <div className="overlay-stars" style={{ display: 'flex', color: '#fbbf24', margin: '4px 0' }}>
                                                {item.rating > 0 && Array.from({ length: 5 }).map((_, i) => (
                                                    <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < item.rating ? 'currentColor' : 'transparent'} stroke="currentColor" strokeWidth="2">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                ))}
                                            </div>

                                            {isOwner && (
                                                <div className="overlay-actions" onClick={e => e.stopPropagation()}>
                                                    <select 
                                                        className="overlay-select-status"
                                                        value={item.status}
                                                        onChange={e => updateItemStatus(safeId, e.target.value)}
                                                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '2px', fontSize: '0.7rem', width: '100%', marginBottom: '4px' }}
                                                    >
                                                        {STATUSES.map(s => (
                                                            <option key={s.id} value={s.id}>{s.label}</option>
                                                        ))}
                                                    </select>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button 
                                                            className="overlay-icon-btn" 
                                                            onClick={() => openReviewModal(item)}
                                                            title="Escribir/Ver reseÃ±a"
                                                            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px', padding: '4px', cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center' }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                        </button>
                                                        <button 
                                                            className="overlay-icon-btn" 
                                                            onClick={() => removeItem(safeId)}
                                                            title="Eliminar"
                                                            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="list-view" style={{ display: 'flex', flexDirection: 'column' }}>
                        {processedLibrary.map((item, index) => {
                            const safeId = item.id || item.game_id || item.anime_id || item.work_id
                            const safeTitle = item.title || item.name || 'Sin tÃ­tulo'
                            const imageUrl = item.image_url || item.cover_url
                            const statusInfo = getStatusInfo(item.status)
                            const hasReview = reviewedIds.has(String(safeId))
                            
                            return (
                                <div key={safeId || index} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <img src={imageUrl || '/icons/videogame.png'} alt="" style={{ width: '48px', height: '64px', objectFit: 'cover', borderRadius: '4px', background: 'var(--bg-tertiary)' }} />
                                    
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Link to={`/${activeMediaType}/${safeId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 'bold', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {safeTitle}
                                        </Link>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '999px', background: statusInfo.color + '33', color: statusInfo.color, fontWeight: 'bold' }}>
                                                {statusInfo.label}
                                            </span>
                                            {item.rating > 0 && (
                                                <span style={{ fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center' }}>
                                                    {item.rating} <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '2px' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {isOwner && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button 
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => openReviewModal(item)}
                                                style={{ padding: '0.5rem' }}
                                                title={hasReview ? "Editar reseÃ±a" : "AÃ±adir reseÃ±a"}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasReview ? "var(--brand-primary)" : "currentColor"} strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                            </button>
                                            <select 
                                                className="input"
                                                value={item.status}
                                                onChange={e => updateItemStatus(safeId, e.target.value)}
                                                style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Add Item Modal */}
            {showAddModal && isOwner && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal lib-add-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
                        <div className="modal-header">
                            <h2>AÃ±adir a {activeMediaType === 'game' ? 'Juegos' : 'Anime'}</h2>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>Ã—</button>
                        </div>
                        <div className="modal-body">
                            <input
                                type="text"
                                className="input"
                                placeholder="Buscar tÃ­tulo..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />

                            <div className="search-results" style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem', maxHeight: '50vh', overflowY: 'auto' }}>
                                {isSearching && <div className="loading" style={{ textAlign: 'center', padding: '2rem' }}>Buscando...</div>}

                                {searchResults.map(item => {
                                    const alreadyAdded = library.find(i => i.id === item.id.toString())
                                    return (
                                        <div key={item.id} className="search-result-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                            <img src={item.image_url || item.cover_url || '/icons/videogame.png'} alt="" style={{ width: '56px', height: '75px', objectFit: 'cover', borderRadius: '4px' }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold' }}>{item.name || item.title}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {activeMediaType === 'game'
                                                        ? item.release_date?.substring(0, 4)
                                                        : item.start_date?.substring(0, 4)}
                                                </div>
                                            </div>
                                            {alreadyAdded ? (
                                                <div style={{ color: 'var(--brand-primary)', fontWeight: 'bold', fontSize: '0.9rem', padding: '0 1rem' }}>En biblioteca</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {STATUSES.map(s => (
                                                            <button
                                                                key={s.id}
                                                                title={s.label}
                                                                onClick={() => addItem(item, s.id)}
                                                                style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: s.color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem' }}
                                                            >
                                                                {s.label.charAt(0)}
                                                            </button>
                                                        ))}
                                                    </div>
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

            {/* Quick Review Modal */}
            {reviewModalData && (
                <QuickReviewModal
                    {...reviewModalData}
                    onClose={() => setReviewModalData(null)}
                    onSaved={onReviewSaved}
                />
            )}
        </div>
    )
}

