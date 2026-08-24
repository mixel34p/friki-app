import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getUserLibrary } from '../lib/libraryService'
import { getWorkById } from '../lib/workPageService'
import LoadingSpinner from './LoadingSpinner'
import './LibraryGrid.css'

export default function LibraryGrid({ userId }) {
    const [loading, setLoading] = useState(true)
    const [recentReviews, setRecentReviews] = useState([])
    const [diaryMonths, setDiaryMonths] = useState([])
    const [revealedSpoilers, setRevealedSpoilers] = useState({})
    const [expandedReviews, setExpandedReviews] = useState({})

    const toggleExpand = (e, id) => {
        e.preventDefault()
        setExpandedReviews(prev => ({ ...prev, [id]: !prev[id] }))
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

    const toggleSpoiler = (id) => {
        setRevealedSpoilers(prev => ({ ...prev, [id]: true }))
    }

    useEffect(() => {
        if (!userId) return

        const fetchActivity = async () => {
            setLoading(true)
            try {
                // Fetch all logs
                const logs = await getUserLibrary(userId)
                
                // Fetch populated data
                const populatedLogs = await Promise.all(logs.map(async (log) => {
                    const workDetails = await getWorkById(log.work_type, parseInt(log.work_id))
                    return {
                        ...log,
                        work: workDetails
                    }
                }))
                
                const validLogs = populatedLogs.filter(log => log.work !== null)

                // 1. Recent Reviews (has review_text)
                const reviews = validLogs
                    .filter(log => log.review_text && log.review_text.trim() !== '')
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 2)
                
                setRecentReviews(reviews)

                // 2. Diary Grouped By Month (using finished_date, fallback to created_at)
                const monthGroups = {}
                validLogs.forEach(log => {
                    const dateObj = new Date(log.finished_date || log.created_at)
                    const shortMonth = dateObj.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().substring(0, 3)
                    const yearStr = dateObj.getFullYear()
                    const monthKey = `${shortMonth}-${yearStr}`
                    
                    if (!monthGroups[monthKey]) {
                        monthGroups[monthKey] = {
                            id: monthKey,
                            shortMonth,
                            year: yearStr,
                            dateForSort: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1),
                            entries: []
                        }
                    }
                    monthGroups[monthKey].entries.push({
                        ...log,
                        day: dateObj.getDate()
                    })
                })

                // Sort months descending and take top 2
                const sortedMonths = Object.values(monthGroups)
                    .sort((a, b) => b.dateForSort - a.dateForSort)
                    .slice(0, 2)
                
                // Sort entries within each month by day descending
                sortedMonths.forEach(m => {
                    m.entries.sort((a, b) => b.day - a.day)
                })

                setDiaryMonths(sortedMonths)

            } catch (err) {
                console.error('Error fetching activity:', err)
            } finally {
                setLoading(false)
            }
        }
        
        fetchActivity()
    }, [userId])

    if (loading) {
        return (
            <div className="activity-loading">
                <LoadingSpinner size="md" />
            </div>
        )
    }

    if (recentReviews.length === 0 && diaryMonths.length === 0) {
        return (
            <div className="activity-empty">
                <p>No hay actividad reciente en el diario.</p>
            </div>
        )
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
                        <linearGradient id="halfStarSmall">
                            <stop offset="50%" stopColor="var(--brand-primary)" />
                            <stop offset="50%" stopColor="transparent" stopOpacity="1" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={fill}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        }
        return <div className="activity-stars">{stars}</div>
    }

    return (
        <div className="profile-activity-container">
            {/* LEFT COLUMN: RECENT REVIEWS */}
            <div className="activity-col activity-reviews">
                <div className="activity-col-header">
                    <h3>Reseñas Recientes</h3>
                    <Link to="/library" className="activity-view-all">Ver todas</Link>
                </div>
                
                {recentReviews.length === 0 ? (
                    <div className="activity-empty-box">Aún no hay reseñas.</div>
                ) : (
                    <div className="reviews-list">
                        {recentReviews.map(log => (
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
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: DIARY */}
            <div className="activity-col activity-diary">
                <div className="activity-col-header">
                    <h3>Diario</h3>
                    <Link to="/library" className="activity-view-all">Ver diario</Link>
                </div>

                {diaryMonths.length === 0 ? (
                    <div className="activity-empty-box">Aún no hay entradas en el diario.</div>
                ) : (
                    <div className="diary-list">
                        {diaryMonths.map(month => (
                            <div key={month.id} className="diary-month-group">
                                <div className="diary-month-header">
                                    <div className="diary-month-calendar">
                                        <div className="calendar-rings"><span></span><span></span><span></span></div>
                                        <div className="calendar-body">{month.shortMonth}</div>
                                    </div>
                                    <span className="diary-month-year">{month.year}</span>
                                </div>
                                <div className="diary-entries">
                                    {month.entries.map(log => (
                                        <div key={log.id} className="diary-entry">
                                            <div className="diary-day">{log.day}</div>
                                            <Link to={`/${log.work_type}/${log.work_id}`} className="diary-entry-poster">
                                                <div className="diary-micro-poster" style={{ backgroundImage: `url(${log.work_type === 'game' ? log.work.cover_url : log.work.image_url})` }}></div>
                                            </Link>
                                            <div className="diary-entry-info">
                                                <div className="diary-entry-header">
                                                    <Link to={`/${log.work_type}/${log.work_id}`} className="diary-entry-title">
                                                        {log.work_type === 'game' ? log.work.name : log.work.title}
                                                    </Link>
                                                    <span className="diary-entry-year">
                                                        {getWorkYear(log.work, log.work_type)}
                                                    </span>
                                                </div>
                                                {renderStars(log.rating)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

