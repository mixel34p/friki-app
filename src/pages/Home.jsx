import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getDebates } from '../lib/debateService'
import DebateCard from '../components/debates/DebateCard'
import LoadingSpinner from '../components/LoadingSpinner'
import './Home.css'

export default function Home() {
    const { user, profile } = useAuth()
    const [tierlists, setTierlists] = useState([])
    const [trendingTierlists, setTrendingTierlists] = useState([])
    const [recentDebates, setRecentDebates] = useState([])
    const [stats, setStats] = useState({ tierlists: 0, following: 0, followers: 0 })
    const [loading, setLoading] = useState(true)
    const [feedTierlists, setFeedTierlists] = useState([])

    useEffect(() => {
        if (user) {
            loadData()
        } else {
            const timer = setTimeout(() => setLoading(false), 1000)
            return () => clearTimeout(timer)
        }
    }, [user])

    const loadData = async () => {
        try {
            // Parallelize requests
            const results = await Promise.allSettled([
                // 1. My Tierlists
                supabase.from('tierlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
                // 2. Following Count
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
                // 3. Followers Count
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
                // 4. Total Tierlists Count
                supabase.from('tierlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                // 5. Trending Tierlists (Public Recent)
                supabase.from('tierlists').select('*').eq('visibility', 'public').order('created_at', { ascending: false }).limit(6),
                // 6. Active Debates (Fetch 15 then shuffle)
                getDebates({ orderBy: 'active', limit: 15 })
            ])

            // Helper
            const getVal = (res, def) => res.status === 'fulfilled' ? res.value : def

            const myLists = getVal(results[0], { data: [] }).data
            const followingCount = getVal(results[1], { count: 0 }).count
            const followersCount = getVal(results[2], { count: 0 }).count
            const tierlistCount = getVal(results[3], { count: 0 }).count
            let trends = getVal(results[4], { data: [] }).data
            const rawDebates = getVal(results[5], [])

            // Randomize debates and take 5
            const shuffledDebates = [...rawDebates].sort(() => 0.5 - Math.random()).slice(0, 5)

            // Enrich Trends with Profiles
            if (trends && trends.length > 0) {
                const userIds = [...new Set(trends.map(t => t.user_id))]
                const { data: trendProfiles } = await supabase
                    .from('profiles')
                    .select('user_id, username, display_name, avatar_url')
                    .in('user_id', userIds)

                const pMap = {}
                trendProfiles?.forEach(p => pMap[p.user_id] = p)
                trends = trends.map(t => ({ ...t, profiles: pMap[t.user_id] }))
            }

            setTierlists(myLists || [])
            setTrendingTierlists(trends || [])
            setRecentDebates(shuffledDebates || [])

            setStats({
                tierlists: tierlistCount || 0,
                following: followingCount || 0,
                followers: followersCount || 0
            })

            // Get feed
            const { data: followingData } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id)

            if (followingData && followingData.length > 0) {
                const followingIds = followingData.map(f => f.following_id)

                const { data: rawFeed, error: feedError } = await supabase
                    .from('tierlists')
                    .select('*')
                    .in('user_id', followingIds)
                    .eq('visibility', 'public')
                    .order('created_at', { ascending: false })
                    .limit(10)

                if (!feedError && rawFeed) {
                    const feedUserIds = [...new Set(rawFeed.map(t => t.user_id))]
                    const { data: feedProfiles } = await supabase
                        .from('profiles')
                        .select('user_id, username, display_name, avatar_url')
                        .in('user_id', feedUserIds)

                    const profileMap = {}
                    feedProfiles?.forEach(p => profileMap[p.user_id] = p)

                    const enriched = rawFeed.map(t => ({
                        ...t,
                        profiles: profileMap[t.user_id]
                    }))
                    setFeedTierlists(enriched)
                }
            }
        } catch (error) {
            console.error('Error loading home data:', error)
        } finally {
            setLoading(false)
        }
    }

    // STRICTLY COPIED FROM DISCOVER.JSX
    const getPreviewImage = (tierlist) => {
        // 1. Try to find a priority image (S tier or #1)
        if (tierlist.content) {
            // Check specific high-priority keys first (Scanning down the ranks)
            const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
            for (const key of priorities) {
                if (tierlist.content[key]?.[0]?.image_url) {
                    return tierlist.content[key][0].image_url
                }
            }
            // Fallback: Scan all keys to find ANY image
            for (const key in tierlist.content) {
                const row = tierlist.content[key]
                if (Array.isArray(row) && row.length > 0) {
                    // Find first item with an image
                    const itemWithImage = row.find(i => i.image_url)
                    if (itemWithImage) return itemWithImage.image_url
                }
            }
        }

        // 2. Fallback to tierlist_items (legacy/alternative)
        if (tierlist.tierlist_items && tierlist.tierlist_items.length > 0) {
            const item = tierlist.tierlist_items.find(i => i.image_url)
            if (item) return item.image_url
        }
        return null
    }

    if (loading) {
        return (
            <div className="home-loading">
                <LoadingSpinner />
            </div>
        )
    }

    return (
        <div className="home">
            {/* Hero Section */}
            <section className="home-hero">
                <div className="container">
                    <div className="hero-content">
                        <div className="hero-welcome">
                            <h1 className="hero-title">
                                Hola, <span className="hero-name">{profile?.display_name || 'Friki'}</span>
                            </h1>
                            <p className="hero-subtitle">¿Qué vamos a debatir hoy?</p>
                        </div>

                        <div className="hero-stats">
                            <div className="hero-stat">
                                <span className="value">{stats.tierlists}</span>
                                <span className="label">Tierlists</span>
                            </div>
                            <div className="hero-stat">
                                <span className="value">{stats.followers}</span>
                                <span className="label">Seguidores</span>
                            </div>
                        </div>

                        <div className="hero-actions">
                            <Link to="/create-tierlist" className="btn btn-primary hero-btn">
                                <img src="/icons/cobb.png" alt="✨" style={{ width: '24px', height: '24px', marginRight: '8px' }} /> Nueva Tierlist
                            </Link>
                            <Link to="/discover" className="btn btn-secondary hero-btn">
                                <img src="/icons/compass.gif" alt="Descubrir" style={{ width: '20px', height: '20px', marginRight: '6px' }} /> Descubrir
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="hero-background"></div>
            </section>

            <div className="container home-grid">

                {/* Active Debates (Randomized) */}
                <section className="section-debates">
                    <div className="section-header">
                        <h2><img src="/icons/exclamation.gif" alt="!" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Debates Activos</h2>
                        <Link to="/debates" className="section-link">Ver todos</Link>
                    </div>

                    {recentDebates.length > 0 ? (
                        <div className="debates-scroll-cards">
                            {recentDebates.map(debate => (
                                <div key={debate.id} className="debate-scroll-item">
                                    <DebateCard debate={debate} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state-mini">No hay debates recientes</div>
                    )}
                </section>

                {/* Trending Tierlists (Grid) */}
                <section className="section-trending">
                    <div className="section-header">
                        <h2><img src="/icons/star.gif" alt="!" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Tendencias</h2>
                    </div>
                    <div className="trending-grid">
                        {trendingTierlists.map(t => {
                            const bg = getPreviewImage(t)
                            return (
                                <Link key={t.id} to={`/tierlist/${t.id}`} className="trending-card">
                                    <div className="trending-card-bg">
                                        {bg ? (
                                            <img src={bg} alt="" className="card-bg-img" />
                                        ) : (
                                            <div className="card-bg-placeholder" />
                                        )}
                                        <div className="card-bg-overlay" />
                                    </div>
                                    <div className="trending-content">
                                        <div className="trending-badges">
                                            <span className="type-badge">
                                                {t.media_type === 'game' ? <><img src="/icons/videogame.png" alt="🎮" style={{ width: '14px', height: '14px', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Juego</> : <><img src="/icons/anime.png" alt="📺" style={{ width: '14px', height: '14px', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Anime</>}
                                            </span>
                                        </div>
                                        <h3>{t.title}</h3>
                                        <div className="trending-meta">
                                            <div className="trending-user">
                                                {t.profiles?.avatar_url ? (
                                                    <img src={t.profiles.avatar_url} alt="" className="trending-avatar" />
                                                ) : (
                                                    <div className="trending-avatar-placeholder">
                                                        {t.profiles?.username?.[0] || '?'}
                                                    </div>
                                                )}
                                                <span>@{t.profiles?.username || 'usuario'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </section>

                {/* My Tierlists */}
                <section className="section-feed">
                    <div className="section-header">
                        <h2>Tus últimas listas</h2>
                        <Link to="/profile" className="section-link">Ir al perfil →</Link>
                    </div>
                    {tierlists.length === 0 ? (
                        <div className="empty-card">
                            <p>Aún no tienes tierlists</p>
                            <Link to="/create-tierlist" className="btn btn-primary btn-sm">Crear ahora</Link>
                        </div>
                    ) : (
                        <div className="tierlist-list-compact">
                            {tierlists.map(t => (
                                <Link key={t.id} to={`/tierlist/${t.id}`} className="tierlist-compact-item">
                                    <span className="icon">{t.media_type === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} />}</span>
                                    <span className="title">{t.title}</span>
                                    <span className="date">{new Date(t.created_at).toLocaleDateString()}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Feed */}
                <section className="section-feed">
                    <div className="section-header">
                        <h2>De gente que sigues</h2>
                    </div>
                    {feedTierlists.length === 0 ? (
                        <div className="empty-card">
                            <p>Sigue a usuarios para ver su actividad</p>
                            <Link to="/discover" className="btn btn-secondary btn-sm">Descubrir</Link>
                        </div>
                    ) : (
                        <div className="feed-grid">
                            {feedTierlists.map(t => {
                                const bg = getPreviewImage(t)
                                return (
                                    <Link key={t.id} to={`/tierlist/${t.id}`} className="feed-card" >
                                        <div className="feed-card-header">
                                            <img src={t.profiles?.avatar_url || 'https://via.placeholder.com/32'} alt="" className="feed-avatar" />
                                            <span className="feed-user">{t.profiles?.display_name}</span>
                                        </div>
                                        <div className="feed-card-preview">
                                            {bg ? (
                                                <img src={bg} alt="" className="feed-preview-img" />
                                            ) : (
                                                <div className="no-preview">📄</div>
                                            )}
                                        </div>
                                        <div className="feed-card-body">
                                            <h4>{t.title}</h4>
                                            <p>{t.description?.substring(0, 60)}...</p>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
