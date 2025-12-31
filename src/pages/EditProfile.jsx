import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import { getBlockedUsers, unblockUser } from '../lib/socialDiscoveryService'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './EditProfile.css'
import { SocialIcons } from '../components/SocialIcons'

const GENRES = [
    'RPG', 'JRPG', 'Action', 'Adventure', 'Horror', 'Puzzle',
    'Platformer', 'Shooter', 'Strategy', 'Roguelike', 'Metroidvania',
    'Souls-like', 'Visual Novel', 'Indie', 'Fighting'
]

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile']

const ERAS = [
    { value: 'retro', label: 'Retro (antes 2000)' },
    { value: 'classic', label: 'Clásica (2000-2010)' },
    { value: 'modern', label: 'Moderna (2010-2020)' },
    { value: 'current', label: 'Actual (2020+)' }
]

const SOCIAL_PLATFORMS = [
    { id: 'twitter', label: 'Twitter / X', placeholder: '@usuario', icon: <SocialIcons.Twitter /> },
    { id: 'instagram', label: 'Instagram', placeholder: '@usuario', icon: <SocialIcons.Instagram /> },
    { id: 'twitch', label: 'Twitch', placeholder: 'Canal o URL', icon: <SocialIcons.Twitch /> },
    { id: 'youtube', label: 'YouTube', placeholder: 'Canal o URL', icon: <SocialIcons.YouTube /> },
    { id: 'discord', label: 'Discord', placeholder: 'usuario', icon: <SocialIcons.Discord /> },
    { id: 'steam', label: 'Steam', placeholder: 'ID de usuario o URL', icon: <SocialIcons.Steam /> },
    { id: 'reddit', label: 'Reddit', placeholder: 'usuario', icon: <SocialIcons.Reddit /> },
    { id: 'tiktok', label: 'TikTok', placeholder: '@usuario', icon: <SocialIcons.TikTok /> },
    { id: 'github', label: 'GitHub', placeholder: 'usuario', icon: <SocialIcons.GitHub /> },
    { id: 'website', label: 'Sitio Web', placeholder: 'https://tusitio.com', icon: <SocialIcons.Website /> }
]

