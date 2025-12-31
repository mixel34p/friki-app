
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LoadingSpinner from '../components/LoadingSpinner'
import './Profile.css'
import { SocialIcons } from '../components/SocialIcons'

const SOCIAL_ICONS_MAP = {
    twitter: <SocialIcons.Twitter />,
    instagram: <SocialIcons.Instagram />,
    twitch: <SocialIcons.Twitch />,
    youtube: <SocialIcons.YouTube />,
    discord: <SocialIcons.Discord />,
    steam: <SocialIcons.Steam />,
    reddit: <SocialIcons.Reddit />,
    tiktok: <SocialIcons.TikTok />,
    github: <SocialIcons.GitHub />,
    website: <SocialIcons.Website />
}

const getSocialLink = (platform, handle) => {
    if (!handle) return null

    // If it's already a URL, return it
    if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle
    }

    const cleanHandle = handle.replace('@', '')

    switch (platform) {
        case 'twitter':
            return `https://x.com/${cleanHandle}`
        case 'instagram':
            return `https://instagram.com/${cleanHandle}`
        case 'twitch':
            return `https://twitch.tv/${cleanHandle}`
        case 'steam':
            // Assume custom ID by default, fallback to profiles if numeric could be added but ID is safer assumption
            return `https://steamcommunity.com/id/${cleanHandle}`
        case 'youtube':
            return `https://youtube.com/@${cleanHandle}`
        case 'reddit':
            return `https://reddit.com/user/${cleanHandle}`
        case 'tiktok':
            return `https://tiktok.com/@${cleanHandle}`
        case 'github':
            return `https://github.com/${cleanHandle}`
        case 'discord':
            return null // Special handling for copy
        default:
            return handle // Website or others fallback
    }
}

