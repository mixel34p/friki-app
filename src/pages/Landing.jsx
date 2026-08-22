import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getRecentReviews } from '../lib/reviewService'
import { getTrendingWorks } from '../lib/workPageService'
import { getDebates } from '../lib/debateService'
import { STATIC_COVERS } from '../lib/constants'
import SEO from '../components/SEO'
import './Landing.css'

// SVGs
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
const StarIcon = ({ size = 20, fill = "currentColor", stroke = "currentColor" }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const LayersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>;
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;

export default function Landing() {
    const [trendingGames, setTrendingGames] = useState([])
    const [trendingAnime, setTrendingAnime] = useState([])
    const [recentReviews, setRecentReviews] = useState([])
    const [activeDebates, setActiveDebates] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const [games, anime, reviews, debates] = await Promise.all([
                    getTrendingWorks('game', 12),
                    getTrendingWorks('anime', 12),
                    getRecentReviews(4),
                    getDebates({ limit: 5, orderBy: 'active' })
                ])
                setTrendingGames(games || [])
                setTrendingAnime(anime || [])
                setRecentReviews(reviews || [])
                setActiveDebates(debates || [])
            } catch (err) {
                console.error('Error loading landing data', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const row1 = [...STATIC_COVERS, ...STATIC_COVERS, ...STATIC_COVERS, ...STATIC_COVERS];
    const row2 = [...STATIC_COVERS.slice(4).concat(STATIC_COVERS.slice(0, 4)), ...STATIC_COVERS.slice(4).concat(STATIC_COVERS.slice(0, 4)), ...STATIC_COVERS.slice(4).concat(STATIC_COVERS.slice(0, 4)), ...STATIC_COVERS.slice(4).concat(STATIC_COVERS.slice(0, 4))];
    const row3 = [...STATIC_COVERS.slice(8).concat(STATIC_COVERS.slice(0, 8)), ...STATIC_COVERS.slice(8).concat(STATIC_COVERS.slice(0, 8)), ...STATIC_COVERS.slice(8).concat(STATIC_COVERS.slice(0, 8)), ...STATIC_COVERS.slice(8).concat(STATIC_COVERS.slice(0, 8))];

    return (
        <div className="landing-page">
            <SEO
                title="GeekSphere — Tu vida en videojuegos y anime"
                description="Registra lo que juegas y ves, escribe reseñas, crea tierlists y descubre gente con tus mismos gustos en la mejor red social friki."
                keywords="geek, anime, videojuegos, tierlists, comunidad, letterboxd para juegos"
            />
            
            <header className="landing-navbar">
                <div className="container landing-nav-content">
                    <div className="landing-logo-box">
                        <img src="/icons/logo.png" alt="GeekSphere" className="landing-logo-img" />
                        <span className="landing-logo-text">GeekSphere</span>
                    </div>
                    <div className="landing-auth-actions">
                        <Link to="/login" className="btn btn-ghost landing-btn-login">INICIAR SESIÓN</Link>
                        <Link to="/register" className="btn btn-primary landing-btn-register">CREAR CUENTA</Link>
                    </div>
                </div>
            </header>

            <main className="landing-main">
                <section className="landing-hero">
                    <div className="hero-backdrop">
                        <div className="hero-track-container">
                            <div className="hero-track track-left">
                                {[...STATIC_COVERS, ...STATIC_COVERS].map((url, i) => (
                                    <div key={`t1-${i}`} className="hero-cover-item" style={{ backgroundImage: `url(${url})` }}></div>
                                ))}
                            </div>
                            <div className="hero-track track-right">
                                {[...STATIC_COVERS].reverse().concat([...STATIC_COVERS].reverse()).map((url, i) => (
                                    <div key={`t2-${i}`} className="hero-cover-item" style={{ backgroundImage: `url(${url})` }}></div>
                                ))}
                            </div>
                            <div className="hero-track track-left-slow">
                                {[...STATIC_COVERS.slice(15), ...STATIC_COVERS.slice(0, 15), ...STATIC_COVERS.slice(15), ...STATIC_COVERS.slice(0, 15)].map((url, i) => (
                                    <div key={`t3-${i}`} className="hero-cover-item" style={{ backgroundImage: `url(${url})` }}></div>
                                ))}
                            </div>
                        </div>
                        <div className="hero-gradient-overlay"></div>
                    </div>

                    <div className="container hero-content">
                        <h1 className="hero-headline">Sigue la pista a lo que juegas y ves.</h1>
                        <p className="hero-subheadline">
                            La red social para fans. Registra tu progreso, crea tierlists, escribe reseñas y descubre con quién compartes afinidad.
                        </p>
                        <div className="hero-cta-group">
                            <Link to="/register" className="btn btn-primary btn-lg hero-cta-btn">Empezar — Es gratis</Link>
                        </div>
                        <p className="hero-subtext">La comunidad de videojuegos y anime más sana.</p>
                    </div>
                </section>

                <section className="landing-features">
                    <div className="container">
                        <div className="features-grid">
                            <div className="feature-col">
                                <div className="feature-icon-box"><EyeIcon /></div>
                                <h3>Registra todo</h3>
                                <p>Mantén un diario visual de lo que estás jugando, viendo, lo que has completado y tu wishlist.</p>
                            </div>
                            <div className="feature-col">
                                <div className="feature-icon-box"><StarIcon /></div>
                                <h3>Opina y puntúa</h3>
                                <p>Da calificaciones de media estrella y escribe reseñas sinceras sobre tus obras favoritas.</p>
                            </div>
                            <div className="feature-col">
                                <div className="feature-icon-box"><LayersIcon /></div>
                                <h3>Crea Tierlists</h3>
                                <p>Construye, comparte y debate listas personalizadas con el creador más rápido de internet.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="landing-trending">
                    <div className="container">
                        <div className="trending-header">
                            <h2 className="landing-section-title">En tendencia esta semana</h2>
                            <span className="trending-subtitle">Las obras más populares en la comunidad</span>
                        </div>

                        {loading ? (
                            <div className="landing-skeleton-grid">
                                {[...Array(6)].map((_, i) => <div key={i} className="skeleton skeleton-cover"></div>)}
                            </div>
                        ) : (
                            <div className="trending-lists">
                                <div className="trending-row">
                                    <div className="trending-row-header">
                                        <h3 className="trending-row-title">Videojuegos</h3>
                                        <Link to="/discover" className="trending-row-link">Ver todos</Link>
                                    </div>
                                    <div className="trending-covers">
                                        {trendingGames.slice(0, 6).map((game, index) => (
                                            <div key={game.id} className="trending-item">
                                                <Link to={`/game/${game.id}`} className="mini-cover-card">
                                                    {game.image ? <img src={game.image} alt={game.title} loading="lazy" /> : <div className="lbx-poster-placeholder"></div>}
                                                    <div className="mini-cover-overlay">
                                                        <span className="rating-badge">
                                                            <StarIcon size={12} fill="currentColor" stroke="none" />
                                                            {game.rating ? parseFloat(game.rating).toFixed(1) : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="trending-rank">{index + 1}</div>
                                                </Link>
                                                <div className="trending-item-info">
                                                    <h4 className="trending-item-title">{game.title}</h4>
                                                    <span className="trending-item-year">2026</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="trending-row">
                                    <div className="trending-row-header">
                                        <h3 className="trending-row-title">Anime</h3>
                                        <Link to="/discover" className="trending-row-link">Ver todos</Link>
                                    </div>
                                    <div className="trending-covers">
                                        {trendingAnime.slice(0, 6).map((anime, index) => (
                                            <div key={anime.id} className="trending-item">
                                                <Link to={`/anime/${anime.id}`} className="mini-cover-card">
                                                    {anime.image ? <img src={anime.image} alt={anime.title} loading="lazy" /> : <div className="lbx-poster-placeholder"></div>}
                                                    <div className="mini-cover-overlay">
                                                        <span className="rating-badge">
                                                            <StarIcon size={12} fill="currentColor" stroke="none" />
                                                            {anime.rating ? parseFloat(anime.rating).toFixed(1) : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="trending-rank">{index + 1}</div>
                                                </Link>
                                                <div className="trending-item-info">
                                                    <h4 className="trending-item-title">{anime.title}</h4>
                                                    <span className="trending-item-year">2026</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="landing-community-lbx">
                    <div className="container">
                        <div className="lbx-community-layout">
                            
                            <div className="lbx-reviews-section">
                                <h2 className="landing-section-title">Reseñas populares</h2>
                                <div className="lbx-reviews-grid">
                                    {recentReviews.map(review => (
                                        <div key={review.id} className="lbx-review-card">
                                            <div className="lbx-review-poster">
                                                {review.work?.image ? (
                                                    <img src={review.work.image} alt={review.work.title} />
                                                ) : (
                                                    <div className="lbx-poster-placeholder"></div>
                                                )}
                                            </div>
                                            <div className="lbx-review-content">
                                                <div className="lbx-review-header">
                                                    <h4 className="lbx-work-title">{review.work?.title || 'Obra desconocida'}</h4>
                                                    <div className="lbx-user-row">
                                                        <img src={review.profiles?.avatar_url || 'https://via.placeholder.com/24'} alt="" className="lbx-avatar" />
                                                        <span className="lbx-username">{review.profiles?.display_name || review.profiles?.username}</span>
                                                    </div>
                                                </div>
                                                <div className="lbx-stars">
                                                    {Array.from({ length: 5 }).map((_, idx) => (
                                                        <StarIcon key={idx} size={12} fill={idx < Math.round(review.rating || 0) ? "currentColor" : "none"} stroke={idx < Math.round(review.rating || 0) ? "none" : "var(--text-muted)"} />
                                                    ))}
                                                </div>
                                                <p className="lbx-review-text">"{review.content?.substring(0, 100)}..."</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="lbx-debates-section">
                                <h2 className="landing-section-title">Debates</h2>
                                <div className="lbx-debates-list">
                                    {activeDebates.map(debate => (
                                        <Link key={debate.id} to={`/debate/${debate.id}`} className="lbx-debate-item">
                                            <h4 className="lbx-debate-title">{debate.title}</h4>
                                            <div className="lbx-debate-meta">
                                                {debate.media?.[0]?.name && (
                                                    <span className="lbx-debate-category">{debate.media[0].name}</span>
                                                )}
                                                <span className="lbx-debate-replies">
                                                    <ChatIcon size={12} /> {debate.posts_count}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </section>
            </main>

            <footer className="landing-footer">
                <div className="container footer-content">
                    <div className="footer-brand">
                        <img src="/icons/logo.png" alt="" />
                        <span>GeekSphere © 2026</span>
                    </div>
                    <div className="footer-links">
                        <Link to="/">Términos</Link>
                        <Link to="/">Privacidad</Link>
                        <Link to="/">Acerca de</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