export default function EditProfile() {
    const { user, profile, updateProfile } = useAuth()
    const navigate = useNavigate()
    const fileInputRef = useRef(null)
    const bannerInputRef = useRef(null)
    const textareaRef = useRef(null)

    const [bioMode, setBioMode] = useState('write') // 'write' | 'preview'

    const insertMarkdown = (prefix, suffix) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = formData.bio
        const before = text.substring(0, start)
        const selected = text.substring(start, end)
        const after = text.substring(end)

        const newText = before + prefix + selected + suffix + after
        handleChange('bio', newText)

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + prefix.length, end + prefix.length)
        }, 0)
    }

    const [formData, setFormData] = useState({
        username: profile?.username || '',
        display_name: profile?.display_name || '',
        pronouns: profile?.pronouns || '',
        bio: profile?.bio || '',
        favorite_genres: profile?.favorite_genres || [],
        anime_tags: profile?.anime_tags || [],
        custom_tags: profile?.custom_tags || [],
        platforms: profile?.platforms || [],
        favorite_era: profile?.favorite_era || 'current',
        favorite_game: profile?.favorite_game || null,
        favorite_anime: profile?.favorite_anime || null,
        color_primary: profile?.color_primary || '#8b5cf6',
        color_secondary: profile?.color_secondary || '#6366f1',
        color_accent: profile?.color_accent || '#f59e0b',
        color_background: profile?.color_background || '#0f0f0f',
        use_gradient: profile?.use_gradient || false,
        social_links: profile?.social_links || {}
    })

    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
    const [bannerFile, setBannerFile] = useState(null)
    const [bannerPreview, setBannerPreview] = useState(profile?.banner_url || null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [usernameError, setUsernameError] = useState('')

    // Game search state
    const [gameSearchQuery, setGameSearchQuery] = useState('')
    const [gameSearchResults, setGameSearchResults] = useState([])
    const [isSearchingGames, setIsSearchingGames] = useState(false)

    // Anime search state
    const [animeSearchQuery, setAnimeSearchQuery] = useState('')
    const [animeSearchResults, setAnimeSearchResults] = useState([])
    const [isSearchingAnime, setIsSearchingAnime] = useState(false)

    // Tag Input State
    const [customTagInput, setCustomTagInput] = useState('')

    // Socials State
    const [isAddingSocial, setIsAddingSocial] = useState(false)
    const availablePlatforms = SOCIAL_PLATFORMS.filter(
        p => !formData.social_links[p.id] && formData.social_links[p.id] !== ''
    )

    // Blocked Users State
    const [blockedUsers, setBlockedUsers] = useState([])
    const [loadingBlocked, setLoadingBlocked] = useState(false)

    // Fetch blocked users
    useEffect(() => {
        if (!user) return
        const fetchBlocked = async () => {
            setLoadingBlocked(true)
            try {
                const blocked = await getBlockedUsers(user.id)
                setBlockedUsers(blocked)
            } catch (err) {
                console.error('Error fetching blocked users:', err)
            } finally {
                setLoadingBlocked(false)
            }
        }
        fetchBlocked()
    }, [user])

    const handleUnblock = async (blockedId) => {
        if (!window.confirm('¿Desbloquear a este usuario?')) return
        try {
            await unblockUser(user.id, blockedId)
            setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId))
        } catch (err) {
            console.error('Error unblocking:', err)
            alert('Error al desbloquear usuario')
        }
    }

    // Debounced game search
    useEffect(() => {
        if (gameSearchQuery.length < 3) {
            setGameSearchResults([])
            return
        }

        const timeout = setTimeout(async () => {
            setIsSearchingGames(true)
            const results = await searchGames(gameSearchQuery)
            setGameSearchResults(results)
            setIsSearchingGames(false)
        }, 500)

        return () => clearTimeout(timeout)
    }, [gameSearchQuery])

    // Debounced anime search
    useEffect(() => {
        if (animeSearchQuery.length < 3) {
            setAnimeSearchResults([])
            return
        }

        const timeout = setTimeout(async () => {
            setIsSearchingAnime(true)
            // Import dynamically or assume it's imported at top
            const { searchAnime } = await import('../lib/animeService')
            const results = await searchAnime(animeSearchQuery)
            setAnimeSearchResults(results)
            setIsSearchingAnime(false)
        }, 500)

        return () => clearTimeout(timeout)
    }, [animeSearchQuery])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleUsernameChange = async (value) => {
        const newUsername = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
        handleChange('username', newUsername)

        if (newUsername.length < 3) {
            setUsernameError('Mínimo 3 caracteres')
            return
        }

        if (newUsername === profile?.username) {
            setUsernameError('')
            return
        }

        const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', newUsername)
            .maybeSingle()

        if (data) {
            setUsernameError('Este username ya está en uso')
        } else {
            setUsernameError('')
        }
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

        setFormData(prev => ({
            ...prev,
            custom_tags: [...prev.custom_tags, customTagInput.trim()]
        }))
        setCustomTagInput('')
    }

    const removeCustomTag = (tag) => {
        setFormData(prev => ({
            ...prev,
            custom_tags: prev.custom_tags.filter(t => t !== tag)
        }))
    }

    const handleSocialLinkChange = (platformId, value) => {
        setFormData(prev => ({
            ...prev,
            social_links: {
                ...prev.social_links,
                [platformId]: value
            }
        }))
    }

    const removeSocialLink = (platformId) => {
        setFormData(prev => {
            const newLinks = { ...prev.social_links }
            delete newLinks[platformId]
            return { ...prev, social_links: newLinks }
        })
    }

    const addSocialPlatform = (platformId) => {
        handleSocialLinkChange(platformId, '')
        setIsAddingSocial(false)
    }

    const handleAvatarClick = () => fileInputRef.current?.click()
    const handleBannerClick = () => bannerInputRef.current?.click()

    const handleFileChange = (e, type) => {
        const file = e.target.files?.[0]
        if (!file) return

        const maxSize = type === 'banner' ? 5 * 1024 * 1024 : 2 * 1024 * 1024
        if (file.size > maxSize) {
            setError(`La imagen no puede superar ${type === 'banner' ? '5MB' : '2MB'}`)
            return
        }

        if (type === 'avatar') {
            setAvatarFile(file)
            setAvatarPreview(URL.createObjectURL(file))
        } else {
            setBannerFile(file)
            setBannerPreview(URL.createObjectURL(file))
        }
    }

    const uploadImage = async (file, bucket, path) => {
        if (!file || !user) return null

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(path, file, { upsert: true })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        return data.publicUrl
    }

    const selectFavoriteGame = (game) => {
        handleChange('favorite_game', {
            id: game.id,
            name: game.name,
            cover_url: game.cover_url || game.image_url
        })
        setGameSearchQuery('')
        setGameSearchResults([])
    }

    const selectFavoriteAnime = (anime) => {
        handleChange('favorite_anime', {
            id: anime.id,
            title: anime.title,
            cover_url: anime.cover_url || anime.image_url
        })
        setAnimeSearchQuery('')
        setAnimeSearchResults([])
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (usernameError) {
            setError(usernameError)
            return
        }

        if (formData.username.length < 3) {
            setError('El username debe tener al menos 3 caracteres')
            return
        }

        setSaving(true)
        setError('')

        try {
            let avatarUrl = profile?.avatar_url
            let bannerUrl = profile?.banner_url

            if (avatarFile) {
                const ext = avatarFile.name.split('.').pop()
                avatarUrl = await uploadImage(avatarFile, 'avatars', `avatars/${user.id}.${ext}`)
            }

            if (bannerFile) {
                const ext = bannerFile.name.split('.').pop()
                bannerUrl = await uploadImage(bannerFile, 'avatars', `banners/${user.id}.${ext}`)
            }

            await updateProfile({
                ...formData,
                avatar_url: avatarUrl,
                banner_url: bannerUrl
            })

            navigate('/profile')
        } catch (err) {
            console.error('Save error:', err)
            setError(err.message || 'Error al guardar cambios')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="edit-profile">
            <div className="container container-sm">
                <h1 className="page-title">Editar Perfil</h1>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="edit-form">
                    {/* Banner */}
                    <section className="form-section">
                        <h2 className="section-title">Banner</h2>
                        <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'banner')}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            className="banner-upload-btn"
                            onClick={handleBannerClick}
                        >
                            {bannerPreview ? (
                                <img src={bannerPreview} alt="Banner" className="banner-preview" />
                            ) : (
                                <div className="banner-placeholder">
                                    <span>🖼️ Añadir banner</span>
                                </div>
                            )}
                        </button>
                    </section>

                    {/* Avatar */}
                    <section className="form-section">
                        <h2 className="section-title">Foto de perfil</h2>
                        <div className="avatar-edit">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'avatar')}
                                style={{ display: 'none' }}
                            />
                            <button
                                type="button"
                                className="avatar-upload-btn"
                                onClick={handleAvatarClick}
                            >
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="avatar-preview" />
                                ) : (
                                    <div className="avatar-placeholder-large">
                                        {formData.display_name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                )}
                                <div className="avatar-overlay"><span>📷</span></div>
                            </button>
                        </div>
                    </section>

                    {/* Basic Info */}
                    <section className="form-section">
                        <h2 className="section-title">Información básica</h2>

                        <div className="input-group">
                            <label className="input-label">Username</label>
                            <div className="input-with-prefix">
                                <span className="input-prefix">@</span>
                                <input
                                    type="text"
                                    className={`input ${usernameError ? 'input-error' : ''}`}
                                    value={formData.username}
                                    onChange={(e) => handleUsernameChange(e.target.value)}
                                    maxLength={20}
                                />
                            </div>
                            {usernameError && <span className="input-error-text">{usernameError}</span>}
                        </div>

                        <div className="input-group">
                            <label className="input-label">Nombre para mostrar</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.display_name}
                                onChange={(e) => handleChange('display_name', e.target.value)}
                                maxLength={30}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Pronombres (opcional)</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.pronouns}
                                onChange={(e) => handleChange('pronouns', e.target.value)}
                                placeholder="Ej: Él/Él, Ella/Ella, Elle/Elle..."
                                maxLength={20}
                            />
                        </div>

                        <div className="input-group">
                            <div className="flex justify-between items-center mb-2">
                                <label className="input-label">Bio (Markdown soportado)</label>
                                <div className="bio-tabs">
                                    <button
                                        type="button"
                                        className={`tab-btn ${bioMode === 'write' ? 'active' : ''}`}
                                        onClick={() => setBioMode('write')}
                                    >
                                        Escribir
                                    </button>
                                    <button
                                        type="button"
                                        className={`tab-btn ${bioMode === 'preview' ? 'active' : ''}`}
                                        onClick={() => setBioMode('preview')}
                                    >
                                        Vista Previa
                                    </button>
                                </div>
                            </div>

                            {bioMode === 'write' ? (
                                <>
                                    <div className="markdown-toolbar">
                                        <button type="button" onClick={() => insertMarkdown('**', '**')} title="Negrita">𝐁</button>
                                        <button type="button" onClick={() => insertMarkdown('*', '*')} title="Cursiva">𝑖</button>
                                        <button type="button" onClick={() => insertMarkdown('[', '](url)')} title="Enlace">🔗</button>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        className="input textarea bio-input"
                                        value={formData.bio}
                                        onChange={(e) => handleChange('bio', e.target.value)}
                                        placeholder="Cuéntanos sobre tus gustos... usa la barra de herramientas para dar formato."
                                        maxLength={2000}
                                        rows={8}
                                    />
                                    <span className="char-count">{formData.bio.length}/2000</span>
                                </>
                            ) : (
                                <div className="bio-preview markdown-content input">
                                    {formData.bio ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {formData.bio}
                                        </ReactMarkdown>
                                    ) : (
                                        <p className="text-muted italic">Nada que previsualizar...</p>
                                    )}
                                </div>
                            )}
                        </div>

                    </section>

                    {/* Favorite Game */}
                    <section className="form-section">
                        <h2 className="section-title">Juego favorito</h2>

                        {formData.favorite_game ? (
                            <div className="favorite-game-card">
                                {formData.favorite_game.cover_url && (
                                    <img src={formData.favorite_game.cover_url} alt="" />
                                )}
                                <span>{formData.favorite_game.name}</span>
                                <button
                                    type="button"
                                    className="remove-favorite"
                                    onClick={() => handleChange('favorite_game', null)}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="game-search">
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Buscar juego..."
                                    value={gameSearchQuery}
                                    onChange={(e) => setGameSearchQuery(e.target.value)}
                                />
                                {isSearchingGames && <div className="search-loading">Buscando...</div>}
                                {gameSearchResults.length > 0 && (
                                    <div className="game-search-results">
                                        {gameSearchResults.slice(0, 5).map(game => (
                                            <button
                                                key={game.id}
                                                type="button"
                                                className="game-result"
                                                onClick={() => selectFavoriteGame(game)}
                                            >
                                                {(game.cover_url || game.image_url) && (
                                                    <img src={game.cover_url || game.image_url} alt="" />
                                                )}
                                                <span>{game.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Favorite Anime */}
                    <section className="form-section">
                        <h2 className="section-title">Anime favorito</h2>

                        {formData.favorite_anime ? (
                            <div className="favorite-game-card">
                                {formData.favorite_anime.cover_url && (
                                    <img src={formData.favorite_anime.cover_url} alt="" />
                                )}
                                <span>{formData.favorite_anime.title}</span>
                                <button
                                    type="button"
                                    className="remove-favorite"
                                    onClick={() => handleChange('favorite_anime', null)}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="game-search">
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Buscar anime..."
                                    value={animeSearchQuery}
                                    onChange={(e) => setAnimeSearchQuery(e.target.value)}
                                />
                                {isSearchingAnime && <div className="search-loading">Buscando...</div>}
                                {animeSearchResults.length > 0 && (
                                    <div className="game-search-results">
                                        {animeSearchResults.slice(0, 5).map(anime => (
                                            <button
                                                key={anime.id}
                                                type="button"
                                                className="game-result"
                                                onClick={() => selectFavoriteAnime(anime)}
                                            >
                                                {(anime.cover_url || anime.image_url) && (
                                                    <img src={anime.cover_url || anime.image_url} alt="" />
                                                )}
                                                <span>{anime.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>



                    {/* Tags & Passions */}
                    <section className="form-section">
                        <h2 className="section-title">Pasiones y Etiquetas</h2>

                        {/* Game Genres */}
                        <div className="input-group">
                            <label className="input-label">Videojuegos</label>
                            <p className="input-hint">Selecciona tus géneros favoritos</p>
                            <div className="checkbox-grid">
                                {GENRES.map(genre => (
                                    <button
                                        key={genre}
                                        type="button"
                                        className={`checkbox-btn ${formData.favorite_genres.includes(genre) ? 'active' : ''}`}
                                        onClick={() => toggleArrayItem('favorite_genres', genre)}
                                    >
                                        {genre}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Anime Tags (Hardcoded top genres for now) */}
                        <div className="input-group" style={{ marginTop: '1rem' }}>
                            <label className="input-label">Anime</label>
                            <p className="input-hint">Selecciona géneros de anime</p>
                            <div className="checkbox-grid">
                                {['Shonen', 'Seinen', 'Shojo', 'Isekai', 'Mecha', 'Slice of Life', 'Sports', 'Horror', 'Romance', 'Fantasy'].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        className={`checkbox-btn ${formData.anime_tags.includes(tag) ? 'active' : ''}`}
                                        onClick={() => toggleArrayItem('anime_tags', tag)}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Tags */}
                        <div className="input-group" style={{ marginTop: '1rem' }}>
                            <label className="input-label">Etiquetas Personalizadas</label>
                            <div className="custom-tags-input">
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ej: Speedrunning, Cosplay..."
                                    value={customTagInput}
                                    onChange={(e) => setCustomTagInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                                />
                                <button type="button" className="btn btn-secondary" onClick={addCustomTag}>+</button>
                            </div>
                            <div className="tags-list">
                                {formData.custom_tags.map(tag => (
                                    <span key={tag} className="tag custom-tag">
                                        {tag}
                                        <button type="button" onClick={() => removeCustomTag(tag)}>×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Platforms */}
                    <section className="form-section">
                        <h2 className="section-title">Plataformas</h2>
                        <div className="checkbox-grid">
                            {PLATFORMS.map(platform => (
                                <button
                                    key={platform}
                                    type="button"
                                    className={`checkbox-btn ${formData.platforms.includes(platform) ? 'active' : ''}`}
                                    onClick={() => toggleArrayItem('platforms', platform)}
                                >
                                    {platform}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Social Links */}
                    <section className="form-section">
                        <h2 className="section-title">Redes Sociales</h2>
                        <div className="social-links-list">
                            {Object.entries(formData.social_links).map(([platformId, value]) => {
                                const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId)
                                if (!platform) return null

                                return (
                                    <div key={platformId} className="input-group social-input-group animate-slide-in">
                                        <label className="input-label flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <span className="platform-icon-wrapper">{platform.icon}</span>
                                                {platform.label}
                                            </span>
                                            <button
                                                type="button"
                                                className="remove-btn"
                                                onClick={() => removeSocialLink(platformId)}
                                                title="Eliminar"
                                            >
                                                <SocialIcons.Delete width={16} height={16} />
                                            </button>
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={value}
                                            onChange={(e) => handleSocialLinkChange(platformId, e.target.value)}
                                            placeholder={platform.placeholder}
                                            autoFocus
                                        />
                                    </div>
                                )
                            })}
                        </div>

                        {availablePlatforms.length > 0 && (
                            <div className="add-social-container">
                                {isAddingSocial ? (
                                    <div className="add-social-menu animate-fade-in">
                                        <p className="menu-title">Añadir red social:</p>
                                        <div className="platforms-grid">
                                            {availablePlatforms.map(platform => (
                                                <button
                                                    key={platform.id}
                                                    type="button"
                                                    className="platform-select-btn"
                                                    onClick={() => addSocialPlatform(platform.id)}
                                                >
                                                    <span className="platform-icon-wrapper">{platform.icon}</span>
                                                    <span>{platform.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            className="cancel-add-btn"
                                            onClick={() => setIsAddingSocial(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="add-social-btn"
                                        onClick={() => setIsAddingSocial(true)}
                                    >
                                        <span>+</span> Añadir red social
                                    </button>
                                )}
                            </div>
                        )}
                    </section>


                    {/* Blocked Users */}
                    <section className="form-section blocked-section">
                        <h2 className="section-title">Usuarios Bloqueados</h2>
                        {loadingBlocked ? (
                            <p className="text-muted">Cargando...</p>
                        ) : blockedUsers.length === 0 ? (
                            <p className="text-muted">No tienes usuarios bloqueados</p>
                        ) : (
                            <div className="blocked-users-list">
                                {blockedUsers.map(block => (
                                    <div key={block.blocked_id} className="blocked-user-card">
                                        <div className="blocked-user-info">
                                            {block.blocked?.avatar_url ? (
                                                <img src={block.blocked.avatar_url} alt="" className="blocked-avatar" />
                                            ) : (
                                                <div className="blocked-avatar placeholder">
                                                    {block.blocked?.display_name?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <div className="blocked-details">
                                                <span className="blocked-name">{block.blocked?.display_name || 'Usuario'}</span>
                                                <span className="blocked-username">@{block.blocked?.username}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-unblock"
                                            onClick={() => handleUnblock(block.blocked_id)}
                                        >
                                            Desbloquear
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>


                    {/* Actions */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/profile')}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving || !!usernameError}
                        >
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </form >
            </div >
        </div >
    )
}
