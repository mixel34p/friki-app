
import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LoadingSpinner from '../components/LoadingSpinner'
import { useToast } from '../components/Toast'
import FollowsModal from '../components/FollowsModal'
import EditProfile from './EditProfile'

import './Profile.css'
import { SocialIcons } from '../components/SocialIcons'

/* ── SVG icons ── */
const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
)

const IconUserPlus = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
    </svg>
)

const IconUserCheck = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
    </svg>
)

const IconMapPin = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
)

const IconGamepad = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>
)

const IconTV = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
)

/* ── Social link helpers ── */
const SOCIAL_ICONS_MAP = {
    twitter:   <SocialIcons.Twitter />,
    instagram: <SocialIcons.Instagram />,
    twitch:    <SocialIcons.Twitch />,
    youtube:   <SocialIcons.YouTube />,
    discord:   <SocialIcons.Discord />,
    steam:     <SocialIcons.Steam />,
    reddit:    <SocialIcons.Reddit />,
    tiktok:    <SocialIcons.TikTok />,
    github:    <SocialIcons.GitHub />,
    website:   <SocialIcons.Website />
}

import { BADGES_MAP } from '../lib/badges'

const getSocialLink = (platform, handle) => {
    if (!handle) return null
    if (handle.startsWith('http://') || handle.startsWith('https://')) return handle
    const clean = handle.replace('@', '')
    switch (platform) {
        case 'twitter':   return `https://x.com/${clean}`
        case 'instagram': return `https://instagram.com/${clean}`
        case 'twitch':    return `https://twitch.tv/${clean}`
        case 'steam':     return `https://steamcommunity.com/id/${clean}`
        case 'youtube':   return `https://youtube.com/@${clean}`
        case 'reddit':    return `https://reddit.com/user/${clean}`
        case 'tiktok':    return `https://tiktok.com/@${clean}`
        case 'github':    return `https://github.com/${clean}`
        case 'discord':   return null
        default:          return handle
    }
}