export default function Profile() {
    const { username } = useParams()
    const { user, profile: myProfile } = useAuth()

    const [profile, setProfile] = useState(null)
    const [tierlists, setTierlists] = useState([])
    const [stats, setStats] = useState({ following: 0, followers: 0 })
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(true)

    const isOwnProfile = !username || username === myProfile?.username



    // We no longer inject global styles to prevent leaking
    // Instead we apply them to the .profile wrapper below

    useEffect(() => {
        loadProfile()
    }, [username, myProfile])

    const loadProfile = async () => {
        try {
            let profileData
            let userId

            if (isOwnProfile) {
                profileData = myProfile
                userId = user?.id
            } else {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single()

                profileData = data
                userId = data?.user_id
            }

            setProfile(profileData)

            if (!userId) {
                setLoading(false)
                return
            }

            // Get tierlists
            let tierlistQuery = supabase
                .from('tierlists')
                .select('*')
                .eq('user_id', userId)

            if (!isOwnProfile) {
                tierlistQuery = tierlistQuery.eq('visibility', 'public')
            }

            const { data: lists } = await tierlistQuery.order('created_at', { ascending: false })

            setTierlists(lists || [])

            // Get follow stats
            const [{ count: followingCount }, { count: followersCount }] = await Promise.all([
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)
            ])

            setStats({
                following: followingCount || 0,
                followers: followersCount || 0
            })

            // Check if I'm following this user
            if (!isOwnProfile && user) {
                const { data: followData } = await supabase
                    .from('follows')
                    .select('id')
                    .eq('follower_id', user.id)
                    .eq('following_id', userId)
                    .maybeSingle()

                setIsFollowing(!!followData)
            }
        } catch (error) {
            console.error('Error loading profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleFollow = async () => {
        if (!user || !profile) return

        try {
            if (isFollowing) {
                await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', user.id)
                    .eq('following_id', profile.user_id)

                setIsFollowing(false)
                setStats(prev => ({ ...prev, followers: prev.followers - 1 }))
            } else {
                await supabase
                    .from('follows')
                    .insert({
                        follower_id: user.id,
                        following_id: profile.user_id
                    })

                setIsFollowing(true)
                setStats(prev => ({ ...prev, followers: prev.followers + 1 }))
            }
        } catch (error) {
            console.error('Follow error:', error)
        }
    }

    if (loading) {
        return (
            <div className="profile-loading">
                <LoadingSpinner />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="profile-error">
                <h2>Usuario no encontrado</h2>
                <Link to="/home" className="btn btn-primary">Volver</Link>
            </div>
        )
    }

    return (
        <div className="profile">
            <div className="container">
                {/* Header with Custom Banner */}
                <div className="profile-header">
                    {profile.banner_url && (
                        <div className="profile-banner-bg" style={{ backgroundImage: `url(${profile.banner_url})` }}></div>
                    )}

                    <div className="profile-main">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="profile-avatar" />
                        ) : (
                            <div className="profile-avatar profile-avatar-placeholder" style={{ background: 'var(--color-primary)' }}>
                                {profile.display_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                        )}

                        <div className="profile-info">
                            <h1 className="profile-name">
                                {profile.display_name}
                                {profile.pronouns && <span className="pronouns-badge">{profile.pronouns}</span>}
                            </h1>
                            <p className="profile-username">@{profile.username}</p>

                            {/* Social Links */}
                            {profile.social_links && Object.keys(profile.social_links).length > 0 && (
                                <div className="profile-socials">
                                    {Object.entries(profile.social_links).map(([platform, value]) => {
                                        if (!value) return null

                                        const href = getSocialLink(platform, value)
                                        const isDiscord = platform === 'discord'

                                        return isDiscord ? (
                                            <button
                                                key={platform}
                                                className="social-link social-link-btn"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(value)
                                                    alert(`Usuario de Discord copiado: ${value}`)
                                                }}
                                                title={`Discord: ${value} (Click para copiar)`}
                                            >
                                                {SOCIAL_ICONS_MAP[platform] || <img src="/icons/dialog.png" alt="💬" style={{ width: '20px', height: '20px' }} />}
                                            </button>
                                        ) : (
                                            <a
                                                key={platform}
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="social-link"
                                                title={platform}
                                            >
                                                {SOCIAL_ICONS_MAP[platform] || '🔗'}
                                            </a>
                                        )
                                    })}
                                </div>
                            )}
                            {profile.bio && (
                                <div className="profile-bio markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {profile.bio}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {/* Simple Platforms Display */}
                            {profile.platforms?.length > 0 && (
                                <div className="profile-platforms">
                                    {profile.platforms.map(p => (
                                        <span key={p} className="platform-badge">{p}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="profile-actions">
                        {isOwnProfile ? (
                            <Link to="/edit-profile" className="btn btn-secondary">
                                Editar perfil
                            </Link>
                        ) : (
                            <button
                                className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} `}
                                onClick={handleFollow}
                            >
                                {isFollowing ? 'Siguiendo' : 'Seguir'}
                            </button>
                        )}
                        <Link to={`/library/${profile.username}`} className="btn btn-secondary">
                            <img src="/icons/book.png" alt="📚" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Biblioteca
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="profile-stats">
                    <div className="profile-stat">
                        <span className="stat-value" style={{ color: 'var(--color-accent)' }}>{tierlists.length}</span>
                        <span className="stat-label">Tierlists</span>
                    </div>
                    <div className="profile-stat">
                        <span className="stat-value">{stats.following}</span>
                        <span className="stat-label">Siguiendo</span>
                    </div>
                    <div className="profile-stat">
                        <span className="stat-value">{stats.followers}</span>
                        <span className="stat-label">Seguidores</span>
                    </div>
                </div>

                {/* Favorites Grid (Game + Anime) */}
                {(profile.favorite_game || profile.favorite_anime) && (
                    <div className="favorites-grid">
                        {profile.favorite_game && (
                            <Link to={`/game/${profile.favorite_game.id}`} className="favorite-card clickable">
                                <span className="favorite-label"><img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> Juego Favorito</span>
                                <div className="favorite-content">
                                    {profile.favorite_game.cover_url && (
                                        <img src={profile.favorite_game.cover_url} alt="" />
                                    )}
                                    <div className="favorite-info">
                                        <span className="favorite-name">{profile.favorite_game.name}</span>
                                    </div>
                                </div>
                            </Link>
                        )}
                        {profile.favorite_anime && (
                            <Link to={`/anime/${profile.favorite_anime.id}`} className="favorite-card clickable">
                                <span className="favorite-label"><img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> Anime Favorito</span>
                                <div className="favorite-content">
                                    {profile.favorite_anime.cover_url && (
                                        <img src={profile.favorite_anime.cover_url} alt="" />
                                    )}
                                    <div className="favorite-info">
                                        <span className="favorite-name">{profile.favorite_anime.title}</span>
                                    </div>
                                </div>
                            </Link>
                        )}
                    </div>
                )}

                {/* Passions & Tags Section */}
                <div className="passions-section">
                    <h2 className="section-title">Pasiones</h2>
                    <div className="passions-grid">
                        {/* Games Passion */}
                        {profile.favorite_genres?.length > 0 && (
                            <div className="passion-item group">
                                <div className="passion-header">
                                    <span className="passion-icon"><img src="/icons/videogame.png" alt="🎮" style={{ width: '24px', height: '24px' }} /></span>
                                    <span className="passion-title">Videojuegos</span>
                                </div>
                                <div className="passion-tags">
                                    {profile.favorite_genres.map(g => (
                                        <span key={g} className="tag" style={{ borderColor: 'var(--color-primary)' }}>{g}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Anime Passion */}
                        {profile.anime_tags?.length > 0 && (
                            <div className="passion-item group">
                                <div className="passion-header">
                                    <span className="passion-icon"><img src="/icons/anime.png" alt="📺" style={{ width: '24px', height: '24px' }} /></span>
                                    <span className="passion-title">Anime</span>
                                </div>
                                <div className="passion-tags">
                                    {profile.anime_tags.map(t => (
                                        <span key={t} className="tag" style={{ borderColor: 'var(--color-secondary)' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Custom / Other */}
                        {profile.custom_tags?.length > 0 && (
                            <div className="passion-item group">
                                <div className="passion-header">
                                    <span className="passion-icon"><img src="/icons/star.png" alt="✨" style={{ width: '18px', height: '18px', verticalAlign: 'middle' }} /></span>
                                    <span className="passion-title">Intereses</span>
                                </div>
                                <div className="passion-tags">
                                    {profile.custom_tags.map(t => (
                                        <span key={t} className="tag" style={{ borderColor: 'var(--color-accent)' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tierlists */}
                <div className="profile-section">
                    <h2 className="section-title">Tierlists</h2>

                    {tierlists.length === 0 ? (
                        <div className="empty-state">
                            <p>{isOwnProfile ? 'Aún no has creado tierlists' : 'Sin tierlists públicas'}</p>
                            {isOwnProfile && (
                                <Link to="/create-tierlist" className="btn btn-primary btn-sm">
                                    Crear tierlist
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="tierlists-grid">
                            {tierlists.map(t => {
                                // Extract preview image
                                let previewImage = null
                                const tiers = ['S', 'A', 'B', 'C', 'D']
                                if (t.content) {
                                    for (const tier of tiers) {
                                        if (t.content[tier] && Array.isArray(t.content[tier]) && t.content[tier].length > 0) {
                                            const item = t.content[tier][0]
                                            // Handle potential legacy image_url or just fallback
                                            if (item.image_url) {
                                                previewImage = item.image_url.startsWith('//') ? `https:${item.image_url}` : item.image_url
                                                previewImage = previewImage.replace(/t_[a-z0-9_]+/, 't_cover_small')
                                                break
                                            }
                                        }
                                    }
                                }

                                return (
                                    <Link key={t.id} to={`/tierlist/${t.id}`} className="tierlist-item" style={{
                                        backgroundImage: previewImage ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), url(${previewImage})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}>
                                        <span className="tierlist-emoji">
                                            {t.media_type === 'game' && <img src="/icons/videogame.png" alt="🎮" style={{ width: '20px', height: '20px' }} />}
                                            {t.media_type === 'anime' && <img src="/icons/anime.png" alt="📺" style={{ width: '20px', height: '20px' }} />}
                                            {t.media_type === 'movie' && '🎬'}
                                        </span>
                                        <div className="tierlist-details">
                                            <h3>{t.title}</h3>
                                            <span className="tierlist-meta">
                                                {new Date(t.created_at).toLocaleDateString('es-ES', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
