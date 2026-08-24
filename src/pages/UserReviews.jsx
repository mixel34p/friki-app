import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserLibrary } from '../lib/libraryService'
import { getWorkById } from '../lib/workPageService'
import LoadingSpinner from '../components/LoadingSpinner'
import ReviewLikeButton from '../components/ReviewLikeButton'
import '../components/LibraryGrid.css'
import './UserReviews.css'

export default function UserReviews() {
    const { username } = useParams()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)
    const [reviews, setReviews] = useState([])
    const [revealedSpoilers, setRevealedSpoilers] = useState({})
    const [expandedReviews, setExpandedReviews] = useState({})

    const toggleExpand = (e, id) => {
        e.preventDefault()
        setExpandedReviews(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const toggleSpoiler = (id) => {
        setRevealedSpoilers(prev => ({ ...prev, [id]: true }))
    }

    const getWorkYear = (work, type) => {
        if (!work.release_date) return '';
        if (type === 'game') {
            if (typeof work.release_date === 'number') {
                return new Date(work.release_date * 1000).getFullYear();
            }
            return new Date(work.release_date).getFullYear();
        } else {
            return new Date(work.release_date).getFullYear();
        }
    }

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

    useEffect(() => {
        const fetchUserAndReviews = async () => {
            if (!username) return
            setLoading(true)
            try {
                // Get profile ID from username
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .eq('username', username)
                    .single()
                
                if (userError || !userData) {
                    console.error('User not found')
                    setLoading(false)
                    return
                }
                setProfile(userData)

                const logs = await getUserLibrary(userData.id)
                
                // Get fully populated logs that have text
                const populatedLogs = await Promise.all(logs.map(async (log) => {
                    const workDetails = await getWorkById(log.work_type, parseInt(log.work_id))
                    return {
                        ...log,
                        work: workDetails
                    }
                }))

                const validLogs = populatedLogs.filter(log => log.work)
                
                const allReviews = validLogs
                    .filter(log => log.review_text && log.review_text.trim() !== '')
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

                setReviews(allReviews)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        
        fetchUserAndReviews()
    }, [username])

    if (loading) return <LoadingSpinner />

    return (
        <div className="page-container user-reviews-page">
            <div className="user-page-header">
                <div className="user-page-header-content">
                    <div className="user-page-title-row">
                        <Link to={`/profile/${username}`}>
                            <div 
                                className="user-page-avatar" 
                                style={{ backgroundImage: `url(${profile?.avatar_url || '/default-avatar.png'})` }}
                            ></div>
                        </Link>
                        <h2>
                            Reseñas de <Link to={`/profile/${username}`} className="user-link">@{username}</Link>
                        </h2>
                    </div>
                </div>
                <div className="user-page-stats">{reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</div>
            </div>

            <div className="reviews-list-container">
                {reviews.length === 0 ? (
                    <div className="activity-empty">Este usuario no ha escrito ninguna reseña todavía.</div>
                ) : (
                    <div className="reviews-list-stack">
                        {reviews.map(log => (
                            <div key={log.id} className="review-card">
                                <Link to={`/${log.work_type}/${log.work_id}`} className="review-poster-link">
                                    <div className="review-poster" style={{ backgroundImage: `url(${log.work_type === 'game' ? log.work.cover_url : log.work.image_url})` }}></div>
                                </Link>
                                <div className="review-content">
                                    <div className="review-header">
                                        <Link to={`/${log.work_type}/${log.work_id}`} className="review-title">
                                            {log.work_type === 'game' ? log.work.name : log.work.title}
                                        </Link>
                                        <span className="review-year">
                                            {getWorkYear(log.work, log.work_type)}
                                        </span>
                                    </div>
                                    <div className="review-metadata">
                                        {renderStars(log.rating)}
                                        {log.finished_date && (
                                            <span className="review-finished-date">
                                                Finished {new Date(log.finished_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
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
            </div>
        </div>
    )
}

