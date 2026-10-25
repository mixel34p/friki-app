import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ImageCropperModal from '../components/ImageCropperModal'
import { STATIC_COVERS } from '../lib/constants'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableFavoriteItem } from '../components/profile/SortableFavoriteItem';

import './Onboarding.css'

const THEME_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#6366f1', '#ec4899']

export default function Onboarding() {
    const { user, refreshProfile, signOut } = useAuth()
    const navigate = useNavigate()
    
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    
    // Form State
    const [displayName, setDisplayName] = useState('')
    const [bio, setBio] = useState('')
    const [bioMode, setBioMode] = useState('write')
    const textareaRef = useRef(null)
    const [pronouns, setPronouns] = useState('')
    const [themeColor, setThemeColor] = useState('#14b8a6')
    
    // Files
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [bannerFile, setBannerFile] = useState(null)
    const [bannerPreview, setBannerPreview] = useState(null)

    // Cropper State
    const [cropModal, setCropModal] = useState({ isOpen: false, type: null, src: null, aspect: 1 })

    // Favorites
    const [favorite_games, setFavoriteGames] = useState([])
    const [favorite_animes, setFavoriteAnimes] = useState([])
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

    const insertMarkdown = (prefix, suffix) => {
        const textarea = textareaRef.current
        if (!textarea) return
        const { selectionStart, selectionEnd } = textarea
        const nextBio = bio.slice(0, selectionStart) + prefix + bio.slice(selectionStart, selectionEnd) + suffix + bio.slice(selectionEnd)
        setBio(nextBio)
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(selectionStart + prefix.length, selectionEnd + prefix.length)
        }, 0)
    }

    useEffect(() => {
        // Pre-fill from auth metadata if available
        if (user?.user_metadata?.username) {
            setDisplayName(user.user_metadata.username)
        }
    }, [user])

    useEffect(() => {
        if (gameSearchQuery.length < 3) { setGameSearchResults([]); return }
        const t = setTimeout(async () => {
            setIsSearchingGames(true)
            const { searchGames } = await import('../lib/gameService')
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

    const selectGame = (game) => {
        const selectedGame = { id: game.id, name: game.name, cover_url: game.cover_url || game.image_url }
        setFavoriteGames(prev => {
            if (activeGameSlot === null) return prev.length < 4 ? [...prev, selectedGame] : prev
            if (activeGameSlot < prev.length) {
                const next = [...prev]
                next[activeGameSlot] = selectedGame
                return next
            }
            return prev.length < 4 ? [...prev, selectedGame] : prev
        })
        setActiveGameSlot(null)
        setGameSearchQuery(''); setGameSearchResults([])
    }
    const removeGame = (index) => setFavoriteGames(prev => { const n = [...prev]; n.splice(index,1); return n; })
    const handleDragEndGames = ({ active, over }) => {
        if (!over || active.id === over.id) return
        setFavoriteGames(current => {
            const oldIndex = current.findIndex(game => game.id === active.id)
            const newIndex = current.findIndex(game => game.id === over.id)
            return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex)
        })
    }

    const selectAnime = (anime) => {
        const selectedAnime = { id: anime.id, title: anime.title, cover_url: anime.cover_url || anime.image_url }
        setFavoriteAnimes(prev => {
            if (activeAnimeSlot === null) return prev.length < 4 ? [...prev, selectedAnime] : prev
            if (activeAnimeSlot < prev.length) {
                const next = [...prev]
                next[activeAnimeSlot] = selectedAnime
                return next
            }
            return prev.length < 4 ? [...prev, selectedAnime] : prev
        })
        setActiveAnimeSlot(null)
        setAnimeSearchQuery(''); setAnimeSearchResults([])
    }
    const removeAnime = (index) => setFavoriteAnimes(prev => { const n = [...prev]; n.splice(index,1); return n; })
    const handleDragEndAnimes = ({ active, over }) => {
        if (!over || active.id === over.id) return
        setFavoriteAnimes(current => {
            const oldIndex = current.findIndex(anime => anime.id === active.id)
            const newIndex = current.findIndex(anime => anime.id === over.id)
            return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex)
        })
    }

    const handleFileChange = (e, type) => {
        const file = e.target.files[0]
        if (!file) return
        
        if (file.size > 5 * 1024 * 1024) {
            setError('El archivo es demasiado grande (Máx: 5MB)')
            return
        }

        const previewUrl = URL.createObjectURL(file)
        setCropModal({
            isOpen: true,
            type,
            src: previewUrl,
            aspect: type === 'avatar' ? 1 : 16/5
        })
        setError(null)
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

    const uploadImage = async (file, folder) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `${folder}/${fileName}`
        
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file)
            
        if (uploadError) throw uploadError
        
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)
            
        return data.publicUrl
    }

    const checkUsernameAvailability = async () => {
        if (!username || username.length < 3) return false
        
        const { data } = await supabase
            .from('profiles')
            .select('id')
            .ilike('username', username)
            .maybeSingle()
            
        return !data // True if not taken
    }

    const handleNextStep = async () => {
        setError(null)
        
        if (step === 1) {
            if (!displayName.trim()) {
                setError('El nombre para mostrar no puede estar vacío')
                return
            }
            
            setStep(2)
        } else if (step === 2) {
            setStep(3)
        } else if (step === 3) {
            handleSubmit()
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        setError(null)
        
        try {
            let finalAvatarUrl = null
            if (avatarFile) {
                let url = await uploadImage(avatarFile, 'avatars')
                finalAvatarUrl = url ? `${url}?t=${Date.now()}` : null
            }

            let finalBannerUrl = null
            if (bannerFile) {
                let url = await uploadImage(bannerFile, 'banners')
                finalBannerUrl = url ? `${url}?t=${Date.now()}` : null
            }
            
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    username: user.user_metadata.username.toLowerCase(),
                    display_name: displayName,
                    bio: bio,
                    avatar_url: finalAvatarUrl,
                    banner_url: finalBannerUrl,
                    pronouns,
                    platforms: [],
                    theme_color: themeColor,
                    favorite_games,
                    favorite_animes,
                    onboarding_completed: true
                })
                
            if (profileError) {
                if (profileError.code === '23505') {
                     throw new Error('Ese nombre de usuario ya está registrado.')
                }
                throw profileError
            }
            
            await refreshProfile()
            navigate('/home')
            
        } catch (err) {
            console.error('Onboarding Error:', err)
            setError(err.message || 'Hubo un error al guardar tu perfil. Inténtalo de nuevo.')
            setLoading(false)
        }
    }

    return (
        <div className="onboarding-page" style={{ '--brand-primary': themeColor, '--brand-dark': themeColor }}>
            <aside className="onboarding-brand-panel" aria-label="GeekSphere">
                <div className="onboarding-brand-mosaic" aria-hidden="true">
                    {STATIC_COVERS.slice(0, 16).map((cover, index) => (
                        <div key={`${cover}-${index}`} className="onboarding-mosaic-tile" style={{ backgroundImage: `url(${cover})` }} />
                    ))}
                </div>
                <div className="onboarding-brand-overlay" />
                <div className="onboarding-brand-copy"><h1>Te damos la<br /><span>bienvenida</span></h1></div>
                <div className="onboarding-brand-footer">
                    <span className="onboarding-brand-mark"><img src="/icons/logo.png" alt="" /></span>
                    <span className="onboarding-brand-name">GeekSphere</span>
                </div>
            </aside>

            <main className="onboarding-container">
                <div className="onboarding-card-topline">
                    <span>CONFIGURACIÓN DE PERFIL</span>
                    <span className="onboarding-step-count">0{step}<i>/</i>03</span>
                </div>

                <nav className="onboarding-stepper" aria-label={`Paso ${step} de 3`}>
                    {['Identidad', 'Apariencia', 'Favoritos'].map((label, index) => {
                        const stepNumber = index + 1
                        const state = stepNumber < step ? 'complete' : stepNumber === step ? 'current' : ''
                        return (
                            <div className={`onboarding-step-item ${state}`} key={label} aria-current={stepNumber === step ? 'step' : undefined}>
                                <span className="onboarding-step-dot">{stepNumber < step ? '✓' : `0${stepNumber}`}</span>
                                <span className="onboarding-step-label">{label}</span>
                            </div>
                        )
                    })}
                </nav>

                {error && <div className="onboarding-error">{error}</div>}

                <div key={step} className={`onboarding-stage onboarding-stage-${step}`}>
                {step === 1 && (
                    <div className="onboarding-step step-1">
                        <div className="form-group">
                            <label>Nombre a mostrar</label>
                            <input 
                                type="text" 
                                className="input"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Tu apodo genial"
                                maxLength={30}
                            />
                        </div>

                        <div className="form-group">
                            <label>Pronombres (Opcional)</label>
                            <input 
                                type="text" 
                                className="input"
                                value={pronouns}
                                onChange={(e) => setPronouns(e.target.value)}
                                placeholder="Ej: él/él, ella/ella, they/them"
                                maxLength={20}
                            />
                        </div>

                        <div className="form-group">
                            <div className="ep-bio-header onboarding-bio-header">
                                <label className="input-label" htmlFor="onboarding-bio">Biografía <span className="ep-optional">Markdown compatible</span></label>
                                <div className="ep-bio-tabs">
                                    <button type="button" className={`ep-bio-tab ${bioMode === 'write' ? 'active' : ''}`} onClick={() => setBioMode('write')}>Escribir</button>
                                    <button type="button" className={`ep-bio-tab ${bioMode === 'preview' ? 'active' : ''}`} onClick={() => setBioMode('preview')}>Vista previa</button>
                                </div>
                            </div>

                            {bioMode === 'write' ? (
                                <>
                                    <div className="ep-md-toolbar">
                                        <button type="button" className="ep-md-btn" title="Negrita" aria-label="Insertar negrita" onClick={() => insertMarkdown('**', '**')}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg></button>
                                        <button type="button" className="ep-md-btn" title="Cursiva" aria-label="Insertar cursiva" onClick={() => insertMarkdown('*', '*')}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg></button>
                                        <button type="button" className="ep-md-btn" title="Enlace" aria-label="Insertar enlace" onClick={() => insertMarkdown('[', '](url)')}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></button>
                                    </div>
                                    <textarea
                                        id="onboarding-bio"
                                        ref={textareaRef}
                                        className="ep-input ep-textarea onboarding-bio-editor"
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        placeholder="Cuéntanos sobre ti..."
                                        maxLength={500}
                                        rows={6}
                                    />
                                    <span className="ep-char-count">{bio.length}/500</span>
                                </>
                            ) : (
                                <div className="ep-bio-preview markdown-content onboarding-bio-preview">
                                    {bio
                                        ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{bio}</ReactMarkdown>
                                        : <span className="onboarding-bio-empty">Nada que previsualizar...</span>}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-step step-2">
                        <div className="onboarding-visuals">
                            <label 
                                className="banner-upload"
                                style={{ backgroundImage: bannerPreview ? `url(${bannerPreview})` : 'none', backgroundColor: 'var(--bg-tertiary)', cursor: 'pointer' }}
                            >
                                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} hidden />
                                <div className="upload-btn">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    Subir Banner
                                </div>
                            </label>
                            
                            <div className="avatar-upload-wrapper">
                                <label className="avatar-upload" style={{ backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none', backgroundColor: 'var(--brand-primary)', cursor: 'pointer', display: 'block' }}>
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} hidden />
                                    {!avatarPreview && (
                                        <div className="avatar-placeholder">
                                            {displayName.charAt(0).toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <div className="upload-icon-btn">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="ep-field onboarding-theme-field">
                            <label className="ep-label">Color del Tema</label>
                            <div className="ep-color-grid">
                                {THEME_COLORS.map(color => (
                                    <button
                                        type="button"
                                        key={color}
                                        className={`ep-color-btn ${themeColor === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setThemeColor(color)}
                                        title={color}
                                        aria-label={`Elegir color ${color}`}
                                    />
                                ))}
                                <div className="ep-custom-color">
                                    <input
                                        type="color"
                                        value={THEME_COLORS.includes(themeColor) ? '#ffffff' : themeColor}
                                        onChange={e => setThemeColor(e.target.value)}
                                        aria-label="Elegir un color personalizado"
                                    />
                                    <div
                                        className={`ep-color-btn ${!THEME_COLORS.includes(themeColor) ? 'selected' : ''}`}
                                        style={{
                                            backgroundColor: !THEME_COLORS.includes(themeColor) ? themeColor : 'transparent',
                                            border: `2px dashed ${!THEME_COLORS.includes(themeColor) ? 'transparent' : 'var(--border-subtle)'}`
                                        }}
                                    >
                                        {!THEME_COLORS.includes(themeColor) ? '' : '+'}
                                    </div>
                                </div>
                            </div>
                            <p className="ep-hint">Elige el color principal que destacará en tu perfil.</p>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="onboarding-step step-3">
                        <div className="ep-field onboarding-favorite-field">
                            <label className="ep-label">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12a10 10 0 0 1 10-10h0a10 10 0 0 1 10 10v0a10 10 0 0 1-10 10h0a10 10 0 0 1-10-10v0z"></path><path d="M12 2a10 10 0 0 0-10 10h20a10 10 0 0 0-10-10z"></path><path d="M6 12h4"></path><path d="M8 10v4"></path><path d="M15 11h.01"></path><path d="M17 13h.01"></path></svg>
                                    Juegos favoritos (Top 4)
                                </span>
                            </label>
                            <div className="ep-favorites-grid">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndGames}>
                                    <SortableContext items={favorite_games.map(game => game.id)} strategy={rectSortingStrategy}>
                                        {favorite_games.map((game, index) => (
                                            <SortableFavoriteItem
                                                key={game.id}
                                                item={game}
                                                onRemove={() => removeGame(index)}
                                                onClick={() => setActiveGameSlot(index)}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                                {Array.from({ length: 4 - favorite_games.length }).map((_, index) => {
                                    const slot = favorite_games.length + index
                                    return (
                                        <button key={`game-slot-${slot}`} type="button" className={`ep-empty-slot ${activeGameSlot === slot ? 'active' : ''}`} aria-label="Añadir juego favorito" onClick={() => { setGameSearchQuery(''); setGameSearchResults([]); setActiveGameSlot(slot) }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="ep-field onboarding-favorite-field">
                            <label className="ep-label">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                                    Animes favoritos (Top 4)
                                </span>
                            </label>
                            <div className="ep-favorites-grid">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndAnimes}>
                                    <SortableContext items={favorite_animes.map(anime => anime.id)} strategy={rectSortingStrategy}>
                                        {favorite_animes.map((anime, index) => (
                                            <SortableFavoriteItem
                                                key={anime.id}
                                                item={{ ...anime, name: anime.title }}
                                                onRemove={() => removeAnime(index)}
                                                onClick={() => setActiveAnimeSlot(index)}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                                {Array.from({ length: 4 - favorite_animes.length }).map((_, index) => {
                                    const slot = favorite_animes.length + index
                                    return (
                                        <button key={`anime-slot-${slot}`} type="button" className={`ep-empty-slot ${activeAnimeSlot === slot ? 'active' : ''}`} aria-label="Añadir anime favorito" onClick={() => { setAnimeSearchQuery(''); setAnimeSearchResults([]); setActiveAnimeSlot(slot) }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
                </div>

                <div className="onboarding-actions">
                    {step > 1 ? (
                        <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={loading}>
                            Atrás
                        </button>
                    ) : (
                        <button className="btn btn-ghost onboarding-exit" onClick={signOut} disabled={loading}>
                            Salir
                        </button>
                    )}
                    
                    <button className="btn btn-primary onboarding-next" onClick={handleNextStep} disabled={loading}>
                        {loading ? <LoadingSpinner size="sm" /> : (step === 3 ? 'Finalizar y entrar' : 'Continuar')}
                    </button>
                </div>
            </main>
            
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
                <div className="ep-overlay" style={{ zIndex: 9999 }} onClick={() => setActiveGameSlot(null)}>
                    <div className="ep-modal" style={{ width: 'min(400px, calc(100vw - 32px))', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                        <div className="ep-modal-header">
                            <h3 className="ep-modal-title">Elige un Juego</h3>
                            <button className="ep-close-btn" onClick={() => setActiveGameSlot(null)} type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
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
                <div className="ep-overlay" style={{ zIndex: 9999 }} onClick={() => setActiveAnimeSlot(null)}>
                    <div className="ep-modal" style={{ width: 'min(400px, calc(100vw - 32px))', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                        <div className="ep-modal-header">
                            <h3 className="ep-modal-title">Elige un Anime</h3>
                            <button className="ep-close-btn" onClick={() => setActiveAnimeSlot(null)} type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
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
    )
}

