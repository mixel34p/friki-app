import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDebates, DEBATE_TYPES } from '../lib/debateService'
import { supabase } from '../lib/supabase'
import DebateCard from '../components/debates/DebateCard'
import LoadingSpinner from '../components/LoadingSpinner'
import './Debates.css'

const LIMIT = 20

export default function Debates() {
    const [debates, setDebates] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(0)

    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedMedia, setSelectedMedia] = useState(null) // { id, name, media_type, cover_url }
    const [mediaSearchQuery, setMediaSearchQuery] = useState('')
    const [mediaResults, setMediaResults] = useState([])
    const [showMediaPicker, setShowMediaPicker] = useState(false)

    const [filter, setFilter] = useState({
        orderBy: 'recent',
        mediaType: null,
        debateType: null
    })

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Reset and reload when filters or search change
    useEffect(() => {
        setPage(0)
        setHasMore(true)
        loadDebates(true)
    }, [filter, debouncedSearch, selectedMedia])

    // Search media for picker
    useEffect(() => {
        if (mediaSearchQuery.length < 2) {
            setMediaResults([])
            return
        }

        const searchMedia = async () => {
            const [{ data: games }, { data: anime }] = await Promise.all([
                supabase
                    .from('games')
                    .select('id, name, cover_url')
                    .ilike('name', `%${mediaSearchQuery}%`)
                    .limit(5),
                supabase
                    .from('anime')
                    .select('id, title, image_url')
                    .ilike('title', `%${mediaSearchQuery}%`)
                    .limit(5)
            ])

            const results = [
                ...(games || []).map(g => ({ ...g, media_type: 'game' })),
                ...(anime || []).map(a => ({ id: a.id, name: a.title, cover_url: a.image_url, media_type: 'anime' }))
            ]
            setMediaResults(results)
        }

        const timer = setTimeout(searchMedia, 300)
        return () => clearTimeout(timer)
    }, [mediaSearchQuery])

    const loadDebates = async (reset = false) => {
        if (reset) {
            setLoading(true)
        } else {
            setLoadingMore(true)
        }

        try {
            const currentPage = reset ? 0 : page
            const data = await getDebates({
                orderBy: filter.orderBy,
                mediaType: filter.mediaType,
                debateType: filter.debateType,
                search: debouncedSearch,
                mediaId: selectedMedia?.id || null,
                offset: currentPage * LIMIT,
                limit: LIMIT
            })

            if (data.length < LIMIT) {
                setHasMore(false)
            }

            if (reset) {
                setDebates(data)
            } else {
                setDebates(prev => [...prev, ...data])
            }
        } catch (error) {
            console.error('Error loading debates:', error)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }

    const handleLoadMore = () => {
        const nextPage = page + 1
        setPage(nextPage)
        loadDebates(false)
    }

    const toggleMediaFilter = (type) => {
        setFilter(prev => ({
            ...prev,
            mediaType: prev.mediaType === type ? null : type
        }))
    }

    const toggleDebateType = (type) => {
        setFilter(prev => ({
            ...prev,
            debateType: prev.debateType === type ? null : type
        }))
    }

    const selectMedia = (media) => {
        setSelectedMedia(media)
        setShowMediaPicker(false)
        setMediaSearchQuery('')
        setMediaResults([])
    }

    const clearMediaFilter = () => {
        setSelectedMedia(null)
    }

    return (
        <div className="debates-page">
            <div className="container">
                {/* Header */}
                <div className="debates-header">
                    <h1>Debates</h1>
                    <Link to="/debates/create" className="btn btn-primary">
                        ✍️ Crear debate
                    </Link>
                </div>

                {/* Search Bar */}
                <div className="debates-search" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="search-bar" style={{ marginBottom: 'var(--space-sm)' }}>
                        <span className="search-icon"><img src="/icons/lupa.png" alt="🔍" style={{ width: '18px', height: '18px', opacity: 0.6 }} /></span>
                        <input
                            type="text"
                            placeholder="Buscar debates por título..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Media Filter */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                        {selectedMedia ? (
                            <div className="selected-media-chip" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-xs)',
                                background: 'var(--bg-tertiary)',
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--border-default)'
                            }}>
                                {selectedMedia.cover_url && (
                                    <img
                                        src={selectedMedia.cover_url}
                                        alt=""
                                        style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }}
                                    />
                                )}
                                <span>{selectedMedia.media_type === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} />} {selectedMedia.name}</span>
                                <button
                                    onClick={clearMediaFilter}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        padding: 0,
                                        marginLeft: '0.5rem'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowMediaPicker(!showMediaPicker)}
                                >
                                    <img src="/icons/recom.png" alt="🎯" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Filtrar por obra
                                </button>

                                {showMediaPicker && (
                                    <div className="media-picker-dropdown" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '0.5rem',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--space-sm)',
                                        minWidth: 280,
                                        zIndex: 100,
                                        boxShadow: 'var(--shadow-lg)'
                                    }}>
                                        <input
                                            type="text"
                                            placeholder="Buscar juego o anime..."
                                            value={mediaSearchQuery}
                                            onChange={(e) => setMediaSearchQuery(e.target.value)}
                                            autoFocus
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: '1px solid var(--border-default)',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)',
                                                marginBottom: 'var(--space-xs)'
                                            }}
                                        />
                                        {mediaResults.length > 0 && (
                                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                {mediaResults.map(media => (
                                                    <button
                                                        key={`${media.media_type}-${media.id}`}
                                                        onClick={() => selectMedia(media)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 'var(--space-xs)',
                                                            width: '100%',
                                                            padding: '0.5rem',
                                                            background: 'none',
                                                            border: 'none',
                                                            textAlign: 'left',
                                                            cursor: 'pointer',
                                                            color: 'var(--text-primary)',
                                                            borderRadius: 'var(--radius-sm)'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                                                        onMouseLeave={(e) => e.target.style.background = 'none'}
                                                    >
                                                        {media.cover_url && (
                                                            <img
                                                                src={media.cover_url}
                                                                alt=""
                                                                style={{ width: 32, height: 40, borderRadius: 4, objectFit: 'cover' }}
                                                            />
                                                        )}
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{media.name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                {media.media_type === 'game' ? <><img src="/icons/videogame.png" alt="🎮" style={{ width: '12px', height: '12px', verticalAlign: 'middle' }} /> Juego</> : <><img src="/icons/anime.png" alt="📺" style={{ width: '12px', height: '12px', verticalAlign: 'middle' }} /> Anime</>}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {mediaSearchQuery.length >= 2 && mediaResults.length === 0 && (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem' }}>
                                                No se encontraron resultados
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="debates-filters" style={{ marginBottom: 'var(--space-lg)' }}>
                    {/* Order */}
                    <button
                        className={`debates-filter-btn ${filter.orderBy === 'recent' ? 'active' : ''}`}
                        onClick={() => setFilter(prev => ({ ...prev, orderBy: 'recent' }))}
                    >
                        <img src="/icons/clock.png" alt="🕐" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Recientes
                    </button>
                    <button
                        className={`debates-filter-btn ${filter.orderBy === 'active' ? 'active' : ''}`}
                        onClick={() => setFilter(prev => ({ ...prev, orderBy: 'active' }))}
                    >
                        <img src="/icons/fire.gif" alt="🔥" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Activos
                    </button>

                    <span style={{
                        width: '1px',
                        height: '24px',
                        background: 'var(--border-default)',
                        margin: '0 var(--space-xs)'
                    }} />

                    {/* Media Type */}
                    <button
                        className={`debates-filter-btn ${filter.mediaType === 'game' ? 'active' : ''}`}
                        onClick={() => toggleMediaFilter('game')}
                    >
                        <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Juegos
                    </button>
                    <button
                        className={`debates-filter-btn ${filter.mediaType === 'anime' ? 'active' : ''}`}
                        onClick={() => toggleMediaFilter('anime')}
                    >
                        <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Anime
                    </button>

                    <span style={{
                        width: '1px',
                        height: '24px',
                        background: 'var(--border-default)',
                        margin: '0 var(--space-xs)'
                    }} />

                    {/* Debate Type */}
                    {Object.entries(DEBATE_TYPES).map(([key, { emoji, label }]) => (
                        <button
                            key={key}
                            className={`debates-filter-btn ${filter.debateType === key ? 'active' : ''}`}
                            onClick={() => toggleDebateType(key)}
                        >
                            {emoji === '❓' ? (
                                <img src="/icons/interrogation.png" alt="❓" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                            ) : emoji === '⚖️' ? (
                                <img src="/icons/scale.png" alt="⚖️" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                            ) : emoji === '💭' ? (
                                <img src="/icons/opinion.png" alt="💭" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                            ) : emoji === '🏆' ? (
                                <img src="/icons/medal.png" alt="🏆" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                            ) : emoji} {label}
                        </button>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className="debates-loading">
                        <LoadingSpinner />
                    </div>
                ) : debates.length === 0 ? (
                    <div className="debates-empty">
                        <div className="debates-empty-icon"><img src="/icons/dialog.png" alt="💬" style={{ width: '64px', height: '64px', opacity: 0.5 }} /></div>
                        <h3>No hay debates que coincidan</h3>
                        <p>Prueba con otros filtros o crea uno nuevo</p>
                        <Link to="/debates/create" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>
                            Crear debate
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="debates-list">
                            {debates.map(debate => (
                                <DebateCard key={debate.id} debate={debate} />
                            ))}
                        </div>

                        {hasMore && (
                            <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Cargando...' : 'Cargar más debates'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
