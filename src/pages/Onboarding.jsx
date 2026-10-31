import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ImageCropperModal from '../components/ImageCropperModal'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableFavoriteItem } from '../components/profile/SortableFavoriteItem';

import './Auth.css'
import './Onboarding.css'

const DEFAULT_AVATAR = '/default-avatar.svg'
const DEFAULT_THEME_COLOR = '#14b8a6'

const getAgeFromBirthDate = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    const today = new Date()
    let age = today.getFullYear() - year
    const birthdayHasNotPassed = today.getMonth() + 1 < month ||
        (today.getMonth() + 1 === month && today.getDate() < day)
    if (birthdayHasNotPassed) age -= 1
    return age
}

const getBirthDateError = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return 'La fecha no es correcta.'

    const birthDate = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (
        birthDate.getFullYear() !== year ||
        birthDate.getMonth() !== month - 1 ||
        birthDate.getDate() !== day ||
        birthDate > today
    ) return 'La fecha no es correcta.'

    const age = getAgeFromBirthDate(value)
    if (age < 16) return 'Tienes que tener 16 años o más para acceder.'

    return ''
}

export default function Onboarding() {
    const { user, refreshProfile, signOut } = useAuth()
    const navigate = useNavigate()
    const onboardingStepStorageKey = user?.id ? `geeksphere-onboarding-step:${user.id}` : null
    const onboardingDraftStorageKey = user?.id ? `geeksphere-onboarding-draft:${user.id}` : null
    const [savedDraft] = useState(() => {
        if (!onboardingDraftStorageKey || typeof window === 'undefined') return {}
        try {
            return JSON.parse(window.sessionStorage.getItem(onboardingDraftStorageKey) || '{}')
        } catch {
            return {}
        }
    })
    
    const [step, setStep] = useState(() => {
        if (!onboardingStepStorageKey || typeof window === 'undefined') return 1
        try {
            return window.sessionStorage.getItem(onboardingStepStorageKey) === '2' ? 2 : 1
        } catch {
            return 1
        }
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [fieldErrors, setFieldErrors] = useState({})
    
    // Form State
    const [username, setUsername] = useState(savedDraft.username || '')
    const [usernameAvailability, setUsernameAvailability] = useState('idle')
    const [displayName, setDisplayName] = useState(savedDraft.displayName || '')
    // Collected in the onboarding UI; persistence will be added with the profile schema change.
    const [birthDate, setBirthDate] = useState(savedDraft.birthDate || '')
    const [showBirthDateConfirm, setShowBirthDateConfirm] = useState(false)
    const birthDateInputRef = useRef(null)
    // Files
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(DEFAULT_AVATAR)

    // Cropper State
    const [cropModal, setCropModal] = useState({ isOpen: false, type: null, src: null, aspect: 1 })

    // Favorites
    const [favorite_games, setFavoriteGames] = useState(savedDraft.favorite_games || [])
    const [favorite_animes, setFavoriteAnimes] = useState(savedDraft.favorite_animes || [])
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
        if (!onboardingStepStorageKey) return
        try {
            window.sessionStorage.setItem(onboardingStepStorageKey, String(step))
        } catch {}
    }, [onboardingStepStorageKey, step])

    useEffect(() => {
        if (!onboardingDraftStorageKey) return
        try {
            window.sessionStorage.setItem(onboardingDraftStorageKey, JSON.stringify({
                username,
                displayName,
                birthDate,
                favorite_games,
                favorite_animes
            }))
        } catch {}
    }, [onboardingDraftStorageKey, username, displayName, birthDate, favorite_games, favorite_animes])

    useEffect(() => {
        if (!user) return
        const metadata = user.user_metadata || {}
        const emailName = user.email?.split('@')[0] || ''
        const discordIdentity = user.identities?.find(identity => identity.provider === 'discord')
        const discordMetadata = discordIdentity?.identity_data || {}
        const twitchIdentity = user.identities?.find(identity => identity.provider === 'twitch')
        const twitchMetadata = twitchIdentity?.identity_data || {}
        const discordCustomClaims = discordMetadata.custom_claims || metadata.custom_claims || {}
        const isDiscordSignup = user.app_metadata?.provider === 'discord' || Boolean(discordIdentity)
        const isTwitchSignup = user.app_metadata?.provider === 'twitch' || Boolean(twitchIdentity)
        const discordUsername = discordMetadata.username || discordMetadata.user_name || discordMetadata.preferred_username ||
            metadata.username || metadata.user_name || metadata.preferred_username || metadata.full_name || metadata.name || emailName
        const twitchUsername = twitchMetadata.login || twitchMetadata.preferred_username || twitchMetadata.user_name || twitchMetadata.username ||
            metadata.login || metadata.preferred_username || metadata.user_name || metadata.username || metadata.name || metadata.full_name || emailName
        const sourceUsername = isDiscordSignup
            ? discordUsername
            : isTwitchSignup
                ? twitchUsername
                : metadata.username || metadata.preferred_username || metadata.user_name || emailName || metadata.name || metadata.full_name || ''
        const safeUsername = sourceUsername
            .split('#')[0]
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 20)
        const autoTwitchUsernameCandidates = [emailName, metadata.login, metadata.preferred_username, metadata.user_name, metadata.username, metadata.name, metadata.full_name]
            .filter(Boolean)
            .map(value => value.replace(/^@/, '').trim().toLowerCase())
        const savedUsernameIsOldAutoTwitchValue = isTwitchSignup && savedDraft.username &&
            autoTwitchUsernameCandidates.includes(savedDraft.username.replace(/^@/, '').trim().toLowerCase())
        if (!savedDraft.username || savedUsernameIsOldAutoTwitchValue) {
            setUsername(safeUsername.length >= 3 ? safeUsername : `geek${user.id.replace(/-/g, '').slice(0, 8)}`)
        }
        const discordDisplayName = discordMetadata.global_name || discordCustomClaims.global_name ||
            discordMetadata.display_name || metadata.global_name || metadata.custom_claims?.global_name ||
            metadata.display_name || metadata.full_name || metadata.name || metadata.username || emailName
        const previousDiscordNameSuggestions = [
            discordMetadata.username,
            discordMetadata.user_name,
            discordMetadata.full_name,
            discordMetadata.name,
            metadata.username,
            metadata.user_name,
            metadata.full_name,
            metadata.name
        ].filter(Boolean).map(value => value.split('#')[0].replace(/^@/, '').trim().toLowerCase())
        const savedDisplayNameIsOldDiscordUsername = isDiscordSignup && savedDraft.displayName &&
            previousDiscordNameSuggestions.includes(savedDraft.displayName.replace(/^@/, '').trim().toLowerCase())
        const autoTwitchDisplayNameCandidates = [emailName, metadata.name, metadata.full_name, metadata.display_name, metadata.username, metadata.user_name]
            .filter(Boolean)
            .map(value => value.replace(/^@/, '').trim().toLowerCase())
        const savedDisplayNameIsOldAutoTwitchValue = isTwitchSignup && savedDraft.displayName &&
            autoTwitchDisplayNameCandidates.includes(savedDraft.displayName.replace(/^@/, '').trim().toLowerCase())
        if (!savedDraft.displayName || savedDisplayNameIsOldAutoTwitchValue) setDisplayName(isDiscordSignup
            ? discordDisplayName
            : isTwitchSignup
                ? twitchUsername
                : metadata.full_name || metadata.name || metadata.display_name || metadata.username || emailName || '')
        else if (savedDisplayNameIsOldDiscordUsername && discordDisplayName) setDisplayName(discordDisplayName)
        setAvatarPreview(DEFAULT_AVATAR)
        setAvatarFile(null)
    }, [user, savedDraft.username, savedDraft.displayName])

    useEffect(() => {
        const normalizedUsername = username.trim().toLowerCase()
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
            setUsernameAvailability('idle')
            return
        }

        let isCurrent = true
        setUsernameAvailability('checking')
        const timeout = setTimeout(async () => {
            const { data, error: availabilityError } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', normalizedUsername)
                .maybeSingle()

            if (!isCurrent) return
            if (availabilityError) setUsernameAvailability('error')
            else setUsernameAvailability(data ? 'taken' : 'available')
        }, 350)

        return () => {
            isCurrent = false
            clearTimeout(timeout)
        }
    }, [username])

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
        setAvatarFile(croppedBlob)
        setAvatarPreview(croppedUrl)
        setCropModal({ isOpen: false, type: null, src: null, aspect: 1 })
    }

    const uploadImage = async (file, folder) => {
        const fileExt = file.name?.split('.').pop() || file.type?.split('/')[1] || 'jpg'
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `${folder}/${fileName}`
        
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { contentType: file.type || `image/${fileExt}` })
            
        if (uploadError) throw uploadError
        
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)
            
        return data.publicUrl
    }

    const checkUsernameAvailability = async () => {
        if (!username || username.length < 3) return false
        
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .maybeSingle()
        if (error) throw error
        return !data // True if not taken
    }

    const handleNextStep = async () => {
        setError(null)
        
        if (step === 1) {
            const nextFieldErrors = {
                username: !username.trim() ? 'Añade un nombre de usuario.' : '',
                displayName: !displayName.trim() ? 'Añade un nombre para mostrar.' : '',
                birthDate: !birthDate ? 'Añade tu fecha de nacimiento.' : ''
            }
            setFieldErrors(nextFieldErrors)
            if (Object.values(nextFieldErrors).some(Boolean)) return

            const birthDateError = getBirthDateError(birthDate)
            if (birthDateError) {
                setFieldErrors(current => ({ ...current, birthDate: birthDateError }))
                return
            }

            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                setFieldErrors(current => ({ ...current, username: 'Usa entre 3 y 20 letras, números o guiones bajos.' }))
                return
            }
            try {
                if (!(await checkUsernameAvailability())) {
                    setUsernameAvailability('taken')
                    return
                }
            } catch {
                setError('No se pudo comprobar el nombre de usuario. Inténtalo de nuevo.')
                return
            }
            
            setShowBirthDateConfirm(true)
        } else if (step === 2) {
            handleSubmit()
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        setError(null)
        
        try {
            let finalAvatarUrl = DEFAULT_AVATAR
            if (avatarFile) {
                let url = await uploadImage(avatarFile, 'avatars')
                finalAvatarUrl = url ? `${url}?t=${Date.now()}` : DEFAULT_AVATAR
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    username: username.toLowerCase(),
                    display_name: displayName,
                    bio: '',
                    avatar_url: finalAvatarUrl,
                    banner_url: null,
                    pronouns: '',
                    platforms: [],
                    theme_color: DEFAULT_THEME_COLOR,
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
            
            try {
                if (onboardingStepStorageKey) window.sessionStorage.removeItem(onboardingStepStorageKey)
                if (onboardingDraftStorageKey) window.sessionStorage.removeItem(onboardingDraftStorageKey)
            } catch {}
            await refreshProfile()
            navigate(`/profile/${username.toLowerCase()}`)
            
        } catch (err) {
            console.error('Onboarding Error:', err)
            setError(err.message || 'Hubo un error al guardar tu perfil. Inténtalo de nuevo.')
            setLoading(false)
        }
    }

    return (
        <div className="onboarding-page onboarding-in-layout" style={{ '--brand-primary': DEFAULT_THEME_COLOR, '--brand-dark': DEFAULT_THEME_COLOR }}>
            <div className="onboarding-content-shell">
                <header className="onboarding-hero">
                    <img src="/icons/logo.png" alt="GeekSphere" />
                    <h1>Solo un paso<br /><span>más</span></h1>
                </header>

                <section className="onboarding-container" aria-label="Completa tu perfil">
                    <div className="register-progress" aria-label={`Paso ${step} de 2`}>
                        <div className="register-progress-track"><span style={{ width: `${(step / 2) * 100}%` }} /></div>
                        <div className="register-progress-labels">
                            {['Identidad', 'Favoritos'].map((label, index) => (
                                <span className={index + 1 <= step ? 'active' : ''} key={label}>{label}</span>
                            ))}
                        </div>
                    </div>

                    {error && <div className="onboarding-error">{error}</div>}

                    <div key={step} className={`onboarding-stage onboarding-stage-${step}`}>
                {step === 1 && (
                    <div className="onboarding-step step-1 onboarding-identity-form auth-form">
                        <div className="onboarding-avatar-field">
                            <div className="onboarding-avatar-control">
                                <input id="onboarding-avatar" type="file" accept="image/*" onChange={event => handleFileChange(event, 'avatar')} hidden />
                                <label className="onboarding-avatar-photo" htmlFor="onboarding-avatar" title="Cambiar foto de perfil">
                                    <img src={avatarPreview || DEFAULT_AVATAR} alt="Cambiar foto de perfil" />
                                </label>
                                <label className="onboarding-avatar-add" htmlFor="onboarding-avatar" title="Cambiar foto de perfil" aria-label="Cambiar foto de perfil">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                                </label>
                            </div>
                            <span>Foto de perfil</span>
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="onboarding-username">Nombre de usuario</label>
                            <div className="onboarding-username-input">
                                <span aria-hidden="true">@</span>
                                <input
                                    id="onboarding-username"
                                    type="text"
                                    className="auth-input"
                                    value={username}
                                    onChange={event => {
                                        setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))
                                        setShowBirthDateConfirm(false)
                                        setFieldErrors(current => ({ ...current, username: '' }))
                                    }}
                                    placeholder="Ej.: mikasa_42"
                                    autoComplete="username"
                                    maxLength={20}
                                    aria-invalid={Boolean(fieldErrors.username)}
                                />
                            </div>
                            <div className="onboarding-username-preview" aria-live="polite">
                                <span className="onboarding-username-url">geeksphere.vercel.app/profile/</span>
                                <span className="onboarding-username-highlight">{username || 'tu_usuario'}</span>
                                {usernameAvailability !== 'idle' && (
                                    <span className={`onboarding-username-status is-${usernameAvailability}`}>
                                        {usernameAvailability === 'checking' && 'Comprobando...'}
                                        {usernameAvailability === 'taken' && 'En uso'}
                                        {usernameAvailability === 'available' && 'Es tuyo'}
                                        {usernameAvailability === 'error' && 'No se pudo comprobar'}
                                    </span>
                                )}
                            </div>
                            {fieldErrors.username && <span className="onboarding-field-error">{fieldErrors.username}</span>}
                        </div>
                        <div className="input-group">
                            <label className="input-label" htmlFor="onboarding-display-name">Nombre a mostrar</label>
                            <input 
                                id="onboarding-display-name"
                                type="text" 
                                className="auth-input"
                                value={displayName}
                                onChange={(e) => {
                                    setDisplayName(e.target.value)
                                    setShowBirthDateConfirm(false)
                                    setFieldErrors(current => ({ ...current, displayName: '' }))
                                }}
                                placeholder="Tu apodo genial"
                                maxLength={30}
                                aria-invalid={Boolean(fieldErrors.displayName)}
                            />
                            {fieldErrors.displayName && <span className="onboarding-field-error">{fieldErrors.displayName}</span>}
                        </div>
                        <div className="input-group">
                            <label className="input-label" htmlFor="onboarding-birth-date">Fecha de nacimiento</label>
                            <input
                                id="onboarding-birth-date"
                                type="date"
                                className="auth-input onboarding-date-input"
                                ref={birthDateInputRef}
                                value={birthDate}
                                onChange={event => {
                                    setBirthDate(event.target.value)
                                    setShowBirthDateConfirm(false)
                                    setFieldErrors(current => ({ ...current, birthDate: '' }))
                                }}
                                max={new Date().toISOString().slice(0, 10)}
                                aria-invalid={Boolean(fieldErrors.birthDate)}
                            />
                            {fieldErrors.birthDate
                                ? <span className="onboarding-field-error">{fieldErrors.birthDate}</span>
                                : <span className="onboarding-field-hint">No registramos tu fecha de nacimiento; es para comprobar que cumples con los requisitos de edad.</span>}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-step step-2">
                        <div className="ep-field onboarding-favorite-field">
                            <label className="ep-label onboarding-favorite-heading">
                                <span className="onboarding-favorite-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12a10 10 0 0 1 10-10h0a10 10 0 0 1 10 10v0a10 10 0 0 1-10 10h0a10 10 0 0 1-10-10v0z"></path><path d="M12 2a10 10 0 0 0-10 10h20a10 10 0 0 0-10-10z"></path><path d="M6 12h4"></path><path d="M8 10v4"></path><path d="M15 11h.01"></path><path d="M17 13h.01"></path></svg>
                                    Juegos favoritos (Top 4)
                                </span>
                                <span className="onboarding-favorite-count">{favorite_games.length}/4</span>
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
                                        <button key={`game-slot-${slot}`} type="button" className={`ep-empty-slot onboarding-favorite-empty ${activeGameSlot === slot ? 'active' : ''}`} aria-label="Añadir juego favorito" onClick={() => { setGameSearchQuery(''); setGameSearchResults([]); setActiveGameSlot(slot) }}>
                                            <span className="onboarding-favorite-add-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></span>
                                            <span className="onboarding-favorite-add-label">Añadir juego</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="ep-field onboarding-favorite-field">
                            <label className="ep-label onboarding-favorite-heading">
                                <span className="onboarding-favorite-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                                    Animes favoritos (Top 4)
                                </span>
                                <span className="onboarding-favorite-count">{favorite_animes.length}/4</span>
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
                                        <button key={`anime-slot-${slot}`} type="button" className={`ep-empty-slot onboarding-favorite-empty ${activeAnimeSlot === slot ? 'active' : ''}`} aria-label="Añadir anime favorito" onClick={() => { setAnimeSearchQuery(''); setAnimeSearchResults([]); setActiveAnimeSlot(slot) }}>
                                            <span className="onboarding-favorite-add-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></span>
                                            <span className="onboarding-favorite-add-label">Añadir anime</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
                </div>

                    <div className="onboarding-actions">
                        <div className="onboarding-action-main">
                            <button className="btn btn-primary onboarding-next" onClick={handleNextStep} disabled={loading}>
                                {loading ? <LoadingSpinner size="sm" /> : (step === 2 ? 'Finalizar y entrar' : 'Siguiente')}
                            </button>
                        </div>
                        {step === 1 ? (
                            <button type="button" className="onboarding-signout" onClick={signOut} disabled={loading}>Cerrar sesión</button>
                        ) : (
                            <button type="button" className="onboarding-signout" onClick={() => setStep(step - 1)} disabled={loading}>Atrás</button>
                        )}
                    </div>
                </section>
            </div>

            {showBirthDateConfirm && createPortal(
                <div className="onboarding-age-overlay">
                    <section className="onboarding-age-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-age-title" aria-describedby="onboarding-age-description">
                        <div className="onboarding-age-dialog-heading">
                            <h2 id="onboarding-age-title">¿Estás seguro?</h2>
                            <button type="button" className="onboarding-age-close" aria-label="Corregir fecha de nacimiento" onClick={() => {
                                setShowBirthDateConfirm(false)
                                birthDateInputRef.current?.focus()
                            }}>
                                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p id="onboarding-age-description">Según tu fecha de nacimiento, tienes {getAgeFromBirthDate(birthDate)} años.</p>
                        <div className="onboarding-age-dialog-actions">
                            <button type="button" className="onboarding-age-pill onboarding-age-pill-secondary" onClick={() => {
                                setShowBirthDateConfirm(false)
                                birthDateInputRef.current?.focus()
                            }}>Corregir</button>
                            <button type="button" className="onboarding-age-pill onboarding-age-pill-primary" onClick={() => {
                                setShowBirthDateConfirm(false)
                                setStep(2)
                            }}>Es correcto</button>
                        </div>
                    </section>
                </div>,
                document.body
            )}
            
            {cropModal.isOpen && (
                <ImageCropperModal 
                    imageSrc={cropModal.src}
                    aspect={cropModal.aspect}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setCropModal({ isOpen: false, type: null, src: null, aspect: 1 })}
                />
            )}

            {/* Top 4 Modals */}
            {activeGameSlot !== null && createPortal((
                <div className="ep-overlay" style={{ zIndex: 9999 }} onClick={() => setActiveGameSlot(null)}>
                    <div className="ep-modal onboarding-picker-modal" onClick={e => e.stopPropagation()}>
                        <div className="ep-modal-header">
                            <h3 className="ep-modal-title">Elige un juego</h3>
                            <button className="ep-close-btn" onClick={() => setActiveGameSlot(null)} type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="ep-modal-body onboarding-picker-body">
                            <div className="onboarding-picker-search">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
                                <input
                                    type="text"
                                    className="ep-input onboarding-picker-input"
                                    placeholder="Buscar juego..."
                                    value={gameSearchQuery}
                                    onChange={e => setGameSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {isSearchingGames && <p className="ep-searching" style={{ marginTop: '12px' }}>Buscando...</p>}
                            {gameSearchQuery.length < 3 && <p className="onboarding-picker-hint">Escribe al menos 3 caracteres para buscar.</p>}
                            {gameSearchResults.length > 0 && (
                                <div className="ep-search-results onboarding-picker-results">
                                    {gameSearchResults.slice(0, 5).map(game => (
                                        <button key={game.id} type="button" className="ep-search-result" onClick={() => selectGame(game)}>
                                            {(game.cover_url || game.image_url) && <img src={game.cover_url || game.image_url} alt="" className="square-cover" />}
                                            <span className="ep-search-result-name">{game.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {gameSearchQuery.length >= 3 && !isSearchingGames && gameSearchResults.length === 0 && <p className="onboarding-picker-hint">No encontramos juegos con ese nombre.</p>}
                        </div>
                    </div>
                </div>
            ), document.body)}
            {activeAnimeSlot !== null && createPortal((
                <div className="ep-overlay" style={{ zIndex: 9999 }} onClick={() => setActiveAnimeSlot(null)}>
                    <div className="ep-modal onboarding-picker-modal" onClick={e => e.stopPropagation()}>
                        <div className="ep-modal-header">
                            <h3 className="ep-modal-title">Elige un anime</h3>
                            <button className="ep-close-btn" onClick={() => setActiveAnimeSlot(null)} type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="ep-modal-body onboarding-picker-body">
                            <div className="onboarding-picker-search">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
                                <input
                                    type="text"
                                    className="ep-input onboarding-picker-input"
                                    placeholder="Buscar anime..."
                                    value={animeSearchQuery}
                                    onChange={e => setAnimeSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {isSearchingAnime && <p className="ep-searching" style={{ marginTop: '12px' }}>Buscando...</p>}
                            {animeSearchQuery.length < 3 && <p className="onboarding-picker-hint">Escribe al menos 3 caracteres para buscar.</p>}
                            {animeSearchResults.length > 0 && (
                                <div className="ep-search-results onboarding-picker-results">
                                    {animeSearchResults.slice(0, 5).map(anime => (
                                        <button key={anime.id} type="button" className="ep-search-result" onClick={() => selectAnime(anime)}>
                                            {(anime.cover_url || anime.image_url) && <img src={anime.cover_url || anime.image_url} alt="" className="square-cover" />}
                                            <span className="ep-search-result-name">{anime.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {animeSearchQuery.length >= 3 && !isSearchingAnime && animeSearchResults.length === 0 && <p className="onboarding-picker-hint">No encontramos animes con ese nombre.</p>}
                        </div>
                    </div>
                </div>
            ), document.body)}
        </div>
    )
}

