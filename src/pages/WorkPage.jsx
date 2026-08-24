import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    getWorkById,
    getDebatesForWork,
    getTierlistsWithWork,
    getUsersWhoInteractedWithWork,
    getSimilarWorks,
    getWorkStats
} from '../lib/workPageService'
import { getWorkLog } from '../lib/libraryService'
import { DEBATE_TYPES } from '../lib/debateService'
import LogModal from '../components/LogModal'
import LoadingSpinner from '../components/LoadingSpinner'
import './WorkPage.css'

export default function WorkPage({ mediaType }) {
    const { id } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()

    // Data states
    const [work, setWork] = useState(null)
    const [debates, setDebates] = useState([])
    const [tierlistData, setTierlistData] = useState({ tierlists: [], stats: {} })
    const [users, setUsers] = useState([])
    const [similarWorks, setSimilarWorks] = useState([])
    const [reviewStats, setReviewStats] = useState({ average: 0, count: 0 })
    const [userReview, setUserReview] = useState(null)

    // UI states
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [debateFilter, setDebateFilter] = useState('recent')
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [reviewsRefreshTrigger, setReviewsRefreshTrigger] = useState(0)
    const [editingReview, setEditingReview] = useState(null)

    // Collapsible sections
    const [expandedSections, setExpandedSections] = useState({
        synopsis: true,
        tierlists: true,
        debates: true,
        users: false,
        recommendations: false
    })

    useEffect(() => {
        loadWorkData()
    }, [id, mediaType, user]) // Add user to dependecy to re-check review status

    useEffect(() => {
        if (work) {
            loadDebates()
        }
    }, [work, debateFilter])

    const loadWorkData = async () => {
        setLoading(true)
        setError(null)

        try {
            // Load work details
            const workData = await getWorkById(mediaType, parseInt(id))

            if (!workData) {
                setError('Obra no encontrada')
                setLoading(false)
                return
            }

            setWork(workData)

            const promises = [
                getTierlistsWithWork(mediaType, parseInt(id)),
                getUsersWhoInteractedWithWork(mediaType, parseInt(id), user?.id),
                getSimilarWorks(mediaType, parseInt(id), workData.genres)
            ]

            if (user) {
                promises.push(getWorkLog(user.id, parseInt(id), mediaType))
            }

            const results = await Promise.all(promises)

            setTierlistData(results[0])
            setUsers(results[1])
            setSimilarWorks(results[2])

            if (user && results[3]) {
                setUserReview(results[3])
            }
        } catch (err) {
            console.error('Error loading work data:', err)
            setError('Error al cargar los datos')
        } finally {
            setLoading(false)
        }
    }

    const loadDebates = async () => {
        const debatesData = await getDebatesForWork(mediaType, parseInt(id), {
            orderBy: debateFilter
        })
        setDebates(debatesData)
    }

    const handleReviewAdded = async (savedLog) => {
        if (savedLog === null) {
            setUserReview(null)
        } else {
            setUserReview(savedLog)
        }
        setReviewsRefreshTrigger(prev => prev + 1)
        setEditingReview(null) // Clear edit state
    }

    // Called when a user clicks 'Edit' on a review card
    const handleEditReview = (review) => {
        setEditingReview(review)
        setShowReviewModal(true)
    }

    // Close modal handler
    const handleCloseModal = () => {
        setShowReviewModal(false)
        setEditingReview(null)
    }

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_big')
    }

    const getReleaseYear = (date) => {
        if (!date) return null
        const d = new Date(date)
        return isNaN(d.getTime()) ? null : d.getFullYear()
    }

    const getTierColor = (tier) => {
        const colors = {
            'S': 'var(--tier-s)',
            'A': 'var(--tier-a)',
            'B': 'var(--tier-b)',
            'C': 'var(--tier-c)',
            'D': 'var(--tier-d)'
        }
        return colors[tier?.toUpperCase()] || 'var(--text-muted)'
    }

    // Helper to render visual stars
    const renderRatingStars = (average) => {
        const stars = []
        const fullStars = Math.floor(average)
        const hasHalfStar = average % 1 >= 0.5

        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars.push(<span key={i} style={{ color: '#fbbf24', textShadow: '0 0 5px rgba(251, 191, 36, 0.5)' }}>★</span>)
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars.push(
                    <span key={i} style={{ position: 'relative', display: 'inline-block', color: 'var(--text-muted)' }}>
                        ★
                        <span style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden', color: '#fbbf24', textShadow: '0 0 5px rgba(251, 191, 36, 0.5)' }}>★</span>
                    </span>
                )
            } else {
                stars.push(<span key={i} style={{ color: 'var(--text-muted)' }}>★</span>)
            }
        }
        return stars
    }

    if (loading) {
        return (
            <div className="work-page">
                <div className="container">
                    <div className="work-page-loading">
                        <LoadingSpinner />
                        <p>Cargando obra...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error || !work) {
        return (
            <div className="work-page">
                <div className="container">
                    <div className="work-page-error">
                        <h2>{error || 'Obra no encontrada'}</h2>
                        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                            ← Volver
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="work-page">
            {/* Hero Header */}
            <div className="work-hero">
                <div className="work-hero-backdrop">
                    {work.cover_url && (
                        <img
                            src={getHighResImage(work.cover_url)}
                            alt=""
                            className="work-hero-backdrop-img"
                        />
                    )}
                    <div className="work-hero-backdrop-overlay"></div>
                </div>

                <div className="container">
                    <div className="work-hero-content">
                        <div className="work-cover">
                            {work.cover_url ? (
                                <img
                                    src={getHighResImage(work.cover_url)}
                                    alt={work.name}
                                    className="work-cover-img"
                                />
                            ) : (
                                <div className="work-cover-placeholder">
                                    {mediaType === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '60px', height: '60px', opacity: 0.5 }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '60px', height: '60px', opacity: 0.5 }} />}
                                </div>
                            )}
                        </div>

                        <div className="work-info">
                            <div className="work-meta-badges">
                                <span className="work-type-badge">
                                    {mediaType === 'game' ? <><img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> Juego</> : <><img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> Anime</>}
                                </span>
                                {getReleaseYear(work.release_date) && (
                                    <span className="work-year-badge">
                                        {getReleaseYear(work.release_date)}
                                    </span>
                                )}
                            </div>

                            <h1 className="work-title">{work.name}</h1>

                            {/* Platforms/Genres */}
                            <div className="work-tags-row">
                                {work.platforms && work.platforms.slice(0, 4).map((p, i) => (
                                    <span key={i} className="work-platform-tag">{p}</span>
                                ))}
                                {work.genres && work.genres.slice(0, 3).map((g, i) => (
                                    <span key={i} className="work-genre-tag">{g}</span>
                                ))}
                            </div>

                            {/* Review Stats Badge - Visual Stars */}
                            <div className="work-rating-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div className="stars-visual" style={{ fontSize: '1.2rem', display: 'flex', gap: '2px' }}>
                                    {renderRatingStars(reviewStats.average)}
                                </div>
                                <span style={{ fontWeight: 'bold', color: 'white' }}>{reviewStats.average || '0.0'}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({reviewStats.count})</span>
                            </div>

                            {/* Action Buttons */}
                            <div className="work-actions">
                                {userReview ? (
                                    <button
                                        className="btn btn-secondary"
                                        disabled
                                        style={{ opacity: 0.8, cursor: 'default' }}
                                    >
                                        <img src="/icons/check.png" alt="✅" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Opinión enviada
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowReviewModal(true)}
                                    >
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" style={{ marginRight: '6px' }}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        {userReview ? 'Editar Diario' : 'Añadir al Diario'}
                                    </button>
                                )}
                                <Link to="/create-tierlist" className="btn btn-secondary">
                                    ➕ A Tierlist
                                </Link>
                                <Link
                                    to="/debates/create"
                                    state={{ preselectedMedia: { ...work, media_type: mediaType } }}
                                    className="btn btn-secondary"
                                >
                                    <img src="/icons/dialog.png" alt="💬" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Debatir
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Sections */}
            <div className="container">
                <div className="work-sections">

                    {/* Synopsis Section */}
                    {work.summary && (
                        <section className="work-section">
                            <button
                                className="work-section-header"
                                onClick={() => toggleSection('synopsis')}
                            >
                                <h2>📖 Sinopsis</h2>
                                <span className={`work-section-toggle ${expandedSections.synopsis ? 'expanded' : ''}`}>
                                    ▼
                                </span>
                            </button>
                            {expandedSections.synopsis && (
                                <div className="work-section-content">
                                    <p className="work-synopsis">{work.summary}</p>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Tierlists Section */}
                    <section className="work-section">
                        <button
                            className="work-section-header"
                            onClick={() => toggleSection('tierlists')}
                        >
                            <h2><img src="/icons/medal.png" alt="🏆" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Tierlists ({tierlistData.tierlists.length})</h2>
                            <span className={`work-section-toggle ${expandedSections.tierlists ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </button>
                        {expandedSections.tierlists && (
                            <div className="work-section-content">
                                {tierlistData.tierlists.length === 0 ? (
                                    <div className="work-empty-state">
                                        <p>Esta obra aún no aparece en ninguna tierlist pública.</p>
                                        <Link to="/create-tierlist" className="btn btn-sm btn-primary">
                                            ¡Sé el primero!
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="work-tierlists-grid">
                                        {tierlistData.tierlists.map(tierlist => (
                                            <Link
                                                key={tierlist.id}
                                                to={`/tierlist/${tierlist.id}`}
                                                className="work-tierlist-card"
                                            >
                                                <div className="work-tierlist-tier" style={{ background: getTierColor(tierlist.tier) }}>
                                                    {tierlist.tier?.toUpperCase() || '?'}
                                                </div>
                                                <div className="work-tierlist-info">
                                                    <span className="work-tierlist-title">{tierlist.title}</span>
                                                    <span className="work-tierlist-author">
                                                        por {tierlist.profiles?.display_name || tierlist.profiles?.username}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Debates Section */}
                    <section className="work-section">
                        <button
                            className="work-section-header"
                            onClick={() => toggleSection('debates')}
                        >
                            <h2><img src="/icons/dialog.png" alt="💬" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Debates ({debates.length})</h2>
                            <span className={`work-section-toggle ${expandedSections.debates ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </button>
                        {expandedSections.debates && (
                            <div className="work-section-content">
                                {/* Filters */}
                                <div className="work-debates-filters">
                                    <button
                                        className={`work-filter-btn ${debateFilter === 'recent' ? 'active' : ''}`}
                                        onClick={() => setDebateFilter('recent')}
                                    >
                                        Recientes
                                    </button>
                                    <button
                                        className={`work-filter-btn ${debateFilter === 'popular' ? 'active' : ''}`}
                                        onClick={() => setDebateFilter('popular')}
                                    >
                                        Populares
                                    </button>
                                </div>

                                {debates.length === 0 ? (
                                    <div className="work-empty-state">
                                        <p>No hay debates sobre esta obra todavía.</p>
                                        <Link
                                            to="/debates/create"
                                            state={{ preselectedMedia: { ...work, media_type: mediaType } }}
                                            className="btn btn-sm btn-primary"
                                        >
                                            ¡Inicia uno!
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="work-debates-list">
                                        {debates.map(debate => {
                                            const debateType = DEBATE_TYPES[debate.debate_type] || DEBATE_TYPES.opinion
                                            return (
                                                <Link
                                                    key={debate.id}
                                                    to={`/debate/${debate.id}`}
                                                    className="work-debate-card"
                                                >
                                                    <div className="work-debate-header">
                                                        <span className="work-debate-type">
                                                            {debateType.emoji}
                                                        </span>
                                                        <span className="work-debate-title">{debate.title}</span>
                                                    </div>
                                                    <div className="work-debate-meta">
                                                        <span className="work-debate-author">
                                                            {debate.profiles?.display_name || debate.profiles?.username}
                                                        </span>
                                                        <span className="work-debate-replies">
                                                            <img src="/icons/dialog.png" alt="💬" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px', opacity: 0.7 }} /> {debate.posts_count} respuestas
                                                        </span>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Reviews Section */}
                    {/* <ReviewList
                        workId={id}
                        workType={mediaType}
                        refreshTrigger={reviewsRefreshTrigger}
                        showWriteButton={false} // Hidden in list, now in hero
                        onEditReview={handleEditReview}
                    /> */}

                    {/* Recommendations Section */}
                    <section className="work-section">
                        <button
                            className="work-section-header"
                            onClick={() => toggleSection('recommendations')}
                        >
                            <h2><img src="/icons/star.png" alt="✨" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Obras similares ({similarWorks.length})</h2>
                            <span className={`work-section-toggle ${expandedSections.recommendations ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </button>
                        {expandedSections.recommendations && (
                            <div className="work-section-content">
                                {similarWorks.length === 0 ? (
                                    <div className="work-empty-state">
                                        <p>No se encontraron obras similares aún.</p>
                                    </div>
                                ) : (
                                    <div className="work-similar-grid">
                                        {similarWorks.map(similar => (
                                            <Link
                                                key={similar.id}
                                                to={`/${similar.media_type}/${similar.id}`}
                                                className="work-similar-card"
                                            >
                                                {similar.cover_url ? (
                                                    <img
                                                        src={getHighResImage(similar.cover_url)}
                                                        alt={similar.name}
                                                        className="work-similar-cover"
                                                    />
                                                ) : (
                                                    <div className="work-similar-cover-placeholder">
                                                        {similar.media_type === 'game' ? '🎮' : <img src="/icons/anime.png" alt="📺" style={{ width: '40px', height: '40px', opacity: 0.5 }} />}
                                                    </div>
                                                )}
                                                <div className="work-similar-info">
                                                    <span className="work-similar-name">{similar.name}</span>

                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* Log Modal */}
            {showReviewModal && (
                <LogModal
                    isOpen={showReviewModal}
                    onClose={handleCloseModal}
                    work={{ id: parseInt(id), type: mediaType, title: work.name, image: work.cover_image || work.image }}
                    existingLog={userReview}
                    onSaveComplete={handleReviewAdded}
                />
            )}
        </div>
    )
}
