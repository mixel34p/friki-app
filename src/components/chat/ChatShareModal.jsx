import { useState, useEffect } from 'react'
import { getUserTierlists } from '../../lib/socialDiscoveryService'
import { searchGames } from '../../lib/gameService'
import { searchAnime } from '../../lib/animeService'
import LoadingSpinner from '../LoadingSpinner'

export function ChatShareModal({ isOpen, onClose, onSelect, userId }) {
    if (!isOpen) return null

    const [activeTab, setActiveTab] = useState('tierlist')
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [error, setError] = useState(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Fetch data based on tab
    useEffect(() => {
        setError(null)

        const fetchData = async () => {
            setLoading(true)
            try {
                let data = []
                if (activeTab === 'tierlist') {
                    if (!userId) {
                        setError('Usuario no identificado')
                        setItems([])
                        return
                    }
                    data = await getUserTierlists(userId)
                } else if (activeTab === 'game') {
                    if (debouncedQuery.length >= 2) {
                        data = await searchGames(debouncedQuery)
                    }
                } else if (activeTab === 'anime') {
                    if (debouncedQuery.length >= 2) {
                        data = await searchAnime(debouncedQuery)
                    }
                }
                setItems(data || [])
            } catch (err) {
                console.error('Error fetching share items:', err)
                setError('Error al cargar los datos')
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [activeTab, userId, debouncedQuery])

    const handleSelect = (item) => {
        let tag = ''
        let type = ''
        let extra = ''

        if (activeTab === 'tierlist') {
            type = 'TIERLIST'
            tag = `[TIERLIST|${item.id}|${item.name || item.title}|${item.cover_url || ''}]`
        } else if (activeTab === 'game') {
            type = 'WORK'
            extra = 'game'
            tag = `[WORK|${item.id}|${item.name || item.title}|${item.cover_url || item.image_url || ''}|game]`
        } else if (activeTab === 'anime') {
            type = 'WORK'
            extra = 'anime'
            tag = `[WORK|${item.id}|${item.name || item.title}|${item.cover_url || item.image_url || ''}|anime]`
        }

        onSelect({
            tag,
            type,
            id: item.id,
            title: item.name || item.title,
            image: item.cover_url || item.image_url,
            extra
        })
        onClose()
    }

    return (
        <div className="share-modal-overlay" onClick={onClose}>
            <div className="share-modal-content" onClick={e => e.stopPropagation()}>
                <div className="share-modal-header">
                    <h3>Compartir contenido</h3>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>

                <div className="share-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'tierlist' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('tierlist'); setSearchQuery('') }}
                    >
                        <img src="/icons/tierlist.png" alt="📊" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Tierlists
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'game' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('game'); setSearchQuery('') }}
                    >
                        <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Juegos
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'anime' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('anime'); setSearchQuery('') }}
                    >
                        <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Anime
                    </button>
                </div>

                {(activeTab === 'game' || activeTab === 'anime') && (
                    <div className="share-search">
                        <input
                            type="text"
                            placeholder={activeTab === 'game' ? 'Buscar juego...' : 'Buscar anime...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}

                <div className="share-list">
                    {error ? (
                        <div className="error-state">{error}</div>
                    ) : loading ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                        </div>
                    ) : items.length > 0 ? (
                        items.map(item => (
                            <div key={item.id} className="share-item" onClick={() => handleSelect(item)}>
                                <div className="share-item-img">
                                    {item.cover_url || item.image_url ? (
                                        <img src={item.cover_url || item.image_url} alt="" />
                                    ) : (
                                        <div className="placeholder-img">
                                            {activeTab === 'tierlist' ? <img src="/icons/tierlist.png" alt="📊" style={{ width: '24px', height: '24px', opacity: 0.7 }} /> : activeTab === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '24px', height: '24px', opacity: 0.7 }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '24px', height: '24px', opacity: 0.7 }} />}
                                        </div>
                                    )}
                                </div>
                                <div className="share-item-info">
                                    <h4>{item.name || item.title}</h4>
                                    {item.category && <span>{item.category}</span>}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            {(activeTab === 'game' || activeTab === 'anime') && searchQuery.length < 2
                                ? 'Escribe para buscar'
                                : activeTab === 'tierlist'
                                    ? 'No tienes tierlists'
                                    : 'No se encontraron resultados'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
