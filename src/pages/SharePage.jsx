import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import MentionSuggestions from '../components/MentionSuggestions'
import MentionHighlights from '../components/MentionHighlights'
import useMentionAutocomplete from '../hooks/useMentionAutocomplete'
import { supabase } from '../lib/supabase'
import { deleteWorkLog, getUserLibrary, getWorkLog, logWork } from '../lib/libraryService'
import { getAccentTextColor } from '../lib/colorContrast'
import { useToast } from '../components/Toast'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import { createList, getTemplateById, getTemplates, incrementTemplateUses, DEFAULT_TIER_CONFIG } from '../lib/listService'
import { createPost } from '../lib/postService'
import { uploadChatImage } from '../lib/socialDiscoveryService'
import { ListPostPreview } from './lists/ViewList'
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

function readListDraft(search) {
  const token = new URLSearchParams(search).get('listDraft')
  if (!token) return { token: null, draft: null }
  try {
    const raw = sessionStorage.getItem(`share-list-draft:${token}`)
    return { token, draft: raw ? JSON.parse(raw) : null }
  } catch (error) {
    console.error('No se pudo leer el borrador de la lista:', error)
    return { token, draft: null }
  }
}

function getListBackdropImage(draft) {
  const content = draft?.payload?.content
  const items = Array.isArray(content) ? content : Object.values(content || {}).flatMap(value => Array.isArray(value) ? value : [value])
  const first = items.find(item => item && typeof item === 'object' && (item.image_url || item.cover_url || item.cover?.url))
  return first ? first.image_url || first.cover_url || first.cover?.url : ''
}

function makeEmptyTemplateList(template) {
  const config = template?.type_config || {}
  let content = {}
  if (template?.list_type === 'tierlist') {
    ;(config.tiers || []).forEach(tier => { content[tier.id] = [] })
  } else if (template?.list_type === 'ranking') {
    content = Array.from({ length: config.max_items || 10 }, () => null)
  } else if (template?.list_type === 'grid') {
    ;(config.cells || []).forEach((_, index) => { content[`c${index}`] = null })
  }
  return { ...template, content }
}

function makeEmptyStandaloneList(type) {
  const typeConfig = JSON.parse(JSON.stringify(DEFAULT_TIER_CONFIG[type] || DEFAULT_TIER_CONFIG.tierlist))
  let content = {}
  if (type === 'tierlist') {
    typeConfig.tiers.forEach(tier => { content[tier.id] = [] })
  } else if (type === 'grid') {
    typeConfig.cells.forEach((_, index) => { content[`c${index}`] = null })
  } else {
    content = Array.from({ length: typeConfig.max_items }, () => null)
  }
  return {
    title: type === 'ranking' ? 'Nuevo ranking' : type === 'grid' ? 'Nueva cuadrícula' : 'Nueva tierlist',
    list_type: type,
    media_type: type === 'ranking' ? 'mixed' : 'game',
    type_config: typeConfig,
    content,
  }
}

function getTemplateCoverUrls(template, max = 2) {
  const selected = template?.cover_items?.length ? template.cover_items : template?.default_items || []
  return selected.slice(0, max).map(item => typeof item === 'string'
    ? item
    : item?.image_url || item?.cover_url || item?.cover_image || item?.image || item?.cover?.url
  ).filter(Boolean)
}

