import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    getDebateById,
    getDebatePosts,
    createPost,
    deletePost,
    deleteDebate,
    closeDebate,
    DEBATE_TYPES
} from '../lib/debateService'
import DebatePost from '../components/debates/DebatePost'
import MediaSelector from '../components/debates/MediaSelector'
import './Debates.css'

export default function ViewDebate() {
    const { id } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()

    const [debate, setDebate] = useState(null)
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [postsLoading, setPostsLoading] = useState(false)

    // Reply form state
    const [replyContent, setReplyContent] = useState('')
    const [quotedPost, setQuotedPost] = useState(null)
    const [mentionedMedia, setMentionedMedia] = useState(null)
    const [showMediaSelector, setShowMediaSelector] = useState(false)
    const [isSpoiler, setIsSpoiler] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Sort
    const [sortOrder, setSortOrder] = useState('recent')

    // Delete modal
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Close modal
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)
    const [closing, setClosing] = useState(false)

    useEffect(() => {
        loadDebate()
    }, [id])

    useEffect(() => {
        if (debate) {
            loadPosts()
        }
    }, [debate, sortOrder])

    const loadDebate = async () => {
        setLoading(true)
        try {
            const data = await getDebateById(id)
            setDebate(data)
        } catch (error) {
            console.error('Error loading debate:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadPosts = async () => {
        setPostsLoading(true)
        try {
            const data = await getDebatePosts(id, { orderBy: sortOrder })
            setPosts(data)
        } catch (error) {
            console.error('Error loading posts:', error)
        } finally {
            setPostsLoading(false)
        }
    }

    const handleSubmitReply = async (e) => {
        e.preventDefault()
        if (!replyContent.trim() || submitting) return

        setSubmitting(true)
        try {
            const newPost = await createPost(id, {
                content: replyContent,
                quotedPostId: quotedPost?.id,
                mentionedMedia: mentionedMedia,
                isSpoiler: isSpoiler
            })

            setPosts(prev => [...prev, newPost])
            setReplyContent('')
            setQuotedPost(null)
            setMentionedMedia(null)
            setIsSpoiler(false)

            // Update posts count
            setDebate(prev => ({ ...prev, posts_count: prev.posts_count + 1 }))
        } catch (error) {
            console.error('Error posting reply:', error)
            alert('Error al publicar respuesta')
        } finally {
            setSubmitting(false)
        }
    }

    const handleQuote = (post) => {
        setQuotedPost(post)
        // Scroll to reply form
        document.querySelector('.debate-reply-form')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        })
    }

    const handleDeletePost = async (postId) => {
        try {
            await deletePost(postId)
            setPosts(prev => prev.filter(p => p.id !== postId))
            setDebate(prev => ({ ...prev, posts_count: Math.max(0, prev.posts_count - 1) }))
        } catch (error) {
            console.error('Error deleting post:', error)
            alert('Error al eliminar')
        }
    }

    const handleDeleteDebate = async () => {
        setDeleting(true)
        try {
            await deleteDebate(id)
            navigate('/debates')
        } catch (error) {
            console.error('Error deleting debate:', error)
            alert('Error al eliminar debate')
        } finally {
            setDeleting(false)
        }
    }

    const handleCloseDebate = async () => {
        setClosing(true)
        try {
            await closeDebate(id)
            setDebate(prev => ({ ...prev, is_locked: true }))
            setShowCloseConfirm(false)
        } catch (error) {
            console.error('Error closing debate:', error)
            alert('Error al cerrar debate')
        } finally {
            setClosing(false)
        }
    }

    const handleSelectMentionMedia = (selected) => {
        if (selected.length > 0) {
            setMentionedMedia(selected[0])
        }
    }

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_big')
    }

    if (loading) {
        return (
            <div className="view-debate-page">
                <div className="container">
                    <div className="view-debate-loading">
                        <div className="loading-spinner"></div>
                        <p>Cargando debate...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!debate) {
        return (
            <div className="view-debate-page">
                <div className="container">
                    <div className="view-debate-error">
                        <h2>Debate no encontrado</h2>
                        <Link to="/debates" className="btn btn-primary">
                            Volver a debates
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const isOwner = user?.id === debate.user_id
    const debateType = DEBATE_TYPES[debate.debate_type] || DEBATE_TYPES.opinion

    return (
        <div className="view-debate-page">
            <div className="container">
                {/* Back Link */}
                <Link
                    to="/debates"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-lg)',
                        fontSize: 'var(--text-sm)'
                    }}
                >
                    ← Volver a debates
                </Link>

                {/* Media Header */}
                <div className="debate-media-header">
                    {debate.media?.map(media => (
                        <Link
                            key={`${media.media_type}-${media.id}`}
                            to={`/${media.media_type}/${media.id}`}
                            className="debate-media-item"
                        >
                            <img
                                src={getHighResImage(media.cover_url)}
                                alt={media.name}
                                className="debate-media-item-cover"
                                onError={(e) => {
                                    e.target.src = '/icons/videogame.png'
                                }}
                            />
                            <span className="debate-media-item-name" title={media.name}>
                                {media.name}
                            </span>
                            <span className="debate-media-item-type">
                                {media.media_type === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '14px', height: '14px' }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '14px', height: '14px' }} />}
                            </span>
                        </Link>
                    ))}
                </div>

                {/* Debate Info */}
                <div className="debate-info">
                    <div className="debate-info-header">
                        <div>
                            <span className="debate-type-badge" style={{ marginBottom: 'var(--space-sm)', display: 'inline-flex' }}>
                                {debateType.emoji === '❓' ? (
                                    <img src="/icons/interrogation.png" alt="❓" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                                ) : debateType.emoji === '⚖️' ? (
                                    <img src="/icons/scale.png" alt="⚖️" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                                ) : debateType.emoji === '💭' ? (
                                    <img src="/icons/opinion.png" alt="💭" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                                ) : debateType.emoji === '🏆' ? (
                                    <img src="/icons/medal.png" alt="🏆" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} />
                                ) : debateType.emoji} {debateType.label}
                            </span>
                            <h1 className="debate-title">{debate.title}</h1>
                            <div className="debate-meta">
                                <Link
                                    to={`/profile/${debate.profiles?.username}`}
                                    className="debate-author-link"
                                >
                                    {debate.profiles?.avatar_url ? (
                                        <img
                                            src={debate.profiles.avatar_url}
                                            alt=""
                                            className="debate-author-avatar"
                                        />
                                    ) : (
                                        <div
                                            className="debate-author-avatar-placeholder"
                                            style={{
                                                background: `linear-gradient(135deg, ${debate.profiles?.color_primary || '#8b5cf6'}, ${debate.profiles?.color_secondary || '#6366f1'})`
                                            }}
                                        >
                                            {debate.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    {debate.profiles?.display_name}
                                </Link>
                                <span className="debate-date">
                                    {new Date(debate.created_at).toLocaleDateString('es-ES', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>
                        </div>

                        {isOwner && (
                            <div className="debate-actions" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                {!debate.is_locked && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowCloseConfirm(true)}
                                    >
                                        🔒 Cerrar
                                    </button>
                                )}
                                <button
                                    className="btn btn-danger"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    🗑️ Eliminar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Original Post */}
                <div className="debate-original-post">
                    <DebatePost
                        post={{
                            id: `original-${debate.id}`,
                            content: debate.content,
                            created_at: debate.created_at,
                            profiles: debate.profiles,
                            user_id: debate.user_id,
                            reaction_score: 0
                        }}
                        isOriginal={true}
                        debateMedia={debate.media}
                        currentUserId={user?.id}
                        debateOwnerId={debate.user_id}
                    />
                </div>

                {/* Posts Section */}
                <div className="debate-posts-section">
                    <div className="debate-posts-header">
                        <h3 className="debate-posts-title">
                            <img src="/icons/dialog.png" alt="💬" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Respuestas ({debate.posts_count})
                        </h3>
                        <div className="debate-posts-sort">
                            <button
                                className={`debate-sort-btn ${sortOrder === 'recent' ? 'active' : ''}`}
                                onClick={() => setSortOrder('recent')}
                            >
                                Recientes
                            </button>
                            <button
                                className={`debate-sort-btn ${sortOrder === 'score' ? 'active' : ''}`}
                                onClick={() => setSortOrder('score')}
                            >
                                Más valorados
                            </button>
                        </div>
                    </div>

                    {postsLoading ? (
                        <div className="debates-loading">
                            <div className="loading-spinner"></div>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="debate-posts-empty">
                            <p>Aún no hay respuestas. ¡Sé el primero en opinar!</p>
                        </div>
                    ) : (
                        <div className="debate-posts-list">
                            {posts.map(post => (
                                <DebatePost
                                    key={post.id}
                                    post={post}
                                    debateMedia={debate.media}
                                    onQuote={handleQuote}
                                    onDelete={handleDeletePost}
                                    currentUserId={user?.id}
                                    debateOwnerId={debate.user_id}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Reply Form */}
                {user && !debate.is_locked ? (
                    <form className="debate-reply-form" onSubmit={handleSubmitReply}>
                        <h4>✍️ Tu respuesta</h4>

                        {/* Quoted Post */}
                        {quotedPost && (
                            <div className="debate-reply-quote">
                                <div className="debate-reply-quote-content">
                                    <div className="debate-reply-quote-author">
                                        Citando a {quotedPost.profiles?.display_name}:
                                    </div>
                                    {quotedPost.content.substring(0, 100)}
                                    {quotedPost.content.length > 100 && '...'}
                                </div>
                                <button
                                    type="button"
                                    className="debate-reply-quote-remove"
                                    onClick={() => setQuotedPost(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Mention Media */}
                        <div className="debate-reply-media-picker">
                            {mentionedMedia ? (
                                <div className="debate-reply-media-selected">
                                    {mentionedMedia.cover_url && (
                                        <img
                                            src={getHighResImage(mentionedMedia.cover_url)}
                                            alt=""
                                        />
                                    )}
                                    <span>{mentionedMedia.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setMentionedMedia(null)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="debate-reply-media-btn"
                                    onClick={() => setShowMediaSelector(true)}
                                >
                                    <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Mencionar obra
                                </button>
                            )}
                        </div>

                        <textarea
                            className="debate-reply-textarea"
                            placeholder="Escribe tu opinión..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            maxLength={3000}
                            required
                        />

                        <div className="debate-reply-actions">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <span className="debate-reply-char-count">
                                    {replyContent.length} / 3000
                                </span>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-xs)',
                                    fontSize: 'var(--text-sm)',
                                    color: isSpoiler ? '#f59e0b' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={isSpoiler}
                                        onChange={(e) => setIsSpoiler(e.target.checked)}
                                        style={{ accentColor: '#f59e0b' }}
                                    />
                                    ⚠️ Spoiler
                                </label>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting || !replyContent.trim()}
                            >
                                {submitting ? 'Publicando...' : <><img src="/icons/dialog.png" alt="💬" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Publicar respuesta</>}
                            </button>
                        </div>
                    </form>
                ) : !user ? (
                    <div className="debate-reply-form" style={{ textAlign: 'center' }}>
                        <p>Inicia sesión para participar en el debate</p>
                        <Link to="/login" className="btn btn-secondary" style={{ marginTop: 'var(--space-md)' }}>
                            Iniciar sesión
                        </Link>
                    </div>
                ) : debate.is_locked ? (
                    <div className="debate-reply-form" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>🔒 Este debate está cerrado</p>
                    </div>
                ) : null}

                {/* Media Selector Modal */}
                <MediaSelector
                    isOpen={showMediaSelector}
                    onClose={() => setShowMediaSelector(false)}
                    onSelect={handleSelectMentionMedia}
                    selectedMedia={mentionedMedia ? [mentionedMedia] : []}
                    maxSelections={1}
                />

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div
                        className="modal-overlay"
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}
                    >
                        <div
                            className="modal"
                            style={{
                                background: 'var(--bg-secondary)',
                                padding: 'var(--space-xl)',
                                borderRadius: 'var(--radius-xl)',
                                maxWidth: '400px',
                                textAlign: 'center'
                            }}
                        >
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>
                                ¿Eliminar este debate?
                            </h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                                Esta acción no se puede deshacer. Se eliminarán todas las respuestas.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={handleDeleteDebate}
                                    disabled={deleting}
                                >
                                    {deleting ? 'Eliminando...' : '🗑️ Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Close Confirmation Modal */}
                {showCloseConfirm && (
                    <div
                        className="modal-overlay"
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}
                    >
                        <div
                            className="modal"
                            style={{
                                background: 'var(--bg-secondary)',
                                padding: 'var(--space-xl)',
                                borderRadius: 'var(--radius-xl)',
                                maxWidth: '400px',
                                textAlign: 'center'
                            }}
                        >
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>
                                🔒 ¿Cerrar este debate?
                            </h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                                El debate permanecerá visible pero nadie podrá responder.
                                No aparecerá en la lista principal, pero sí en búsquedas.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowCloseConfirm(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleCloseDebate}
                                    disabled={closing}
                                >
                                    {closing ? 'Cerrando...' : '🔒 Cerrar debate'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
