import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    getWorkById,
    getTierlistsWithWork,
    getSimilarWorks,
    getWorkStats
} from '../lib/workPageService'
import { getWorkLog, getWorkReviews } from '../lib/libraryService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { getSpacesByWork } from '../lib/spaceService'
import LogModal from '../components/LogModal'
import LoadingSpinner from '../components/LoadingSpinner'
import ReviewLikeButton from '../components/ReviewLikeButton'
import SEO from '../components/SEO'
import { BADGES_MAP } from '../lib/badges'
import '../components/LibraryGrid.css'
import './spaces/SpacesExplore.css'
import './WorkPage.css'
import { FaPlaystation, FaXbox, FaWindows, FaApple, FaAndroid, FaLinux, FaDesktop, FaGamepad } from 'react-icons/fa'
import { BsNintendoSwitch } from 'react-icons/bs'
import { SiSega } from 'react-icons/si'

export default function WorkPage({ mediaType }) {
    const { id } = useParams()
    const { user, profile, updateProfile } = useAuth()
    const navigate = useNavigate()
    const isOwner = user && profile

    // Data states
    const [work, setWork] = useState(null)
    const [relatedSpaces, setRelatedSpaces] = useState([])
    const [similarWorks, setSimilarWorks] = useState([])
    const [recentReviews, setRecentReviews] = useState([])
    const [revealedSpoilers, setRevealedSpoilers] = useState({})
    const [userReview, setUserReview] = useState(null)
    const [reviewStats, setReviewStats] = useState({ average: 0, count: 0, ratingsCount: 0, recentMembers: [] })

    // UI states
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [reviewsRefreshTrigger, setReviewsRefreshTrigger] = useState(0)

    useEffect(() => {
        loadWorkData()
    }, [id, mediaType, user])

    useEffect(() => {
        if (work) {
            loadStats()
            loadReviews()
            loadRelatedSpaces()
        }
    }, [work, reviewsRefreshTrigger])

    const loadRelatedSpaces = async () => {
        const spacesData = await getSpacesByWork(parseInt(id))
        setRelatedSpaces(spacesData || [])
    }

    const loadReviews = async () => {
        const { data } = await getWorkReviews(id, mediaType, 1, 3)
        setRecentReviews(data)
    }

    const toggleSpoiler = (reviewId) => {
        setRevealedSpoilers(prev => ({ ...prev, [reviewId]: true }))
    }

    const currentWishlist = profile?.wishlist || [];
    const wishlistIndex = currentWishlist.findIndex(i => String(i.id) === String(id) && i.type === mediaType);
    const isInWishlist = wishlistIndex >= 0;

    const toggleWishlist = async () => {
        if (!isOwner) {
            alert('Debes iniciar sesión para añadir a la wishlist.');
            return;
        }

        let newWishlist = [...currentWishlist];

        if (isInWishlist) {
            newWishlist.splice(wishlistIndex, 1);
        } else {
            const newEntry = {
                id: String(id),
                type: mediaType,
                title: mediaType === 'game' ? work.name : work.title,
                image_url: mediaType === 'game' ? work.cover_url : work.image_url,
                added_at: new Date().toISOString()
            };
            newWishlist.push(newEntry);
        }

        try {
            await updateProfile({ wishlist: newWishlist });
        } catch (error) {
            console.error('Error toggling wishlist', error);
        }
    }

    const loadStats = async () => {
        const stats = await getWorkStats(mediaType, parseInt(id))
        setReviewStats({
            average: stats.avgRating,
            count: stats.membersCount,
            ratingsCount: stats.ratingsCount || 0,
            recentMembers: stats.recentMembers || []
        })
    }

    const loadWorkData = async () => {
        setLoading(true)
        setError(null)
        try {
            const workData = await getWorkById(mediaType, parseInt(id))
            if (!workData) {
                setError('Obra no encontrada')
                setLoading(false)
                return
            }
            setWork(workData)

            const promises = [
                getSimilarWorks(mediaType, parseInt(id), workData.genres)
            ]
            if (user) {
                promises.push(getWorkLog(user.id, parseInt(id), mediaType))
            }

            const results = await Promise.all(promises)
            setSimilarWorks(results[0] || [])

            if (user && results[1]) {
                setUserReview(results[1])
            } else {
                setUserReview(null)
            }
        } catch (err) {
            console.error('Error loading work data:', err)
            setError('Error al cargar los datos')
        } finally {
            setLoading(false)
        }
    }

    const handleReviewAdded = async (savedLog) => {
        if (savedLog === null) {
            setUserReview(null)
        } else {
            setUserReview(savedLog)
        }
        setReviewsRefreshTrigger(prev => prev + 1)
        setShowReviewModal(false)
    }

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_big').replace(/t_thumb/, 't_cover_big')
    }

    const getReleaseYear = (date) => {
        if (!date) return null
        // Fix for unix timestamps accidentally stored as strings
        if (typeof date === 'string' && /^\d+$/.test(date) && date.length === 10) {
            date = parseInt(date, 10)
        }
        const d = new Date(typeof date === 'number' && date.toString().length === 10 ? date * 1000 : date)
        return isNaN(d.getTime()) ? null : d.getFullYear()
    }

    const renderRatingStars = (rating) => {
        if (!rating) return null
        const stars = []
        for (let i = 1; i <= 5; i++) {
            let fill = "transparent"
            if (rating >= i) fill = "var(--brand-primary)"
            else if (rating >= i - 0.5) fill = "url(#halfStarWork)"
            stars.push(
                <svg key={i} viewBox="0 0 24 24" width="16" height="16">
                    <defs>
                        <linearGradient id="halfStarWork" x1="0" x2="100%" y1="0" y2="0">
                            <stop offset="50%" stopColor="var(--brand-primary)" />
                            <stop offset="50%" stopColor="transparent" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={rating >= i - 0.5 && rating < i ? "url(#halfStarWork)" : fill}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        }
        return <div className="wr-rating-stars" style={{ display: 'flex', gap: '2px' }}>{stars}</div>
    }

    if (loading) return <LoadingSpinner />
    if (error) return <div className="work-page-error"><h2>{error}</h2></div>
    if (!work) return null

    const title = work.name || work.title
    const coverUrl = getHighResImage(work.cover_url || work.image_url)
    const hasRealBanner = !!work.banner_url
    const bannerUrl = work.banner_url || coverUrl // Fallback to cover
    const releaseYear = getReleaseYear(work.release_date || work.first_release_date)
    const genres = work.genres || []
    const synopsis = work.summary || work.synopsis || "No hay sinopsis disponible para esta obra."
    const apiRating = work.igdb_rating || work.anilist_rating || null

    // Extract creators (companies for game, studios for anime)
    let creators = []
    if (mediaType === 'game' && work.developers) {
        creators = work.developers
    } else if (mediaType === 'game' && work.involved_companies) {
        // Fallback if data came straight from raw IGDB format instead of our DB
        creators = work.involved_companies.filter(c => c.developer).map(c => c.company.name)
        if (creators.length === 0) creators = work.involved_companies.map(c => c.company.name)
    } else if (mediaType === 'anime' && work.studios) {
        // If it's an array of strings (from our DB/API mapping) use it directly
        // If it's an array of objects (e.g. from an older API response shape), map it
        creators = work.studios.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
    }
    const creatorText = creators.slice(0, 2).join(', ')

    return (
        <div className="work-page-cinematic">
            <SEO title={`${title} (${mediaType === 'game' ? 'Videojuego' : 'Anime'})`} description={`${title}, ${mediaType === 'game' ? 'videojuego' : 'anime'} en GeekSphere.`} />
            
            {/* 1. Backdrop */}
            <div className={`work-backdrop ${hasRealBanner ? 'has-banner' : ''}`}>
                {bannerUrl && (
                    <img src={bannerUrl} alt="backdrop" className="work-backdrop-img" />
                )}
                <div className="work-backdrop-overlay"></div>
            </div>

            {/* 2. Hero Section */}
            <div className="work-hero-cinematic">
                <div className="work-poster-wrapper">
                    {coverUrl ? (
                        <img src={coverUrl} alt={title} className="work-poster-img" />
                    ) : (
                        <div className="work-poster-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
                            <span style={{ fontSize: '3rem', opacity: 0.5 }}>{mediaType === 'game' ? '🎮' : '📺'}</span>
                        </div>
                    )}
                </div>

                <div className="work-hero-info">
                    <div className="work-title-row">
                        <h1 className="work-title-cinematic">
                            {title}
                        </h1>
                        {releaseYear && <span className="work-year-cinematic">{releaseYear}</span>}
                    </div>

                    {creatorText && (
                        <div className="work-creator">
                            {creatorText}
                        </div>
                    )}

                    <div className={`work-interaction-panel ${userReview ? 'logged' : ''}`}>
                        {userReview ? (
                            <>
                                <button className="interaction-btn btn-edit" onClick={() => setShowReviewModal(true)}>
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Editar Entrada
                                </button>
                                {userReview.rating && (
                                    <div className="user-rating-display">
                                        <span className="user-rating-label">Tu nota</span>
                                        {renderRatingStars(userReview.rating)}
                                    </div>
                                )}
                            </>
                        ) : (
                            <button className="interaction-btn" onClick={() => setShowReviewModal(true)}>
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M12 5v14M5 12h14"></path></svg>
                                Registrar / Reseñar
                            </button>
                        )}
                        <button 
                            className={`wishlist-icon-btn ${isInWishlist ? 'active' : ''}`} 
                            onClick={toggleWishlist}
                            title={isInWishlist ? 'Quitar de Wishlist' : 'Añadir a Wishlist'}
                        >
                            <svg viewBox="0 0 24 24" width="22" height="22" fill={isInWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Stats Bar */}
            <div className="work-stats-bar">
                <div className="stats-bar-inner">
                    <div className="stat-item">
                        <span className="stat-label">Tipo</span>
                        <span className="stat-value highlight">{mediaType === 'game' ? 'Videojuego' : 'Anime'}</span>
                    </div>
                    {/* Placeholder for real stats in the future */}
                    <div className="stat-item">
                        <span className="stat-label">Valoración Media</span>
                        <span className="stat-value work-average-summary">
                            <span className="work-average-number">{reviewStats.average > 0 ? Number(reviewStats.average).toFixed(1) : '—'}</span>
                            <span className="work-average-detail">
                                {reviewStats.average > 0 && renderRatingStars(Number(reviewStats.average))}
                                <span className="work-average-count">
                                    de {reviewStats.ratingsCount} {reviewStats.ratingsCount === 1 ? 'valoración' : 'valoraciones'}
                                </span>
                            </span>
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Miembros</span>
                        <div className="stat-value members-avatars">
                            {reviewStats.recentMembers?.length > 0 ? (
                                <>
                                    <div className="members-avatars-list">
                                        {reviewStats.recentMembers.map((member, i) => (
                                            <div 
                                                key={i} 
                                                className="member-avatar-circle" 
                                                style={{ zIndex: 10 - i }}
                                                title={member.username}
                                            >
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt={member.username} />
                                                ) : (
                                                    <div className="avatar-placeholder">{member.username.charAt(0).toUpperCase()}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {reviewStats.count > 5 && (
                                        <span className="members-more-dots">...</span>
                                    )}
                                </>
                            ) : (
                                <span>0</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Split Body */}
            <div className="work-content-split">
                <div className="work-main-col">
                    <div>
                        <h3 className="work-section-title">Sinopsis</h3>
                        <p className="work-synopsis">{synopsis}</p>
                    </div>

                    {/* Recent Reviews Section */}
                    {recentReviews.length > 0 && (
                        <div className="work-page-reviews">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2rem' }}>
                                <h3 className="work-section-title" style={{ margin: 0 }}>Reseñas Recientes</h3>
                                <Link to={`/${mediaType}/${id}/reviews`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>
                                    Ver todas
                                </Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {recentReviews.map(log => (
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
                                                {renderRatingStars(log.rating)}
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
                                                    <>{log.review_text.length > 300 ? log.review_text.substring(0, 300) + '...' : log.review_text}</>
                                                )}
                                            </p>
                                            <ReviewLikeButton entryId={log.id} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                <div className="work-sidebar">
                    {/* Meta info */}
                    <div>
                        <h3 className="work-section-title">Detalles</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {genres.length > 0 && (
                                <div className="meta-block">
                                    <span className="meta-label">Géneros</span>
                                    <div className="meta-tags">
                                        {genres.map((g, i) => <span key={i} className="meta-tag">{g}</span>)}
                                    </div>
                                </div>
                            )}

                            {mediaType === 'game' && work.platforms && (() => {
                                const groupedPlatforms = work.platforms.reduce((acc, p) => {
                                    const pl = p.toLowerCase();
                                    let key = 'other';
                                    let Icon = FaGamepad;
                                    
                                    if (pl.includes('playstation') || pl.includes('ps vita')) { key = 'playstation'; Icon = FaPlaystation; }
                                    else if (pl.includes('xbox')) { key = 'xbox'; Icon = FaXbox; }
                                    else if (pl.includes('windows') || pl.includes('pc')) { key = 'windows'; Icon = FaWindows; }
                                    else if (pl.includes('mac') || pl.includes('ios') || pl.includes('apple')) { key = 'apple'; Icon = FaApple; }
                                    else if (pl.includes('android')) { key = 'android'; Icon = FaAndroid; }
                                    else if (pl.includes('linux')) { key = 'linux'; Icon = FaLinux; }
                                    else if (pl.includes('nintendo') || pl.includes('game boy') || pl.includes('wii') || pl.includes('ds') || pl.includes('gamecube')) { key = 'nintendo'; Icon = BsNintendoSwitch; }
                                    else if (pl.includes('dreamcast') || pl.includes('sega') || pl.includes('genesis') || pl.includes('megadrive')) { key = 'sega'; Icon = SiSega; }
                                    else if (pl.includes('browser') || pl.includes('web')) { key = 'web'; Icon = FaDesktop; }
                                    else { key = `other-${p}`; }
                                    
                                    if (!acc[key]) {
                                        acc[key] = { Icon, names: [] };
                                    }
                                    acc[key].names.push(p);
                                    return acc;
                                }, {});

                                return (
                                    <div className="meta-block">
                                        <span className="meta-label">Plataformas</span>
                                        <div className="meta-tags">
                                            {Object.entries(groupedPlatforms).map(([key, data]) => {
                                                const { Icon, names } = data;
                                                return (
                                                    <span key={key} className="platform-icon" title={names.join(', ')}>
                                                        <Icon />
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {mediaType === 'anime' && work.status && (
                                <div className="meta-block">
                                    <span className="meta-label">Estado</span>
                                    <span className="meta-value">{work.status}</span>
                                </div>
                            )}

                            {mediaType === 'anime' && work.episodes && (
                                <div className="meta-block">
                                    <span className="meta-label">Episodios</span>
                                    <span className="meta-value">{work.episodes}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {similarWorks.length > 0 && (
                        <div>
                            <h3 className="work-section-title">Similares</h3>
                            <div className="similar-works-grid">
                                {similarWorks.slice(0, 6).map(similar => (
                                    <Link key={similar.id} to={`/${similar.media_type}/${similar.id}`} className="similar-work-card">
                                        <div 
                                            className="similar-work-poster"
                                            style={{ backgroundImage: `url(${getHighResImage(similar.cover_url || similar.image_url)})` }}
                                        >
                                            <div className="similar-work-overlay">
                                                <span className="similar-work-title">{similar.name || similar.title}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {relatedSpaces.length > 0 && (
                <div style={{ maxWidth: '1200px', margin: '0 auto 3rem auto', padding: '0 1.5rem' }}>
                    <h3 className="work-section-title" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
                        Espacios relacionados
                    </h3>
                    <div className="work-page-spaces">
                        {relatedSpaces.map(space => (
                            <Link key={space.id} to={`/spaces/${space.id}`} className="work-space-card">
                                <span className="work-space-artwork">
                                    {space.avatar_url || space.banner_url ? (
                                        <img src={space.avatar_url || space.banner_url} alt="" loading="lazy" />
                                    ) : (
                                        <span className="work-space-fallback" aria-hidden="true">{space.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </span>
                                <span className="work-space-title-line">
                                    <strong className="work-space-title">{space.name}</strong>
                                    {space.is_verified && <span className="work-space-verified" title="Espacio verificado" aria-label="Espacio verificado">
                                        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1d9bf0" d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6-.86 2.07-3.14 3.47-1.5 3.47 1.5 2.07 3.14 3.6.86-.57 3.65z"/><path fill="#fff" d="M10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z"/></svg>
                                    </span>}
                                </span>
                                <small className="work-space-members">{space.member_count ?? 0} {space.member_count === 1 ? 'usuario' : 'usuarios'}</small>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Log Modal */}
            {showReviewModal && (
                <LogModal
                    isOpen={showReviewModal}
                    onClose={() => setShowReviewModal(false)}
                    work={{ id: parseInt(id), type: mediaType, title: title, image: coverUrl, banner_url: bannerUrl }}
                    existingLog={userReview}
                    onSaveComplete={handleReviewAdded}
                />
            )}
        </div>
    )
}
