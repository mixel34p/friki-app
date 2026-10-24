import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import CommentSection from '../components/CommentSection'
import ThematicReactions from '../components/ThematicReactions'
import { toggleLike, getTierlistLikes, checkUserLike } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import SEO from '../components/SEO'
import './ViewTierlist.css'


const TEMPLATES = {
    tierlist: {
        id: 'tierlist',
        label: 'Tierlist',
        rows: ['S', 'A', 'B', 'C', 'D'],
        colors: {
            'S': 'var(--tier-s)', 'A': 'var(--tier-a)', 'B': 'var(--tier-b)',
            'C': 'var(--tier-c)', 'D': 'var(--tier-d)'
        }
    },
    ranking: {
        id: 'ranking',
        label: 'Top Ranking',
        rows: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'],
        colors: {
            '#1': '#fbbf24', '#2': '#94a3b8', '#3': '#b45309',
            '#4': '#6366f1', '#5': '#6366f1', '#6': '#6366f1',
            '#7': '#6366f1', '#8': '#6366f1', '#9': '#6366f1', '#10': '#6366f1'
        }
    }
}

export default function ViewTierlist() {
    const { id } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()
    const [tierlist, setTierlist] = useState(null)
    const [owner, setOwner] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Legacy images state (Hoisted)
    const [legacyImages, setLegacyImages] = useState({})

    // Social State
    const [likesCount, setLikesCount] = useState(0)
    const [isLiked, setIsLiked] = useState(false)
    const [likeLoading, setLikeLoading] = useState(false)

    useEffect(() => {
        if (!id) return
        fetchLikes()
        if (user) checkLikeStatus()
    }, [id, user])

    const fetchLikes = async () => {
        try {
            const count = await getTierlistLikes(id)
            setLikesCount(count)
        } catch (error) {
            console.error('Error loading likes:', error)
        }
    }

    const checkLikeStatus = async () => {
        try {
            const liked = await checkUserLike(id)
            setIsLiked(liked)
        } catch (error) {
            console.error('Error checking like:', error)
        }
    }

    const handleLike = async () => {
        if (!user) {
            alert('Inicia sesión para dar like')
            return
        }
        if (likeLoading) return

        setLikeLoading(true)
        try {
            const liked = await toggleLike(id)
            setIsLiked(liked)
            setLikesCount(prev => liked ? prev + 1 : prev - 1)
        } catch (error) {
            console.error('Error toggling like:', error)
        } finally {
            setLikeLoading(false)
        }
    }

    // Effect to fetch fresh images for all items from DB
    useEffect(() => {
        if (!tierlist) return
        if (Object.keys(legacyImages).length > 0) return // Already fetched

        const fetchFreshImages = async () => {
            try {
                // Collect IDs
                const ids = new Set()

                // From JSON content
                if (tierlist.content) {
                    Object.values(tierlist.content).forEach(row => {
                        if (Array.isArray(row)) {
                            row.forEach(item => {
                                if (item.id) ids.add(item.id)
                            })
                        }
                    })
                }

                // From legacy items
                if (tierlist.tierlist_items) {
                    tierlist.tierlist_items.forEach(item => {
                        if (item.media_id) ids.add(item.media_id)
                    })
                }

                if (ids.size === 0) return

                const table = tierlist.media_type === 'anime' ? 'anime' : 'games'
                const imageCol = tierlist.media_type === 'anime' ? 'image_url' : 'cover_url'

                const { data, error } = await supabase
                    .from(table)
                    .select(`id, ${imageCol}`)
                    .in('id', Array.from(ids))

                if (error) throw error

                const imgMap = {}
                data?.forEach(item => {
                    imgMap[item.id] = item[imageCol]
                })
                setLegacyImages(imgMap) // Reuse this state as the "DB Images Map"
            } catch (err) {
                console.error("Error fetching fresh images:", err)
            }
        }

        fetchFreshImages()
    }, [tierlist, legacyImages])

    useEffect(() => {
        fetchTierlist()
    }, [id])

    const handleDelete = async () => {
        setDeleting(true)
        try {
            // Delete tierlist items first (foreign key constraint)
            await supabase.from('tierlist_items').delete().eq('tierlist_id', id)
            // Delete tierlist
            await supabase.from('tierlists').delete().eq('id', id)
            navigate('/profile')
        } catch (error) {
            console.error('Error deleting tierlist:', error)
        } finally {
            setDeleting(false)
        }
    }

    const fetchTierlist = async () => {
        try {
            const { data, error } = await supabase
                .from('tierlists')
                .select(`
          *,
          *,
          tierlist_items (*),
          parent:parent_id ( title, id )
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            setTierlist(data)

            // Fetch owner info
            const { data: ownerData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', data.user_id)
                .single()

            setOwner(ownerData)
        } catch (error) {
            console.error('Error fetching tierlist:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="view-tierlist-loading">
                <LoadingSpinner />
                <p>Cargando tierlist...</p>
            </div>
        )
    }

    if (!tierlist) {
        return (
            <div className="view-tierlist-error">
                <h2>Tierlist no encontrada</h2>
                <Link to="/home" className="btn btn-primary">Volver al inicio</Link>
            </div>
        )
    }

    const isOwner = user?.id === tierlist.user_id

    // Determine template
    const templateId = tierlist.list_type || 'tierlist'
    const activeTemplate = TEMPLATES[templateId] || TEMPLATES['tierlist']

    // Group items by tier (using template rows + fallback for orphan items)
    const itemsByTier = {}

    // Initialize buckets
    activeTemplate.rows.forEach(row => {
        itemsByTier[row] = []
    })

    // Sort items into buckets
    // Sort items into buckets
    // Sort items into buckets

    if (tierlist.content && Object.keys(tierlist.content).length > 0) {
        // Use JSON content (New format)
        activeTemplate.rows.forEach(row => {
            if (tierlist.content[row]) {
                itemsByTier[row] = tierlist.content[row].map((game, index) => ({
                    id: game.id,
                    media_id: game.id,
                    title: game.name,
                    image_url: legacyImages[game.id] || game.image_url, // Prioritize fresh DB image
                    tier: row,
                    position: index,
                    tags: game.genres ? (Array.isArray(game.genres) ? game.genres : game.genres.split(', ')) : []
                }))
            }
        })
    } else if (tierlist.tierlist_items) {
        // Legacy fallback
        tierlist.tierlist_items.forEach(item => {
            if (activeTemplate.rows.includes(item.tier)) {
                itemsByTier[item.tier].push({
                    ...item,
                    image_url: legacyImages[item.media_id] || item.image_url
                })
            }
        })
    }

    // Fetch missing images for legacy items
    // Legacy images fetched by effect above

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        // Replace any t_ size with t_cover_big
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_big')
    }

    // Also handle legacy tiers mapping if needed, but for now assuming direct match

    return (
        <div className="view-tierlist">
            <SEO
                title={tierlist.title}
                description="Puedes mirar esta tierlist en geeksphere."
                ogTitle={tierlist.title}
                ogDescription="Puedes mirar esta tierlist en geeksphere."
                ogImage={tierlist.screenshot_url || Object.values(legacyImages)[0] || '/logo.png'}
            />
            <div className="container">
                {/* Header */}
                <div className="tierlist-header">
                    <div className="tierlist-info">
                        <div className="tierlist-type-badge">
                            {tierlist.media_type === 'game' && <><img src="/icons/videogame.png" alt="🎮" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Videojuegos</>}
                            {tierlist.media_type === 'anime' && <><img src="/icons/anime.png" alt="📺" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Anime</>}
                            {tierlist.media_type === 'movie' && '🎬 Películas'}
                            <span className="template-badge"> • {activeTemplate.label}</span>
                        </div>
                        <h1 className="tierlist-title">{tierlist.title}</h1>
                        {tierlist.description && (
                            <p className="tierlist-description">{tierlist.description}</p>
                        )}
                    </div>

                    <div className="tierlist-actions">
                        <Link
                            to={`/create-tierlist?fork=${id}`}
                            className="btn btn-primary remix-btn"
                            title="Crear tu propia versión de esta lista"
                        >
                            🔀 Remix
                        </Link>

                        <button
                            className={`like-btn ${isLiked ? 'liked' : ''}`}
                            onClick={handleLike}
                            disabled={likeLoading}
                        >
                            <span className="heart-icon">{isLiked ? '❤️' : '🤍'}</span>
                            <span className="like-count">{likesCount}</span>
                        </button>
                        {isOwner && (
                            <>
                                <Link to={`/edit-tierlist/${id}`} className="btn btn-secondary">
                                    ✏️ Editar
                                </Link>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    🗑️ Borrar
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Based On Info */}
                {tierlist.parent && (
                    <div className="tierlist-parent-info">
                        <span className="text-muted">Basada en </span>
                        <Link to={`/tierlist/${tierlist.parent.id}`} className="parent-link">
                            {tierlist.parent.title}
                        </Link>
                    </div>
                )}

                {/* Owner Card */}
                {owner && (
                    <Link to={`/profile/${owner.username}`} className="owner-card">
                        {owner.avatar_url ? (
                            <img src={owner.avatar_url} alt="" className="owner-avatar-img" />
                        ) : (
                            <div
                                className="owner-avatar"
                                style={{
                                    background: `linear-gradient(135deg, ${owner.color_primary || '#8b5cf6'}, ${owner.color_secondary || '#6366f1'})`
                                }}
                            >
                                {owner.display_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="owner-info">
                            <span className="owner-name">{owner.display_name}</span>
                            <span className="owner-username">@{owner.username}</span>
                        </div>
                        <span className="owner-arrow">→</span>
                    </Link>
                )}

                {/* Tierlist Display */}
                <div className="tierlist-display">
                    {activeTemplate.rows.map(tier => (
                        <div key={tier} className="tier-row">
                            <div
                                className="tier-label"
                                style={{
                                    backgroundColor: activeTemplate.colors[tier],
                                    color: '#000',
                                    fontSize: templateId === 'ranking' ? '1.2rem' : undefined,
                                    width: '80px', // We'll override this in CSS
                                }}
                            >
                                {tier}
                            </div>
                            <div className="tier-content">
                                {itemsByTier[tier] && itemsByTier[tier].length > 0 ? (
                                    itemsByTier[tier]
                                        .sort((a, b) => a.position - b.position)
                                        .map(item => (
                                            <Link
                                                key={item.id}
                                                to={`/${tierlist.media_type || 'game'}/${item.media_id}`}
                                                className="tier-item"
                                                style={{ textDecoration: 'none' }}
                                                title={item.title}
                                            >
                                                {item.image_url ? (
                                                    <img
                                                        src={getHighResImage(item.image_url)}
                                                        alt={item.title}
                                                        className="tier-item-img-view"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none'
                                                            e.target.parentElement.querySelector('.tier-item-fallback').style.display = 'flex'
                                                        }}
                                                    />
                                                ) : null}

                                                <div
                                                    className="tier-item-fallback item-emoji"
                                                    style={{ display: item.image_url ? 'none' : 'flex' }}
                                                >
                                                    🎮
                                                </div>

                                                {/* Tooltip-like title on hover only, handled by CSS */}
                                            </Link>
                                        ))
                                ) : (
                                    <div className="tier-empty"></div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Meta Info */}
                <div className="tierlist-meta">
                    <span className="meta-item">
                        📅 Creada: {new Date(tierlist.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </span>
                    <span className="meta-item">
                        {tierlist.visibility === 'public' ? '🌍 Pública' : '🔒 Privada'}
                    </span>
                </div>

                {/* Reactions (Moved & Compact) */}
                <div className="tierlist-reactions-compact">
                    <ThematicReactions targetType="tierlist" targetId={id} />
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal delete-modal">
                        <h3>¿Eliminar esta tierlist?</h3>
                        <p>Esta acción no se puede deshacer.</p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Eliminando...' : '🗑️ Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comments Section */}
            <CommentSection tierlistId={id} ownerId={tierlist.user_id} />

            {/* Join CTA for non-logged users */}
            {!user && (
                <div className="join-cta-banner">
                    <div className="join-cta-content">
                        <div className="join-cta-info">
                            <h3>¿Quieres crear tu propia versión?</h3>
                            <p>Únete a GeekSphere para remixear tierlists, opinar sobre juegos/animes y conectar con la comunidad.</p>
                        </div>
                        <div className="join-cta-actions">
                            <Link to="/register" className="btn btn-primary">Crear Cuenta</Link>
                            <Link to="/login" className="btn btn-text">Login</Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
