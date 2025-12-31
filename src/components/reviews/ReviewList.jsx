import { useState, useEffect } from 'react'
import { getReviews, getMyReactions } from '../../lib/reviewService'
import { useAuth } from '../../context/AuthContext'
import ReviewCard from './ReviewCard'
import ReviewForm from './ReviewForm'
import LoadingSpinner from '../LoadingSpinner'
import './Reviews.css'

export default function ReviewList({ workId, workType, refreshTrigger = 0, showWriteButton = true, onEditReview }) {
    const { user } = useAuth()
    const [reviews, setReviews] = useState([])
    const [loading, setLoading] = useState(false)
    const [sortBy, setSortBy] = useState('recent') // recent, rating_desc, reactions
    const [showForm, setShowForm] = useState(false)
    const [myReactions, setMyReactions] = useState({})
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const LIMIT = 10

    useEffect(() => {
        // When sort or work changes, reset everything
        setPage(0)
        setHasMore(true)
        loadReviews(true)
    }, [workId, workType, sortBy, refreshTrigger])

    const loadReviews = async (reset = false) => {
        setLoading(true)
        try {
            const currentPage = reset ? 0 : page
            const data = await getReviews(workId, workType, sortBy, currentPage, LIMIT)

            if (data.length < LIMIT) {
                setHasMore(false)
            }

            if (reset) {
                setReviews(data || [])
            } else {
                setReviews(prev => [...prev, ...data])
            }

            // Also fetch my reactions if user is logged in
            if (user && data && data.length > 0) {
                const reactionMap = await getMyReactions(data.map(r => r.id), user.id)
                setMyReactions(prev => reset ? reactionMap : { ...prev, ...reactionMap })
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const loadMore = async () => {
        if (loading || !hasMore) return
        const nextPage = page + 1
        setPage(nextPage) // Update UI state
        setLoading(true)

        try {
            const data = await getReviews(workId, workType, sortBy, nextPage, LIMIT)

            if (data.length < LIMIT) {
                setHasMore(false)
            }

            setReviews(prev => [...prev, ...data])

            if (user && data && data.length > 0) {
                const reactionMap = await getMyReactions(data.map(r => r.id), user.id)
                setMyReactions(prev => ({ ...prev, ...reactionMap }))
            }
        } catch (err) {
            console.error(err)
            setPage(prev => prev - 1) // Rollback on error
        } finally {
            setLoading(false)
        }
    }

    const handleReviewAdded = async () => {
        setPage(0)
        setHasMore(true)
        await loadReviews(true)
        window.scrollTo({ top: document.getElementById('reviews-anchor').offsetTop, behavior: 'smooth' })
    }

    // Deletions are handled by reloading data
    const handleReviewDeleted = async () => {
        setPage(0)
        setHasMore(true)
        await loadReviews(true)
    }

    // Callback to refresh reactions when user interacts
    const handleReactionUpdate = async () => {
        // Silently reload to ensure counts are accurate eventually?
    }

    return (
        <div id="reviews-anchor" className="reviews-section">
            <div className="reviews-header">
                <h2>Reseñas y Opiniones</h2>
                {user && showWriteButton && (
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        ✎ Escribir Review
                    </button>
                )}
            </div>

            <div className="reviews-controls">
                <button
                    className={`sort-btn ${sortBy === 'recent' ? 'active' : ''}`}
                    onClick={() => setSortBy('recent')}
                >
                    Más recientes
                </button>
                <button
                    className={`sort-btn ${sortBy === 'rating_desc' ? 'active' : ''}`}
                    onClick={() => setSortBy('rating_desc')}
                >
                    Mejor valoradas
                </button>
                <button
                    className={`sort-btn ${sortBy === 'reactions' ? 'active' : ''}`}
                    onClick={() => setSortBy('reactions')}
                >
                    Más reacciones
                </button>
            </div>

            <div className="reviews-list-container">
                {reviews.length === 0 && !loading ? (
                    <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>No hay reseñas todavía. ¡Sé el primero en opinar!</p>
                    </div>
                ) : (
                    <>
                        <div className="reviews-list">
                            {reviews.map(review => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    myReaction={myReactions[review.id]}
                                    onReactionUpdate={handleReactionUpdate}
                                    onEdit={onEditReview}
                                    onDelete={handleReviewDeleted}
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="reviews-load-more" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={loadMore}
                                    disabled={loading}
                                >
                                    {loading ? 'Cargando...' : 'Cargar más reseñas'}
                                </button>
                            </div>
                        )}

                        {loading && reviews.length > 0 && (
                            <div style={{ margin: '1rem auto', display: 'flex', justifyContent: 'center' }}>
                                <LoadingSpinner />
                            </div>
                        )}
                    </>
                )}

                {loading && reviews.length === 0 && (
                    <div style={{ margin: '2rem auto', display: 'flex', justifyContent: 'center' }}>
                        <LoadingSpinner />
                    </div>
                )}
            </div>

            {showForm && (
                <ReviewForm
                    workId={workId}
                    workType={workType}
                    onClose={() => setShowForm(false)}
                    onReviewAdded={handleReviewAdded}
                />
            )}
        </div>
    )
}
