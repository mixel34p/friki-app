import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getWorkById } from '../lib/workPageService'
import { getWorkReviews, getWorkRatings, getWorkReviewStats } from '../lib/libraryService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import LoadingSpinner from '../components/LoadingSpinner'
import ReviewLikeButton from '../components/ReviewLikeButton'
import SEO from '../components/SEO'
import { BADGES_MAP } from '../lib/badges'
import '../components/LibraryGrid.css'
import './WorkReviews.css'

export default function WorkReviews({ mediaType }) {
    const { id } = useParams()
    const [work, setWork] = useState(null)
    const [reviews, setReviews] = useState([])
    const [ratings, setRatings] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [filteredReviewCount, setFilteredReviewCount] = useState(0)
    const [averageRating, setAverageRating] = useState(null)
    const [totalRatings, setTotalRatings] = useState(0)
    const [filteredRatingsCount, setFilteredRatingsCount] = useState(0)
    const [activeTab, setActiveTab] = useState('reviews')
    const [ratingFilter, setRatingFilter] = useState(null)
    const [showStarFilter, setShowStarFilter] = useState(false)
    const [hoverRating, setHoverRating] = useState(null)
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
                if (activeTab === 'reviews') {
                    const { data, count } = await getWorkReviews(id, mediaType, page, limit, ratingFilter)
                    setReviews(data)
                    setFilteredReviewCount(count)
                    if (page === 1 && ratingFilter == null) {
                        const stats = await getWorkReviewStats(id, mediaType)
                        setAverageRating(stats.average)
                        setTotalCount(stats.count)
                        setTotalRatings(stats.ratingsCount)
                    }
                } else {
                    const { data, count } = await getWorkRatings(id, mediaType, page, limit, ratingFilter)
                    setRatings(data)
                    setFilteredRatingsCount(count)
                }
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [id, mediaType, page, activeTab, ratingFilter])

    const renderStars = (rating) => {
        const roundedRating = rating == null ? 0 : Math.round(rating * 2) / 2
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            let fill = "transparent";
            if (roundedRating >= i) fill = "var(--brand-primary)";
            else if (roundedRating === i - 0.5) fill = `url(#halfStar-${i})`;
            stars.push(
                <svg key={i} viewBox="0 0 24 24" width="20" height="20">
                    <defs>
                        <linearGradient id={`halfStar-${i}`} x1="0" x2="100%" y1="0" y2="0">
                            <stop offset="50%" stopColor="var(--brand-primary)" />
                            <stop offset="50%" stopColor="transparent" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={roundedRating === i - 0.5 ? `url(#halfStar-${i})` : fill}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        }
        return <div className="wr-rating-stars" aria-label={`${rating == null ? 'Sin puntuación' : `${rating.toFixed(1)} de 5`} estrellas`}>{stars}</div>
    }

    const visibleEntries = activeTab === 'reviews' ? reviews : ratings
    const visibleCount = activeTab === 'reviews' ? filteredReviewCount : filteredRatingsCount
    if (loading && !work && reviews.length === 0 && ratings.length === 0) return <LoadingSpinner />

    const totalPages = Math.ceil(visibleCount / limit)

    const handleTabClick = (tab) => {
        if (activeTab === tab) {
            setShowStarFilter(open => !open)
            return
        }

        setActiveTab(tab)
        setPage(1)
        setShowStarFilter(false)
    }

    const selectRatingFilter = (rating) => {
        setRatingFilter(rating)
        setPage(1)
        setShowStarFilter(false)
        setHoverRating(null)
    }

    const renderStarFilter = (label) => {
        const previewRating = hoverRating ?? ratingFilter ?? 0

        return (
            <div className="wr-star-filter" role="dialog" aria-label={`Filtrar ${label} por estrellas`}>
                <div className="wr-star-filter-heading">
                    <div>
                        <div className="wr-star-filter-title">Filtrar por estrellas</div>
                        <div className="wr-star-filter-current">
                            {previewRating > 0 ? `${previewRating.toFixed(1)} de 5` : 'Todas las puntuaciones'}
                        </div>
                    </div>
                    <button type="button" className="wr-star-filter-clear" onClick={() => selectRatingFilter(null)}>
                        Todas
                    </button>
                </div>
                <div className="wr-star-picker" onMouseLeave={() => setHoverRating(null)}>
                    {[1, 2, 3, 4, 5].map(star => {
                        const fill = previewRating >= star
                            ? 'var(--brand-primary)'
                            : previewRating >= star - 0.5
                                ? `url(#wr-filter-half-${star})`
                                : 'transparent'

                        return (
                            <span className="wr-star-choice" key={star}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <defs>
                                        <linearGradient id={`wr-filter-half-${star}`} x1="0" x2="100%" y1="0" y2="0">
                                            <stop offset="50%" stopColor="var(--brand-primary)" />
                                            <stop offset="50%" stopColor="transparent" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={fill} stroke="var(--brand-primary)" strokeWidth="1.5" strokeLinejoin="round" />
                                </svg>
                                <button
                                    type="button"
                                    className="wr-star-half-hit"
                                    aria-label={`${star - 0.5} estrellas`}
                                    aria-pressed={ratingFilter === star - 0.5}
                                    onMouseEnter={() => setHoverRating(star - 0.5)}
                                    onFocus={() => setHoverRating(star - 0.5)}
                                    onClick={() => selectRatingFilter(star - 0.5)}
                                />
                                <button
                                    type="button"
                                    className="wr-star-full-hit"
                                    aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                                    aria-pressed={ratingFilter === star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onFocus={() => setHoverRating(star)}
                                    onClick={() => selectRatingFilter(star)}
                                />
                            </span>
                        )
                    })}
                </div>
                <div className="wr-star-filter-hint">Pulsa la mitad izquierda o derecha de una estrella</div>
            </div>
        )
    }

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
            <SEO title={`${title} (${mediaType === 'game' ? 'Videojuego' : 'Anime'})`} description={`${title}, ${mediaType === 'game' ? 'videojuego' : 'anime'} en GeekSphere.`} />
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
                            <Link to={`/${mediaType}/${id}`}>{title}</Link>
                        </h1>
                        {releaseYear && <div className="wr-release-date">{releaseYear}</div>}
                        <div className="wr-rating-summary">
                            <span className="wr-average">{averageRating == null ? '—' : averageRating.toFixed(1)}</span>
                            <div className="wr-rating-detail">
                                {renderStars(averageRating)}
                                <span className="wr-review-count">de {totalRatings} {totalRatings === 1 ? 'valoración' : 'valoraciones'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="reviews-list-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 5%' }}>
                <div className="wr-tabs" role="tablist" aria-label="Contenido de la obra">
                    <div className="wr-tab-item">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'reviews'}
                            className={`wr-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                            onClick={() => handleTabClick('reviews')}
                        >
                            Reviews <span>{totalCount}</span>
                        </button>
                        {activeTab === 'reviews' && showStarFilter && (
                            renderStarFilter('reviews')
                        )}
                    </div>
                    <div className="wr-tab-item">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'ratings'}
                            className={`wr-tab ${activeTab === 'ratings' ? 'active' : ''}`}
                            onClick={() => handleTabClick('ratings')}
                        >
                            Valoraciones <span>{totalRatings}</span>
                        </button>
                        {activeTab === 'ratings' && showStarFilter && (
                            renderStarFilter('valoraciones')
                        )}
                    </div>
                </div>

                {visibleEntries.length === 0 ? (
                    <div className="activity-empty">{activeTab === 'reviews' ? 'No hay reseñas para esta obra todavía.' : 'Todavía no hay valoraciones para esta obra.'}</div>
                ) : activeTab === 'ratings' ? (
                    <div className="wr-ratings-grid">
                        {ratings.map(log => (
                            <div key={log.id} className="review-card wr-rating-card">
                                <Link
                                    to={`/profile/${log.profiles?.username}`}
                                    className="wr-rating-avatar-link"
                                    title={log.profiles?.display_name || log.profiles?.username || 'Usuario'}
                                >
                                    <div
                                        className="wr-user-avatar"
                                        style={{
                                            backgroundImage: `url(${log.profiles?.avatar_url || 'https://via.placeholder.com/48'})`,
                                            borderColor: log.profiles?.theme_color || 'var(--brand-primary)'
                                        }}
                                    />
                                </Link>
                                <div className="wr-rating-card-score" aria-label={`${Number(log.rating).toFixed(1)} de 5 estrellas`}>
                                    {renderStars(log.rating)}
                                    <span>{Number(log.rating).toFixed(1)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="reviews-list-stack">
                        {reviews.map(log => (
                            <div key={log.id} className="review-card work-review-layout">
                                <div className="review-user-heading">
                                    <div className="review-user-identity">
                                        <Link to={`/profile/${log.profiles?.username}`} className="review-poster-link">
                                            <div
                                                className="review-poster"
                                                style={{ backgroundImage: `url(${log.profiles?.avatar_url || 'https://via.placeholder.com/48'})`, borderRadius: '50%', width: '48px', height: '48px', border: `2px solid ${log.profiles?.theme_color || 'var(--brand-primary)'}`, boxSizing: 'border-box' }}
                                            ></div>
                                        </Link>
                                        <div className="review-author-name-group">
                                            <Link to={`/profile/${log.profiles?.username}`} className="review-title">
                                                {log.profiles?.display_name || log.profiles?.username}
                                            </Link>
                                            {log.profiles?.featured_badge && BADGES_MAP[log.profiles?.featured_badge] && (
                                                <span style={{ color: BADGES_MAP[log.profiles.featured_badge].color, display: 'inline-flex' }} title={BADGES_MAP[log.profiles.featured_badge].title}>
                                                    {BADGES_MAP[log.profiles.featured_badge].icon}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <time className="work-review-date" dateTime={log.created_at}>
                                        {formatRelativeDate(log.created_at)}
                                    </time>
                                </div>
                                {log.rating != null && (
                                    <div className="work-review-rating-line">
                                        {renderStars(log.rating)}
                                        <span>{Number(log.rating).toFixed(1)}</span>
                                    </div>
                                )}
                                <div className="review-content">
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