const TOOLS = [
  { id: 'camera', label: 'Hacer una foto', icon: <><path d="M14 4H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3Z"/><circle cx="12" cy="13" r="3"/></> },
  { id: 'image', label: 'Añadir imagen', icon: <><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></> },
  { id: 'gif', label: 'Añadir GIF', icon: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9.5a2.5 2.5 0 1 0 0 5h1.5v-1.7H10M15 9.5v5M18 9.5h-2v5"/></> },
  { id: 'review', label: 'Valorar un juego o anime', icon: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></> },
  { id: 'list', label: 'Añadir lista', icon: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></> },
  { id: 'mention', label: 'Mencionar a alguien', icon: <><circle cx="12" cy="12" r="4"/><path d="M16 8v6a2 2 0 0 0 4 0v-2a8 8 0 1 0-3.3 6.5"/></> },
]

export default function SharePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { toast } = useToast()
  const [initialListDraft, setInitialListDraft] = useState(() => readListDraft(location.search))
  const listDraftToken = initialListDraft.token
  const listDraft = initialListDraft.draft
  const isListPublishingFlow = Boolean(listDraftToken)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const imageGridRef = useRef(null)
  const calendarWrapRef = useRef(null)
  const templatePickerRef = useRef(null)
  const templateTriggerRef = useRef(null)
  const imagesRef = useRef([])
  const [text, setText] = useState('')
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)])
  const [selectedTool, setSelectedTool] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedStandaloneType, setSelectedStandaloneType] = useState(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false)
  const [templatePickerSection, setTemplatePickerSection] = useState('standalone')
  const [templateQuery, setTemplateQuery] = useState('')
  const [templateResults, setTemplateResults] = useState([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState('')
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
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [diaryEntries, setDiaryEntries] = useState([])
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [postSubmitting, setPostSubmitting] = useState(false)
  const [listPublishing, setListPublishing] = useState(false)
  const [removeListConfirmOpen, setRemoveListConfirmOpen] = useState(false)
  const [pendingReviewWork, setPendingReviewWork] = useState(null)
  const [loadingExistingReview, setLoadingExistingReview] = useState(false)
  const [existingWorkEntry, setExistingWorkEntry] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({})
  const [previewLayout, setPreviewLayout] = useState({ width: 0, viewportHeight: 0, isMobile: false })
  const isOverLimit = text.length > POST_LIMIT
  const overage = Math.max(0, text.length - POST_LIMIT)
  const canPost = (Boolean(text.trim()) || images.length > 0) && !isOverLimit
  const isTemplateComposerFlow = Boolean(selectedTemplate && !isListPublishingFlow && !selectedReview)
  const isStandaloneListComposer = Boolean(selectedStandaloneType) && !isListPublishingFlow && !selectedReview
  const isListSetupComposerFlow = isTemplateComposerFlow || isStandaloneListComposer
  const isListAttachmentFlow = isListPublishingFlow || isListSetupComposerFlow
  const mentions = useMentionAutocomplete({
    inputRef: textareaRef, value: text, userId: user?.id, maxLength: INPUT_LIMIT,
    enabled: !selectedReview && !isListAttachmentFlow,
    onValueChange: value => handleTextChange({ target: { value } }),
  })

  useEffect(() => {
    if (new URLSearchParams(location.search).get('openList') !== '1') return
    setTemplatePickerSection('standalone')
    setTemplatePickerOpen(true)
    setSelectedTool('list')
  }, [location.search])

  useEffect(() => {
    const standaloneType = new URLSearchParams(location.search).get('listType')
    setSelectedStandaloneType(['tierlist', 'grid', 'ranking'].includes(standaloneType) && !isListPublishingFlow ? standaloneType : null)
  }, [location.search, isListPublishingFlow])

  useEffect(() => {
    const templateId = new URLSearchParams(location.search).get('listTemplate')
    if (!templateId || isListPublishingFlow) {
      if (!isListPublishingFlow) setSelectedTemplate(null)
      return undefined
    }
    let active = true
    getTemplateById(templateId).then(template => { if (active) setSelectedTemplate(template) }).catch(error => {
      console.error('No se pudo cargar la plantilla seleccionada:', error)
      if (active) setSelectedTemplate(null)
    })
    return () => { active = false }
  }, [location.search, isListPublishingFlow])

  useEffect(() => {
    if (!templatePickerOpen || templatePickerSection !== 'templates') return undefined
    let active = true
    const timer = window.setTimeout(async () => {
      setTemplateLoading(true)
      setTemplateError('')
      try {
        const results = await getTemplates({ query: templateQuery.trim(), limit: 24 })
        if (active) setTemplateResults(results)
      } catch (error) {
        console.error('No se pudieron cargar las plantillas:', error)
        if (active) { setTemplateResults([]); setTemplateError('No se pudieron cargar las plantillas. Inténtalo de nuevo.') }
      } finally { if (active) setTemplateLoading(false) }
    }, templateQuery.trim() ? 220 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [templatePickerOpen, templatePickerSection, templateQuery])

  useEffect(() => {
    if (!templatePickerOpen) return undefined
    const closeOnOutsidePointer = event => {
      if (!templatePickerRef.current?.contains(event.target) && !templateTriggerRef.current?.contains(event.target)) setTemplatePickerOpen(false)
    }
    const closeOnEscape = event => { if (event.key === 'Escape') setTemplatePickerOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [templatePickerOpen])

  useEffect(() => {
    if (!reviewPickerOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setReviewPickerOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [reviewPickerOpen])

  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => {
    const viewport = window.visualViewport
    const updateKeyboardInset = () => {
      const active = document.activeElement
      const isEditing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.isContentEditable
      const keyboardInset = isEditing && viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0
      document.documentElement.style.setProperty('--share-keyboard-offset', `${Math.min(keyboardInset, window.innerHeight * .7)}px`)
    }
    const scheduleUpdate = () => requestAnimationFrame(updateKeyboardInset)
    window.addEventListener('resize', scheduleUpdate)
    document.addEventListener('focusin', scheduleUpdate)
    document.addEventListener('focusout', scheduleUpdate)
    viewport?.addEventListener('resize', scheduleUpdate)
    viewport?.addEventListener('scroll', scheduleUpdate)
    updateKeyboardInset()
    return () => {
      window.removeEventListener('resize', scheduleUpdate)
      document.removeEventListener('focusin', scheduleUpdate)
      document.removeEventListener('focusout', scheduleUpdate)
      viewport?.removeEventListener('resize', scheduleUpdate)
      viewport?.removeEventListener('scroll', scheduleUpdate)
      document.documentElement.style.removeProperty('--share-keyboard-offset')
    }
  }, [])
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
    if ((!spoilerEnabled && !reviewPickerOpen) || (spoilerEnabled && spoilerWork) || !workQuery.trim() || workQuery.trim().length < 2) {
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
  }, [spoilerEnabled, spoilerWork, reviewPickerOpen, workQuery, workType])

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
    if (query.length < 2) { setRegisterResults([]); setRegisterLoading(false); return undefined }
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
  }, [registerCategory, registerQuery])

  const accent = profile?.theme_color || '#14b8a6'
  const avatar = profile?.avatar_url || profile?.profile_picture || ''
  const displayName = profile?.display_name || profile?.username || 'Usuario'
  const avatarBackground = avatar ? `url("${avatar}")` : 'none'
  const isStandaloneMobile = window.matchMedia('(display-mode: standalone) and (max-width: 620px)').matches || (navigator.standalone === true && window.innerWidth <= 620)
  const renderMobileSheet = content => isStandaloneMobile ? createPortal(content, document.body) : content

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
    if (tool.id === 'mention') {
      setGifOpen(false)
      setTemplatePickerOpen(false)
      setSelectedTool(null)
      setToolHint('')
      mentions.insertMention()
      return
    }
    if (tool.id === 'list') {
      const shouldOpen = !templatePickerOpen
      setSelectedTool(shouldOpen ? 'list' : null)
      setGifOpen(false)
      if (shouldOpen) setTemplateQuery('')
      setTemplatePickerOpen(shouldOpen)
      setToolHint('')
      return
    }
    if (tool.id === 'review') {
      setTemplatePickerOpen(false)
      setGifOpen(false)
      setReviewPickerOpen(true)
      setWorkQuery('')
      setWorkType('game')
      return
    }
    if (tool.id === 'camera') {
      cameraInputRef.current?.click()
      return
    }
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

  const handlePost = async () => {
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
    if (!user?.id || postSubmitting) return

    setPostSubmitting(true)
    try {
      const media = await Promise.all(images.map(async image => {
        const url = image.remoteUrl || (image.file ? await uploadChatImage(image.file) : null)
        if (!url) throw new Error(`No se pudo subir ${image.name || 'una de las imágenes'}.`)
        const isGif = image.source === 'giphy' || image.file?.type === 'image/gif' || /\.gif(?:$|\?)/i.test(url)
        return { url, name: image.name || '', type: isGif ? 'gif' : 'image' }
      }))
      const created = await createPost({
        user_id: user.id,
        body: text.trim(),
        media,
        contains_spoiler: spoilerEnabled,
        is_sensitive: sensitive,
        spoiler_work_id: spoilerWork?.id,
        spoiler_work_type: spoilerWork?.type,
        spoiler_work_title: spoilerWork?.title,
      })
      navigate(`/posts/${created.id}`)
    } catch (error) {
      console.error('No se pudo publicar el post:', error)
      toast({ title: 'No se pudo publicar', message: error.message || 'Inténtalo de nuevo.', type: 'error' })
    } finally { setPostSubmitting(false) }
  }

  const handlePublishList = async () => {
    if (!listDraft?.payload || listPublishing) return
    if (!user?.id || listDraft.payload.user_id !== user.id) {
      toast({ title: 'No se pudo publicar', message: 'Vuelve al editor y prepara la lista con tu cuenta actual.', type: 'error' })
      return
    }
    setListPublishing(true)
    try {
      const savedList = await createList(listDraft.payload)
      if (listDraft.payload.template_id) {
        try { await incrementTemplateUses(listDraft.payload.template_id) }
        catch (error) { console.error('La lista se publicó, pero no se pudo actualizar el contador de usos de la plantilla:', error) }
      }
      if (listDraftToken) sessionStorage.removeItem(`share-list-draft:${listDraftToken}`)
      navigate(`/lists/${savedList.id}`, { replace: true })
    } catch (error) {
      console.error('No se pudo publicar la lista:', error)
      toast({ title: 'No se pudo publicar la lista', message: error.message || 'Inténtalo de nuevo.', type: 'error' })
    } finally { setListPublishing(false) }
  }

  const handleReturnToListEditor = () => {
    if (!listDraftToken) return navigate('/templates')
    navigate(`/lists/new?publishDraft=${encodeURIComponent(listDraftToken)}`)
  }

  const handleRemoveListFromComposer = () => {
    if (listDraftToken) sessionStorage.removeItem(`share-list-draft:${listDraftToken}`)
    setRemoveListConfirmOpen(false)
    setInitialListDraft({ token: null, draft: null })
    setSelectedTemplate(null)
    setSelectedStandaloneType(null)
    navigate('/share', { replace: true })
    if (pendingReviewWork) {
      const work = pendingReviewWork
      setPendingReviewWork(null)
      selectWorkForReview(work)
    }
  }

  const handleRegisterWorkSelection = work => {
    if (!isListAttachmentFlow) return selectWorkForReview(work)
    setPendingReviewWork(work)
    setRemoveListConfirmOpen(true)
  }

  const handleChooseTemplate = template => {
    setSelectedTemplate(template)
    setSelectedStandaloneType(null)
    setSelectedTool(null)
    setTemplatePickerOpen(false)
    setTemplateQuery('')
    navigate(`/share?listTemplate=${encodeURIComponent(template.id)}`, { replace: true })
  }

  const handleChooseStandaloneType = type => {
    setSelectedTemplate(null)
    setSelectedStandaloneType(type)
    setSelectedTool(null)
    setTemplatePickerOpen(false)
    navigate(`/share?listType=${encodeURIComponent(type)}`, { replace: true })
  }

  const handleEditSelectedList = () => {
    if (selectedStandaloneType) navigate(`/lists/new?type=${encodeURIComponent(selectedStandaloneType)}`)
    else if (selectedTemplate?.id) navigate(`/lists/new?template=${encodeURIComponent(selectedTemplate.id)}`)
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
      if (existing.finished_date) {
        const finished = new Date(`${String(existing.finished_date).slice(0, 10)}T12:00:00`)
        if (!Number.isNaN(finished.getTime())) setCalendarMonth(new Date(finished.getFullYear(), finished.getMonth(), 1))
      }
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

  useEffect(() => {
    if (!calendarOpen) return undefined
    const closeOnOutsidePointer = event => {
      if (!calendarWrapRef.current?.contains(event.target)) setCalendarOpen(false)
    }
    const closeOnEscape = event => { if (event.key === 'Escape') setCalendarOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [calendarOpen])

  useEffect(() => {
    if (!selectedReview || !user?.id) return undefined
    let cancelled = false
    getUserLibrary(user.id).then(async entries => {
      const rows = entries || []
      const coverMap = new Map()
      for (const type of ['game', 'anime']) {
        const ids = rows.filter(entry => entry.work_type === type).map(entry => entry.work_id)
        if (!ids.length) continue
        const { data } = await supabase.from(type === 'game' ? 'games' : 'anime').select(type === 'game' ? 'id, name, cover_url' : 'id, title, image_url').in('id', ids)
        ;(data || []).forEach(work => coverMap.set(`${type}:${work.id}`, { title: work.name || work.title, image: work.cover_url || work.image_url }))
      }
      if (!cancelled) setDiaryEntries(rows.map(entry => ({ ...entry, ...coverMap.get(`${entry.work_type}:${entry.work_id}`) })))
    }).catch(error => console.error('No se pudo cargar el diario para el calendario:', error))
    return () => { cancelled = true }
  }, [selectedReview?.id, selectedReview?.type, user?.id])

  const calendarDays = (() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const offset = (firstDay.getDay() + 6) % 7
    const count = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]
  })()
  const today = new Date()
  const todayCalendarKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const entriesByDate = diaryEntries.reduce((map, entry) => {
    if (!entry.finished_date) return map
    const key = String(entry.finished_date).slice(0, 10)
    map[key] = [...(map[key] || []), entry]
    return map
  }, {})
  const formatCalendarDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Elegir fecha'

  return (
    <section
      className={`share-page${selectedReview ? ' has-selected-review' : ''}${isListAttachmentFlow ? ' has-list-draft' : ''}`}
      style={{
        '--share-accent': accent,
        '--share-accent-ink': getAccentTextColor(accent),
        '--share-avatar-backdrop': avatarBackground,
        '--share-list-backdrop': (getListBackdropImage(listDraft) || getListBackdropImage({ payload: { content: selectedTemplate?.default_items || [] } })) ? `url("${getListBackdropImage(listDraft) || getListBackdropImage({ payload: { content: selectedTemplate?.default_items || [] } })}")` : 'none',
      }}
    >
      <div key={selectedReview?.id || 'default-share-backdrop'} className={`share-selected-backdrop${selectedReview?.image ? ' is-visible' : ''}`} style={{ backgroundImage: selectedReview?.image ? `url("${selectedReview.image}")` : 'none' }} aria-hidden="true" />
      <header className="share-page-heading">
        <button className="share-mobile-back" type="button" onClick={() => navigate(-1)} aria-label="Volver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
        <h1>Compartir</h1>
        {!selectedReview && <button className="share-mobile-post-button" type="button" onClick={isListPublishingFlow ? handlePublishList : isListSetupComposerFlow ? handleEditSelectedList : handlePost} disabled={isListPublishingFlow ? listPublishing || !listDraft?.payload : isListSetupComposerFlow ? false : postSubmitting || !canPost}>{isListPublishingFlow ? listPublishing ? 'Publicando…' : 'Postear' : isListSetupComposerFlow ? 'Editar lista' : postSubmitting ? 'Publicando…' : 'Postear'}</button>}
      </header>

      <article className={`share-composer${isOverLimit ? ' is-over-limit' : ''}${selectedReview ? ' is-review-composer' : ''}${isListAttachmentFlow ? ' is-list-composer' : ''}`} aria-label={isListAttachmentFlow ? 'Publicar una lista' : selectedReview ? 'Escribir reseña' : 'Crear un post'}>
        {isListAttachmentFlow ? listDraft?.payload ? <>
          <div className="share-list-composer-entry">
            <span className="share-composer-avatar" aria-label={`Foto de ${displayName}`}>
              {avatar ? <img src={avatar} alt="" /> : <DefaultAvatar accent={accent} />}
            </span>
            <div className="share-list-attachment">
              <ListPostPreview list={listDraft.payload} onClick={handleReturnToListEditor} className="share-list-published-preview" ariaLabel="Volver a editar la lista" />
            </div>
          </div>
          <div className="share-list-publish-actions">
            <button className="share-review-clear share-list-remove-button" type="button" onClick={() => setRemoveListConfirmOpen(true)} disabled={listPublishing} aria-label="Quitar lista" title="Quitar lista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
            <button className="share-post-button" type="button" onClick={handlePublishList} disabled={listPublishing}>{listPublishing ? 'Publicando…' : 'Postear'}</button>
          </div>
        </> : isTemplateComposerFlow ? <>
          <div className="share-list-composer-entry">
            <span className="share-composer-avatar" aria-label={`Foto de ${displayName}`}>
              {avatar ? <img src={avatar} alt="" /> : <DefaultAvatar accent={accent} />}
            </span>
            <div className="share-list-attachment">
              <ListPostPreview list={makeEmptyTemplateList(selectedTemplate)} onClick={handleEditSelectedList} className="share-list-published-preview" ariaLabel={`Editar lista basada en ${selectedTemplate.title}`} />
            </div>
          </div>
          <div className="share-list-publish-actions">
            <button className="share-review-clear share-list-remove-button" type="button" onClick={() => setRemoveListConfirmOpen(true)} aria-label="Quitar plantilla" title="Quitar plantilla"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
            <button className="share-post-button" type="button" onClick={handleEditSelectedList}>Editar lista</button>
          </div>
        </> : isStandaloneListComposer ? <>
          <div className="share-list-composer-entry">
            <span className="share-composer-avatar" aria-label={`Foto de ${displayName}`}>
              {avatar ? <img src={avatar} alt="" /> : <DefaultAvatar accent={accent} />}
            </span>
            <div className="share-list-attachment">
              <ListPostPreview list={makeEmptyStandaloneList(selectedStandaloneType)} onClick={handleEditSelectedList} className="share-list-published-preview" ariaLabel={`Editar ${selectedStandaloneType === 'ranking' ? 'ranking' : selectedStandaloneType === 'grid' ? 'cuadrícula' : 'tierlist'}`} />
            </div>
          </div>
          <div className="share-list-publish-actions">
            <button className="share-review-clear share-list-remove-button" type="button" onClick={() => setRemoveListConfirmOpen(true)} aria-label="Quitar lista" title="Quitar lista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
            <button className="share-post-button" type="button" onClick={handleEditSelectedList}>Editar lista</button>
          </div>
        </> : <div className="share-list-draft-error" role="alert"><p>No se pudo recuperar la lista o plantilla seleccionada.</p><button type="button" className="share-post-button" onClick={() => navigate('/templates')}>Volver a plantillas</button></div> : <>
        <div className={`share-composer-entry${images.length ? ' has-images' : ''}${selectedReview ? ' has-review-work' : ''}`}>
          {selectedReview ? <div className="share-review-identity">
            {selectedReview.image && <div className="share-review-cover"><img src={selectedReview.image} alt={selectedReview.title} /></div>}
          </div> : <span className="share-composer-avatar" aria-label={`Foto de ${displayName}`}>
            {avatar ? <img src={avatar} alt="" /> : <DefaultAvatar accent={accent} />}
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
            <div className="mention-input-wrap">
            <MentionHighlights inputRef={textareaRef} value={text} enabled={!selectedReview} />
            <textarea
              ref={textareaRef}
              className={!selectedReview ? 'has-mention-highlights' : undefined}
              value={text}
              {...mentions.inputProps}
              maxLength={INPUT_LIMIT}
              placeholder={selectedReview ? (loadingExistingReview ? 'Cargando tu reseña…' : `Tu reseña sobre ${selectedReview.title}… (opcional)`) : placeholder}
              rows={3}
              aria-label={selectedReview ? 'Escribe tu reseña' : 'Escribe tu post'}
              aria-describedby="share-character-count"
            />
            <MentionSuggestions autocomplete={mentions} />
            </div>
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
          {selectedReview ? <div className="share-review-date-wrap" ref={calendarWrapRef}><button className="share-review-date-trigger" type="button" onClick={() => setCalendarOpen(value => !value)} aria-expanded={calendarOpen}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>{reviewDate ? formatCalendarDate(reviewDate) : 'Fecha de registro'}<span className="share-review-date-chevron">{calendarOpen ? '−' : '+'}</span>
          </button>{calendarOpen && <div className="share-calendar-popover">
            <div className="share-calendar-header">
              <div className="share-calendar-nav-group"><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear() - 1, calendarMonth.getMonth(), 1))} aria-label="Año anterior"><svg viewBox="0 0 24 24"><path d="m18 6-6 6 6 6M11 6l-6 6 6 6"/></svg></button><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Mes anterior"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button></div>
              <strong>{calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</strong>
              <div className="share-calendar-nav-group"><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Mes siguiente"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear() + 1, calendarMonth.getMonth(), 1))} aria-label="Año siguiente"><svg viewBox="0 0 24 24"><path d="m6 6 6 6-6 6m7-12 6 6-6 6"/></svg></button></div>
            </div>
            <div className="share-calendar-grid share-calendar-weekdays">{'LMXJVSD'.split('').map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
            <div className="share-calendar-grid">{calendarDays.map((day, index) => {
              if (!day) return <span className="share-calendar-empty" key={`empty-${index}`} />
              const date = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const covers = entriesByDate[date] || []
              const isFutureDate = date > todayCalendarKey
              return <button key={date} className={`share-calendar-day${reviewDate === date ? ' is-selected' : ''}${covers.length ? ' has-entries' : ''}`} type="button" disabled={isFutureDate} onClick={() => { setReviewDate(date); setCalendarOpen(false) }} aria-label={`${day}${covers.length ? `, ${covers.length} obras registradas` : ''}${isFutureDate ? ', fecha futura no disponible' : ''}`}>
                <span>{day}</span>{covers.length > 0 && <i>{covers.slice(0, 2).map(entry => entry.image ? <img key={`${entry.work_type}-${entry.work_id}`} src={entry.image} alt="" title={entry.title || ''} /> : <b key={`${entry.work_type}-${entry.work_id}`} />)}</i>}
              </button>
            })}</div>
            <div className="share-calendar-footer"><span>{reviewDate ? formatCalendarDate(reviewDate) : 'Selecciona un día'}</span>{reviewDate && <button type="button" onClick={() => { setReviewDate(''); setCalendarOpen(false) }}>Quitar fecha</button>}</div>
          </div>}</div> : <div className="share-composer-tools" aria-label="Opciones del post">
            <input ref={cameraInputRef} className="share-image-file-input" type="file" accept="image/*" capture="environment" onChange={handleImageSelection} aria-label="Hacer una foto para el post" />
            <input ref={fileInputRef} className="share-image-file-input" type="file" accept="image/*" multiple onChange={handleImageSelection} aria-label="Elegir imágenes para el post" />
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                ref={tool.id === 'list' ? templateTriggerRef : undefined}
                className={`share-tool-button share-tool-${tool.id}${selectedTool === tool.id ? ' is-selected' : ''}`}
                type="button"
                aria-label={tool.label}
                aria-pressed={selectedTool === tool.id}
                title={tool.label}
                disabled={['camera', 'image', 'gif'].includes(tool.id) && images.length >= 3}
                onMouseDown={tool.id === 'mention' ? event => event.preventDefault() : undefined}
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
            <button className="share-post-button" type="button" onClick={handlePost} disabled={selectedReview ? reviewSubmitting || isOverLimit : postSubmitting || !canPost} aria-disabled={selectedReview ? reviewSubmitting || isOverLimit : postSubmitting || !canPost}>{selectedReview ? reviewSubmitting ? 'Guardando…' : 'Reseñar' : postSubmitting ? 'Publicando…' : 'Postear'}</button>
            {selectedReview && <button className="share-review-clear" type="button" onClick={() => { setSelectedReview(null); setText(''); setReviewRating(0); setReviewDate(''); setSpoilerEnabled(false); if (textareaRef.current) textareaRef.current.style.height = '' }} aria-label="Volver a escribir un post" title="Quitar reseña"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>}
          </div>
        </div>
        {gifOpen && renderMobileSheet(
          <section className={`share-gif-panel${isStandaloneMobile ? ' share-gif-mobile-sheet' : ''}`} role={isStandaloneMobile ? 'dialog' : undefined} aria-modal={isStandaloneMobile ? 'true' : undefined} aria-label="Buscar GIFs" style={isStandaloneMobile ? { '--share-accent': accent } : undefined}>
            {isStandaloneMobile && <header className="share-sheet-header"><button type="button" onClick={() => setGifOpen(false)} aria-label="Volver a compartir"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><div><h2>Elige un GIF</h2><p>Busca una reacción para tu publicación</p></div><button type="button" onClick={() => setGifOpen(false)} aria-label="Cerrar">×</button></header>}
            <div className="share-gif-panel-heading">
              <label className="share-gif-search">
                <span className="share-sr-only">Buscar GIFs</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
                <input type="search" value={gifQuery} onChange={event => setGifQuery(event.target.value.slice(0, 50))} maxLength={50} placeholder="Buscar GIFs" autoComplete="off" />
              </label>
              <a className="share-gif-attribution" href="https://giphy.com" target="_blank" rel="noreferrer">Powered by <strong>GIPHY</strong></a>
            </div>
            <div className="share-gif-results" aria-live="polite" aria-busy={gifLoading}>
              {gifLoading && Array.from({ length: 8 }, (_, index) => <span className="share-gif-skeleton" key={`gif-loading-${index}`} aria-hidden="true" />)}
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
        {templatePickerOpen && renderMobileSheet(<section className={`share-template-picker-panel share-gif-panel${isStandaloneMobile ? ' share-list-mobile-sheet' : ''}`} ref={templatePickerRef} role={isStandaloneMobile ? 'dialog' : undefined} aria-modal={isStandaloneMobile ? 'true' : undefined} aria-label="Añadir una lista" style={isStandaloneMobile ? { '--share-accent': accent } : undefined}>
          {isStandaloneMobile ? <header className="share-sheet-header"><button type="button" onClick={() => setTemplatePickerOpen(false)} aria-label="Volver a compartir"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><div><h2>Añadir una lista</h2><p>Elige cómo quieres empezar</p></div><button type="button" onClick={() => setTemplatePickerOpen(false)} aria-label="Cerrar">×</button></header> : <header className="share-template-picker-header"><div><h2>Añadir una lista</h2><p>Elige cómo quieres empezar</p></div></header>}
          <div className="share-list-kind-tabs" role="tablist" aria-label="Tipo de lista"><button type="button" role="tab" aria-selected={templatePickerSection === 'standalone'} className={templatePickerSection === 'standalone' ? 'active' : ''} onClick={() => setTemplatePickerSection('standalone')}>Sin plantillas</button><button type="button" role="tab" aria-selected={templatePickerSection === 'templates'} className={templatePickerSection === 'templates' ? 'active' : ''} onClick={() => setTemplatePickerSection('templates')}>Plantillas</button></div>
          {templatePickerSection === 'standalone' ? <div className="share-template-picker-results share-list-kind-results">
            <button className="share-list-kind-pill" type="button" onClick={() => handleChooseStandaloneType('tierlist')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h13M8 12h13M8 19h13"/><path d="M3 5h.01M3 12h.01M3 19h.01"/></svg>
              <span>Tierlist</span>
            </button>
            <button className="share-list-kind-pill" type="button" onClick={() => handleChooseStandaloneType('grid')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>
              <span>Cuadrícula</span>
            </button>
            <button className="share-list-kind-pill" type="button" onClick={() => handleChooseStandaloneType('ranking')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2L7 14 2.1 9.2l6.8-1L12 2Z"/></svg>
              <span>Ranking</span>
            </button>
          </div> : <>
          <label className="share-template-picker-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg><input autoFocus type="search" value={templateQuery} onChange={event => setTemplateQuery(event.target.value)} placeholder="Buscar plantillas…" /></label>
          <div className="share-template-picker-results" aria-live="polite" aria-busy={templateLoading}>
            {templateLoading && Array.from({ length: 3 }, (_, index) => <div className="share-template-skeleton" key={`template-loading-${index}`} aria-hidden="true"><span className="share-template-skeleton-art" /><span className="share-template-skeleton-copy"><i /><i /><i /></span><span className="share-template-skeleton-arrow" /></div>)}
            {!templateLoading && templateError && <div className="share-template-picker-state is-error">{templateError}</div>}
            {!templateLoading && !templateError && templateResults.map(template => {
              const covers = getTemplateCoverUrls(template, 2)
              const type = template.list_type === 'ranking' ? 'Ranking' : template.list_type === 'grid' ? 'Grid' : 'Tierlist'
              const media = template.media_type === 'anime' ? 'Anime' : template.media_type === 'game' ? 'Videojuegos' : template.media_type || ''
              return <button className="share-template-result" type="button" key={template.id} onClick={() => handleChooseTemplate(template)}>
                <span className={`share-template-result-art type-${template.list_type || 'tierlist'}`} aria-hidden="true">{covers.length ? covers.map((cover, index) => <img key={`${cover}-${index}`} src={cover} alt="" loading="lazy" />) : <svg viewBox="0 0 24 24">{template.list_type === 'ranking' ? <path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2L7 14 2.1 9.2l6.8-1L12 2Z"/> : template.list_type === 'grid' ? <><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></> : <><path d="M8 5h13M8 12h13M8 19h13"/><path d="M3 5h.01M3 12h.01M3 19h.01"/></>}</svg>}</span>
                <span className="share-template-result-copy"><strong>{template.title}</strong><small>{type}{media ? ` · ${media}` : ''}</small><small className="share-template-result-author">por {template.profiles?.display_name || template.profiles?.username || 'Usuario'} · {template.uses_count || 0} usos</small></span>
                <svg className="share-template-result-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            })}
            {!templateLoading && !templateError && templateResults.length === 0 && <div className="share-template-picker-state">No se encontraron plantillas.</div>}
          </div>
          </>}
        </section>)}
        {reviewPickerOpen && renderMobileSheet(<section className="share-review-picker-sheet" role="dialog" aria-modal="true" aria-label="Valorar una obra" style={isStandaloneMobile ? { '--share-accent': accent } : undefined}>
          <header className="share-sheet-header"><button type="button" onClick={() => setReviewPickerOpen(false)} aria-label="Volver a compartir"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><div><h2>¿Qué vas a valorar?</h2><p>Elige un juego o un anime</p></div><button type="button" onClick={() => setReviewPickerOpen(false)} aria-label="Cerrar">×</button></header>
          <div className="share-review-picker-content"><div className="share-list-kind-tabs" role="tablist" aria-label="Tipo de obra"><button type="button" role="tab" aria-selected={workType === 'game'} className={workType === 'game' ? 'active' : ''} onClick={() => setWorkType('game')}>Videojuegos</button><button type="button" role="tab" aria-selected={workType === 'anime'} className={workType === 'anime' ? 'active' : ''} onClick={() => setWorkType('anime')}>Anime</button></div><label className="share-review-picker-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg><input autoFocus value={workQuery} onChange={event => setWorkQuery(event.target.value)} placeholder={`Buscar ${workType === 'game' ? 'juego' : 'anime'}…`} /></label><div className="share-review-picker-results" aria-live="polite">{workLoading && <p>Buscando…</p>}{!workLoading && workQuery.trim().length < 2 && <p>Escribe al menos dos letras para buscar.</p>}{!workLoading && workQuery.trim().length >= 2 && workResults.map(work => <button type="button" key={work.id} onClick={() => { setReviewPickerOpen(false); selectWorkForReview({ ...work, title: work.name || work.title, image: work.cover_url || work.image_url, type: workType }) }}><img src={work.cover_url || work.image_url || '/icons/logo.png'} alt=""/><span><strong>{work.name || work.title}</strong><small>{workType === 'game' ? 'Videojuego' : 'Anime'}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>)}</div></div>
        </section>)}
        {toolHint && <p className="share-tool-hint" role="status">{toolHint}</p>}
        </>}
      </article>

      <section className="share-register" aria-label="Registrar obras">
        <h2>REGISTRAR</h2>
        <div className="share-register-controls">
          <div className={`share-register-switch${registerCategory === 'anime' ? ' anime-selected' : ''}`} role="tablist" aria-label="Categoría"><button type="button" role="tab" aria-selected={registerCategory === 'game'} className={registerCategory === 'game' ? 'active' : ''} onClick={() => { setRegisterCategory('game'); setRegisterQuery(''); setRegisterResults([]); setRegisterLoading(false) }}>Juegos</button><button type="button" role="tab" aria-selected={registerCategory === 'anime'} className={registerCategory === 'anime' ? 'active' : ''} onClick={() => { setRegisterCategory('anime'); setRegisterQuery(''); setRegisterResults([]); setRegisterLoading(false) }}>Anime</button></div>
        </div>
        <label className="share-register-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg><input value={registerQuery} onChange={event => { const query = event.target.value; setRegisterQuery(query); setRegisterResults([]); setRegisterLoading(query.trim().length >= 2) }} placeholder={`Buscar ${registerCategory === 'game' ? 'juegos' : 'anime'}…`} /></label>
        <h3>{registerQuery.trim().length >= 2 ? 'RESULTADOS' : 'LO MÁS REGISTRADO'}</h3>
        <div className="share-register-grid" aria-busy={registerQuery.trim().length >= 2 ? registerLoading : recommendedLoading}>
          {(registerQuery.trim().length >= 2 ? registerResults : recommended).map(work => <button className="share-register-card" type="button" key={work.id} onClick={() => handleRegisterWorkSelection(work)}>
            {work.image ? <img src={work.image} alt="" loading="lazy" /> : <span className="share-register-no-cover" />}
            <strong>{work.title}</strong>{registerQuery.trim().length < 2 && <small>{work.count} {work.count === 1 ? 'registrado' : 'registrados'}</small>}
          </button>)}
          {(registerQuery.trim().length >= 2 ? registerLoading : recommendedLoading) && Array.from({ length: 6 }, (_, index) => <div className="share-register-skeleton-card" key={`loading-${index}`} aria-hidden="true"><span className="share-register-skeleton-cover" /><span className="share-register-skeleton-line" /><span className="share-register-skeleton-line is-short" /></div>)}
          {!(registerQuery.trim().length >= 2 ? registerLoading : recommendedLoading) && (registerQuery.trim().length >= 2 ? registerResults : recommended).length === 0 && <span className="share-register-state">No se encontraron obras.</span>}
        </div>
      </section>
      {removeListConfirmOpen && createPortal(<div className="share-delete-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setRemoveListConfirmOpen(false); setPendingReviewWork(null) } }}>
        <section className="share-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="share-remove-list-title">
          <span className="share-delete-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></span>
          <h2 id="share-remove-list-title">{selectedTemplate && isTemplateComposerFlow ? '¿Quitar esta plantilla?' : '¿Quitar esta lista?'}</h2>
          <p>{pendingReviewWork ? `La lista dejará de estar adjunta y abrirás la reseña de ${pendingReviewWork.name || pendingReviewWork.title}.` : 'La selección se quitará del compositor y volverás al modo normal de compartir.'}</p>
          <div className="share-delete-actions"><button type="button" className="share-delete-cancel" onClick={() => { setRemoveListConfirmOpen(false); setPendingReviewWork(null) }}>Cancelar</button><button type="button" className="share-delete-confirm" onClick={handleRemoveListFromComposer}>{selectedTemplate && isTemplateComposerFlow ? 'Quitar plantilla' : 'Quitar lista'}</button></div>
        </section>
      </div>, document.body)}
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
