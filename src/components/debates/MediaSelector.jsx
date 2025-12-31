import { useState, useEffect, useCallback } from 'react'
import { searchGames } from '../../lib/gameService'
import { searchAnime } from '../../lib/animeService'
import './DebateComponents.css'

export default function MediaSelector({
    isOpen,
    onClose,
    onSelect,
    selectedMedia = [],
    maxSelections = 5
}) {
    const [activeTab, setActiveTab] = useState('game')
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState(selectedMedia)

    // Sync with parent
    useEffect(() => {
        setSelected(selectedMedia)
    }, [selectedMedia])

    // Debounced search
    const doSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            setResults([])
            return
        }

        setLoading(true)
        try {
            let data
            if (activeTab === 'game') {
                data = await searchGames(searchQuery)
                // Normalize to common format
                data = data.map(g => ({
                    id: g.id,
                    name: g.name,
                    cover_url: g.cover_url,
                    genres: g.genres,
                    media_type: 'game'
                }))
            } else {
                data = await searchAnime(searchQuery)
                data = data.map(a => ({
                    id: a.id,
                    name: a.title,
                    cover_url: a.image_url,
                    genres: a.genres,
                    media_type: 'anime'
                }))
            }
            setResults(data || [])
        } catch (error) {
            console.error('Error searching:', error)
            setResults([])
        } finally {
            setLoading(false)
        }
    }, [searchQuery, activeTab])

    useEffect(() => {
        const timer = setTimeout(doSearch, 400)
        return () => clearTimeout(timer)
    }, [doSearch])

    // Clear results when switching tabs
    useEffect(() => {
        setResults([])
        setSearchQuery('')
    }, [activeTab])

    const handleToggleSelect = (item) => {
        const isSelected = selected.some(
            s => s.id === item.id && s.media_type === item.media_type
        )

        if (isSelected) {
            setSelected(selected.filter(
                s => !(s.id === item.id && s.media_type === item.media_type)
            ))
        } else if (selected.length < maxSelections) {
            setSelected([...selected, item])
        }
    }

    const handleRemove = (item) => {
        setSelected(selected.filter(
            s => !(s.id === item.id && s.media_type === item.media_type)
        ))
    }

    const handleConfirm = () => {
        onSelect(selected)
        onClose()
    }

    const isItemSelected = (item) => {
        return selected.some(
            s => s.id === item.id && s.media_type === item.media_type
        )
    }

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_small')
    }

    if (!isOpen) return null

    return (
        <div className="media-selector-overlay" onClick={onClose}>
            <div
                className="media-selector-modal"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="media-selector-header">
                    <h3>Seleccionar obras</h3>
                    <button className="media-selector-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="media-selector-tabs">
                    <button
                        className={`media-selector-tab ${activeTab === 'game' ? 'active' : ''}`}
                        onClick={() => setActiveTab('game')}
                    >
                        <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Videojuegos
                    </button>
                    <button
                        className={`media-selector-tab ${activeTab === 'anime' ? 'active' : ''}`}
                        onClick={() => setActiveTab('anime')}
                    >
                        <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Anime
                    </button>
                </div>

                {/* Search */}
                <div className="media-selector-search">
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'game' ? 'videojuegos' : 'anime'}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Results */}
                <div className="media-selector-results">
                    {loading ? (
                        <div className="media-selector-loading">
                            <div className="loading-spinner"></div>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="media-selector-empty">
                            {searchQuery
                                ? 'No se encontraron resultados'
                                : 'Escribe para buscar'
                            }
                        </div>
                    ) : (
                        results.map(item => (
                            <div
                                key={`${item.media_type}-${item.id}`}
                                className={`media-selector-item ${isItemSelected(item) ? 'selected' : ''}`}
                                onClick={() => handleToggleSelect(item)}
                            >
                                <img
                                    src={getHighResImage(item.cover_url)}
                                    alt=""
                                    className="media-selector-item-cover"
                                    onError={(e) => {
                                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 54" fill="%231c1c1c"><rect width="40" height="54"/></svg>'
                                    }}
                                />
                                <div className="media-selector-item-info">
                                    <div className="media-selector-item-name">
                                        {item.name}
                                    </div>
                                    {item.genres && item.genres.length > 0 && (
                                        <div className="media-selector-item-meta">
                                            {Array.isArray(item.genres)
                                                ? item.genres.slice(0, 2).join(', ')
                                                : item.genres
                                            }
                                        </div>
                                    )}
                                </div>
                                {isItemSelected(item) && (
                                    <span className="media-selector-check">✓</span>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="media-selector-footer">
                    <div className="media-selector-selected">
                        {selected.map(item => (
                            <span
                                key={`${item.media_type}-${item.id}`}
                                className="media-selector-selected-item"
                            >
                                {item.media_type === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} />}
                                {item.name.length > 20
                                    ? item.name.substring(0, 20) + '...'
                                    : item.name
                                }
                                <button
                                    className="media-selector-selected-remove"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemove(item)
                                    }}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                    >
                        Confirmar ({selected.length})
                    </button>
                </div>
            </div>
        </div>
    )
}
