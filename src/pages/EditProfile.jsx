import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getAccentTextColor } from '../lib/colorContrast'
import { searchGames } from '../lib/gameService'
import { getBlockedUsers, unblockUser } from '../lib/socialDiscoveryService'
import { BADGES_MAP } from '../lib/badges'
import './EditProfile.css'
import { SocialIcons } from '../components/SocialIcons'
import ImageCropperModal from '../components/ImageCropperModal'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SortableFavoriteItem } from '../components/profile/SortableFavoriteItem'

const getOwnedAvatarStoragePath = (avatarUrl, userId) => {
    if (!avatarUrl || !userId) return null

    try {
        const pathname = new URL(avatarUrl).pathname
        const bucketMarker = '/storage/v1/object/public/avatars/'
        const markerIndex = pathname.indexOf(bucketMarker)
        if (markerIndex === -1) return null

        const objectPath = decodeURIComponent(pathname.slice(markerIndex + bucketMarker.length))
        const ownedPathPrefix = `avatars/${userId}`
        if (!objectPath.startsWith(`${ownedPathPrefix}-`) && !objectPath.startsWith(`${ownedPathPrefix}.`)) return null
        return objectPath
    } catch {
        return null
    }
}

const getOwnedBannerStoragePath = (bannerUrl, userId) => {
    if (!bannerUrl || !userId) return null

    try {
        const pathname = new URL(bannerUrl).pathname
        const bucketMarker = '/storage/v1/object/public/avatars/'
        const markerIndex = pathname.indexOf(bucketMarker)
        if (markerIndex === -1) return null

        const objectPath = decodeURIComponent(pathname.slice(markerIndex + bucketMarker.length))
        if (!objectPath.startsWith(`banners/${userId}.`)) return null
        return objectPath
    } catch {
        return null
    }
}

/* ──────────────────────────────────────
   SVG Icons (no emojis)
   ────────────────────────────────────── */
const IconClose = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

const IconCamera = ({ size = 20 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
)

const IconImage = ({ size = 28 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
    </svg>
)

const IconPlus = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

const IconUser = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
)

const IconGamepad = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" />
        <line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" />
        <rect x="2" y="6" width="20" height="12" rx="2" />
    </svg>
)

const IconTV = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" />
        <polyline points="17 2 12 7 7 2" />
    </svg>
)

const IconMusic = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
)

const IconLink = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
)

const IconShield = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
)

const IconBold = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
)

const IconItalic = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" />
    </svg>
)

const IconLinkSmall = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
)

const IconHeart = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
)

/* ──────────────────────────────────────
   Constants
   ────────────────────────────────────── */
const THEME_COLORS = [
    '#ff3b30', '#ff7a18', '#ffbf1f', '#20c66b', '#3b82f6', '#a445f5', '#e93b9c', '#10b7a6', '#ec3a5c', '#f27087',
    '#f5a111', '#7dce14', '#0ebd87', '#03b4c5', '#12a9e0', '#625eea', '#9255e9', '#cd33c7', '#e72d2e', '#f0bd00',
    '#b21b50', '#84252a', '#7022a1', '#155b3f', '#c63d0f', '#874117', '#ae8e69', '#527d14', '#f1d0e2', '#f7b46d',
    '#fff18e', '#a8eed0', '#bbf0d4', '#c6a2ef', '#e2cff9', '#ade0f7', '#c3cef6', '#66e2cd', '#fcf0c9', '#6d7a89',
    '#30343a', '#183f95', '#0c0d0f', '#d2d3d7', '#ffffff'
]

const SOCIAL_PLATFORMS = [
    { id: 'twitter',   label: 'Twitter / X',  placeholder: '@usuario',           icon: <SocialIcons.Twitter /> },
    { id: 'instagram', label: 'Instagram',    placeholder: '@usuario',           icon: <SocialIcons.Instagram /> },
    { id: 'twitch',    label: 'Twitch',       placeholder: 'canal o URL',        icon: <SocialIcons.Twitch /> },
    { id: 'youtube',   label: 'YouTube',      placeholder: 'canal o URL',        icon: <SocialIcons.YouTube /> },
    { id: 'discord',   label: 'Discord',      placeholder: 'usuario#0000',       icon: <SocialIcons.Discord /> },
    { id: 'steam',     label: 'Steam',        placeholder: 'ID de usuario',      icon: <SocialIcons.Steam /> },
    { id: 'reddit',    label: 'Reddit',       placeholder: 'usuario',            icon: <SocialIcons.Reddit /> },
    { id: 'tiktok',    label: 'TikTok',       placeholder: '@usuario',           icon: <SocialIcons.TikTok /> },
    { id: 'github',    label: 'GitHub',       placeholder: 'usuario',            icon: <SocialIcons.GitHub /> },
    { id: 'website',   label: 'Sitio Web',    placeholder: 'https://tusitio.com',icon: <SocialIcons.Website /> }
]

