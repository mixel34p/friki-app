import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getRecentReviews } from '../lib/reviewService'
import { getTrendingWorks } from '../lib/workPageService'
import { getDebates } from '../lib/debateService'
import './Landing.css'

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
                    getTrendingWorks('game', 6),
                    getTrendingWorks('anime', 6),
                    getRecentReviews(3),
                    getDebates({ limit: 3, orderBy: 'active' })
                ])
                setTrendingGames(games)
                setTrendingAnime(anime)
                setRecentReviews(reviews)
                setActiveDebates(debates)
            } catch (err) {
                console.error('Error loading landing data', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const WorkCard = ({ work }) => (
        <Link to={`/${work.media_type}/${work.id}`} className="landing-work-card">
            <div className="landing-work-cover" style={{ backgroundImage: `url(${work.image})` }}>
                <div className="landing-work-overlay">
                    <span className="landing-work-rating">★ {work.rating}</span>
                </div>
            </div>
            <div className="landing-work-info">
                <h4>{work.title}</h4>
                <span>{work.tierlists} tierlists</span>
            </div>
        </Link>
    )

    const ReviewCard = ({ review }) => (
        <div className="landing-review-card">
            <div className="review-card-header">
                <img
                    src={review.profiles?.avatar_url || 'https://via.placeholder.com/32'}
                    alt={review.profiles?.display_name}
                    className="review-avatar-sm"
                />
                <div className="review-meta">
                    <span className="review-author">{review.profiles?.display_name}</span>
                    <span className="review-work-name">sobre {review.work?.title}</span>
                </div>
            </div>
            <div className="review-stars">
                {'★'.repeat(Math.round(review.rating))}
                <span className="star-empty">{'★'.repeat(5 - Math.round(review.rating))}</span>
            </div>
            <p className="review-snippet">"{review.content.substring(0, 80)}..."</p>
        </div>
    )

    const DebateRow = ({ debate }) => (
        <Link to={`/debate/${debate.id}`} className="landing-debate-row">
            <div className="debate-icon"><img src="/icons/dialog.png" alt="💬" style={{ width: '20px', height: '20px' }} /></div>
            <div className="debate-info">
                <h4>{debate.title}</h4>
                <span>{debate.posts_count} respuestas • en {debate.media?.[0]?.name || 'General'}</span>
            </div>
            <div className="debate-arrow">→</div>
        </Link>
    )

    return (
        <div className="landing">
            {/* Header / Nav */}
            <header className="landing-header">
                <div className="container header-content">
                    <div className="logo-container">
                        <img src="/logo.png" alt="GeekSphere" className="landing-logo" />
                        <span className="landing-brand">GeekSphere</span>
                    </div>
                    <div className="auth-buttons">
                        <Link to="/login" className="btn btn-secondary">Entrar</Link>
                        <Link to="/register" className="btn btn-primary">Crear cuenta</Link>
                    </div>
                </div>
            </header>

            <main className="landing-main">
                {/* 1. HERO SECTION */}
                <section className="hero-section">
                    <div className="container hero-container">
                        <div className="hero-content">
                            <span className="hero-badge">Beta Abierta</span>
                            <h1 className="hero-title">
                                Descubre gente a través <br />
                                <span className="text-gradient">de tus gustos</span>
                            </h1>
                            <p className="hero-subtitle">
                                Crea tierlists, escribe opiniones y participa en debates sin presión social.
                                Aquí lo importante es lo que te gusta.
                            </p>
                            <div className="hero-cta">
                                <button className="btn btn-outline btn-lg" onClick={() => document.getElementById('explore').scrollIntoView({ behavior: 'smooth' })}>
                                    <img src="/icons/lupa.png" alt="👁️" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Explorar como invitado
                                </button>
                                <Link to="/register" className="btn btn-primary btn-lg">
                                    <img src="/icons/luckyblock.png" alt="🚀" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Crear cuenta
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="hero-bg-glow"></div>
                </section>

                {/* 2. FEATURES GRID */}
                <section className="features-section">
                    <div className="container">
                        <div className="features-grid">
                            <div className="feature-card">
                                <div className="feature-icon"><img src="/icons/tierlist.png" alt="📊" style={{ width: '32px', height: '32px' }} /></div>
                                <h3>Crear Tierlists</h3>
                                <p>Ordena videojuegos y anime a tu manera. Tu identidad son tus gustos.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><img src="/icons/star.png" alt="⭐" style={{ width: '32px', height: '32px' }} /></div>
                                <h3>Reseñas Reales</h3>
                                <p>Opiniones sinceras de 1 a 5 estrellas. Sin algoritmos ocultos.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><img src="/icons/wishlist.png" alt="🤝" style={{ width: '32px', height: '32px' }} /></div>
                                <h3>Matching</h3>
                                <p>Encuentra personas con una afinidad alta contigo basada en lo que jugáis.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><img src="/icons/scale.png" alt="🧠" style={{ width: '32px', height: '32px' }} /></div>
                                <h3>Debates Sanos</h3>
                                <p>Conversaciones centradas en obras concretas. Sin toxicidad.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. EXPLORE SECTION */}
                <div id="explore" className="explore-wrapper">

                    {/* Trending Games */}
                    <section className="content-section">
                        <div className="container">
                            <h2 className="section-title"><img src="/icons/videogame.png" alt="🎮" style={{ width: '24px', height: '24px', verticalAlign: '-3px', marginRight: '8px' }} /> Videojuegos Destacados</h2>
                            <div className="works-scroll">
                                {loading ? <div className="loader">Cargando...</div> :
                                    trendingGames.map(game => <WorkCard key={game.id} work={game} />)
                                }
                            </div>
                        </div>
                    </section>

                    {/* Trending Anime */}
                    <section className="content-section">
                        <div className="container">
                            <h2 className="section-title"><img src="/icons/anime.png" alt="📺" style={{ width: '24px', height: '24px', verticalAlign: '-3px', marginRight: '8px' }} /> Anime Destacado</h2>
                            <div className="works-scroll">
                                {loading ? <div className="loader">Cargando...</div> :
                                    trendingAnime.map(anime => <WorkCard key={anime.id} work={anime} />)
                                }
                            </div>
                        </div>
                    </section>

                    {/* Recent Reviews & Debates Split */}
                    <section className="content-section dual-col-section">
                        <div className="container dual-col-container">
                            <div className="col-left">
                                <h2 className="section-title"><img src="/icons/checklist.png" alt="📝" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Opiniones Recientes</h2>
                                <div className="reviews-list">
                                    {recentReviews.map(review => (
                                        <ReviewCard key={review.id} review={review} />
                                    ))}
                                </div>
                            </div>
                            <div className="col-right">
                                <h2 className="section-title"><img src="/icons/fire.gif" alt="🔥" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Debates Activos</h2>
                                <div className="debates-list">
                                    {activeDebates.map(debate => (
                                        <DebateRow key={debate.id} debate={debate} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* 4. HOW IT WORKS */}
                <section className="how-it-works-section">
                    <div className="container">
                        <h2 className="section-center-title">¿Cómo funciona?</h2>
                        <div className="steps-container">
                            <div className="step">
                                <div className="step-number">1</div>
                                <h3>Crea tu perfil</h3>
                                <p>Personaliza tu avatar y biografía.</p>
                            </div>
                            <div className="step-connector"></div>
                            <div className="step">
                                <div className="step-number">2</div>
                                <h3>Organiza tus gustos</h3>
                                <p>Añade juegos y animes a tu biblioteca y tierlists.</p>
                            </div>
                            <div className="step-connector"></div>
                            <div className="step">
                                <div className="step-number">3</div>
                                <h3>Descubre gente</h3>
                                <p>El sistema te sugiere usuarios compatibles.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. VALUES / CTA */}
                <section className="values-section">
                    <div className="container">
                        <div className="values-box">
                            <h2>Aquí tú importas</h2>
                            <div className="values-list">
                                <span><img src="/icons/star.png" alt="✨" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '6px' }} /> Sin contadores de popularidad</span>
                                <span><img src="/icons/cross.png" alt="🛡️" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '6px' }} /> Sin presión social</span>
                                <span><img src="/icons/mushroom.png" alt="💚" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '6px' }} /> Comunidad apasionada</span>
                            </div>
                            <p className="cta-text">¿Te apetece crear tu propio perfil de gustos?</p>
                            <Link to="/register" className="btn btn-primary btn-xl">
                                Crear mi cuenta ahora
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="landing-footer">
                <div className="container">
                    <p>GeekSphere © 2026. Hecho por desarrolladores indie.</p>
                </div>
            </footer>
        </div>
    )
}
