import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { toggleReaction, getReviewComments, postReviewComment, deleteReview } from '../../lib/reviewService'
import { formatRelativeDate } from '../../lib/formatRelativeDate'
import { Link } from 'react-router-dom'
import './Reviews.css'

export default function ReviewCard({ review, myReaction, onReactionUpdate, onEdit, onDelete }) {
    const { user } = useAuth()
    const [showSpoiler, setShowSpoiler] = useState(!review.is_spoiler)
    const [comments, setComments] = useState([])
    const [showComments, setShowComments] = useState(false)
    const [replying, setReplying] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const isOwner = user && user.id === review.user_id

    // Optimistic reaction UI
    const [optimisticCounts, setOptimisticCounts] = useState({
        good_point: review.count_good_point || 0,
        interesting: review.count_interesting || 0,
        strong_opinion: review.count_strong_opinion || 0
    })
    const [currentReaction, setCurrentReaction] = useState(myReaction)

    useEffect(() => {
        setOptimisticCounts({
            good_point: review.count_good_point || 0,
            interesting: review.count_interesting || 0,
            strong_opinion: review.count_strong_opinion || 0
        })
        setCurrentReaction(myReaction)
    }, [review, myReaction])

    const handleDelete = async () => {
        if (!window.confirm('¿Seguro que quieres borrar tu review?')) return

        setIsDeleting(true)
        try {
            await deleteReview(review.id)
            if (onDelete) onDelete()
        } catch (err) {
            console.error('Error deleting review:', err)
            setIsDeleting(false)
        }
    }

    const handleReaction = async (type) => {
        if (!user) return // TODO: Trigger login?

        const oldReaction = currentReaction
        const oldCounts = { ...optimisticCounts }

        // Optimistic Update
        let newReaction = null
        if (oldReaction === type) {
            // Untoggle
            setOptimisticCounts(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }))
            setCurrentReaction(null)
        } else {
            // Toggle/Swap
            setOptimisticCounts(prev => ({
                ...prev,
                [oldReaction]: oldReaction ? Math.max(0, prev[oldReaction] - 1) : prev[oldReaction],
                [type]: prev[type] + 1
            }))
            setCurrentReaction(type)
            newReaction = type
        }

        try {
            await toggleReaction(review.id, type, user.id)
            if (onReactionUpdate) onReactionUpdate()
        } catch (err) {
            // Revert
            setOptimisticCounts(oldCounts)
            setCurrentReaction(oldReaction)
            console.error('Error reaction', err)
        }
    }

    const handleLoadComments = async () => {
        if (showComments) {
            setShowComments(false)
            return
        }
        try {
            const data = await getReviewComments(review.id)
            setComments(data || [])
            setShowComments(true)
        } catch (err) {
            console.error(err)
        }
    }

    const handlePostReply = async (e) => {
        e.preventDefault()
        if (!replyText.trim()) return

        try {
            const newComment = await postReviewComment(review.id, replyText.trim(), user.id)
            setComments(prev => [...prev, newComment])
            setReplyText('')
            setReplying(false)
            setShowComments(true) // Ensure open
        } catch (err) {
            console.error(err)
        }
    }

    const renderStars = (rating) => {
        return (
            <div className="review-rating-display">
                {[1, 2, 3, 4, 5].map(star => (
                    <span
                        key={star}
                        className={`review-star ${star <= rating ? 'filled' : ''}`}
                    >
                        ★
                    </span>
                ))}
            </div>
        )
    }

    if (isDeleting) return null // Or a spinner/fading out

    return (
        <div className="review-card">
            <div className="review-card-header">
                <div className="review-user-block">
                    {review.profiles ? (
                        <Link to={`/profile/${review.profiles.username}`}>
                            <img
                                src={review.profiles.avatar_url || 'https://via.placeholder.com/48'}
                                alt={review.profiles.username}
                                className="review-author-avatar"
                            />
                        </Link>
                    ) : (
                        <div className="review-author-avatar" style={{ background: '#333' }}></div>
                    )}
                    <div className="review-meta-text">
                        <span className="review-author-name">
                            {review.profiles?.display_name || 'Usuario'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            {isOwner && (
                                <div className="review-owner-actions" style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <button
                                        onClick={() => onEdit && onEdit(review)}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Borrar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="review-card-rating-meta">
                    <time className="review-date" dateTime={review.created_at}>
                        {formatRelativeDate(review.created_at)}
                    </time>
                    {renderStars(review.rating)}
                </div>
            </div>

            {review.title && <h3 className="review-title">{review.title}</h3>}

            <div className="review-body">
                <div className={!showSpoiler ? 'review-spoiler-blur' : ''}>
                    {review.content}
                </div>

                {!showSpoiler && (
                    <button className="spoiler-reveal-btn" onClick={() => setShowSpoiler(true)}>
                        <img src="/icons/lupa.png" alt="👁️" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Ver Spoiler
                    </button>
                )}
            </div>

            <div className="review-actions-bar">
                <div
                    className={`reaction-chip ${currentReaction === 'good_point' ? 'active' : ''}`}
                    onClick={() => handleReaction('good_point')}
                >
                    👍 <span className="reaction-label">Buen punto</span>
                    {optimisticCounts.good_point > 0 && <span className="reaction-count">{optimisticCounts.good_point}</span>}
                </div>

                <div
                    className={`reaction-chip ${currentReaction === 'interesting' ? 'active' : ''}`}
                    onClick={() => handleReaction('interesting')}
                >
                    💡 <span className="reaction-label">Interesante</span>
                    {optimisticCounts.interesting > 0 && <span className="reaction-count">{optimisticCounts.interesting}</span>}
                </div>

                <div
                    className={`reaction-chip ${currentReaction === 'strong_opinion' ? 'active' : ''}`}
                    onClick={() => handleReaction('strong_opinion')}
                >
                    <img src="/icons/fire.gif" alt="🔥" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> <span className="reaction-label">Opinión fuerte</span>
                    {optimisticCounts.strong_opinion > 0 && <span className="reaction-count">{optimisticCounts.strong_opinion}</span>}
                </div>

                <button className="reply-action-btn" onClick={handleLoadComments}>
                    <img src="/icons/dialog.png" alt="💬" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> {comments.length > 0 ? `${comments.length} Respuestas` : 'Responder'}
                </button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="review-comments-container">
                    {comments.map(c => (
                        <div key={c.id} className="comment-bubble">
                            <div className="comment-header">
                                <Link to={`/profile/${c.profiles?.username}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
                                    <img
                                        src={c.profiles?.avatar_url || 'https://via.placeholder.com/32'}
                                        alt=""
                                        className="comment-avatar"
                                    />
                                    <span className="comment-author-name">{c.profiles?.display_name}</span>
                                </Link>
                                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                                    {new Date(c.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="comment-content">{c.content}</div>
                        </div>
                    ))}

                    {user && (
                        <div className="comment-input-wrapper">
                            <input
                                type="text"
                                className="modern-input"
                                placeholder="Escribe una respuesta..."
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handlePostReply(e)}
                            />
                            <button
                                className="btn-submit"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                onClick={handlePostReply}
                            >
                                Enviar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
