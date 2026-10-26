
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getAccentTextColor, getVisibleAccentColor } from '../lib/colorContrast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from '../components/Toast'
import FollowsModal from '../components/FollowsModal'
import EditProfile from './EditProfile'
import LibraryGrid from '../components/LibraryGrid'
import ListLikeButton from '../components/ListLikeButton'

import LoadingSpinner from '../components/LoadingSpinner'
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
    const [isFollowing, setIsFollowing] = useState(false)
    const [isFollowedBy, setIsFollowedBy] = useState(false)
    const [loading, setLoading] = useState(true)
    const [followsModal, setFollowsModal] = useState({ isOpen: false, type: 'followers' })
    const [selectedBadge, setSelectedBadge] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef(null)
    const [activeFavTab, setActiveFavTab] = useState('games')
    const [activeProfileTab, setActiveProfileTab] = useState('actividad')
    const [userLists, setUserLists] = useState([])
    const [userTemplates, setUserTemplates] = useState([])

    const { toast } = useToast()
    const isOwnProfile = !username || username === myProfile?.username

    const navigate = useNavigate()
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        if (!selectedBadge) return undefined

        const previousOverflow = document.body.style.overflow
        const handleKeyDown = event => {
            if (event.key === 'Escape') setSelectedBadge(null)
        }

        document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [selectedBadge])

    useEffect(() => {
        document.body.classList.add('profile-no-main-header-on-mobile')

        const handleScroll = () => {
            setIsScrolled(window.scrollY > 300)
        }
        window.addEventListener('scroll', handleScroll)

        return () => {
            document.body.classList.remove('profile-no-main-header-on-mobile')
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

    const getCollageImages = (content) => {
        let images = [];
        if (!content) return images;
        
        const addImg = (item) => {
            if (!item) return;
            const img = item.image_url || item.cover_url || (item.cover && item.cover.url);
            if (img && !images.includes(img)) {
                images.push(img);
            }
        };

        if (Array.isArray(content)) {
            // Ranking format
            for (const item of content) {
                addImg(item);
                if (images.length === 4) return images;
            }
        } else {
            // Tierlist or Grid format
            const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F'];
            // Try priorities first
            for (const key of priorities) {
                if (content[key]) {
                    if (Array.isArray(content[key])) {
                        for (const item of content[key]) {
                            addImg(item);
                            if (images.length === 4) return images;
                        }
                    } else {
                        addImg(content[key]);
                        if (images.length === 4) return images;
                    }
                }
            }
            // Then any other row/cell
            for (const key in content) {
                if (!priorities.includes(key) && content[key]) {
                    if (Array.isArray(content[key])) {
                        for (const item of content[key]) {
                            addImg(item);
                            if (images.length === 4) return images;
                        }
                    } else {
                        addImg(content[key]);
                        if (images.length === 4) return images;
                    }
                }
            }
        }
        return images;
    }

    const loadProfile = async () => {
        try {
            setIsFollowing(false)
            setIsFollowedBy(false)
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

            const { getUserLists, getUserTemplates } = await import('../lib/listService.js')

            const [lists, templates] = await Promise.all([
                getUserLists(userId),
                getUserTemplates(userId)
            ])
            setUserLists(lists || [])
            setUserTemplates(templates || [])

            if (!isOwnProfile && user) {
                const [followingResult, followedByResult] = await Promise.all([
                    supabase.from('follows').select('id')
                        .eq('follower_id', user.id).eq('following_id', userId).maybeSingle(),
                    supabase.from('follows').select('id')
                        .eq('follower_id', userId).eq('following_id', user.id).maybeSingle()
                ])
                setIsFollowing(!!followingResult.data)
                setIsFollowedBy(!!followedByResult.data)
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
            } else {
                await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id })
                setIsFollowing(true)
            }
        } catch (err) { console.error('Follow error:', err) }
    }

    const followLabel = isFollowing
        ? isFollowedBy ? 'Amigos' : 'Siguiendo'
        : isFollowedBy ? 'Seguir también' : 'Seguir'

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
    const profileAccent = profile.theme_color || '#14b8a6'
    const accentTextColor = getAccentTextColor(profileAccent)
    const visibleAccent = getVisibleAccentColor(profileAccent)

    return (
        <div className="profile-page" style={profile.theme_color ? { 
            '--brand-primary': profile.theme_color,
            '--brand-dark': profile.theme_color,
            '--profile-accent-text': accentTextColor,
            '--profile-accent-visible': visibleAccent
        } : {
            '--profile-accent-text': accentTextColor,
            '--profile-accent-visible': visibleAccent
        }}>

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
                        {profile.avatar_url ? (
                            <img className="profile-mobile-mini-avatar" src={profile.avatar_url} alt="" />
                        ) : (
                            <span className="profile-mobile-mini-avatar profile-mobile-mini-avatar-placeholder">
                                {profile.display_name?.charAt(0).toUpperCase() || '?'}
                            </span>
                        )}
                        <span className="profile-mobile-name">{profile.display_name}</span>
                    </div>
                    {!isOwnProfile && (
                        <button
                            className={`btn btn-primary${isFollowing && isFollowedBy ? ' profile-friends-button' : ''}`}
                            style={{ padding: '4px 12px', fontSize: '0.8rem', minHeight: '28px', flexShrink: 0 }}
                            onClick={handleFollow}
                        >
                            {followLabel}
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
                <div className="profile-header-inner">
                    {/* El avatar comparte el ancho centrado del contenido del perfil. */}
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

                    {/* Fila 2: Identidad — nombre, @user, bio, stats, plataformas, socials */}
                    
                    
                    <div className="profile-header-columns">
                        <div className={`profile-identity ${profile.location ? 'has-location' : 'no-location'}`}>
                            
                        <div className="profile-name-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h1 className="profile-display-name" style={{ margin: 0 }}>{profile.display_name}</h1>
                            {profile.featured_badge && BADGES_MAP[profile.featured_badge] && (
                                <button
                                    type="button"
                                    className="profile-featured-badge"
                                    title={`Insignia destacada: ${BADGES_MAP[profile.featured_badge].title}`}
                                    aria-label={`Insignia destacada: ${BADGES_MAP[profile.featured_badge].title}`}
                                    aria-haspopup="dialog"
                                    onClick={() => setSelectedBadge(profile.featured_badge)}
                                    style={{ color: BADGES_MAP[profile.featured_badge].color }}
                                >
                                    {BADGES_MAP[profile.featured_badge].icon}
                                </button>
                            )}
                            {profile.pronouns && (
                                <span className="profile-pronouns">{profile.pronouns}</span>
                            )}
                            <div className="profile-actions">
                                {isOwnProfile ? (
                                    <button onClick={() => setSearchParams({ edit: 'true' })} className="btn btn-secondary profile-edit-button">
                                        <IconEdit /> Editar perfil
                                    </button>
                                ) : (
                                    <button
                                        className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}${isFollowing && isFollowedBy ? ' profile-friends-button' : ''}`}
                                        onClick={handleFollow}
                                    >
                                        {isFollowing
                                            ? <><IconUserCheck /> {followLabel}</>
                                            : <><IconUserPlus /> {followLabel}</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="profile-meta-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                            <p className="profile-username" style={{ margin: 0 }}>@{profile.username}</p>
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

                        {renderSongPlayer('profile-song-pill')}

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
                                        <div className={`fav-tab-switch ${activeFavTab === 'games' ? 'games-active' : ''}`}>
                                            <button 
                                                className={`tab-btn ${activeFavTab === 'anime' ? 'active' : ''}`}
                                                type="button"
                                                onClick={() => setActiveFavTab('anime')}
                                                title="Animes"
                                                aria-pressed={activeFavTab === 'anime'}
                                            >
                                                Anime
                                            </button>
                                            <button 
                                                className={`tab-btn ${activeFavTab === 'games' ? 'active' : ''}`}
                                                type="button"
                                                onClick={() => setActiveFavTab('games')}
                                                title="Videojuegos"
                                                aria-pressed={activeFavTab === 'games'}
                                            >
                                                Juegos
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

            {/* --- PROFILE SECTION TABS --- */}
            <div className="profile-section-tabs">
                {[
                    { id: 'actividad', label: 'Actividad' },
                    { id: 'tierlists', label: 'Tierlists' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`profile-section-tab ${activeProfileTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveProfileTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="profile-content">
                {activeProfileTab === 'actividad' && (
                    profile && <LibraryGrid profile={profile} userId={profile.id} username={profile.username} wishlist={profile.wishlist} />
                )}
                {activeProfileTab === 'tierlists' && (
                    <div className="profile-activity-container" style={{ display: 'grid', gridTemplateColumns: 'var(--grid-cols, 5fr 3fr)', gap: 'var(--grid-gap, 3rem)', width: '100%', alignItems: 'start', marginTop: 'var(--space-lg)' }}>
                        {/* LEFT COLUMN: TIERLISTS DESTACADAS */}
                        <div className="activity-col activity-reviews" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div className="activity-col-header">
                                <h3>Tierlists Destacadas</h3>
                                {profile?.username && <Link to={`/profile/${profile.username}/tierlists`} className="activity-view-all">Ver todas</Link>}
                            </div>
                            {userLists.length === 0 ? (
                                <div className="activity-empty-box">Aún no hay tierlists.</div>
                            ) : (
                                <div className="reviews-list">
                                    {(() => {
                                        let displayedLists = [];
                                        const pinnedListId = profile?.pinned_list_id;
                                        const pinnedList = pinnedListId ? userLists.find(l => l.id === pinnedListId) : null;
                                        if (pinnedList) {
                                            displayedLists.push({ ...pinnedList, isPinned: true });
                                            const others = userLists.filter(l => l.id !== pinnedListId);
                                            displayedLists.push(...others.slice(0, 3));
                                        } else {
                                            displayedLists = userLists.slice(0, 4);
                                        }

                                        return displayedLists.map(t => {
                                            const images = getCollageImages(t.content);

                                            return (
                                            <div key={t.id} className="review-card" style={{ gap: '1rem', paddingBottom: '1rem', marginBottom: '1rem', position: 'relative' }}>
                                                {t.isPinned && (
                                                    <div style={{ position: 'absolute', top: '0px', right: '0px', zIndex: 10, color: 'var(--brand-primary)' }} title="Tierlist destacada">
                                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                                    </div>
                                                )}
                                                <Link to={`/lists/${t.id}`} className="review-poster-link">
                                                    {images.length > 0 ? (
                                                        <div className="review-poster" style={{ 
                                                            width: '75px',
                                                            height: '112px',
                                                            display: 'grid', 
                                                            gridTemplateColumns: images.length > 1 ? '1fr 1fr' : '1fr',
                                                            gridTemplateRows: images.length > 2 ? '1fr 1fr' : '1fr',
                                                            gap: 0, 
                                                            background: 'var(--bg-tertiary)',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {images.map((img, i) => (
                                                                <div key={i} style={{ 
                                                                    backgroundImage: `url(${img})`, 
                                                                    backgroundSize: 'cover', 
                                                                    backgroundPosition: 'center',
                                                                    width: '100%',
                                                            height: '100%',
                                                            gridColumn: images.length === 3 && i === 2 ? '1 / -1' : undefined
                                                                }} />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="review-poster" style={{ width: '75px', height: '112px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Sin imagen</span>
                                                        </div>
                                                    )}
                                                </Link>
                                                <div className="review-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                                                    <div className="review-header">
                                                        <Link to={`/lists/${t.id}`} className="review-title" style={{ fontSize: '1rem' }}>
                                                            {t.title}
                                                        </Link>
                                                    </div>
                                                    <div className="review-metadata" style={{ marginTop: '6px', marginBottom: '4px' }}>
                                                        <div className="search-list-tags">
                                                            {t.list_type && (
                                                                <span className={'search-list-tag type-' + t.list_type}>
                                                                    {t.list_type === 'tierlist' && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                                                                    {t.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                                                                    {t.list_type === 'grid' && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                                                    {t.list_type === 'ranking' ? 'Ranking' : t.list_type === 'grid' ? 'Grid' : 'Tierlist'}
                                                                </span>
                                                            )}
                                                            {t.media_type && (
                                                                <span className={'search-list-tag media-' + t.media_type}>
                                                                    {t.media_type === 'game' && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>}
                                                                    {t.media_type === 'anime' && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>}
                                                                    {t.media_type === 'game' ? 'Videojuegos' : t.media_type === 'anime' ? 'Anime' : t.media_type}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ListLikeButton listId={t.id} />
                                                </div>
                                            </div>
                                            );
                                        })
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: PLANTILLAS */}
                        <div className="activity-col activity-diary" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div className="activity-col-header">
                                <h3>Plantillas</h3>
                                {profile?.username && <Link to={`/profile/${profile.username}/templates`} className="activity-view-all">Ver todas</Link>}
                            </div>
                            {userTemplates.length === 0 ? (
                                <div className="activity-empty-box">Aún no hay plantillas creadas.</div>
                            ) : (
                                <div className="diary-entries" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {userTemplates.slice(0, 4).map(t => (
                                        <div key={t.id} className="diary-entry" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <Link to={`/templates/${t.id}`} className="diary-entry-poster">
                                                <div className="diary-micro-poster" style={{ background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                                    {t.list_type === 'tierlist' || !t.list_type ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> : null}
                                                    {t.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                                                    {t.list_type === 'grid' && <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                                </div>
                                            </Link>
                                            <div className="diary-entry-info">
                                                <div className="diary-entry-header">
                                                    <Link to={`/templates/${t.id}`} className="diary-entry-title">
                                                        {t.title}
                                                    </Link>
                                                </div>
                                                <div className="review-metadata" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                                    <span>{t.uses_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <FollowsModal
                isOpen={followsModal.isOpen}
                onClose={() => setFollowsModal(prev => ({ ...prev, isOpen: false }))}
                type={followsModal.type}
                userId={profile.id}
                themeColor={profile.theme_color}
            />

            {selectedBadge && BADGES_MAP[selectedBadge] && createPortal(
                <div
                    className="profile-badge-modal-backdrop"
                    onClick={event => { if (event.target === event.currentTarget) setSelectedBadge(null) }}
                >
                    <section
                        className="profile-badge-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-badge-modal-title"
                        style={{ '--badge-color': BADGES_MAP[selectedBadge].color }}
                    >
                        <button
                            type="button"
                            className="profile-badge-modal-close"
                            onClick={() => setSelectedBadge(null)}
                            aria-label="Cerrar información de insignia"
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="m18 6-12 12M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="profile-badge-modal-icon" aria-hidden="true">
                            {BADGES_MAP[selectedBadge].icon}
                        </div>
                        <span className="profile-badge-modal-kicker">Insignia de perfil</span>
                        <h2 id="profile-badge-modal-title">{BADGES_MAP[selectedBadge].title}</h2>
                        <p>{BADGES_MAP[selectedBadge].description}</p>
                        <div className="profile-badge-modal-footer">
                            <span className="profile-badge-modal-dot" />
                            Insignia de la comunidad
                        </div>
                    </section>
                </div>,
                document.body
            )}

            {searchParams.get('edit') === 'true' && (
                <EditProfile onClose={() => setSearchParams({})} />
            )}
        </div>
    )
}




