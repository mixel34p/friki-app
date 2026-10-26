import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getAccentTextColor } from '../lib/colorContrast'
import { searchGames } from '../lib/gameService'
import { getBlockedUsers, unblockUser } from '../lib/socialDiscoveryService'
import { BADGES_MAP } from '../lib/badges'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './EditProfile.css'
import { SocialIcons } from '../components/SocialIcons'
import ImageCropperModal from '../components/ImageCropperModal'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SortableFavoriteItem } from '../components/profile/SortableFavoriteItem'

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
    '#14b8a6', // Teal (Brand)
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#6366f1', // Indigo
    '#ec4899', // Pink
]

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Nintendo', 'Mobile']

const GAME_GENRES = [
    'RPG', 'Acción', 'Aventura', 'Estrategia', 'Simulación', 'Deportes',
    'Lucha', 'Shooter', 'Plataformas', 'Terror', 'Puzzle', 'Indie',
    'MMORPG', 'Battle Royale', 'Souls-like', 'Roguelike', 'Metroidvania'
]

const ANIME_GENRES = [
    'Shonen', 'Seinen', 'Shojo', 'Isekai', 'Mecha', 'Romance',
    'Comedia', 'Terror', 'Ciencia Ficción', 'Fantasy', 'Slice of Life',
    'Deportes', 'Misterio', 'Acción', 'Histórico', 'Psychological'
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

const SECTION_TABS = [
    { id: 'photos',    label: 'Fotos',     icon: <IconImage /> },
    { id: 'info',      label: 'Info',      icon: <IconUser /> },
    { id: 'favorites', label: 'Favoritos', icon: <IconHeart /> },
    { id: 'interests', label: 'Intereses', icon: <IconGamepad /> },
    { id: 'social',    label: 'Redes',     icon: <IconLink /> },
    { id: 'blocked',   label: 'Bloqueados',icon: <IconShield /> }
]

/* ──────────────────────────────────────
   Component
   ────────────────────────────────────── */
export default function EditProfile({ onClose }) {
    const { user, profile, updateProfile } = useAuth()
    const navigate = useNavigate()
    const fileInputRef = useRef(null)
    const bannerInputRef = useRef(null)
    const textareaRef = useRef(null)

    const [activeSection, setActiveSection] = useState('photos')
    const [bioMode, setBioMode] = useState('write')

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

    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
    const [bannerFile, setBannerFile] = useState(null)
    const [bannerPreview, setBannerPreview] = useState(profile?.banner_url || null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [usernameError, setUsernameError] = useState('')

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
    const [customTagInput, setCustomTagInput] = useState('')
    const [isAddingSocial, setIsAddingSocial] = useState(false)

    useEffect(() => {
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
    }, []);

    // Blocked users
    const [blockedUsers, setBlockedUsers] = useState([])
    const [loadingBlocked, setLoadingBlocked] = useState(false)

    const availablePlatforms = SOCIAL_PLATFORMS.filter(
        p => !formData.social_links[p.id] && formData.social_links[p.id] !== ''
    )

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
        const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
        handleChange('username', clean)
        if (clean.length < 3) { setUsernameError('Mínimo 3 caracteres'); return }
        if (clean === profile?.username) { setUsernameError(''); return }
        const { data } = await supabase.from('profiles').select('username').eq('username', clean).maybeSingle()
        setUsernameError(data ? 'Este username ya está en uso' : '')
    }

    const toggleArrayItem = (field, item) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(item)
                ? prev[field].filter(i => i !== item)
                : [...prev[field], item]
        }))
    }

    const addCustomTag = () => {
        if (!customTagInput.trim()) return
        if (formData.custom_tags.includes(customTagInput.trim())) return
        handleChange('custom_tags', [...formData.custom_tags, customTagInput.trim()])
        setCustomTagInput('')
    }

    const removeCustomTag = (tag) =>
        handleChange('custom_tags', formData.custom_tags.filter(t => t !== tag))

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

    const uploadImage = async (file, bucket, path) => {
        if (!file || !user) return null
        const { error: err } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
        if (err) throw err
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
        if (formData.username.length < 3) { setError('El username debe tener al menos 3 caracteres'); return }
        setSaving(true); setError('')
        try {
            let avatarUrl = profile?.avatar_url
            let bannerUrl = profile?.banner_url
            if (avatarFile) {
                const ext = (avatarFile.name && avatarFile.name.includes('.')) ? avatarFile.name.split('.').pop() : 'jpg'
                let url = await uploadImage(avatarFile, 'avatars', `avatars/${user.id}.${ext}`)
                avatarUrl = `${url}?t=${Date.now()}`
            }
            if (bannerFile) {
                const ext = (bannerFile.name && bannerFile.name.includes('.')) ? bannerFile.name.split('.').pop() : 'jpg'
                let url = await uploadImage(bannerFile, 'avatars', `banners/${user.id}.${ext}`)
                bannerUrl = `${url}?t=${Date.now()}`
            }
            await updateProfile({ ...formData, avatar_url: avatarUrl, banner_url: bannerUrl })
            if (onClose) onClose(); else navigate('/profile')
        } catch (err) {
            console.error(err)
            setError(err.message || 'Error al guardar cambios')
        } finally {
            setSaving(false)
        }
    }

    const handleClose = () => { if (onClose) onClose(); else navigate('/profile') }

    /* ──────────────────────────────────────
       Render
       ────────────────────────────────────── */
    return createPortal((
        <div className="ep-portal-root" style={{
            '--brand-primary': formData.theme_color || '#14b8a6',
            '--brand-dark': formData.theme_color || '#14b8a6',
            '--profile-theme-color': formData.theme_color || '#14b8a6',
            '--profile-accent-text': getAccentTextColor(formData.theme_color || '#14b8a6')
        }}>
            <div className="ep-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
                <div className="ep-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="ep-modal-header">
                    <h1 className="ep-modal-title">Editar Perfil</h1>
                    <button className="ep-close-btn" onClick={handleClose} type="button">
                        <IconClose />
                    </button>
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

                <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
                    {/* Scrollable body */}
                    <div className="ep-modal-body ep-animate-in" key={activeSection}>
                        {error && <div className="ep-alert ep-alert--error">{error}</div>}

                        {/* ── FOTOS ── */}
                        {activeSection === 'photos' && (
                            <>
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

                                {/* Avatar */}
                                <div className="ep-field">
                                    <label className="ep-label">Foto de perfil</label>
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
                                                <IconCamera />
                                            </div>
                                        </button>
                                        <div className="ep-avatar-hints">
                                            <p>Haz clic en la imagen para cambiarla</p>
                                            <span>Formato JPG, PNG o GIF · Máx. 2MB</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Theme Color */}
                                <div className="ep-field" style={{ marginTop: '24px' }}>
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
                        {activeSection === 'info' && (
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
                                        <label className="ep-label" style={{ margin: 0 }}>
                                            Biografía <span className="ep-optional">Markdown soportado</span>
                                        </label>
                                        <div className="ep-bio-tabs">
                                            <button type="button" className={`ep-bio-tab ${bioMode === 'write' ? 'active' : ''}`} onClick={() => setBioMode('write')}>Escribir</button>
                                            <button type="button" className={`ep-bio-tab ${bioMode === 'preview' ? 'active' : ''}`} onClick={() => setBioMode('preview')}>Vista previa</button>
                                        </div>
                                    </div>

                                    {bioMode === 'write' ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <div className="ep-bio-preview markdown-content">
                                            {formData.bio
                                                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{formData.bio}</ReactMarkdown>
                                                : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nada que previsualizar...</span>
                                            }
                                        </div>
                                    )}
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
                        {activeSection === 'favorites' && (
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

                        {/* ── INTERESES ── */}
                        {activeSection === 'interests' && (
                            <>
                                {/* Platforms */}
                                <div className="ep-field">
                                    <label className="ep-label">Plataformas de juego</label>
                                    <div className="ep-pill-grid">
                                        {PLATFORMS.map(p => (
                                            <button
                                                key={p} type="button"
                                                className={`ep-pill-btn ${formData.platforms.includes(p) ? 'active' : ''}`}
                                                onClick={() => toggleArrayItem('platforms', p)}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Game genres */}
                                <div className="ep-field">
                                    <label className="ep-label">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <IconGamepad /> Géneros de videojuegos
                                        </span>
                                    </label>
                                    <div className="ep-pill-grid">
                                        {GAME_GENRES.map(g => (
                                            <button
                                                key={g} type="button"
                                                className={`ep-pill-btn ${formData.favorite_genres.includes(g) ? 'active' : ''}`}
                                                onClick={() => toggleArrayItem('favorite_genres', g)}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Anime genres */}
                                <div className="ep-field">
                                    <label className="ep-label">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <IconTV /> Géneros de anime
                                        </span>
                                    </label>
                                    <div className="ep-pill-grid">
                                        {ANIME_GENRES.map(g => (
                                            <button
                                                key={g} type="button"
                                                className={`ep-pill-btn ${formData.anime_tags.includes(g) ? 'active' : ''}`}
                                                onClick={() => toggleArrayItem('anime_tags', g)}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom tags */}
                                <div className="ep-field">
                                    <label className="ep-label">
                                        Otros intereses <span className="ep-optional">personalizados</span>
                                    </label>
                                    <div className="ep-tag-input-row">
                                        <input
                                            type="text"
                                            className="ep-input"
                                            placeholder="Ej: Cómics, Cosplay, DnD..."
                                            value={customTagInput}
                                            onChange={e => setCustomTagInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                                            maxLength={30}
                                        />
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomTag}>
                                            <IconPlus />
                                        </button>
                                    </div>
                                    {formData.custom_tags.length > 0 && (
                                        <div className="ep-tags-cloud">
                                            {formData.custom_tags.map(tag => (
                                                <span key={tag} className="ep-tag-item">
                                                    {tag}
                                                    <button type="button" className="ep-tag-remove" onClick={() => removeCustomTag(tag)}>
                                                        <IconClose />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── REDES SOCIALES ── */}
                        {activeSection === 'social' && (
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
                    <div className="ep-modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={handleClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !!usernameError}>
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
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
), document.body)
}
