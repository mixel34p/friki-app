import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { deleteWorkLog, getWorkLog, logWork } from '../lib/libraryService'
import { getAccentTextColor } from '../lib/colorContrast'
import { useToast } from '../components/Toast'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import './SharePage.css'

const PLACEHOLDERS = [
  '¿Qué estás viendo ahora?',
  '¿Qué juego recomiendas?',
  '¿Tu anime favorito?',
  'Comparte una recomendación…',
]
const POST_LIMIT = 2000
const INPUT_LIMIT = 2100
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''

const TOOLS = [
  { id: 'image', label: 'Añadir imagen', icon: <><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></> },
  { id: 'gif', label: 'Añadir GIF', icon: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9.5a2.5 2.5 0 1 0 0 5h1.5v-1.7H10M15 9.5v5M18 9.5h-2v5"/></> },
  { id: 'poll', label: 'Crear encuesta', icon: <><path d="M4 19.5h16M6 16V9M12 16V4M18 16v-4"/><circle cx="6" cy="7" r="1"/><circle cx="12" cy="2.5" r="1"/><circle cx="18" cy="10" r="1"/></> },
  { id: 'emoji', label: 'Añadir reacción', icon: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></> },
]

export default function SharePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { toast } = useToast()
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageGridRef = useRef(null)
  const imagesRef = useRef([])
  const [text, setText] = useState('')
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)])
  const [selectedTool, setSelectedTool] = useState(null)
  const [toolHint, setToolHint] = useState('')
  const [images, setImages] = useState([])
  const [gifOpen, setGifOpen] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const [warningsOpen, setWarningsOpen] = useState(false)
  const [sensitive, setSensitive] = useState(false)
  const [spoilerEnabled, setSpoilerEnabled] = useState(false)
  const [spoilerWork, setSpoilerWork] = useState(null)
  const [workType, setWorkType] = useState('game')
  const [workQuery, setWorkQuery] = useState('')
  const [workResults, setWorkResults] = useState([])
  const [workLoading, setWorkLoading] = useState(false)
  const [registerCategory, setRegisterCategory] = useState('game')
  const [registerQuery, setRegisterQuery] = useState('')
  const [registerResults, setRegisterResults] = useState([])
  const [registerLoading, setRegisterLoading] = useState(false)
  const [recommended, setRecommended] = useState([])
  const [recommendedLoading, setRecommendedLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewDate, setReviewDate] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [loadingExistingReview, setLoadingExistingReview] = useState(false)
  const [existingWorkEntry, setExistingWorkEntry] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({})
  const [previewLayout, setPreviewLayout] = useState({ width: 0, viewportHeight: 0, isMobile: false })
  const isOverLimit = text.length > POST_LIMIT
  const overage = Math.max(0, text.length - POST_LIMIT)
  const canPost = (Boolean(text.trim()) || images.length > 0) && !isOverLimit

  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => {
    const textarea = textareaRef.current
    if (!selectedReview || !textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [selectedReview, text])
  useEffect(() => () => imagesRef.current.forEach(image => {
    if (image.localPreviewUrl) URL.revokeObjectURL(image.previewUrl)
  }), [])
  useEffect(() => {
    if (!images.length || !imageGridRef.current) return undefined
    const grid = imageGridRef.current
    const measure = () => setPreviewLayout({
      width: grid.getBoundingClientRect().width,
      viewportHeight: window.innerHeight,
      isMobile: window.innerWidth <= 620,
    })
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(grid)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [images.length])

  useEffect(() => {
    if (!gifOpen) return undefined
    if (!GIPHY_API_KEY) {
      setGifError('El buscador de GIFs no está configurado.')
      setGifLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const query = gifQuery.trim().slice(0, 50)
    const endpoint = query ? 'search' : 'trending'
    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      limit: '24',
      rating: 'pg-13',
      bundle: 'messaging_non_clips',
      lang: 'es',
    })
    if (query) params.set('q', query)
    setGifLoading(true)
    setGifError('')
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || payload?.meta?.status !== 200) {
          throw new Error(payload?.meta?.msg || 'No se pudieron cargar los GIFs.')
        }
        setGifResults(payload.data || [])
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al buscar GIFs en GIPHY:', error)
          setGifError('No se pudieron cargar los GIFs. Inténtalo de nuevo.')
          setGifResults([])
        }
      } finally {
        if (!controller.signal.aborted) setGifLoading(false)
      }
    }, query ? 320 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [gifOpen, gifQuery])

  useEffect(() => {
    if (!spoilerEnabled || spoilerWork || !workQuery.trim() || workQuery.trim().length < 2) {
      setWorkResults([])
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setWorkLoading(true)
      try {
        const results = workType === 'game'
          ? await searchGames(workQuery.trim(), 8, { signal: controller.signal })
          : await searchAnime(workQuery.trim(), 8, { signal: controller.signal })
        if (!controller.signal.aborted) setWorkResults(results || [])
      } catch (error) {
        if (error.name !== 'AbortError') setWorkResults([])
      } finally {
        if (!controller.signal.aborted) setWorkLoading(false)
      }
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [spoilerEnabled, spoilerWork, workQuery, workType])

  useEffect(() => {
    let cancelled = false
    const loadPopular = async () => {
      setRecommendedLoading(true)
      try {
        const { data: entries, error } = await supabase.from('library_entries').select('work_id, work_type').eq('work_type', registerCategory).limit(10000)
        if (error) throw error
        const counts = new Map()
        ;(entries || []).forEach(entry => counts.set(String(entry.work_id), (counts.get(String(entry.work_id)) || 0) + 1))
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        if (!top.length) { if (!cancelled) setRecommended([]); return }
        const table = registerCategory === 'game' ? 'games' : 'anime'
        const { data: works, error: worksError } = await supabase.from(table).select('*').in('id', top.map(([id]) => id))
        if (worksError) throw worksError
        const byId = new Map((works || []).map(work => [String(work.id), work]))
        const rows = top.map(([id, count]) => {
          const work = byId.get(id)
          if (!work) return null
          return { ...work, title: work.name || work.title, image: work.cover_url || work.image_url, count, type: registerCategory }
        }).filter(Boolean)
        if (!cancelled) setRecommended(rows)
      } catch (error) {
        console.error('No se pudieron cargar las obras más registradas:', error)
        if (!cancelled) setRecommended([])
      } finally { if (!cancelled) setRecommendedLoading(false) }
    }
    loadPopular()
    return () => { cancelled = true }
  }, [registerCategory])

  useEffect(() => {
    const query = registerQuery.trim()
    if (selectedReview || query.length < 2) { setRegisterResults([]); return undefined }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setRegisterLoading(true)
      try {
        const results = registerCategory === 'game'
          ? await searchGames(query, 20, { signal: controller.signal })
          : await searchAnime(query, 20, { signal: controller.signal })
        if (!controller.signal.aborted) setRegisterResults((results || []).map(work => ({ ...work, title: work.name || work.title, image: work.cover_url || work.image_url, type: registerCategory })))
      } catch (error) { if (error.name !== 'AbortError') setRegisterResults([]) }
      finally { if (!controller.signal.aborted) setRegisterLoading(false) }
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [registerCategory, registerQuery, selectedReview])

  const accent = profile?.theme_color || '#14b8a6'
  const avatar = profile?.avatar_url || profile?.profile_picture || ''
  const displayName = profile?.display_name || profile?.username || 'Usuario'
  const avatarBackground = avatar ? `url("${avatar}")` : 'none'

  const handleTextChange = event => {
    const value = event.target.value.slice(0, INPUT_LIMIT)
    setText(value)
    const textarea = textareaRef.current
    if (textarea) {
      const pageScrollY = window.scrollY
      requestAnimationFrame(() => {
        if (!textarea.isConnected) return
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
        if (Math.abs(window.scrollY - pageScrollY) > 1) {
          const root = document.documentElement
          const previousBehavior = root.style.scrollBehavior
          root.style.scrollBehavior = 'auto'
          window.scrollTo(0, pageScrollY)
          root.style.scrollBehavior = previousBehavior
        }
      })
    }
  }

  const handleImageSelection = event => {
    const pickedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    if (!pickedFiles.length) return

    const validFiles = pickedFiles.filter(file => file.type.startsWith('image/'))

    const slots = Math.max(0, 3 - images.length)
    const selectedFiles = validFiles.slice(0, slots)
    if (validFiles.length > slots) {
      toast({ title: 'Máximo 3 imágenes', message: 'Quita una imagen para poder añadir otra.', type: 'warning' })
    }
    if (!selectedFiles.length) return

    const pending = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      localPreviewUrl: true,
      name: file.name,
    }))
    setImages(current => [...current, ...pending].slice(0, 3))
    setSelectedTool('image')
    setGifOpen(false)
    setToolHint('')
  }

  const removeImage = id => {
    setImages(current => {
      const image = current.find(item => item.id === id)
      if (image?.localPreviewUrl) URL.revokeObjectURL(image.previewUrl)
      return current.filter(item => item.id !== id)
    })
    setImageDimensions(current => {
      const remaining = { ...current }
      delete remaining[id]
      return remaining
    })
  }

  const handleSelectGif = gif => {
    if (images.length >= 3) {
      toast({ title: 'Máximo 3 imágenes', message: 'Quita una imagen para poder añadir otra.', type: 'warning' })
      return
    }
    const preview = gif.images?.fixed_width_small?.webp || gif.images?.fixed_width_small?.url || gif.images?.preview_gif?.url || gif.images?.original?.url
    const mediaUrl = gif.images?.original?.url || gif.images?.downsized_large?.url || gif.images?.downsized?.url || preview
    if (!preview || !mediaUrl) return
    const id = `giphy-${gif.id}-${Date.now()}`
    setImages(current => current.length < 3 ? [...current, {
      id,
      name: gif.title || 'GIF de GIPHY',
      previewUrl: preview,
      remoteUrl: mediaUrl,
      source: 'giphy',
      localPreviewUrl: false,
    }] : current)
    setGifOpen(false)
    setGifQuery('')
    setSelectedTool(null)
    setToolHint('')
  }

  const handlePreviewImageLoad = (id, event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (naturalWidth && naturalHeight) {
      setImageDimensions(current => ({ ...current, [id]: { width: naturalWidth, height: naturalHeight } }))
    }
  }

  const getPreviewImageStyle = image => {
    if (images.length !== 1 || !imageDimensions[image.id] || !previewLayout.width) return undefined
    const { width, height } = imageDimensions[image.id]
    const maxWidth = Math.max(1, Math.min(320, previewLayout.width - 72))
    const aspectRatio = width / height
    const isExtremelyTall = height > width * 1.7
    if (!isExtremelyTall) {
      const displayWidth = Math.min(maxWidth, Math.max(width, Math.min(260, maxWidth)))
      return { width: `${Math.round(displayWidth)}px`, height: `${Math.round(displayWidth / aspectRatio)}px`, objectFit: 'contain' }
    }

    const maxHeight = Math.min(360, previewLayout.viewportHeight * (previewLayout.isMobile ? .62 : .67))
    const previewHeight = Math.min(maxHeight, maxWidth / aspectRatio)
    return {
      width: `${Math.round(maxWidth)}px`,
      height: `${Math.round(previewHeight)}px`,
      objectFit: 'cover',
    }
  }

  const chooseTool = tool => {
    if (tool.id === 'image') {
      setSelectedTool('image')
      setGifOpen(false)
      setToolHint('')
      fileInputRef.current?.click()
      return
    }
    if (tool.id === 'gif') {
      const shouldOpen = !gifOpen
      setGifOpen(shouldOpen)
      setSelectedTool(shouldOpen ? 'gif' : null)
      setToolHint('')
      return
    }
    setGifOpen(false)
    setSelectedTool(current => current === tool.id ? null : tool.id)
    setToolHint(`${tool.label} estará disponible en una siguiente fase.`)
  }

  const handlePost = () => {
    if (isOverLimit) return
    if (selectedReview) {
      if (!user?.id) return
      setReviewSubmitting(true)
      logWork(user.id, selectedReview.id, selectedReview.type, {
        rating: reviewRating || null,
        review_text: text,
        contains_spoiler: spoilerEnabled,
        finished_date: reviewDate || null,
      }).then(savedEntry => {
        const hasReview = Boolean(text.trim())
        toast({
          title: hasReview ? 'Reseña publicada' : 'Obra registrada',
          message: hasReview ? 'Tu reseña ya está lista para compartir.' : `${selectedReview.title} se añadió a tu perfil.`,
          type: 'success',
        })
        setSelectedReview(null); setText(''); setReviewRating(0); setReviewDate(''); setSpoilerEnabled(false)
        if (textareaRef.current) textareaRef.current.style.height = ''
        if (hasReview && savedEntry?.id) navigate(`/reviews/${savedEntry.id}`)
        else navigate(profile?.username ? `/profile/${profile.username}` : '/profile')
      }).catch(error => {
        console.error('Error al guardar la reseña:', error)
        toast({ title: 'No se pudo guardar', message: 'Inténtalo de nuevo.', type: 'error' })
      }).finally(() => setReviewSubmitting(false))
      return
    }
    if (!text.trim() && images.length === 0) {
      toast({ title: 'Tu post está vacío', message: 'Escribe algo antes de continuar.', type: 'warning' })
      return
    }
    toast({ title: 'Compositor preparado', message: 'La publicación se conectará en la siguiente fase.', type: 'info' })
  }

  const selectWorkForReview = async work => {
    setSelectedReview(work)
    setExistingWorkEntry(null)
    setText('')
    setReviewRating(0)
    setReviewDate('')
    setSpoilerEnabled(false)
    setSensitive(false)
    setImages([])
    setGifOpen(false)
    if (!user?.id) return
    setLoadingExistingReview(true)
    try {
      const existing = await getWorkLog(user.id, work.id, work.type)
      if (!existing) return
      setExistingWorkEntry(existing)
      setText(existing.review_text || '')
      setReviewRating(Number(existing.rating) || 0)
      setReviewDate(existing.finished_date || '')
      setSpoilerEnabled(Boolean(existing.contains_spoiler))
    } catch (error) {
      console.error('No se pudo cargar la reseña anterior:', error)
    } finally { setLoadingExistingReview(false) }
  }

  const handleDeleteEntry = async () => {
    if (!user?.id || !selectedReview || !existingWorkEntry || deletingEntry) return
    setDeletingEntry(true)
    try {
      await deleteWorkLog(user.id, selectedReview.id, selectedReview.type)
      setExistingWorkEntry(null)
      setSelectedReview(null)
      setDeleteConfirmOpen(false)
      setText('')
      setReviewRating(0)
      setReviewDate('')
      setSpoilerEnabled(false)
      if (textareaRef.current) textareaRef.current.style.height = ''
      toast({ title: 'Entrada eliminada', message: 'La obra se ha quitado de tu diario.', type: 'success' })
    } catch (error) {
      console.error('No se pudo eliminar la entrada:', error)
      toast({ title: 'No se pudo eliminar', message: 'Inténtalo de nuevo.', type: 'error' })
    } finally { setDeletingEntry(false) }
  }

  useEffect(() => {
    const work = location.state?.reviewWork
    if (!work?.id || !work?.type) return
    selectWorkForReview({ ...work, title: work.title || 'Obra' })
    navigate(location.pathname, { replace: true, state: null })
  }, [location.key])

  return (
    <section
      className={`share-page${selectedReview ? ' has-selected-review' : ''}`}
      style={{
        '--share-accent': accent,
        '--share-accent-ink': getAccentTextColor(accent),
        '--share-avatar-backdrop': avatarBackground,
      }}
    >
      <div key={selectedReview?.id || 'default-share-backdrop'} className={`share-selected-backdrop${selectedReview?.image ? ' is-visible' : ''}`} style={{ backgroundImage: selectedReview?.image ? `url("${selectedReview.image}")` : 'none' }} aria-hidden="true" />
      <header className="share-page-heading">
        <h1>Compartir</h1>
      </header>

      <article className={`share-composer${isOverLimit ? ' is-over-limit' : ''}${selectedReview ? ' is-review-composer' : ''}`} aria-label={selectedReview ? 'Escribir reseña' : 'Crear un post'}>
        <div className={`share-composer-entry${images.length ? ' has-images' : ''}${selectedReview ? ' has-review-work' : ''}`}>
          {selectedReview ? <div className="share-review-identity">
            {selectedReview.image && <div className="share-review-cover"><img src={selectedReview.image} alt={selectedReview.title} /></div>}
          </div> : <span className="share-composer-avatar" aria-label={`Foto de ${displayName}`}>
            {avatar ? <img src={avatar} alt="" /> : <span>{displayName.slice(0, 1).toLocaleUpperCase()}</span>}
          </span>}
          <div className="share-composer-input">
            <span className="share-sr-only">{selectedReview ? 'Escribe tu reseña' : 'Escribe tu post'}</span>
            {selectedReview && <h2 className="share-review-work-title">{selectedReview.title}</h2>}
            {selectedReview && <div className="share-review-rating" role="group" aria-label="Valoración">
              {Array.from({ length: 5 }, (_, index) => {
                const fill = Math.max(0, Math.min(1, reviewRating - index))
                const gradientId = `share-review-star-${selectedReview.id}-${index}`
                return <button key={index} type="button" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setReviewRating(index + (event.clientX - rect.left < rect.width / 2 ? .5 : 1)) }} aria-label={`${index + .5} o ${index + 1} estrellas`} aria-pressed={fill > 0}><svg viewBox="0 0 24 24" aria-hidden="true">{fill > 0 && fill < 1 && <defs><linearGradient id={gradientId}><stop offset={`${fill * 100}%`} stopColor="var(--share-accent)"/><stop offset={`${fill * 100}%`} stopColor="transparent"/></linearGradient></defs>}<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={fill === 1 ? 'var(--share-accent)' : fill > 0 ? `url(#${gradientId})` : 'none'} /></svg></button>
              })}
              <strong>{reviewRating > 0 ? reviewRating.toFixed(1) : '—'}</strong>
            </div>}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              maxLength={INPUT_LIMIT}
              placeholder={selectedReview ? (loadingExistingReview ? 'Cargando tu reseña…' : `Tu reseña sobre ${selectedReview.title}… (opcional)`) : placeholder}
              rows={3}
              aria-label={selectedReview ? 'Escribe tu reseña' : 'Escribe tu post'}
              aria-describedby="share-character-count"
            />
            {selectedReview && existingWorkEntry && <button className="share-review-delete-entry" type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={deletingEntry}>Eliminar entrada</button>}
          </div>
        </div>

        {!selectedReview && images.length > 0 && (
          <div ref={imageGridRef} className={`share-image-preview-grid count-${images.length}`} aria-label={`${images.length} imágenes adjuntas`}>
            {images.map(image => (
              <figure className="share-image-preview-item" key={image.id}>
                <img src={image.previewUrl} alt={image.name || ''} style={getPreviewImageStyle(image)} onLoad={event => handlePreviewImageLoad(image.id, event)} />
                <button className="share-image-remove" type="button" onClick={() => removeImage(image.id)} aria-label={`Quitar ${image.name || 'GIF'}`} title="Quitar imagen">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </figure>
            ))}
            {images.length < 3 && (
              <button className="share-image-add-tile" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Añadir otra imagen">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}
          </div>
        )}

        {warningsOpen && !selectedReview && <div className="share-warning-row">
          <button className={`share-warning-chip${spoilerEnabled ? ' is-active' : ''}`} type="button" aria-pressed={spoilerEnabled} onClick={() => { setSpoilerEnabled(value => !value); if (spoilerEnabled) setSpoilerWork(null) }}>Spoiler de una obra</button>
          <button className={`share-warning-chip${sensitive ? ' is-active' : ''}`} type="button" aria-pressed={sensitive} onClick={() => setSensitive(value => !value)}>Contenido sensible</button>
          {spoilerEnabled && (spoilerWork
            ? <button className="share-warning-selected" type="button" onClick={() => setSpoilerWork(null)}>{spoilerWork.title}<span>×</span></button>
            : <div className="share-warning-picker">
              <div className="share-warning-tabs"><button type="button" className={workType === 'game' ? 'active' : ''} onClick={() => setWorkType('game')}>Juegos</button><button type="button" className={workType === 'anime' ? 'active' : ''} onClick={() => setWorkType('anime')}>Anime</button></div>
              <input className="share-warning-search" value={workQuery} onChange={event => setWorkQuery(event.target.value)} placeholder={`Buscar ${workType === 'game' ? 'juego' : 'anime'}…`} />
              {(workLoading || workResults.length > 0) && <div className="share-warning-results">{workLoading ? <span>Buscando…</span> : workResults.map(work => <button type="button" key={work.id} onClick={() => { setSpoilerWork({ id: work.id, type: workType, title: work.name || work.title }); setWorkQuery('') }}>{work.cover_url || work.image_url ? <img src={work.cover_url || work.image_url} alt="" /> : null}<span>{work.name || work.title}</span></button>)}</div>}
            </div>)}
        </div>}

        <div className="share-composer-footer">
          {selectedReview ? <div className="share-review-date"><label htmlFor="share-review-finished-date">Terminada el</label><input id="share-review-finished-date" type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></div> : <div className="share-composer-tools" aria-label="Opciones del post">
            <input ref={fileInputRef} className="share-image-file-input" type="file" accept="image/*" multiple onChange={handleImageSelection} aria-label="Elegir imágenes para el post" />
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                className={`share-tool-button${selectedTool === tool.id ? ' is-selected' : ''}`}
                type="button"
                aria-label={tool.label}
                aria-pressed={selectedTool === tool.id}
                title={tool.label}
                disabled={['image', 'gif'].includes(tool.id) && images.length >= 3}
                onClick={() => chooseTool(tool)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">{tool.icon}</svg>
              </button>
            ))}
          </div>}

          <div className="share-composer-submit">
            <button className={`share-warning-button${sensitive || spoilerEnabled ? ' is-active' : ''}`} type="button" onClick={() => selectedReview ? setSpoilerEnabled(value => !value) : setWarningsOpen(value => !value)} aria-label={selectedReview ? 'Marcar reseña con spoiler' : 'Advertencias del post'} aria-pressed={selectedReview ? spoilerEnabled : warningsOpen} title={selectedReview ? 'Spoiler' : 'Advertencias'}>
              {selectedReview ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="m4 4 16 16"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2.1h16a1.4 1.4 0 0 0 1.2-2.1L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>}
            </button>
            <span id="share-character-count" className={isOverLimit ? 'is-over-limit' : ''} aria-live="polite">
              {isOverLimit && <strong>-{overage}</strong>}
            </span>
            <button className="share-post-button" type="button" onClick={handlePost} disabled={selectedReview ? reviewSubmitting || isOverLimit : !canPost} aria-disabled={selectedReview ? reviewSubmitting || isOverLimit : !canPost}>{selectedReview ? reviewSubmitting ? 'Guardando…' : 'Reseñar' : 'Postear'}</button>
            {selectedReview && <button className="share-review-clear" type="button" onClick={() => { setSelectedReview(null); setText(''); setReviewRating(0); setReviewDate(''); setSpoilerEnabled(false); if (textareaRef.current) textareaRef.current.style.height = '' }} aria-label="Volver a escribir un post" title="Quitar reseña"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>}
          </div>
        </div>
        {gifOpen && (
          <section className="share-gif-panel" aria-label="Buscar GIFs">
            <div className="share-gif-panel-heading">
              <label className="share-gif-search">
                <span className="share-sr-only">Buscar GIFs</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
                <input type="search" value={gifQuery} onChange={event => setGifQuery(event.target.value.slice(0, 50))} maxLength={50} placeholder="Buscar GIFs" autoComplete="off" />
              </label>
              <a className="share-gif-attribution" href="https://giphy.com" target="_blank" rel="noreferrer">Powered by <strong>GIPHY</strong></a>
            </div>
            <div className="share-gif-results" aria-live="polite">
              {gifLoading && <div className="share-gif-state">Buscando GIFs…</div>}
              {!gifLoading && gifError && <div className="share-gif-state is-error">{gifError}</div>}
              {!gifLoading && !gifError && gifResults.length === 0 && <div className="share-gif-state">No se encontraron GIFs.</div>}
              {!gifLoading && !gifError && gifResults.map(gif => {
                const preview = gif.images?.fixed_width_small?.webp || gif.images?.fixed_width_small?.url || gif.images?.preview_gif?.url
                if (!preview) return null
                return (
                  <button className="share-gif-result" key={gif.id} type="button" onClick={() => handleSelectGif(gif)} aria-label={`Añadir GIF: ${gif.title || 'GIF de GIPHY'}`}>
                    <img src={preview} alt="" loading="lazy" />
                  </button>
                )
              })}
            </div>
          </section>
        )}
        {toolHint && <p className="share-tool-hint" role="status">{toolHint}</p>}
      </article>

      <section className="share-register" aria-label="Registrar obras">
        <h2>REGISTRAR</h2>
        <div className="share-register-controls">
          <div className="share-register-switch" role="tablist" aria-label="Categoría"><button type="button" role="tab" aria-selected={registerCategory === 'game'} className={registerCategory === 'game' ? 'active' : ''} onClick={() => { setRegisterCategory('game'); setRegisterQuery('') }}>Juegos</button><button type="button" role="tab" aria-selected={registerCategory === 'anime'} className={registerCategory === 'anime' ? 'active' : ''} onClick={() => { setRegisterCategory('anime'); setRegisterQuery('') }}>Anime</button></div>
        </div>
        <label className="share-register-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg><input value={registerQuery} onChange={event => setRegisterQuery(event.target.value)} placeholder={`Buscar ${registerCategory === 'game' ? 'juegos' : 'anime'}…`} /></label>
        <h3>{registerQuery.trim().length >= 2 ? 'RESULTADOS' : 'LO MÁS REGISTRADO'}</h3>
        <div className="share-register-grid">
          {(registerQuery.trim().length >= 2 ? registerResults : recommended).map(work => <button className="share-register-card" type="button" key={work.id} onClick={() => selectWorkForReview(work)}>
            {work.image ? <img src={work.image} alt="" loading="lazy" /> : <span className="share-register-no-cover" />}
            <strong>{work.title}</strong>{registerQuery.trim().length < 2 && <small>{work.count} {work.count === 1 ? 'registrado' : 'registrados'}</small>}
          </button>)}
          {(registerQuery.trim().length >= 2 ? registerLoading : recommendedLoading) && <span className="share-register-state">Cargando…</span>}
          {!registerLoading && !recommendedLoading && (registerQuery.trim().length >= 2 ? registerResults : recommended).length === 0 && <span className="share-register-state">No se encontraron obras.</span>}
        </div>
      </section>
      {deleteConfirmOpen && createPortal(<div className="share-delete-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deletingEntry) setDeleteConfirmOpen(false) }}>
        <section className="share-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="share-delete-title">
          <span className="share-delete-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></span>
          <h2 id="share-delete-title">¿Quitar esta obra de tu diario?</h2>
          <p>Se eliminarán tu nota, fecha y reseña de <strong>{selectedReview?.title}</strong>.</p>
          <div className="share-delete-actions"><button type="button" className="share-delete-cancel" onClick={() => setDeleteConfirmOpen(false)} disabled={deletingEntry}>Cancelar</button><button type="button" className="share-delete-confirm" onClick={handleDeleteEntry} disabled={deletingEntry}>{deletingEntry ? 'Eliminando…' : 'Eliminar entrada'}</button></div>
        </section>
      </div>, document.body)}
    </section>
  )
}