export default function Profile() {
    const { username } = useParams()
    const { user, profile: myProfile } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()

    const [profile, setProfile] = useState(null)
    const [stats, setStats] = useState({ following: 0, followers: 0 })
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [followsModal, setFollowsModal] = useState({ isOpen: false, type: 'followers' })
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef(null)
    const [activeFavTab, setActiveFavTab] = useState('games')

    const { toast } = useToast()
    const isOwnProfile = !username || username === myProfile?.username

    const navigate = useNavigate()
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        document.body.classList.add('hide-main-header-on-mobile')
        
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 300)
        }
        window.addEventListener('scroll', handleScroll)
        
        return () => {
            document.body.classList.remove('hide-main-header-on-mobile')
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }
        setIsPlaying(false)
        loadProfile()
    }, [username, myProfile])

    const loadProfile = async () => {
        try {
            let profileData, userId

            if (isOwnProfile) {
                profileData = myProfile
                userId = user?.id
            } else {
                const { data } = await supabase
                    .from('profiles').select('*')
                    .eq('username', username).single()
                profileData = data
                userId = data?.id
            }


            setProfile(profileData)
            if (profileData) {
                if (profileData.favorite_games && profileData.favorite_games.length > 0) {
                    setActiveFavTab('games')
                } else if (profileData.favorite_animes && profileData.favorite_animes.length > 0) {
                    setActiveFavTab('anime')
                }
            }

            if (!userId) { setLoading(false); return }

            const [{ count: followingCount }, { count: followersCount }] = await Promise.all([
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)
            ])
            setStats({ following: followingCount || 0, followers: followersCount || 0 })

            if (!isOwnProfile && user) {
                const { data: followData } = await supabase
                    .from('follows').select('id')
                    .eq('follower_id', user.id).eq('following_id', userId)
                    .maybeSingle()
                setIsFollowing(!!followData)
            }
        } catch (err) {
            console.error('Error loading profile:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleFollow = async () => {
        if (!user || !profile) return
        try {
            if (isFollowing) {
                await supabase.from('follows').delete()
                    .eq('follower_id', user.id).eq('following_id', profile.id)
                setIsFollowing(false)
                setStats(prev => ({ ...prev, followers: prev.followers - 1 }))
            } else {
                await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id })
                setIsFollowing(true)
                setStats(prev => ({ ...prev, followers: prev.followers + 1 }))
            }
        } catch (err) { console.error('Follow error:', err) }
    }

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    const togglePlay = async () => {
        let songData = profile?.profile_song
        if (typeof songData === 'string') {
            try { songData = JSON.parse(songData) } catch (e) { return }
        }
        if (!songData) return

        if (!audioRef.current) {
            let finalUrl = songData.previewUrl;
            
            // Si es de Deezer y tenemos ID, pillamos la URL fresca porque la preview caduca
            if (songData.trackId && (songData.provider === 'deezer' || !songData.provider)) {
                try {
                    finalUrl = await new Promise((resolve) => {
                        const cbName = 'dzCb_' + Date.now() + Math.floor(Math.random()*1000);
                        const scriptId = 'dzScript_' + cbName;
                        window[cbName] = (data) => {
                            document.getElementById(scriptId)?.remove();
                            delete window[cbName];
                            resolve(data?.preview || songData.previewUrl);
                        };
                        const script = document.createElement('script');
                        script.id = scriptId;
                        script.src = `https://api.deezer.com/track/${songData.trackId}?output=jsonp&callback=${cbName}`;
                        document.body.appendChild(script);
                        setTimeout(() => resolve(songData.previewUrl), 3000);
                    });
                } catch(e) {}
            }

            if (!finalUrl) return;

            const audio = new Audio(finalUrl)
            audio.volume = 0.5
            
            // Sincronizar estado con eventos nativos
            audio.onplay = () => setIsPlaying(true)
            audio.onpause = () => setIsPlaying(false)
            audio.onended = () => {
                setIsPlaying(false)
                audio.currentTime = 0 // Reiniciar al acabar
                audio.volume = 0.5    // Restaurar volumen original
            }

            // Efecto de fade-out en los últimos 3 segundos para que no corte brusco
            audio.ontimeupdate = () => {
                if (!audio.duration) return
                const timeLeft = audio.duration - audio.currentTime
                if (timeLeft < 3 && timeLeft > 0) {
                    audio.volume = Math.max(0, (timeLeft / 3) * 0.5)
                }
            }

            audioRef.current = audio
        }

        if (audioRef.current.paused) {
            audioRef.current.play().catch(e => console.log('Auto-play blocked or error:', e))
        } else {
            audioRef.current.pause()
        }
    }

    const renderSongPlayer = (className) => {
        let parsedSong = null
        if (profile?.profile_song) {
            if (typeof profile.profile_song === 'object') parsedSong = profile.profile_song
            else if (typeof profile.profile_song === 'string') {
                try { parsedSong = JSON.parse(profile.profile_song) } catch (e) { /* ignore */ }
            }
        }
        if (!parsedSong?.previewUrl) return null

        return (
            <div className={`custom-song-pill ${className}`} onClick={togglePlay}>
                <div className={`song-cover-wrapper ${isPlaying ? 'playing' : ''}`}>
                    <img src={parsedSong.cover} alt="cover" className="song-cover" />
                    <div className="song-center-hole"></div>
                </div>
                <div className="song-info">
                    <div className="song-name-scroll">
                        <span>{parsedSong.name}</span>
                    </div>
                    <span className="song-artist">{parsedSong.artist}</span>
                </div>
                <button className="song-play-btn">
                    {isPlaying ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>
            </div>
        )
    }

    if (loading) return <div className="profile-loading"><LoadingSpinner /></div>

    if (!profile) return (
        <div className="profile-error">
            <h2>Usuario no encontrado</h2>
            <Link to="/home" className="btn btn-primary">Volver al inicio</Link>
        </div>
    )

    const hasSocials = profile.social_links && Object.values(profile.social_links).some(Boolean)

    return (
        <div className="profile-page" style={profile.theme_color ? { 
            '--brand-primary': profile.theme_color,
            '--brand-dark': profile.theme_color 
        } : {}}>

            {/* Mobile Topbar */}
            <div className={`profile-mobile-nav ${isScrolled ? 'scrolled' : ''}`}>
                <button className="profile-mobile-back" onClick={() => navigate(-1)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                </button>
                <div className={`profile-mobile-mini-info ${isScrolled ? 'visible' : ''}`}>
                    <div className="profile-mobile-name-row">
                        <span className="profile-mobile-name">{profile.display_name}</span>
                        {profile.featured_badge && BADGES_MAP[profile.featured_badge] && (
                            <div style={{ color: BADGES_MAP[profile.featured_badge].color, display: 'flex', flexShrink: 0 }} title={BADGES_MAP[profile.featured_badge].title}>
                                {BADGES_MAP[profile.featured_badge].icon}
                            </div>
                        )}
                    </div>
                    {!isOwnProfile && (
                        <button 
                            className="btn btn-primary" 
                            style={{ padding: '4px 12px', fontSize: '0.8rem', minHeight: '28px', flexShrink: 0 }}
                            onClick={handleFollow}
                        >
                            {isFollowing ? 'Siguiendo' : 'Seguir'}
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Banner ─── */}
            <div className="profile-banner">
                {profile.banner_url && (
                    <>
                        <img src={profile.banner_url} alt="" className="profile-banner-img" />
                        <div className="profile-banner-overlay" />
                    </>
                )}
            </div>

            {/* ─── Header card ─── */}
            <div className="profile-header-card">

                {/* Avatar: posición absoluta, sobresale hacia el banner */}
                <div className="profile-avatar-wrapper">
                    {profile.avatar_url ? (
                        <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="profile-avatar"
                        />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {profile.display_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                    )}
                </div>

                <div className="profile-header-inner">

                    {/* Fila 1: espacio para el avatar (izq) + botones (der) */}
                    <div className="profile-actions-row">
                        <div className="desktop-song-wrapper">
                            {renderSongPlayer('desktop-song-pill')}
                        </div>
                        <div className="profile-actions">
                            {isOwnProfile ? (
                                <button onClick={() => setSearchParams({ edit: 'true' })} className="btn btn-secondary">
                                    <IconEdit /> Editar perfil
                                </button>
                            ) : (
                                <button
                                    className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                                    onClick={handleFollow}
                                >
                                    {isFollowing
                                        ? <><IconUserCheck /> Siguiendo</>
                                        : <><IconUserPlus /> Seguir</>
                                    }
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Fila 2: Identidad — nombre, @user, bio, stats, plataformas, socials */}
                    
                    
                    <div className="profile-header-columns">
                        <div className="profile-identity">
                            
                        <div className="profile-name-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h1 className="profile-display-name" style={{ margin: 0 }}>{profile.display_name}</h1>
                            {profile.pronouns && (
                                <span className="profile-pronouns">{profile.pronouns}</span>
                            )}
                        </div>

                        <div className="profile-meta-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                            <p className="profile-username" style={{ margin: 0 }}>@{profile.username}</p>
                            {profile.badges && profile.badges.length > 0 && (
                                <div className="profile-badges" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {profile.badges.map(b => BADGES_MAP[b] && (
                                        <div key={b} title={BADGES_MAP[b].title} style={{ color: BADGES_MAP[b].color, display: 'flex' }}>
                                            {BADGES_MAP[b].icon}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {profile.location && (
                            <div className="profile-additional-info" style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '12px', marginBottom: '4px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <IconMapPin /> {profile.location}
                                </span>
                            </div>
                        )}

                        {profile.bio && (
                            <div className="profile-bio markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{profile.bio}</ReactMarkdown>
                            </div>
                        )}

                        <div className="profile-stats-inline">
                            <div 
                                className="profile-stat-item clickable"
                                onClick={() => setFollowsModal({ isOpen: true, type: 'followers' })}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="stat-num">{stats.followers}</span>
                                <span className="stat-lbl">Seguidores</span>
                            </div>
                            <div 
                                className="profile-stat-item clickable" 
                                onClick={() => setFollowsModal({ isOpen: true, type: 'following' })}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="stat-num">{stats.following}</span>
                                <span className="stat-lbl">Siguiendo</span>
                            </div>
                        </div>



                        {hasSocials && (
                            <div className="profile-socials">
                                {Object.entries(profile.social_links).map(([platform, value]) => {
                                    if (!value) return null
                                    const href = getSocialLink(platform, value)
                                    return platform === 'discord' ? (
                                        <button
                                            key={platform}
                                            className="social-icon-btn"
                                            onClick={() => {
                                                navigator.clipboard.writeText(value)
                                                toast({
                                                    title: 'Discord copiado',
                                                    message: `${value} se ha copiado al portapapeles.`,
                                                    type: 'discord'
                                                })
                                            }}
                                            title={`Discord: ${value}`}
                                        >
                                            {SOCIAL_ICONS_MAP[platform]}
                                        </button>
                                    ) : (
                                        <a
                                            key={platform}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="social-icon-btn"
                                            title={platform}
                                        >
                                            {SOCIAL_ICONS_MAP[platform]}
                                        </a>
                                    )
                                })}
                            </div>
                        )}

                        
                            <div className="mobile-song-wrapper">
                            {renderSongPlayer('mobile-song-pill')}
                        </div>
                    </div>
                        
                                                <div className="profile-header-favorites">
                            <div className="profile-favorites-section">


                                
                                {(profile?.favorite_animes?.length > 0 || profile?.favorite_games?.length > 0) && (
                                    <div className="profile-favorites-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '12px' }}>
                                    <h3 className="profile-favorites-title" style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
                                        {activeFavTab === 'anime' ? (
                                            <><IconTV size={18} /> ANIMES FAVORITOS</>
                                        ) : (
                                            <><IconGamepad size={18} /> VIDEOJUEGOS FAVORITOS</>
                                        )}
                                    </h3>

                                    {(profile.favorite_animes?.length > 0 && profile.favorite_games?.length > 0) && (
                                        <div className="fav-tab-switch">
                                            <button 
                                                className={`switch-option ${activeFavTab === 'anime' ? 'active' : ''}`}
                                                onClick={() => setActiveFavTab('anime')}
                                                title="Animes"
                                            >
                                                <IconTV size={16} />
                                            </button>
                                            <button 
                                                className={`switch-option ${activeFavTab === 'games' ? 'active' : ''}`}
                                                onClick={() => setActiveFavTab('games')}
                                                title="Videojuegos"
                                            >
                                                <IconGamepad size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                )}

                                
                                {activeFavTab === 'anime' && profile.favorite_animes && profile.favorite_animes.length > 0 && (
                                    <div className="profile-favorites-block">
                                        <div className="profile-favorites-grid">
                                            {profile.favorite_animes.map((a, idx) => (
                                                <div key={idx} className="profile-favorite-poster">
                                                    {a.cover_url ? <img src={a.cover_url} alt={a.title} /> : <div className="no-cover">{a.title}</div>}
                                                    <div className="profile-favorite-overlay">
                                                        <span>{a.title}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeFavTab === 'games' && profile.favorite_games && profile.favorite_games.length > 0 && (
                                    <div className="profile-favorites-block">
                                        <div className="profile-favorites-grid">
                                            {profile.favorite_games.map((g, idx) => (
                                                <div key={idx} className="profile-favorite-poster">
                                                    {g.cover_url ? <img src={g.cover_url} alt={g.name} /> : <div className="no-cover">{g.name}</div>}
                                                    <div className="profile-favorite-overlay">
                                                        <span>{g.name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ─── Área de contenido (se llenará próximamente) ─── */}
            <div className="profile-content">
            </div>

            <FollowsModal
                isOpen={followsModal.isOpen}
                onClose={() => setFollowsModal(prev => ({ ...prev, isOpen: false }))}
                type={followsModal.type}
                userId={profile.id}
            />

            {searchParams.get('edit') === 'true' && (
                <EditProfile onClose={() => setSearchParams({})} />
            )}
        </div>
    )
}
