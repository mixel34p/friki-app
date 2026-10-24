import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserLibrary, deleteWorkLog } from '../lib/libraryService'
import { getWorkById } from '../lib/workPageService'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ReviewLikeButton from '../components/ReviewLikeButton'
import '../components/LibraryGrid.css'
import './UserReviews.css'

export default function UserReviews() {
    const { username } = useParams()
    const { user, updateProfile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)
    const [reviews, setReviews] = useState([])
    const [revealedSpoilers, setRevealedSpoilers] = useState({})
    const [expandedReviews, setExpandedReviews] = useState({})
    const [openMenuId, setOpenMenuId] = useState(null)

    const isOwnProfile = user && profile && user.id === profile.id;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.review-menu-container')) {
                setOpenMenuId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleDelete = async (log) => {
        if (!window.confirm('¿Seguro que quieres eliminar esta reseña?')) return;
        try {
            await deleteWorkLog(log.user_id, log.work_id, log.work_type)
            setReviews(reviews.filter(r => r.id !== log.id))
            setOpenMenuId(null)
            if (profile?.pinned_review_id === log.id) {
                await updateProfile({ pinned_review_id: null })
            }
        } catch (e) {
            alert('Error al eliminar la reseña')
        }
    }

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
                    .select('id, username, avatar_url, pinned_review_id, theme_color')
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
                
                let allReviews = validLogs
                    .filter(log => log.review_text && log.review_text.trim() !== '')
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

                if (userData.pinned_review_id) {
                    const pinnedIdx = allReviews.findIndex(r => r.id === userData.pinned_review_id);
                    if (pinnedIdx > -1) {
                        const pinnedReview = allReviews.splice(pinnedIdx, 1)[0];
                        pinnedReview.isPinned = true;
                        allReviews.unshift(pinnedReview);
                    }
                }

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
        <div
            className="page-container user-reviews-page"
            style={profile?.theme_color ? {
                '--brand-primary': profile.theme_color,
                '--brand-dark': profile.theme_color
            } : {}}
        >
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
                            <div key={log.id} className="review-card" style={{ position: 'relative' }}>
                                {log.isPinned && !isOwnProfile && (
                                    <div className="review-pin-badge" title="Reseña destacada">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                    </div>
                                )}
                                {isOwnProfile && (
                                    <div className="review-menu-container">
                                        {log.isPinned && (
                                            <div className="review-menu-pin-badge" title="Reseña destacada">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                            </div>
                                        )}
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === log.id ? null : log.id) }}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex', alignItems: 'center' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                        </button>
                                        {openMenuId === log.id && (
                                            <div className="review-dropdown-menu">
                                                <button 
                                                    className="review-dropdown-btn"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        try {
                                                            await updateProfile({ pinned_review_id: log.isPinned ? null : log.id });
                                                            const newReviews = [...reviews];
                                                            const idx = newReviews.findIndex(r => r.id === log.id);
                                                            if (idx > -1) {
                                                                if (log.isPinned) {
                                                                    newReviews[idx].isPinned = false;
                                                                    setReviews(newReviews);
                                                                } else {
                                                                    newReviews.forEach(r => r.isPinned = false);
                                                                    newReviews[idx].isPinned = true;
                                                                    const p = newReviews.splice(idx, 1)[0];
                                                                    newReviews.unshift(p);
                                                                    setReviews(newReviews);
                                                                }
                                                            }
                                                            setProfile({...profile, pinned_review_id: log.isPinned ? null : log.id});
                                                            setOpenMenuId(null);
                                                        } catch (err) {
                                                            alert('Error al fijar');
                                                        }
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                                    {log.isPinned ? "Quitar destacada" : "Fijar en perfil"}
                                                </button>
                                                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }}></div>
                                                <button 
                                                    className="review-dropdown-btn danger"
                                                    onClick={(e) => { e.preventDefault(); handleDelete(log); }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                    Eliminar reseña
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
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

