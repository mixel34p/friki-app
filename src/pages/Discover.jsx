import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { discoverSimilarUsers, calculateAffinityClient } from '../lib/socialDiscoveryService'
import { getRecommendations } from '../lib/recommendationService'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import RecommendationCard from '../components/RecommendationCard'
import LoadingSpinner from '../components/LoadingSpinner'
import './Discover.css'

export default function Discover() {
    const { user, profile, refreshProfile } = useAuth()
    const [users, setUsers] = useState([])
    const [tierlists, setTierlists] = useState([])
    const [recommendations, setRecommendations] = useState([])
    const [searchResults, setSearchResults] = useState([])
    const [loading, setLoading] = useState(true)

    // UI State
    const [activeTab, setActiveTab] = useState('recommendations') // 'affinity' | 'tierlists' | 'recommendations'
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [mediaFilter, setMediaFilter] = useState('game') // 'game' | 'anime' (Removed 'all')

    // Custom debounce since we might not have lodash
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
        }, 500)

        return () => clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => {
        if (user && profile) {
            // Only load data if strictly necessary (tab change or search)
            // Prevent reloading recommendations if they are already loaded
            if (activeTab === 'recommendations' && recommendations.length > 0 && !debouncedQuery && mediaFilter === 'all') {
                return
            }
            loadData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, profile, activeTab, debouncedQuery, mediaFilter])

    const loadData = async () => {
        try {
            setLoading(true)

            // Always calculate recommendations in background (regardless of active tab)
            if (user && profile) {
                // Don't await if we want it truly background, but for now let's await to ensure consistency
                // or parallelize with other fetches
                const recsPromise = getRecommendations(user.id, profile, mediaFilter, { limit: 50 })
                    .then(recs => enrichRecommendations(recs))
                    .then(enriched => setRecommendations(enriched))
                    .catch(e => console.error('Background recs error:', e))

                // We won't await recsPromise here to let other data load faster, 
                // unless activeTab IS recommendations, but the user asked for "background context"
            }

            if (activeTab === 'affinity') {
                // Discover affine users
                const affineUsersList = await discoverSimilarUsers(user.id, profile)

                if (!affineUsersList) {
                    console.error('Error discovering affine users')
                } else {
                    // affineUsersList already has the structure we need

                    // Filter by search
                    if (debouncedQuery) {
                        const filtered = affineUsersList.filter(u =>
                            u.username?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
                            u.display_name?.toLowerCase().includes(debouncedQuery.toLowerCase())
                        )
                        setUsers(filtered)
                    } else {
                        setUsers(affineUsersList)
                    }
                }
            } else if (activeTab === 'recommendations') {
                // Check if user is searching
                if (debouncedQuery.trim().length > 0) {
                    // Global search for games/anime
                    await performGlobalSearch(debouncedQuery, mediaFilter)
                } else {
                    // Start calculation also here if not done, but the background one above handles it.
                    // If we want to ensure it's fresh/loaded:
                    if (recommendations.length === 0) {
                        const recs = await getRecommendations(user.id, profile, mediaFilter, { limit: 50 })
                        const enrichedRecs = await enrichRecommendations(recs)
                        setRecommendations(enrichedRecs)
                    }
                    setSearchResults([])
                }
            } else {
                // Get tierlists
                let query = supabase
                    .from('tierlists')
                    .select('*, likes_count')
                    .eq('visibility', 'public')
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (debouncedQuery.trim().length > 0) {
                    query = query.ilike('title', `%${debouncedQuery}%`)
                }

                if (mediaFilter !== 'all') {
                    query = query.eq('media_type', mediaFilter)
                }

                const { data: rawTierlists, error: tierlistError } = await query

                if (tierlistError) console.error('Error fetching tierlists:', tierlistError)

                let enrichedTierlists = []
                if (rawTierlists && rawTierlists.length > 0) {
                    // Manually fetch profiles
                    const userIds = [...new Set(rawTierlists.map(t => t.user_id))]
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('user_id, username, display_name, avatar_url')
                        .in('user_id', userIds)

                    const profileMap = {}
                    profiles?.forEach(p => profileMap[p.user_id] = p)

                    enrichedTierlists = rawTierlists.map(t => ({
                        ...t,
                        profiles: profileMap[t.user_id]
                    }))
                }
                setTierlists(enrichedTierlists)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    // Enrich recommendations with game/anime details
    const enrichRecommendations = async (recs) => {
        if (!recs || recs.length === 0) return []

        const gameIds = recs.filter(r => r.media_type === 'game' && !r.title).map(r => r.work_id)
        const animeIds = recs.filter(r => r.media_type === 'anime' && !r.title).map(r => r.work_id)

        const gamesMap = {}
        const animeMap = {}

        // Fetch games only if title is missing
        if (gameIds.length > 0) {
            const { data: games } = await supabase
                .from('games')
                .select('id, name, cover_url')
                .in('id', gameIds)

            games?.forEach(g => gamesMap[g.id] = g)
        }

        // Fetch anime only if title is missing
        if (animeIds.length > 0) {
            // Try matching by id OR mal_id to be safe
            const { data: anime } = await supabase
                .from('anime')
                .select('id, mal_id, title, image_url')
                .or(`id.in.(${animeIds.join(',')}),mal_id.in.(${animeIds.join(',')})`)

            anime?.forEach(a => {
                animeMap[a.id] = a
                if (a.mal_id) animeMap[a.mal_id] = a
            })
        }

        // Enrich each recommendation
        return recs.map(rec => {
            if (rec.media_type === 'game') {
                const gameData = gamesMap[rec.work_id]
                return {
                    ...rec,
                    title: rec.title || gameData?.name || 'Juego desconocido',
                    image_url: rec.image_url || gameData?.cover_url
                }
            } else {
                const animeData = animeMap[rec.work_id]
                return {
                    ...rec,
                    title: rec.title || animeData?.title || 'Anime desconocido',
                    image_url: rec.image_url || animeData?.image_url
                }
            }
        })
    }

    // Perform global search using APIs (IGDB/Jikan) with DB fallback
    const performGlobalSearch = async (query, mediaType) => {
        const results = []

        // Search games using gameService (IGDB API + DB)
        if (mediaType === 'game' || mediaType === 'all') {
            const games = await searchGames(query, 20)

            games.forEach(game => {
                results.push({
                    work_id: game.id,
                    media_type: 'game',
                    title: game.name,
                    image_url: game.cover_url || game.image_url,
                    score: null, // No score for search results
                    reasons: [{ type: 'search', icon: <img src="/icons/lupa.png" alt="🔍" style={{ width: '14px', height: '14px' }} />, text: 'Resultado de búsqueda' }]
                })
            })
        }

        // Search anime using animeService (Jikan API + DB)
        if (mediaType === 'anime' || mediaType === 'all') {
            const animeList = await searchAnime(query, 20)

            animeList.forEach(a => {
                results.push({
                    work_id: a.id,
                    media_type: 'anime',
                    title: a.title || a.name,
                    image_url: a.image_url || a.cover_url,
                    score: null, // No score for search results
                    reasons: [{ type: 'search', icon: <img src="/icons/lupa.png" alt="🔍" style={{ width: '14px', height: '14px' }} />, text: 'Resultado de búsqueda' }]
                })
            })
        }

        setSearchResults(results)
    }

    // Handle adding recommendation to library
    const handleAddToLibrary = async (recommendation, status = 'wishlist') => {
        if (!user || !profile) return

        try {
            const libraryKey = recommendation.media_type === 'game' ? 'library' : 'anime_library'
            const currentLibrary = profile[libraryKey] || []

            // Convert work_id to string for consistency
            const workId = String(recommendation.work_id)

            // Check if already exists
            const exists = currentLibrary.find(item => {
                const itemId = String(item.game_id || item.mal_id || item.id)
                return itemId === workId
            })

            if (exists) {
                alert('Este elemento ya está en tu biblioteca')
                return
            }

            const newEntry = {
                id: workId,
                [recommendation.media_type === 'game' ? 'game_id' : 'mal_id']: workId,
                title: recommendation.title,
                name: recommendation.title, // Add both title and name for compatibility
                image_url: recommendation.image_url,
                status: status,
                rating: null,
                added_at: new Date().toISOString()
            }

            const newLibrary = [...currentLibrary, newEntry]

            const { error } = await supabase
                .from('profiles')
                .update({ [libraryKey]: newLibrary })
                .eq('user_id', user.id)

            if (error) {
                console.error('Error adding to library:', error)
                alert('Error al añadir a la biblioteca')
            } else {
                // Remove from recommendations and search results
                setRecommendations(prev => prev.filter(r => String(r.work_id) !== workId))
                setSearchResults(prev => prev.filter(r => String(r.work_id) !== workId))

                // Refresh profile to update library
                if (refreshProfile) {
                    await refreshProfile()
                }

                // Show success message
                alert(`Añadido a tu ${recommendation.media_type === 'game' ? 'biblioteca de juegos' : 'biblioteca de anime'}`)
            }
        } catch (error) {
            console.error('Error in handleAddToLibrary:', error)
            alert('Error al añadir a la biblioteca')
        }
    }

    if (loading && users.length === 0 && tierlists.length === 0 && recommendations.length === 0 && searchResults.length === 0) {
        return (
            <div className="discover-loading">
                <LoadingSpinner />
            </div>
        )
    }

    return (
        <div className="discover">
            <div className="container">
                <div className="discover-header">
                    <h1 className="page-title">Descubrir</h1>

                    <div className="discover-actions-top">
                        <Link to="/connections" className="btn btn-secondary btn-sm">
                            📬 Solicitudes y Conexiones
                        </Link>
                    </div>

                    {/* Search Bar */}
                    <div className="search-bar">
                        {activeTab === 'recommendations' && <span className="search-hint">💡 Busca obras específicas o deja vacío para recomendaciones</span>}
                        <span className="search-icon"><img src="/icons/lupa.png" alt="🔍" style={{ width: '18px', height: '18px', opacity: 0.6 }} /></span>
                        <input
                            type="text"
                            placeholder={activeTab === 'affinity' ? "Buscar personas..." : activeTab === 'recommendations' ? "Buscar o dejar vacío para recomendaciones..." : "Buscar tierlists..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="discover-controls">
                    {/* Main Tabs */}
                    <div className="tabs input-group-segment">
                        <button
                            className={`tab-btn ${activeTab === 'tierlists' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tierlists')}
                        >
                            <img src="/icons/checklist.png" alt="📋" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Tierlists
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'affinity' ? 'active' : ''}`}
                            onClick={() => setActiveTab('affinity')}
                        >
                            <img src="/icons/star.png" alt="✨" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Personas Afines
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
                            onClick={() => setActiveTab('recommendations')}
                        >
                            <img src="/icons/recom.png" alt="🎯" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Recomendaciones
                        </button>
                    </div>

                    {/* Media Filter (For Tierlists and Recommendations) */}
                    {(activeTab === 'tierlists' || activeTab === 'recommendations') && (
                        <div className="media-filters">
                            {/* 'Todo' removed as per request */}
                            <button
                                className={`filter-chip ${mediaFilter === 'game' ? 'active' : ''}`}
                                onClick={() => setMediaFilter('game')}
                            >
                                <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Juegos
                            </button>
                            <button
                                className={`filter-chip ${mediaFilter === 'anime' ? 'active' : ''}`}
                                onClick={() => setMediaFilter('anime')}
                            >
                                <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Anime
                            </button>
                        </div>
                    )}
                </div>

                {activeTab === 'affinity' && (
                    <div className="users-grid">
                        {users.length === 0 ? (
                            <div className="empty-state">
                                <p>No se encontraron personas</p>
                                {debouncedQuery ? (
                                    <p className="empty-subtitle">Intenta con otro nombre de usuario</p>
                                ) : (
                                    <p className="empty-subtitle">¡Prueba a añadir más tags o juegos favoritos a tu perfil!</p>
                                )}
                            </div>
                        ) : (
                            users.map(u => (
                                <div key={u.user_id} className="user-card-grid affinity-card-mode">
                                    <div className="user-card-header">
                                        <div className={`affinity-badge ${u.affinity >= 60 ? 'high' : u.affinity >= 30 ? 'medium' : 'low'}`}>
                                            {u.affinity}% Afinidad
                                        </div>
                                    </div>
                                    <div className="user-card-content">
                                        {u.avatar_url ? (
                                            <img src={u.avatar_url} alt="" className="user-card-avatar" />
                                        ) : (
                                            <div className="user-card-avatar-placeholder">
                                                {u.display_name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        <h3 className="user-card-name">{u.display_name}</h3>
                                        <span className="user-card-username">Identidad oculta hasta conectar</span>

                                        {/* Preview of matches */}
                                        <div className="matches-preview">
                                            {u.matches?.slice(0, 3).map((m, i) => (
                                                <span key={i} className="mini-match-pill" title={`${m.type}: ${m.value}`}>
                                                    {m.icon === '🎮' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '12px', height: '12px', verticalAlign: 'middle', marginRight: '2px' }} /> : m.icon === '📺' ? <img src="/icons/anime.png" alt="📺" style={{ width: '12px', height: '12px', verticalAlign: 'middle', marginRight: '2px' }} /> : m.icon} {m.value}
                                                </span>
                                            ))}
                                            {u.matches?.length > 3 && (
                                                <span className="mini-match-more">+{u.matches.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="user-card-actions">
                                        <Link
                                            to={`/compare/${u.user_id}`}
                                            className="btn btn-primary btn-full"
                                        >
                                            Ver compatibilidad
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'tierlists' && (
                    <div className="tierlists-grid">
                        {tierlists.length === 0 ? (
                            <div className="empty-state">
                                <p>No hay tierlists que coincidan</p>
                            </div>
                        ) : (
                            tierlists.map(t => (
                                <Link key={t.id} to={`/tierlist/${t.id}`} className="tierlist-poster">
                                    <div className="poster-preview">
                                        {/* Collage of first 4 items if available, or placeholder */}
                                        {(() => {
                                            // Helper to find image
                                            let bg = null
                                            if (t.content) {
                                                const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
                                                for (const key of priorities) {
                                                    if (t.content[key]?.[0]?.image_url) {
                                                        bg = t.content[key][0].image_url
                                                        break
                                                    }
                                                }
                                                if (!bg) {
                                                    for (const key in t.content) {
                                                        const row = t.content[key]
                                                        if (Array.isArray(row) && row.length > 0) {
                                                            const item = row.find(i => i.image_url)
                                                            if (item) { bg = item.image_url; break; }
                                                        }
                                                    }
                                                }
                                            }
                                            if (!bg && t.tierlist_items && t.tierlist_items.length > 0) {
                                                bg = t.tierlist_items.find(i => i.image_url)?.image_url
                                            }

                                            if (bg) {
                                                return <img src={bg} className="poster-cover" alt="" />
                                            }
                                            return (
                                                <div className="poster-placeholder">
                                                    {t.media_type === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '40px', height: '40px', opacity: 0.8 }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '40px', height: '40px', opacity: 0.8 }} />}
                                                </div>
                                            )
                                        })()}
                                        <div className="poster-overlay">
                                            <span className="poster-type">
                                                {t.list_type === 'ranking' ? <><img src="/icons/medal.png" alt="🏆" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} /> Ranking</> : <><img src="/icons/tierlist.png" alt="📊" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} /> Tierlist</>}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="poster-info">
                                        <h3 className="poster-title">{t.title}</h3>
                                        <div className="poster-meta">
                                            {t.profiles?.avatar_url ? (
                                                <img src={t.profiles.avatar_url} alt="" className="mini-avatar" />
                                            ) : (
                                                <div className="mini-avatar placeholder">
                                                    {t.profiles?.display_name?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <span className="poster-author">@{t.profiles?.username}</span>
                                            <span className="poster-likes">❤️ {t.likes_count || 0}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'recommendations' && (
                    <div className="recommendations-container">
                        {/* Show search results if searching, otherwise show recommendations */}
                        {debouncedQuery.trim().length > 0 ? (
                            searchResults.length === 0 ? (
                                <div className="empty-state">
                                    <p>No se encontraron resultados</p>
                                    <p className="empty-subtitle">Intenta con otro nombre</p>
                                </div>
                            ) : (
                                <div className="recommendations-grid">
                                    {searchResults.map((result, i) => (
                                        <RecommendationCard
                                            key={`search_${result.media_type}_${result.work_id}_${i}`}
                                            recommendation={result}
                                            onAddToLibrary={handleAddToLibrary}
                                        />
                                    ))}
                                </div>
                            )
                        ) : recommendations.length === 0 ? (
                            <div className="empty-state">
                                <p>No hay recomendaciones disponibles</p>
                                {profile?.library?.length === 0 && profile?.anime_library?.length === 0 ? (
                                    <p className="empty-subtitle">¡Añade algunos juegos o animes a tu biblioteca para recibir recomendaciones personalizadas!</p>
                                ) : (
                                    <p className="empty-subtitle">Intenta añadir más contenido a tu perfil o espera a que más usuarios se unan</p>
                                )}
                            </div>
                        ) : (
                            (() => {
                                // Split recommendations into Social (Following) and General
                                const socialRecs = recommendations.filter(r => r.reasons && r.reasons.some(reason => reason.type === 'following'))
                                const generalRecs = recommendations.filter(r => !r.reasons || !r.reasons.some(reason => reason.type === 'following'))

                                // Helper to render grid
                                const renderGrid = (list, prefix) => (
                                    <div className="recommendations-grid">
                                        {list.map((rec, i) => (
                                            <RecommendationCard
                                                key={`${prefix}_${rec.media_type}_${rec.work_id}_${i}`}
                                                recommendation={rec}
                                                onAddToLibrary={handleAddToLibrary}
                                            />
                                        ))}
                                    </div>
                                )

                                if (socialRecs.length > 0) {
                                    return (
                                        <div className="recommendations-split-view">
                                            {/* General Recommendations First */}
                                            {generalRecs.length > 0 && (
                                                <div className="recommendation-section">
                                                    <h3 className="section-header">
                                                        <span className="section-icon"><img src="/icons/recom.png" alt="🎯" style={{ width: '20px', height: '20px', verticalAlign: 'middle' }} /></span>
                                                        Para ti
                                                    </h3>
                                                    {renderGrid(generalRecs, 'general')}
                                                </div>
                                            )}

                                            {/* Social Recommendations Second */}
                                            <div className="recommendation-section">
                                                <h3 className="section-header">
                                                    De las personas a las que sigues
                                                </h3>
                                                {renderGrid(socialRecs, 'social')}
                                            </div>
                                        </div>
                                    )
                                }

                                // Fallback to single grid if no social recs
                                return (
                                    <div className="recommendations-grid">
                                        {recommendations.map((rec, i) => (
                                            <RecommendationCard
                                                key={`rec_${rec.media_type}_${rec.work_id}_${i}`}
                                                recommendation={rec}
                                                onAddToLibrary={handleAddToLibrary}
                                            />
                                        ))}
                                    </div>
                                )
                            })()
                        )}
                    </div> // This closing div was for recommendations-grid, but we handle layout inside now for split view
                )}
            </div>
        </div>
    )
}
