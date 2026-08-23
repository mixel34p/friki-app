import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ImageCropperModal from '../components/ImageCropperModal'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableFavoriteItem } from '../components/profile/SortableFavoriteItem';

import './Onboarding.css'

export default function Onboarding() {
    const { user, refreshProfile, signOut } = useAuth()
    const navigate = useNavigate()
    
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    
    // Form State
    const [displayName, setDisplayName] = useState('')
    const [bio, setBio] = useState('')
    const [pronouns, setPronouns] = useState('')
    const [platforms, setPlatforms] = useState([])
    
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
        if (favorite_games.length >= 4) return
        setFavoriteGames(prev => [...prev, { id: game.id, name: game.name, cover_url: game.cover_url || game.image_url }])
        setGameSearchQuery(''); setGameSearchResults([])
    }
    const removeGame = (index) => setFavoriteGames(prev => { const n = [...prev]; n.splice(index,1); return n; })

    const selectAnime = (anime) => {
        if (favorite_animes.length >= 4) return
        setFavoriteAnimes(prev => [...prev, { id: anime.id, title: anime.title, cover_url: anime.cover_url || anime.image_url }])
        setAnimeSearchQuery(''); setAnimeSearchResults([])
    }
    const removeAnime = (index) => setFavoriteAnimes(prev => { const n = [...prev]; n.splice(index,1); return n; })

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
                    platforms,
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
        <div className="onboarding-page" style={{ '--theme': '#14b8a6' }}>
            <div className="onboarding-container">
                <div className="onboarding-header">
                    <h2>Bienvenido a GeekSphere</h2>
                    <p>Vamos a configurar tu perfil de usuario antes de entrar.</p>
                </div>
                
                <div className="onboarding-progress">
                    <div className={`progress-bar ${step >= 1 ? 'active' : ''}`}></div>
                    <div className={`progress-bar ${step >= 2 ? 'active' : ''}`}></div>
                </div>

                {error && <div className="onboarding-error">{error}</div>}

                {step === 1 && (
                    <div className="onboarding-step step-1 fade-in">
                        <h3>Tu Identidad</h3>
                        
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

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
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

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label>Biografía (Opcional)</label>
                            <textarea 
                                className="input" 
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Unas palabras sobre ti..."
                                rows={4}
                                maxLength={500}
                            ></textarea>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {bio.length}/500
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-step step-2 fade-in">
                        <h3>Personaliza tu Perfil</h3>
                        
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
                                <label className="avatar-upload" style={{ backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none', backgroundColor: 'var(--theme)', cursor: 'pointer', display: 'block' }}>
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

                        <div className="form-group" style={{ marginTop: '3rem' }}>
                            <label>Plataformas de Juego</label>
                            <div className="platforms-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                {['PC', 'PlayStation', 'Xbox', 'Nintendo', 'Mobile'].map(platform => {
                                    const isSelected = platforms.includes(platform)
                                    return (
                                        <button
                                            key={platform}
                                            className={`platform-badge ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setPlatforms(prev => 
                                                prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
                                            )}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                                                background: isSelected ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
                                                color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontFamily: 'var(--font-body)',
                                                fontWeight: isSelected ? '600' : '400'
                                            }}
                                        >
                                            {platform}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="onboarding-step animate-slide-up">
                        <div className="step-header">
                            <h3>Tus Favoritos (Opcional)</h3>
                            <p>¡Muéstrale al mundo tus 4 juegos y animes favoritos! Podrás cambiarlos más tarde.</p>
                        </div>

                        {/* Favorite Games */}
                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12a10 10 0 0 1 10-10h0a10 10 0 0 1 10 10v0a10 10 0 0 1-10 10h0a10 10 0 0 1-10-10v0z"></path><path d="M12 2a10 10 0 0 0-10 10h20a10 10 0 0 0-10-10z"></path><path d="M6 12h4"></path><path d="M8 10v4"></path><path d="M15 11h.01"></path><path d="M17 13h.01"></path></svg>
                                Juegos favoritos (Top 4)
                            </label>
                            
                            <div className="ep-favorites-grid" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {favorite_games.map((g, idx) => (
                                    <div key={idx} className="ep-favorite-item" style={{ position: 'relative', aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                        {g.cover_url && <img src={g.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        <button onClick={() => removeGame(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {favorite_games.length < 4 && (
                                <div style={{ marginTop: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="Buscar juego..."
                                        value={gameSearchQuery}
                                        onChange={e => setGameSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    />
                                    {isSearchingGames && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Buscando...</p>}
                                    {gameSearchResults.length > 0 && (
                                        <div style={{ marginTop: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                                            {gameSearchResults.slice(0, 5).map(game => (
                                                <button key={game.id} onClick={() => selectGame(game)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                                                    {(game.cover_url || game.image_url) && <img src={game.cover_url || game.image_url} alt="" style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} />}
                                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{game.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Favorite Anime */}
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                                Animes favoritos (Top 4)
                            </label>
                            
                            <div className="ep-favorites-grid" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {favorite_animes.map((a, idx) => (
                                    <div key={idx} className="ep-favorite-item" style={{ position: 'relative', aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                        {a.cover_url && <img src={a.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        <button onClick={() => removeAnime(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {favorite_animes.length < 4 && (
                                <div style={{ marginTop: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="Buscar anime..."
                                        value={animeSearchQuery}
                                        onChange={e => setAnimeSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    />
                                    {isSearchingAnime && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Buscando...</p>}
                                    {animeSearchResults.length > 0 && (
                                        <div style={{ marginTop: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                                            {animeSearchResults.slice(0, 5).map(anime => (
                                                <button key={anime.id} onClick={() => selectAnime(anime)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                                                    {(anime.cover_url || anime.image_url) && <img src={anime.cover_url || anime.image_url} alt="" style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} />}
                                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{anime.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="onboarding-actions">
                    {step > 1 ? (
                        <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={loading}>
                            Atrás
                        </button>
                    ) : (
                        <button className="btn btn-ghost" onClick={signOut} disabled={loading} style={{ color: 'var(--error)' }}>
                            Cancelar y Salir
                        </button>
                    )}
                    
                    <button className="btn btn-primary" onClick={handleNextStep} disabled={loading} style={{ backgroundColor: 'var(--theme)', borderColor: 'var(--theme)', color: '#000' }}>
                        {loading ? <LoadingSpinner size="sm" /> : (step === 3 ? 'Finalizar y Entrar' : 'Siguiente')}
                    </button>
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
                <div className="ep-overlay" style={{ zIndex: 9999 }} onClick={() => setActiveGameSlot(null)}>
                    <div className="ep-modal" style={{ width: '400px', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
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
                    <div className="ep-modal" style={{ width: '400px', height: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
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