const getEditSocialHref = (platform, handle) => {
    const value = handle?.trim()
    if (!value || platform === 'discord') return null
    if (/^https?:\/\//i.test(value)) return value
    const clean = value.replace(/^@/, '')
    const links = {
        twitter: `https://x.com/${clean}`,
        instagram: `https://instagram.com/${clean}`,
        twitch: `https://twitch.tv/${clean}`,
        youtube: `https://youtube.com/@${clean}`,
        steam: `https://steamcommunity.com/id/${clean}`,
        reddit: `https://reddit.com/user/${clean}`,
        tiktok: `https://tiktok.com/@${clean}`,
        github: `https://github.com/${clean}`,
        website: /^https?:\/\//i.test(value) ? value : `https://${value}`
    }
    return links[platform] || null
}

const SECTION_TABS = [
    { id: 'photos',    label: 'Fotos',     icon: <IconImage /> },
    { id: 'info',      label: 'Info',      icon: <IconUser /> },
    { id: 'favorites', label: 'Favoritos', icon: <IconHeart /> },
    { id: 'social',    label: 'Redes',     icon: <IconLink /> },
    { id: 'blocked',   label: 'Bloqueados',icon: <IconShield /> }
]

/* ──────────────────────────────────────
   Component
   ────────────────────────────────────── */
export default function EditProfile({ onClose, standalone = false }) {
    const { user, profile, updateProfile } = useAuth()
    const navigate = useNavigate()
    const fileInputRef = useRef(null)
    const bannerInputRef = useRef(null)
    const textareaRef = useRef(null)

    const [activeSection, setActiveSection] = useState('photos')

    const [formData, setFormData] = useState({
        username:        profile?.username        || '',
        display_name:    profile?.display_name    || '',
        pronouns:        profile?.pronouns        || '',
        location:        profile?.location        || '',
        bio:             (profile?.bio             || '').slice(0, 100),
        profile_song:    profile?.profile_song    || '',
        favorite_genres: profile?.favorite_genres || [],
        anime_tags:      profile?.anime_tags      || [],
        custom_tags:     profile?.custom_tags     || [],
        platforms:       profile?.platforms       || [],
        favorite_games:  profile?.favorite_games  || [],
        favorite_animes: profile?.favorite_animes || [],
        social_links:    profile?.social_links    || {},
        theme_color:     profile?.theme_color     || '#14b8a6',
        featured_badge:  profile?.featured_badge  || null
    })
    const savedFormDataRef = useRef(JSON.stringify(formData))
    const savedAvatarPreviewRef = useRef(profile?.avatar_url || null)
    const savedBannerPreviewRef = useRef(profile?.banner_url || null)

    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
    const [bannerFile, setBannerFile] = useState(null)
    const [bannerPreview, setBannerPreview] = useState(profile?.banner_url || null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [usernameError, setUsernameError] = useState('')
    const hasUnsavedChanges = JSON.stringify(formData) !== savedFormDataRef.current
        || !!avatarFile || !!bannerFile
        || avatarPreview !== savedAvatarPreviewRef.current
        || bannerPreview !== savedBannerPreviewRef.current

    // Cropper State
    const [cropModal, setCropModal] = useState({ isOpen: false, type: null, src: null, aspect: 1 })

    // Search state
    const [gameSearchQuery, setGameSearchQuery] = useState('')
    const [gameSearchResults, setGameSearchResults] = useState([])
    const [isSearchingGames, setIsSearchingGames] = useState(false)
    const [activeGameSlot, setActiveGameSlot] = useState(null)
    
    const [animeSearchQuery, setAnimeSearchQuery] = useState('')
    const [animeSearchResults, setAnimeSearchResults] = useState([])
    const [isSearchingAnime, setIsSearchingAnime] = useState(false)
    const [activeAnimeSlot, setActiveAnimeSlot] = useState(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    )

    const [songSearchQuery, setSongSearchQuery] = useState('')
    const [songSearchResults, setSongSearchResults] = useState([])
    const [isSearchingSong, setIsSearchingSong] = useState(false)

    // Tags & socials
    const [isAddingSocial, setIsAddingSocial] = useState(false)
    const [copiedSocial, setCopiedSocial] = useState('')

    useEffect(() => {
        if (standalone) return undefined
        const scrollY = window.scrollY;
        const body = document.body;
        const previousStyles = {
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
            overflow: body.style.overflow,
        };

        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';

        return () => {
            Object.assign(body.style, previousStyles);
            window.scrollTo(0, scrollY);
        };
    }, [standalone]);

    // Blocked users
    const [blockedUsers, setBlockedUsers] = useState([])
    const [loadingBlocked, setLoadingBlocked] = useState(false)

    const availablePlatforms = SOCIAL_PLATFORMS.filter(
        p => !formData.social_links[p.id] && formData.social_links[p.id] !== ''
    )
    const showProfileSections = !standalone || activeSection !== 'blocked'

    /* ── Effects ── */
    useEffect(() => {
        if (!user) return
        setLoadingBlocked(true)
        getBlockedUsers(user.id)
            .then(setBlockedUsers)
            .catch(err => console.error('Error fetching blocked users:', err))
            .finally(() => setLoadingBlocked(false))
    }, [user])

    useEffect(() => {
        if (gameSearchQuery.length < 3) { setGameSearchResults([]); return }
        const t = setTimeout(async () => {
            setIsSearchingGames(true)
            const results = await searchGames(gameSearchQuery)
            setGameSearchResults(results)
            setIsSearchingGames(false)
        }, 500)
        return () => clearTimeout(t)
    }, [gameSearchQuery])

    useEffect(() => {
        if (animeSearchQuery.length < 3) { setAnimeSearchResults([]); return }
        const t = setTimeout(async () => {
            setIsSearchingAnime(true)
            const { searchAnime } = await import('../lib/animeService')
            const results = await searchAnime(animeSearchQuery)
            setAnimeSearchResults(results)
            setIsSearchingAnime(false)
        }, 500)
        return () => clearTimeout(t)
    }, [animeSearchQuery])

    useEffect(() => {
        const query = songSearchQuery.trim()
        if (query.length < 2) {
            setSongSearchResults([])
            return
        }

        const t = setTimeout(() => {
            setIsSearchingSong(true)
            
            const scriptId = 'deezer-jsonp'
            const existing = document.getElementById(scriptId)
            if (existing) existing.remove()

            window.deezerCallback = (data) => {
                if (data && data.data) {
                    const parsed = data.data.map(track => ({
                        trackId: track.id,
                        name: track.title,
                        artist: track.artist.name,
                        cover: track.album.cover_medium,
                        previewUrl: track.preview
                    })).filter(track => track.previewUrl)
                    setSongSearchResults(parsed)
                }
                setIsSearchingSong(false)
                document.getElementById(scriptId)?.remove()
                delete window.deezerCallback
            }

            const script = document.createElement('script')
            script.id = scriptId
            script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5&output=jsonp&callback=deezerCallback`
            document.body.appendChild(script)
            
        }, 500)

        return () => clearTimeout(t)
    }, [songSearchQuery])

    /* ── Handlers ── */
    const handleChange = (field, value) =>
        setFormData(prev => ({ ...prev, [field]: field === 'bio' ? value.slice(0, 100) : value }))

    const handleUsernameChange = async (value) => {
        const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
        handleChange('username', clean)
        if (clean.length < 3) { setUsernameError('Mínimo 3 caracteres'); return }
        if (clean === profile?.username) { setUsernameError(''); return }
        const { data } = await supabase.from('profiles').select('username').eq('username', clean).maybeSingle()
        setUsernameError(data ? 'Este username ya está en uso' : '')
    }

    const handleSocialChange = (id, value) =>
        setFormData(prev => ({ ...prev, social_links: { ...prev.social_links, [id]: value } }))

    const removeSocial = (id) => {
        setFormData(prev => {
            const links = { ...prev.social_links }
            delete links[id]
            return { ...prev, social_links: links }
        })
    }

    const addSocial = (id) => { handleSocialChange(id, ''); setIsAddingSocial(false) }

    const handleFileChange = (e, type) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        const maxSize = type === 'banner' ? 5 * 1024 * 1024 : 2 * 1024 * 1024
        if (file.size > maxSize) { setError(`La imagen no puede superar ${type === 'banner' ? '5MB' : '2MB'}`); return }
        
        const previewUrl = URL.createObjectURL(file)
        setCropModal({
            isOpen: true,
            type,
            src: previewUrl,
            aspect: type === 'avatar' ? 1 : 16/5
        })
        
        e.target.value = '' // Reset input
    }

    const handleCropComplete = (croppedBlob, croppedUrl) => {
        if (cropModal.type === 'avatar') {
            setAvatarFile(croppedBlob)
            setAvatarPreview(croppedUrl)
        } else {
            setBannerFile(croppedBlob)
            setBannerPreview(croppedUrl)
        }
        setCropModal({ isOpen: false, type: null, src: null, aspect: 1 })
    }

    const uploadImage = async (file, bucket, path, { upsert = true } = {}) => {
        if (!file || !user) return null
        const { error: err } = await supabase.storage.from(bucket).upload(path, file, { upsert })
        if (err) {
            console.error('Storage upload failed:', { bucket, path, upsert, error: err })
            throw err
        }
        return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    }

    const selectGame = (game) => {
        const newGames = [...formData.favorite_games]
        const gameObj = { id: game.id, name: game.name, cover_url: game.cover_url || game.image_url }
        if (activeGameSlot !== null && activeGameSlot < newGames.length) {
            newGames[activeGameSlot] = gameObj
        } else {
            if (newGames.length < 4) newGames.push(gameObj)
        }
        handleChange('favorite_games', newGames)
        setGameSearchQuery(''); setGameSearchResults([]); setActiveGameSlot(null)
    }

    const removeGame = (index) => {
        const newGames = [...formData.favorite_games]
        newGames.splice(index, 1)
        handleChange('favorite_games', newGames)
        setActiveGameSlot(null)
    }

    const handleDragEndGames = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = formData.favorite_games.findIndex(i => i.id === active.id);
            const newIndex = formData.favorite_games.findIndex(i => i.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                handleChange('favorite_games', arrayMove(formData.favorite_games, oldIndex, newIndex));
            }
        }
    }

    const selectAnime = (anime) => {
        const newAnimes = [...formData.favorite_animes]
        const animeObj = { id: anime.id, title: anime.title, cover_url: anime.cover_url || anime.image_url }
        if (activeAnimeSlot !== null && activeAnimeSlot < newAnimes.length) {
            newAnimes[activeAnimeSlot] = animeObj
        } else {
            if (newAnimes.length < 4) newAnimes.push(animeObj)
        }
        handleChange('favorite_animes', newAnimes)
        setAnimeSearchQuery(''); setAnimeSearchResults([]); setActiveAnimeSlot(null)
    }

    const removeAnime = (index) => {
        const newAnimes = [...formData.favorite_animes]
        newAnimes.splice(index, 1)
        handleChange('favorite_animes', newAnimes)
        setActiveAnimeSlot(null)
    }

    const handleDragEndAnimes = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = formData.favorite_animes.findIndex(i => i.id === active.id);
            const newIndex = formData.favorite_animes.findIndex(i => i.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                handleChange('favorite_animes', arrayMove(formData.favorite_animes, oldIndex, newIndex));
            }
        }
    }

    const handleUnblock = async (blockedId) => {
        if (!window.confirm('¿Desbloquear a este usuario?')) return
        try {
            await unblockUser(user.id, blockedId)
            setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId))
        } catch { alert('Error al desbloquear usuario') }
    }

    const insertMarkdown = (prefix, suffix) => {
        const ta = textareaRef.current
        if (!ta) return
        const { selectionStart: s, selectionEnd: e } = ta
        const text = formData.bio
        const newText = text.substring(0, s) + prefix + text.substring(s, e) + suffix + text.substring(e)
        handleChange('bio', newText)
        setTimeout(() => { ta.focus(); ta.setSelectionRange(s + prefix.length, e + prefix.length) }, 0)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (usernameError) { setError(usernameError); return }
        if (standalone && !/^#[\da-f]{6}$/i.test(formData.theme_color)) { setError('Introduce un color hexadecimal válido'); return }
        if (formData.username.length < 3) { setError('El username debe tener al menos 3 caracteres'); return }
        if (formData.username.length > 20) { setError('El username no puede superar los 20 caracteres'); return }
        setSaving(true); setError('')
        try {
            let avatarUrl = profile?.avatar_url
            let bannerUrl = profile?.banner_url
            const previousAvatarPath = avatarFile ? getOwnedAvatarStoragePath(profile?.avatar_url, user?.id) : null
            const previousBannerPath = bannerFile ? getOwnedBannerStoragePath(profile?.banner_url, user?.id) : null
            if (avatarFile) {
                const ext = (avatarFile.name && avatarFile.name.includes('.')) ? avatarFile.name.split('.').pop() : 'jpg'
                const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
                let url = await uploadImage(avatarFile, 'avatars', `avatars/${user.id}.${uniqueSuffix}.${ext}`, { upsert: false })
                avatarUrl = `${url}?t=${Date.now()}`
            }
            if (bannerFile) {
                const ext = (bannerFile.name && bannerFile.name.includes('.')) ? bannerFile.name.split('.').pop() : 'jpg'
                const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
                let url = await uploadImage(bannerFile, 'avatars', `banners/${user.id}.${uniqueSuffix}.${ext}`, { upsert: false })
                bannerUrl = `${url}?t=${Date.now()}`
            }
            await updateProfile({ ...formData, avatar_url: avatarUrl, banner_url: bannerUrl })
            savedFormDataRef.current = JSON.stringify(formData)
            savedAvatarPreviewRef.current = avatarUrl || null
            savedBannerPreviewRef.current = bannerUrl || null
            setAvatarFile(null)
            setBannerFile(null)
            setAvatarPreview(avatarUrl || null)
            setBannerPreview(bannerUrl || null)
            if (previousAvatarPath) {
                const nextAvatarPath = getOwnedAvatarStoragePath(avatarUrl, user?.id)
                if (nextAvatarPath !== previousAvatarPath) {
                    const { data: removedFiles, error: removeError } = await supabase.storage.from('avatars').remove([previousAvatarPath])
                    if (removeError) console.warn('No se pudo borrar el avatar anterior del bucket:', removeError)
                    else if (!removedFiles?.length) console.warn('Supabase no encontró o no permitió borrar el avatar anterior:', previousAvatarPath)
                }
            }
            if (previousBannerPath) {
                const nextBannerPath = getOwnedBannerStoragePath(bannerUrl, user?.id)
                if (nextBannerPath !== previousBannerPath) {
                    const { data: removedFiles, error: removeError } = await supabase.storage.from('avatars').remove([previousBannerPath])
                    if (removeError) console.warn('No se pudo borrar el banner anterior del bucket:', removeError)
                    else if (!removedFiles?.length) console.warn('Supabase no encontró o no permitió borrar el banner anterior:', previousBannerPath)
                }
            }
            if (onClose) onClose()
            else if (!standalone) navigate('/profile')
        } catch (err) {
            console.error(err)
            setError(err.message || 'Error al guardar cambios')
        } finally {
            setSaving(false)
        }
    }

    const handleClose = () => { if (onClose) onClose(); else navigate('/profile') }

    const renderWorkSearchResults = (kind) => {
        const isGame = kind === 'game'
        const results = isGame ? gameSearchResults : animeSearchResults
        const isSearching = isGame ? isSearchingGames : isSearchingAnime
        if (isSearching) return <div className="ep-settings-search-status">Buscando…</div>
        if (!results.length) return null
        return <div className="ep-settings-work-results">
            {results.slice(0, 5).map(item => (
                <button key={item.id} type="button" className="ep-settings-work-result" onClick={() => isGame ? selectGame(item) : selectAnime(item)}>
                    {(item.cover_url || item.image_url) && <img src={item.cover_url || item.image_url} alt="" />}
                    <span>{isGame ? item.name : item.title}</span>
                    <span className="ep-settings-result-add">Añadir</span>
                </button>
            ))}
        </div>
    }

    const settingsMarkup = (
        <div className="ep-portal-root" style={{
            '--brand-primary': formData.theme_color || '#14b8a6',
            '--brand-dark': formData.theme_color || '#14b8a6',
            '--profile-theme-color': formData.theme_color || '#14b8a6',
            '--profile-accent-text': getAccentTextColor(formData.theme_color || '#14b8a6')
        }}>
            <div className="ep-overlay ep-settings-overlay">
                <div className="ep-modal ep-settings-shell">
                    <h1 className="ep-settings-page-title">Ajustes</h1>
                    <aside className="ep-settings-nav">
                        <span className="ep-settings-nav-label">PERFIL</span>
                        <button type="button" className={`ep-settings-nav-item ${activeSection !== 'blocked' ? 'active' : ''}`} onClick={() => setActiveSection('photos')}>Perfil</button>
                        <span className="ep-settings-nav-label ep-settings-nav-secondary">CUENTA</span>
                        <button type="button" className={`ep-settings-nav-item ${activeSection === 'blocked' ? 'active' : ''}`} onClick={() => setActiveSection('blocked')}>Bloqueados y silenciados</button>
                    </aside>

                    <div className="ep-settings-editor">
                        <div className="ep-modal-header">
                            <h1 className="ep-modal-title">{activeSection === 'blocked' ? 'Bloqueados y silenciados' : 'Perfil'}</h1>
                            {activeSection !== 'blocked' && <button type="submit" form="profile-settings-form" className="btn btn-primary ep-settings-save-button" disabled={saving || !!usernameError}>{saving ? 'Guardando…' : 'Guardar'}</button>}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleFileChange(e, 'avatar')} hidden />
                        <input ref={bannerInputRef} type="file" accept="image/*" onChange={e => handleFileChange(e, 'banner')} hidden />

                        {activeSection !== 'blocked' ? <form id="profile-settings-form" onSubmit={handleSubmit} className="ep-settings-form">
                            <section className="ep-settings-card ep-settings-personal-card">
                                <div className="ep-settings-photo-row">
                                    <button type="button" className="ep-settings-photo-button" onClick={() => fileInputRef.current?.click()} aria-label="Cambiar foto de perfil">
                                        {avatarPreview ? <img src={avatarPreview} alt="" /> : <img src="/default-avatar.svg" alt="" />}
                                        <span><IconPlus size={16} /></span>
                                    </button>
                                    <div><strong>Foto</strong><p>Cuadrada, haz clic para cambiarla.</p><small>JPG, PNG o GIF · Máx. 2 MB</small></div>
                                </div>
                                <div className="ep-settings-row">
                                    <label htmlFor="settings-display-name">Nombre a mostrar <small>{formData.display_name.length}/30</small></label>
                                    <input id="settings-display-name" className="ep-settings-control" value={formData.display_name} onChange={e => handleChange('display_name', e.target.value)} maxLength={30} placeholder="¿Cómo te llamamos?" />
                                </div>
                                <div className="ep-settings-row">
                                    <label htmlFor="settings-username">Usuario</label>
                                    <div className={`ep-settings-handle ${usernameError ? 'has-error' : ''}`}>
                                        <span>@</span>
                                        <input id="settings-username" value={formData.username} onChange={e => handleUsernameChange(e.target.value)} maxLength={20} autoComplete="username" />
                                    </div>
                                    {usernameError ? <small className="ep-settings-error">{usernameError}</small> : <small className="ep-settings-help">De 3 a 20 caracteres. Letras, números y guiones bajos.</small>}
                                </div>
                                <div className="ep-settings-row">
                                    <label htmlFor="settings-pronouns">Pronombres</label>
                                    <input id="settings-pronouns" className="ep-settings-control" value={formData.pronouns} onChange={e => handleChange('pronouns', e.target.value)} placeholder="Ej. él, ella, elle" maxLength={20} />
                                </div>
                                <div className="ep-settings-row">
                                    <label htmlFor="settings-location">Ubicación</label>
                                    <input id="settings-location" className="ep-settings-control" value={formData.location} onChange={e => handleChange('location', e.target.value)} placeholder="Ciudad, país" maxLength={50} />
                                </div>
                                <div className="ep-settings-row">
                                    <label htmlFor="settings-bio">Bio <small>{formData.bio.length}/100</small></label>
                                    <textarea id="settings-bio" className="ep-settings-control ep-settings-bio" value={formData.bio} onChange={e => handleChange('bio', e.target.value)} maxLength={100} placeholder="Cuéntale a la gente sobre ti" />
                                </div>
                            </section>

                            <h2 className="ep-settings-card-kicker">ESTILO</h2>
                            <section className="ep-settings-card ep-settings-style-card">
                                <div className="ep-settings-row">
                                    <label>Banner <small>Opcional</small></label>
                                    <button type="button" className="ep-settings-banner" onClick={() => bannerInputRef.current?.click()}>
                                        {bannerPreview ? <img src={bannerPreview} alt="Banner del perfil" /> : <span>Añadir un banner para tu perfil</span>}
                                        <span className="ep-settings-banner-action">{bannerPreview ? 'Cambiar' : 'Subir imagen'}</span>
                                    </button>
                                </div>
                                <div className="ep-settings-row ep-settings-accent-row">
                                    <details className="ep-settings-accent-picker">
                                        <summary>
                                            <strong>Acento</strong>
                                            <span className="ep-settings-accent-value"><i style={{ background: formData.theme_color }} />{formData.theme_color.toUpperCase()}<b aria-hidden="true">⌃</b></span>
                                        </summary>
                                        <div className="ep-settings-accent-content">
                                            <div className="ep-settings-accent-swatches">
                                                {THEME_COLORS.map(color => <button type="button" key={color} className={formData.theme_color.toLowerCase() === color ? 'selected' : ''} style={{ background: color }} onClick={() => handleChange('theme_color', color)} aria-label={`Usar color ${color}`} title={color} />)}
                                                <label className={`ep-settings-custom-swatch ${!THEME_COLORS.includes(formData.theme_color.toLowerCase()) ? 'selected' : ''}`} title="Elegir otro color">
                                                    <input type="color" value={/^#[\da-f]{6}$/i.test(formData.theme_color) ? formData.theme_color : '#14b8a6'} onChange={e => handleChange('theme_color', e.target.value)} aria-label="Elegir otro color" />
                                                    <span aria-hidden="true" />
                                                </label>
                                            </div>
                                        </div>
                                    </details>
                                </div>

                                <div className="ep-settings-row">
                                    <label htmlFor="settings-game-search">Juegos favoritos <small>{formData.favorite_games.length}/4</small></label>
                                    <div className="ep-settings-selected-works">
                                        {formData.favorite_games.map((game, index) => <div className="ep-settings-selected-work" key={game.id}>
                                            {game.cover_url && <img src={game.cover_url} alt="" />}
                                            <span>{game.name}</span>
                                            <button type="button" onClick={() => removeGame(index)} aria-label={`Quitar ${game.name}`}>×</button>
                                        </div>)}
                                    </div>
                                    {formData.favorite_games.length < 4 && <div className="ep-settings-search-wrap">
                                        <input id="settings-game-search" className="ep-settings-control" value={gameSearchQuery} onChange={e => setGameSearchQuery(e.target.value)} placeholder="Buscar juegos…" />
                                        {renderWorkSearchResults('game')}
                                    </div>}
                                </div>
                                <div className="ep-settings-row">
                                    <label htmlFor="settings-anime-search">Animes favoritos <small>{formData.favorite_animes.length}/4</small></label>
                                    <div className="ep-settings-selected-works">
                                        {formData.favorite_animes.map((anime, index) => <div className="ep-settings-selected-work" key={anime.id}>
                                            {anime.cover_url && <img src={anime.cover_url} alt="" />}
                                            <span>{anime.title}</span>
                                            <button type="button" onClick={() => removeAnime(index)} aria-label={`Quitar ${anime.title}`}>×</button>
                                        </div>)}
                                    </div>
                                    {formData.favorite_animes.length < 4 && <div className="ep-settings-search-wrap">
                                        <input id="settings-anime-search" className="ep-settings-control" value={animeSearchQuery} onChange={e => setAnimeSearchQuery(e.target.value)} placeholder="Buscar anime…" />
                                        {renderWorkSearchResults('anime')}
                                    </div>}
                                </div>

                                <div className="ep-settings-row">
                                    <label>Canción del perfil</label>
                                    {formData.profile_song && typeof formData.profile_song === 'object' ? <div className="ep-settings-song-selected">
                                        <img src={formData.profile_song.cover} alt="" />
                                        <span><strong>{formData.profile_song.name}</strong><small>{formData.profile_song.artist}</small></span>
                                        <button type="button" onClick={() => handleChange('profile_song', null)} aria-label="Quitar canción">×</button>
                                    </div> : <div className="ep-settings-search-wrap">
                                        <input className="ep-settings-control" value={songSearchQuery} onChange={e => setSongSearchQuery(e.target.value)} placeholder="Buscar canción o artista…" />
                                        {isSearchingSong && <div className="ep-settings-search-status">Buscando…</div>}
                                        {songSearchResults.length > 0 && <div className="ep-settings-work-results">{songSearchResults.map(track => <button type="button" className="ep-settings-work-result" key={track.trackId} onClick={() => { handleChange('profile_song', track); setSongSearchQuery(''); setSongSearchResults([]) }}><img src={track.cover} alt="" /><span>{track.name}<small>{track.artist}</small></span><span className="ep-settings-result-add">Añadir</span></button>)}</div>}
                                    </div>}
                                </div>

                                {profile?.badges?.length > 0 && <div className="ep-settings-row">
                                    <label>Insignia destacada</label>
                                    <div className="ep-settings-badges">
                                        <button type="button" className={!formData.featured_badge ? 'selected' : ''} onClick={() => handleChange('featured_badge', null)}>Ninguna</button>
                                        {profile.badges.map(badge => BADGES_MAP[badge] && <button type="button" key={badge} className={formData.featured_badge === badge ? 'selected' : ''} onClick={() => handleChange('featured_badge', badge)}>{BADGES_MAP[badge].icon}{BADGES_MAP[badge].title}</button>)}
                                    </div>
                                </div>}
                            </section>

                            <h2 className="ep-settings-card-kicker">ENLACES</h2>
                            <section className="ep-settings-card ep-settings-links-card">
                                {SOCIAL_PLATFORMS.map(platform => {
                                    const value = formData.social_links[platform.id] || ''
                                    const href = getEditSocialHref(platform.id, value)
                                    return <div className="ep-settings-social-row" key={platform.id}>
                                        <div className="ep-settings-social-heading">
                                            <span className={`ep-settings-social-icon ${platform.id}`}>{platform.icon}</span>
                                            <strong>{platform.label}</strong>
                                            {platform.id === 'discord' ? value && <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopiedSocial(platform.id); window.setTimeout(() => setCopiedSocial(''), 1600) } catch {} }}>{copiedSocial === platform.id ? 'copiado' : 'copiar'}</button> : href && <a href={href} target="_blank" rel="noopener noreferrer">abrir ↗</a>}
                                        </div>
                                        <input className="ep-settings-control" value={value} onChange={e => handleSocialChange(platform.id, e.target.value)} placeholder={platform.placeholder} aria-label={platform.label} />
                                        {platform.id === 'discord' && <small>El usuario se copia; los demás enlaces abren tu perfil.</small>}
                                    </div>
                                })}
                            </section>
                            {error && <div className="ep-alert ep-alert--error">{error}</div>}
                        </form> : <div className="ep-settings-card ep-settings-blocked-card">
                            {loadingBlocked ? <p>Cargando usuarios bloqueados…</p> : blockedUsers.length === 0 ? <p>No tienes usuarios bloqueados.</p> : blockedUsers.map(block => <div key={block.blocked_id} className="ep-blocked-item">
                                <div className="ep-blocked-user">{block.blocked?.avatar_url ? <img src={block.blocked.avatar_url} alt="" className="ep-blocked-avatar" /> : <div className="ep-blocked-avatar">{block.blocked?.display_name?.charAt(0) || '?'}</div>}<div className="ep-blocked-names"><span className="ep-blocked-display-name">{block.blocked?.display_name || 'Usuario'}</span><span className="ep-blocked-username">@{block.blocked?.username}</span></div></div>
                                <button type="button" className="ep-unblock-btn" onClick={() => handleUnblock(block.blocked_id)}>Desbloquear</button>
                            </div>)}
                        </div>}
                    </div>

                    <aside className="ep-settings-preview-column">
                        <div className="ep-settings-preview-heading">
                            <span className="ep-settings-nav-label">PERFIL</span>
                        </div>
                        <article className="ep-settings-profile-preview" style={{ '--preview-accent': formData.theme_color || '#14b8a6' }}>
                            <div className="ep-settings-preview-banner">{bannerPreview && <img src={bannerPreview} alt="" />}</div>
                            <div className="ep-settings-preview-content">
                                <div className="ep-settings-preview-avatar">{avatarPreview ? <img src={avatarPreview} alt="" /> : <img src="/default-avatar.svg" alt="" />}</div>
                                <div className="ep-settings-preview-name-row"><strong>{formData.display_name || 'Tu nombre'}</strong>{formData.pronouns && <span className="ep-settings-preview-pronouns">{formData.pronouns}</span>}</div>
                                <div className="ep-settings-preview-identity-row"><span className="ep-settings-preview-username">@{formData.username || 'usuario'}</span>{formData.featured_badge && BADGES_MAP[formData.featured_badge] && <span className="ep-settings-preview-badge" style={{ '--badge-accent': BADGES_MAP[formData.featured_badge].color }} aria-label={BADGES_MAP[formData.featured_badge].title} title={BADGES_MAP[formData.featured_badge].title}>{BADGES_MAP[formData.featured_badge].icon}</span>}</div>
                                <p>{formData.bio || 'Tu biografía aparecerá aquí.'}</p>
                                {formData.profile_song && typeof formData.profile_song === 'object' && <div className="ep-settings-preview-song"><img src={formData.profile_song.cover} alt="" /><span><strong>{formData.profile_song.name}</strong><small>{formData.profile_song.artist}</small></span></div>}
                            </div>
                        </article>
                        <p className={`ep-settings-preview-hint${hasUnsavedChanges ? ' ep-settings-preview-hint--dirty' : ''}`}>{hasUnsavedChanges ? 'Tienes cambios sin guardar.' : 'No te olvides de guardar los cambios.'}</p>
                    </aside>
                </div>
            </div>
            {cropModal.isOpen && <ImageCropperModal imageSrc={cropModal.src} aspect={cropModal.aspect} onCropComplete={handleCropComplete} onCancel={() => setCropModal({ isOpen: false, type: null, src: null, aspect: 1 })} />}
        </div>
    )

    /* ──────────────────────────────────────
       Render
       ────────────────────────────────────── */
    const editorMarkup = (
        <div className="ep-portal-root" style={{
            '--brand-primary': formData.theme_color || '#14b8a6',
            '--brand-dark': formData.theme_color || '#14b8a6',
            '--profile-theme-color': formData.theme_color || '#14b8a6',
            '--profile-accent-text': getAccentTextColor(formData.theme_color || '#14b8a6')
        }}>
            <div className={`ep-overlay ${standalone ? 'ep-settings-overlay' : ''}`} onClick={e => { if (!standalone && e.target === e.currentTarget) handleClose() }}>
                <div className={`ep-modal ${standalone ? 'ep-settings-shell' : ''}`} onClick={e => e.stopPropagation()}>

                {standalone && <h1 className="ep-settings-page-title">Ajustes</h1>}
                {standalone && <aside className="ep-settings-nav">
                    <span className="ep-settings-nav-label">PERFIL</span>
                    <button type="button" className={`ep-settings-nav-item ${activeSection !== 'blocked' ? 'active' : ''}`} onClick={() => setActiveSection('photos')}>
                        <span>Perfil</span>
                    </button>
                    <span className="ep-settings-nav-label ep-settings-nav-secondary">CUENTA</span>
                    <button type="button" className={`ep-settings-nav-item ${activeSection === 'blocked' ? 'active' : ''}`} onClick={() => setActiveSection('blocked')}>
                        <span>Bloqueados y silenciados</span>
                    </button>
                </aside>}

                <div className={standalone ? 'ep-settings-editor' : 'ep-modal-inner'}>

                {/* Header */}
                <div className="ep-modal-header">
                    <h1 className="ep-modal-title">{standalone ? (activeSection === 'blocked' ? 'Bloqueados y silenciados' : 'Perfil') : 'Editar Perfil'}</h1>
                    {standalone ? <button type="submit" form="profile-settings-form" className="btn btn-primary" disabled={saving || !!usernameError}>{saving ? 'Guardando…' : 'Guardar'}</button> :
                        <button className="ep-close-btn" onClick={handleClose} type="button"><IconClose /></button>}
                </div>

                {/* Section tabs */}
                <div className="ep-section-tabs">
                    {SECTION_TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`ep-section-tab ${activeSection === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(tab.id)}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Hidden file inputs */}
                <input ref={fileInputRef}   type="file" accept="image/*" onChange={e => handleFileChange(e, 'avatar')} style={{ display: 'none' }} />
                <input ref={bannerInputRef} type="file" accept="image/*" onChange={e => handleFileChange(e, 'banner')} style={{ display: 'none' }} />

                <form id={standalone ? 'profile-settings-form' : undefined} onSubmit={handleSubmit} style={{ display: 'contents' }}>
                    {/* Scrollable body */}
                    <div className="ep-modal-body ep-animate-in" key={activeSection}>
                        {error && <div className="ep-alert ep-alert--error">{error}</div>}

                        {/* ── FOTOS ── */}
                        {(activeSection === 'photos' || standalone && activeSection !== 'blocked') && (
                            <>
                                {/* Avatar */}
                                <div className="ep-field">
                                    <label className="ep-label">Foto</label>
                                    <div className="ep-avatar-row">
                                        <button type="button" className="ep-avatar-upload" onClick={() => fileInputRef.current?.click()}>
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="Avatar" className="ep-avatar-img" />
                                            ) : (
                                                <div className="ep-avatar-placeholder">
                                                    {formData.display_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                            )}
                                            <div className="ep-avatar-overlay">
                                                <IconPlus size={16} />
                                            </div>
                                        </button>
                                        <div className="ep-avatar-hints">
                                            <p>Haz clic en la imagen para cambiarla</p>
                                            <span>Formato JPG, PNG o GIF · Máx. 2MB</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Banner */}
                                <div className="ep-field">
                                    <label className="ep-label">Banner <span className="ep-optional">opcional</span></label>
                                    <button type="button" className="ep-banner-btn" onClick={() => bannerInputRef.current?.click()}>
                                        {bannerPreview ? (
                                            <img src={bannerPreview} alt="Banner" className="ep-banner-preview" />
                                        ) : (
                                            <div className="ep-banner-empty">
                                                <IconImage />
                                                <span>Añadir imagen de banner</span>
                                                <small>Recomendado: 1500 × 500px · Máx. 5MB</small>
                                            </div>
                                        )}
                                        <div className="ep-banner-hover-overlay">
                                            <IconCamera /> {bannerPreview ? 'Cambiar banner' : 'Subir banner'}
                                        </div>
                                    </button>
                                </div>

                                {/* Theme Color */}
                                <div className="ep-field">
                                    <label className="ep-label">Color del Tema</label>
                                    <div className="ep-color-grid">
                                        {THEME_COLORS.map(color => (
                                            <button
                                                type="button"
                                                key={color}
                                                className={`ep-color-btn ${formData.theme_color === color ? 'selected' : ''}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => handleChange('theme_color', color)}
                                                title={color}
                                            />
                                        ))}
                                        <div className="ep-custom-color">
                                            <input 
                                                type="color" 
                                                value={THEME_COLORS.includes(formData.theme_color) ? '#ffffff' : formData.theme_color} 
                                                onChange={e => handleChange('theme_color', e.target.value)}
                                            />
                                            <div className={`ep-color-btn ${!THEME_COLORS.includes(formData.theme_color) ? 'selected' : ''}`}
                                                 style={{ 
                                                    backgroundColor: !THEME_COLORS.includes(formData.theme_color) ? formData.theme_color : 'transparent',
                                                    border: `2px dashed ${!THEME_COLORS.includes(formData.theme_color) ? 'transparent' : 'var(--border-subtle)'}`
                                                 }}>
                                                {!THEME_COLORS.includes(formData.theme_color) ? '' : '+'}
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Elige el color principal que destacará en tu perfil.
                                    </p>
                                </div>

                            </>
                        )}

                        {/* ── INFO ── */}
                        {showProfileSections && standalone && <div className="ep-settings-section-divider" aria-hidden="true" />}
                        {(activeSection === 'info' || standalone && activeSection !== 'blocked') && (
                            <>

                                <div className="ep-two-col">
                                    <div className="ep-field">
                                        <label className="ep-label">Username</label>
                                        <div className="ep-input-prefix-wrap">
                                            <span className="ep-input-prefix">@</span>
                                            <input
                                                type="text"
                                                className={`ep-input ${usernameError ? 'ep-input--error' : ''}`}
                                                value={formData.username}
                                                onChange={e => handleUsernameChange(e.target.value)}
                                                maxLength={20}
                                            />
                                        </div>
                                        {usernameError && <span className="ep-error-text">{usernameError}</span>}
                                        <span className="ep-hint">Entre 3 y 20 caracteres.</span>
                                    </div>
                                    <div className="ep-field">
                                        <label className="ep-label">Nombre para mostrar</label>
                                        <input
                                            type="text"
                                            className="ep-input"
                                            value={formData.display_name}
                                            onChange={e => handleChange('display_name', e.target.value)}
                                            maxLength={30}
                                        />
                                    </div>
                                </div>

                                <div className="ep-two-col">
                                    <div className="ep-field">
                                        <label className="ep-label">
                                            Pronombres <span className="ep-optional">opcional</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="ep-input"
                                            value={formData.pronouns}
                                            onChange={e => handleChange('pronouns', e.target.value)}
                                            placeholder="Ej: él, ella..."
                                            maxLength={20}
                                        />
                                    </div>
                                    <div className="ep-field">
                                        <label className="ep-label">
                                            Ubicación <span className="ep-optional">opcional</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="ep-input"
                                            value={formData.location}
                                            onChange={e => handleChange('location', e.target.value)}
                                            placeholder="Ej: Madrid, España"
                                            maxLength={50}
                                        />
                                    </div>
                                </div>

                                {/* Bio */}
                                <div className="ep-field">
                                    <div className="ep-bio-header">
                                        <label className="ep-label" style={{ margin: 0 }}>Biografía <span className="ep-optional">Markdown soportado</span></label>
                                    </div>
                                    <div className="ep-md-toolbar">
                                        <button type="button" className="ep-md-btn" title="Negrita" onClick={() => insertMarkdown('**', '**')}><IconBold /></button>
                                        <button type="button" className="ep-md-btn" title="Cursiva" onClick={() => insertMarkdown('*', '*')}><IconItalic /></button>
                                        <button type="button" className="ep-md-btn" title="Enlace" onClick={() => insertMarkdown('[', '](url)')}><IconLinkSmall /></button>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        className="ep-input ep-textarea"
                                        value={formData.bio}
                                        onChange={e => handleChange('bio', e.target.value)}
                                        placeholder="Cuéntanos sobre ti..."
                                        maxLength={100}
                                        rows={6}
                                    />
                                    <span className="ep-char-count">{formData.bio.length}/100</span>
                                </div>

                                <div className="ep-field">
                                    <label className="ep-label">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <IconMusic /> Canción del perfil
                                        </span>
                                    </label>
                                    
                                    {formData.profile_song && typeof formData.profile_song === 'object' ? (
                                        <div className="ep-favorite-selected">
                                            <img src={formData.profile_song.cover} alt="" className="square-cover" style={{ borderRadius: '4px' }} />
                                            <div className="ep-favorite-name" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                <span>{formData.profile_song.name}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formData.profile_song.artist}</span>
                                            </div>
                                            <button type="button" className="ep-remove-btn" onClick={() => handleChange('profile_song', null)}>
                                                <IconClose />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                className="ep-input"
                                                placeholder="Buscar canción o artista..."
                                                value={songSearchQuery}
                                                onChange={e => setSongSearchQuery(e.target.value)}
                                            />
                                            {isSearchingSong && <div className="ep-search-loading">Buscando...</div>}
                                            
                                            {songSearchResults.length > 0 && (
                                                <div className="ep-search-results">
                                                    {songSearchResults.map(track => (
                                                        <button
                                                            key={track.trackId}
                                                            type="button"
                                                            className="ep-search-result"
                                                            onClick={() => {
                                                                handleChange('profile_song', track)
                                                                setSongSearchQuery('')
                                                                setSongSearchResults([])
                                                            }}
                                                        >
                                                            <img src={track.cover} alt="" className="square-cover" style={{ borderRadius: '4px' }} />
                                                            <div className="ep-search-result-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                                                                <span>{track.name}</span>
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{track.artist}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Featured Badge */}
                                {profile?.badges && profile.badges.length > 0 && (
                                    <div className="ep-field" style={{ marginTop: '24px' }}>
                                        <label className="ep-label">Insignia Destacada</label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('featured_badge', null)}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '20px',
                                                    border: `1px solid ${!formData.featured_badge ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                                                    background: !formData.featured_badge ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
                                                    color: !formData.featured_badge ? 'var(--brand-primary)' : 'var(--text-primary)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Ninguna
                                            </button>
                                            {profile.badges.map(b => BADGES_MAP[b] && (
                                                <button
                                                    key={b}
                                                    type="button"
                                                    onClick={() => handleChange('featured_badge', b)}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        border: `1px solid ${formData.featured_badge === b ? BADGES_MAP[b].color : 'var(--border-subtle)'}`,
                                                        background: formData.featured_badge === b ? `${BADGES_MAP[b].color}20` : 'transparent',
                                                        color: formData.featured_badge === b ? BADGES_MAP[b].color : 'var(--text-primary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    {BADGES_MAP[b].icon} {BADGES_MAP[b].title}
                                                </button>
                                            ))}
                                        </div>
                                        <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Elige qué insignia quieres que aparezca junto a tu nombre en listas y comentarios.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── FAVORITOS ── */}
                        {showProfileSections && standalone && <div className="ep-settings-section-divider" aria-hidden="true" />}
                        {(activeSection === 'favorites' || standalone && activeSection !== 'blocked') && (
                            <>
                                {/* Favorite Games */}
                                <div className="ep-field">
                                    <label className="ep-label">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <IconGamepad /> Juegos favoritos (Top 4)
                                        </span>
                                    </label>
                                    
                                    <div className="ep-favorites-grid">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndGames}>
                                            <SortableContext items={formData.favorite_games.map(g => g.id)} strategy={rectSortingStrategy}>
                                                {formData.favorite_games.map((g, idx) => (
                                                    <SortableFavoriteItem 
                                                        key={g.id} 
                                                        item={g} 
                                                        onRemove={() => removeGame(idx)} 
                                                        onClick={() => setActiveGameSlot(idx)}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                        {Array.from({ length: 4 - formData.favorite_games.length }).map((_, idx) => {
                                            const actualSlot = formData.favorite_games.length + idx;
                                            return (
                                                <button 
                                                    key={`empty-${idx}`} 
                                                    type="button" 
                                                    className={`ep-empty-slot ${activeGameSlot === actualSlot ? 'active' : ''}`}
                                                    onClick={() => setActiveGameSlot(actualSlot)}
                                                >
                                                    <IconPlus size={24} />
                                                </button>
                                            );
                                        })}
                                    </div>


                                </div>

                                {/* Favorite Anime */}
                                <div className="ep-field" style={{ marginTop: '32px' }}>
                                    <label className="ep-label">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <IconTV /> Animes favoritos (Top 4)
                                        </span>
                                    </label>
                                    
                                    <div className="ep-favorites-grid">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndAnimes}>
                                            <SortableContext items={formData.favorite_animes.map(a => a.id)} strategy={rectSortingStrategy}>
                                                {formData.favorite_animes.map((a, idx) => (
                                                    <SortableFavoriteItem 
                                                        key={a.id} 
                                                        item={{...a, name: a.title}} 
                                                        onRemove={() => removeAnime(idx)} 
                                                        onClick={() => setActiveAnimeSlot(idx)}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                        {Array.from({ length: 4 - formData.favorite_animes.length }).map((_, idx) => {
                                            const actualSlot = formData.favorite_animes.length + idx;
                                            return (
                                                <button 
                                                    key={`empty-${idx}`} 
                                                    type="button" 
                                                    className={`ep-empty-slot ${activeAnimeSlot === actualSlot ? 'active' : ''}`}
                                                    onClick={() => setActiveAnimeSlot(actualSlot)}
                                                >
                                                    <IconPlus size={24} />
                                                </button>
                                            );
                                        })}
                                    </div>


                                </div>
                            </>
                        )}

                        {/* ── REDES SOCIALES ── */}
                        {showProfileSections && standalone && <div className="ep-settings-section-divider" aria-hidden="true" />}
                        {(activeSection === 'social' || standalone && activeSection !== 'blocked') && (
                            <>
                                <div className="ep-social-list">
                                    {Object.entries(formData.social_links).map(([platformId, value]) => {
                                        const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId)
                                        if (!platform) return null
                                        return (
                                            <div key={platformId} className="ep-social-item">
                                                <div className="ep-social-icon">{platform.icon}</div>
                                                <div className="ep-social-info">
                                                    <span className="ep-social-platform-name">{platform.label}</span>
                                                    <input
                                                        type="text"
                                                        className="ep-social-input"
                                                        value={value}
                                                        onChange={e => handleSocialChange(platformId, e.target.value)}
                                                        placeholder={platform.placeholder}
                                                        autoFocus
                                                    />
                                                </div>
                                                <button type="button" className="ep-remove-btn" onClick={() => removeSocial(platformId)}>
                                                    <IconClose />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>

                                {availablePlatforms.length > 0 && (
                                    <>
                                        {isAddingSocial ? (
                                            <div className="ep-platform-picker">
                                                <p className="ep-platform-picker-title">Añadir red social</p>
                                                <div className="ep-platform-grid">
                                                    {availablePlatforms.map(p => (
                                                        <button key={p.id} type="button" className="ep-platform-opt" onClick={() => addSocial(p.id)}>
                                                            {p.icon} {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button type="button" className="ep-cancel-picker" onClick={() => setIsAddingSocial(false)}>
                                                    Cancelar
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" className="ep-add-social-btn" onClick={() => setIsAddingSocial(true)}>
                                                <IconPlus /> Añadir red social
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* ── BLOQUEADOS ── */}
                        {activeSection === 'blocked' && (
                            <>
                                {loadingBlocked ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando...</p>
                                ) : blockedUsers.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No tienes usuarios bloqueados.</p>
                                ) : (
                                    <div className="ep-blocked-list">
                                        {blockedUsers.map(block => (
                                            <div key={block.blocked_id} className="ep-blocked-item">
                                                <div className="ep-blocked-user">
                                                    {block.blocked?.avatar_url ? (
                                                        <img src={block.blocked.avatar_url} alt="" className="ep-blocked-avatar" />
                                                    ) : (
                                                        <div className="ep-blocked-avatar">
                                                            {block.blocked?.display_name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <div className="ep-blocked-names">
                                                        <span className="ep-blocked-display-name">{block.blocked?.display_name || 'Usuario'}</span>
                                                        <span className="ep-blocked-username">@{block.blocked?.username}</span>
                                                    </div>
                                                </div>
                                                <button type="button" className="ep-unblock-btn" onClick={() => handleUnblock(block.blocked_id)}>
                                                    Desbloquear
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer actions */}
                    {!standalone && <div className="ep-modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !!usernameError}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
                    </div>}
                </form>
                </div>

                {standalone && <aside className="ep-settings-preview-column">
                    <span className="ep-settings-nav-label">PERFIL</span>
                    <article className="ep-settings-profile-preview" style={{ '--preview-accent': formData.theme_color || '#14b8a6' }}>
                        <div className="ep-settings-preview-banner">{bannerPreview && <img src={bannerPreview} alt="" />}</div>
                        <div className="ep-settings-preview-content">
                            <div className="ep-settings-preview-avatar">{avatarPreview ? <img src={avatarPreview} alt="" /> : <img src="/default-avatar.svg" alt="" />}</div>
                            <div className="ep-settings-preview-name-row"><strong>{formData.display_name || 'Tu nombre'}</strong>{formData.pronouns && <span className="ep-settings-preview-pronouns">{formData.pronouns}</span>}</div>
                            <div className="ep-settings-preview-identity-row"><span className="ep-settings-preview-username">@{formData.username || 'usuario'}</span>{formData.featured_badge && BADGES_MAP[formData.featured_badge] && <span className="ep-settings-preview-badge" style={{ '--badge-accent': BADGES_MAP[formData.featured_badge].color }} aria-label={BADGES_MAP[formData.featured_badge].title} title={BADGES_MAP[formData.featured_badge].title}>{BADGES_MAP[formData.featured_badge].icon}</span>}</div>
                            <p>{formData.bio || 'Tu biografía aparecerá aquí.'}</p>
                            {formData.profile_song && typeof formData.profile_song === 'object' && <div className="ep-settings-preview-song"><img src={formData.profile_song.cover} alt="" /><span><strong>{formData.profile_song.name}</strong><small>{formData.profile_song.artist}</small></span></div>}
                        </div>
                    </article>
                    <p className={`ep-settings-preview-hint${hasUnsavedChanges ? ' ep-settings-preview-hint--dirty' : ''}`}>{hasUnsavedChanges ? 'Tienes cambios sin guardar.' : 'No te olvides de guardar los cambios.'}</p>
                </aside>}
        </div>

        {cropModal.isOpen && (
            <ImageCropperModal
                imageSrc={cropModal.src}
                aspect={cropModal.aspect}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropModal({ isOpen: false, type: null, src: null, aspect: 1 })}
            />
        )}

        {/* Top 4 Modals */}
        {activeGameSlot !== null && (
            <div className="ep-overlay" style={{ zIndex: 10001 }} onClick={e => { if (e.target === e.currentTarget) setActiveGameSlot(null) }}>
                <div className="ep-modal" style={{ width: '400px', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                    <div className="ep-modal-header">
                        <h3 className="ep-modal-title">Elige un Juego</h3>
                        <button className="ep-close-btn" onClick={() => setActiveGameSlot(null)} type="button"><IconClose /></button>
                    </div>
                    <div className="ep-modal-body" style={{ padding: '16px' }}>
                        <input
                            type="text"
                            className="ep-input"
                            placeholder="Escribe el nombre del juego..."
                            value={gameSearchQuery}
                            onChange={e => setGameSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {isSearchingGames && <p className="ep-searching" style={{ marginTop: '12px' }}>Buscando...</p>}
                        {gameSearchResults.length > 0 && (
                            <div className="ep-search-results" style={{ marginTop: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                                {gameSearchResults.slice(0, 5).map(game => (
                                    <button key={game.id} type="button" className="ep-search-result" onClick={() => selectGame(game)}>
                                        {(game.cover_url || game.image_url) && <img src={game.cover_url || game.image_url} alt="" className="square-cover" />}
                                        <span className="ep-search-result-name">{game.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        {activeAnimeSlot !== null && (
            <div className="ep-overlay" style={{ zIndex: 10001 }} onClick={e => { if (e.target === e.currentTarget) setActiveAnimeSlot(null) }}>
                <div className="ep-modal" style={{ width: '400px', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                    <div className="ep-modal-header">
                        <h3 className="ep-modal-title">Elige un Anime</h3>
                        <button className="ep-close-btn" onClick={() => setActiveAnimeSlot(null)} type="button"><IconClose /></button>
                    </div>
                    <div className="ep-modal-body" style={{ padding: '16px' }}>
                        <input
                            type="text"
                            className="ep-input"
                            placeholder="Escribe el nombre del anime..."
                            value={animeSearchQuery}
                            onChange={e => setAnimeSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {isSearchingAnime && <p className="ep-searching" style={{ marginTop: '12px' }}>Buscando...</p>}
                        {animeSearchResults.length > 0 && (
                            <div className="ep-search-results" style={{ marginTop: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                                {animeSearchResults.slice(0, 5).map(anime => (
                                    <button key={anime.id} type="button" className="ep-search-result" onClick={() => selectAnime(anime)}>
                                        {(anime.cover_url || anime.image_url) && <img src={anime.cover_url || anime.image_url} alt="" className="square-cover" />}
                                        <span className="ep-search-result-name">{anime.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        </div>
        </div>
    )

    return standalone ? settingsMarkup : createPortal(editorMarkup, document.body)
}
