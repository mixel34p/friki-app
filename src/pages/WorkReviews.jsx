import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getWorkById } from '../lib/workPageService'
import { getWorkReviews } from '../lib/libraryService'
import LoadingSpinner from '../components/LoadingSpinner'
import ReviewLikeButton from '../components/ReviewLikeButton'
import { BADGES_MAP } from '../lib/badges'
import '../components/LibraryGrid.css'
import './WorkReviews.css'

export default function WorkReviews({ mediaType }) {
    const { id } = useParams()
    const [work, setWork] = useState(null)
    const [reviews, setReviews] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const limit = 10

    const [revealedSpoilers, setRevealedSpoilers] = useState({})
    const [expandedReviews, setExpandedReviews] = useState({})

    const toggleExpand = (e, reviewId) => {
        e.preventDefault()
        setExpandedReviews(prev => ({ ...prev, [reviewId]: !prev[reviewId] }))
    }

    const toggleSpoiler = (reviewId) => {
        setRevealedSpoilers(prev => ({ ...prev, [reviewId]: true }))
    }

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                if (page === 1 && !work) {
                    const workData = await getWorkById(mediaType, parseInt(id))
                    setWork(workData)
                }
                const { data, count } = await getWorkReviews(id, mediaType, page, limit)
                setReviews(data)
                setTotalCount(count)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [id, mediaType, page])

    const renderStars = (rating) => {
        if (!rating) return null;
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            let fill = "transparent";
            if (rating >= i) fill = "var(--brand-primary)";
            else if (rating === i - 0.5) fill = "url(#halfStarSmall)";
            stars.push(
                <svg key={i} viewBox="0 0 24 24" width="14" height="14">
                    <defs>
                        <linearGradient id={`halfStar-${i}`} x1="0" x2="100%" y1="0" y2="0">
                            <stop offset="50%" stopColor="var(--brand-primary)" />
                            <stop offset="50%" stopColor="transparent" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={rating === i - 0.5 ? `url(#halfStar-${i})` : fill}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        }
        return <div className="activity-stars">{stars}</div>
    }

    if (loading && reviews.length === 0) return <LoadingSpinner />

    const totalPages = Math.ceil(totalCount / limit)

    const bannerUrl = work ? (mediaType === 'game' ? work.banner_url || work.cover_url : work.banner_url || work.image_url) : '';
    const posterUrl = work ? (mediaType === 'game' ? work.cover_url : work.image_url) : '';
    const title = work ? (mediaType === 'game' ? work.name : work.title) : '';
    
    let releaseYear = '';
    if (work && (work.release_date || work.first_release_date)) {
        const dateVal = work.release_date || work.first_release_date;
        if (typeof dateVal === 'number') {
            releaseYear = new Date(dateVal * 1000).getFullYear();
        } else {
            releaseYear = new Date(dateVal).getFullYear();
        }
    }

    return (
        <div className="work-reviews-page">
            <div className="wr-header">
                {bannerUrl && <div className="wr-backdrop" style={{ backgroundImage: `url(${bannerUrl})` }}></div>}
                <div className="wr-overlay"></div>
                
                <div className="wr-header-content">
                    {posterUrl && (
                        <Link to={`/${mediaType}/${id}`}>
                            <img src={posterUrl} alt={title} className="wr-poster" />
                        </Link>
                    )}
                    <div className="wr-info">
                        <h1 className="wr-title">
                            Reseñas de <Link to={`/${mediaType}/${id}`}>{title}</Link>
                            {releaseYear && <span className="wr-year">{releaseYear}</span>}
                        </h1>
                        <div className="wr-stats">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            {totalCount} {totalCount === 1 ? 'reseña' : 'reseñas'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="reviews-list-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 5%' }}>
                {reviews.length === 0 ? (
                    <div className="activity-empty">No hay reseñas para esta obra todavía.</div>
                ) : (
                    <div className="reviews-list-stack">
                        {reviews.map(log => (
                            <div key={log.id} className="review-card">
                                <Link to={`/profile/${log.profiles?.username}`} className="review-poster-link">
                                    <div 
                                        className="review-poster" 
                                        style={{ backgroundImage: `url(${log.profiles?.avatar_url || 'https://via.placeholder.com/48'})`, borderRadius: '50%', width: '48px', height: '48px' }}
                                    ></div>
                                </Link>
                                <div className="review-content">
                                    <div className="review-header">
                                        <Link to={`/profile/${log.profiles?.username}`} className="review-title">
                                            {log.profiles?.display_name || log.profiles?.username}
                                        </Link>
                                        {log.profiles?.featured_badge && BADGES_MAP[log.profiles?.featured_badge] && (
                                            <span style={{ color: BADGES_MAP[log.profiles.featured_badge].color, marginLeft: '6px', display: 'inline-flex' }} title={BADGES_MAP[log.profiles.featured_badge].title}>
                                                {BADGES_MAP[log.profiles.featured_badge].icon}
                                            </span>
                                        )}
                                    </div>
                                    {log.rating && (
                                        <div className="review-metadata">
                                            {renderStars(log.rating)}
                                        </div>
                                    )}
                                    <p className="review-text">
                                        {log.contains_spoiler && !revealedSpoilers[log.id] ? (
                                            <span className="spoiler-warning" onClick={() => toggleSpoiler(log.id)}>
                                                Esta reseña contiene spoilers. Haz clic para ver.
                                            </span>
                                        ) : (
                                            <>
                                                {expandedReviews[log.id] || log.review_text.length <= 250 
                                                    ? log.review_text 
                                                    : `${log.review_text.substring(0, 250)}... `}
                                                {log.review_text.length > 250 && (
                                                    <a href="#" className="review-more-btn" onClick={(e) => toggleExpand(e, log.id)}>
                                                        {expandedReviews[log.id] ? 'less' : 'more'}
                                                    </a>
                                                )}
                                            </>
                                        )}
                                    </p>
                                    <ReviewLikeButton entryId={log.id} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Paginación */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                        <button 
                            className="btn btn-outline" 
                            disabled={page === 1} 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Anterior
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'var(--text-muted)' }}>
                            Página {page} de {totalPages}
                        </span>
                        <button 
                            className="btn btn-outline" 
                            disabled={page === totalPages} 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
