import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Groq from "groq-sdk"
import { useAuth } from '../context/AuthContext'
import {
    getConversations,
    getMessages,
    sendMessage,
    subscribeToMessages,
    markMessagesAsRead,
    blockUser,
    unblockUser,
    isBlocked,
    checkBlockRelationship,
    uploadChatImage,
    toggleMessageReaction,
    editMessage,
    deleteMessage
} from '../lib/socialDiscoveryService'
import '../components/chat/ChatEnhancements.css'
import { ChatShareModal } from '../components/chat/ChatShareModal'
import LoadingSpinner from '../components/LoadingSpinner'
import { SocialIcons } from '../components/SocialIcons'
import './Chat.css'

const ImageViewer = ({ src, onClose }) => {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    if (!src) return null

    const handleDownload = async (e) => {
        e.stopPropagation()
        try {
            const response = await fetch(src)
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = blobUrl
            link.download = `chat-image-${Date.now()}.jpg`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(blobUrl)
        } catch (error) {
            console.error('Error downloading image:', error)
            window.open(src, '_blank')
        }
    }

    return (
        <div className="image-viewer-overlay" onClick={onClose}>
            <div className="image-viewer-controls">
                <button className="image-viewer-btn download" onClick={handleDownload} title="Descargar">
                    ⬇️
                </button>
                <button className="image-viewer-btn close" onClick={onClose} title="Cerrar">
                    ×
                </button>
            </div>
            <div className="image-viewer-content-wrapper" onClick={e => e.stopPropagation()}>
                <img src={src} alt="Full size" className="image-viewer-content" />
            </div>
        </div>
    )
}

// Helper component to render rich message content
const MessageContent = ({ content, commonWorks = [], imageUrl, onImageClick }) => {
    const navigate = useNavigate()

    // Regex to match tags: [TYPE|ID|TITLE|IMG|EXTRA]
    const tagRegex = /\[(TIERLIST|WORK|DEBATE)\|([^|]+)\|([^|]+)(?:\|([^|]*))?(?:\|([^|]*))?\]/g

    // Split content by tags
    const parts = []
    let lastIndex = 0
    let match

    while ((match = tagRegex.exec(content)) !== null) {
        // Add text before tag (processed for auto-linking)
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: content.slice(lastIndex, match.index)
            })
        }

        // Add tag
        parts.push({
            type: 'card',
            cardType: match[1],
            id: match[2],
            title: match[3],
            image: match[4],
            extra: match[5]
        })

        lastIndex = match.index + match[0].length
    }

    // Also parse YouTube tags
    const youtubeRegex = /\[YOUTUBE\|([a-zA-Z0-9_-]{11})\]/g
    let ytMatch
    const youtubeEmbeds = []
    while ((ytMatch = youtubeRegex.exec(content)) !== null) {
        youtubeEmbeds.push(ytMatch[1])
    }

    // Add remaining text
    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.slice(lastIndex).replace(/\[YOUTUBE\|[^\]]+\]/g, '') })
    }

    // Function to process text and auto-link common works
    const renderText = (text, keyPrefix) => {
        if (!commonWorks || commonWorks.length === 0) return text

        // Create regex pattern from common works names
        // Sort by length desc to match longer names first
        const workNames = commonWorks
            .map(w => w.name)
            .filter(n => n && n.length > 2)
            .sort((a, b) => b.length - a.length)

        if (workNames.length === 0) return text

        // Escape special regex chars
        const pattern = workNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
        const workRegex = new RegExp(`(${pattern})`, 'gi')

        const segments = text.split(workRegex)

        return segments.map((seg, i) => {
            const isMatch = workNames.some(n => n.toLowerCase() === seg.toLowerCase())
            if (isMatch) {
                const work = commonWorks.find(w => w.name.toLowerCase() === seg.toLowerCase())
                return (
                    <span
                        key={`${keyPrefix}-${i}`}
                        className="work-mention"
                        title={`Obra en común: ${work.name}`}
                    >
                        {seg}
                    </span>
                )
            }
            return seg
        })
    }

    const handleCardClick = (part) => {
        if (part.cardType === 'DEBATE') {
            navigate(`/debate/${part.id}`)
        } else if (part.cardType === 'TIERLIST') {
            navigate(`/tierlist/${part.id}`)
        } else if (part.cardType === 'WORK') {
            // extra contains media_type (game/anime)
            const mediaType = part.extra || 'game'
            navigate(`/${mediaType}/${part.id}`)
        }
    }

    return (
        <div className="message-content-mixed">
            {imageUrl && (
                <div className="chat-image-container" onClick={() => onImageClick && onImageClick(imageUrl)}>
                    <img src={imageUrl} alt="Adjunto" className="chat-image" />
                </div>
            )}

            {(content && content.trim().length > 0) && (
                parts.length === 0 ? (
                    <p className="message-text">{renderText(content, 'single')}</p>
                ) : (
                    parts.map((part, i) => {
                        if (part.type === 'text') {
                            return <span key={i} className="message-text-span">
                                {renderText(part.content, `part-${i}`)}
                            </span>
                        }
                        return (
                            <div
                                key={i}
                                className={`chat-card ${part.cardType.toLowerCase()}-card`}
                                onClick={() => handleCardClick(part)}
                                title="Ver detalles"
                            >
                                {part.image && (
                                    <div className="chat-card-media">
                                        <img src={part.image} alt="" />
                                    </div>
                                )}
                                <div className="chat-card-info">
                                    <span className="chat-card-type">{part.cardType === 'WORK' ? 'Obra' : part.cardType}</span>
                                    <h4>{part.title}</h4>
                                    {part.extra && <span className="chat-card-extra">{part.extra}</span>}
                                </div>
                            </div>
                        )
                    })
                )
            )}

            {/* YouTube embeds */}
            {youtubeEmbeds.map((videoId, i) => (
                <div key={`yt-${i}`} className="youtube-embed" onClick={() => window.open(`https://youtube.com/watch?v=${videoId}`, '_blank')}>
                    <img
                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                        alt="YouTube video"
                        className="youtube-thumbnail"
                    />
                    <div className="youtube-play-btn">▶</div>
                </div>
            ))}
        </div>
    )
}

// Generate contextual suggestions based on shared works and affinity
function generateContextualSuggestions(commonWorks, affinityScore) {
    const suggestions = []

    if (commonWorks?.length > 0) {
        const work = commonWorks[0]
        suggestions.push(`¿Qué te hizo añadir ${work.name} a tu tierlist? 🎮`)
        suggestions.push(`Veo que te gusta ${work.name}, ¿qué opinas? 👀`)
    }

    if (commonWorks?.length > 1) {
        suggestions.push(`Tenemos ${commonWorks.length} obras en común, ¿cuál es tu favorita?`)
    }

    if (affinityScore >= 70) {
        suggestions.push('¡Tenemos gustos muy parecidos! ¿Alguna recomendación? ✨')
    } else {
        suggestions.push('¿Alguna recomendación que te haya sorprendido?')
    }

    suggestions.push('¿Qué estás jugando/viendo últimamente?')

    return suggestions.slice(0, 5)
}

// Fallback suggestions when no shared works
const FALLBACK_SUGGESTIONS = [
    '¡Hola! 👋',
    '¿Qué estás jugando/viendo últimamente?',
    '¿Alguna recomendación?',
    '¡Tenemos gustos parecidos! ✨'
]

// Format relative time
function formatRelativeTime(date) {
    const now = new Date()
    const diff = now - new Date(date)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return new Date(date).toLocaleDateString()
}

export default function Chat() {
    const { connectionId } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()
    const messagesEndRef = useRef(null)
    const chatContainerRef = useRef(null)
    const inputRef = useRef(null)

    const [conversations, setConversations] = useState([])
    const [activeConversation, setActiveConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [showQuickReplies, setShowQuickReplies] = useState(false)
    const [showChatMenu, setShowChatMenu] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)

    // New states for enhancements
    const [replyTo, setReplyTo] = useState(null)
    const [imageFiles, setImageFiles] = useState([]) // Array for multiple images
    const [imagePreviews, setImagePreviews] = useState([]) // Array of preview URLs
    const [uploadingImage, setUploadingImage] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(null)
    const [editingMessage, setEditingMessage] = useState(null) // {id, content}
    const [youtubeUrl, setYoutubeUrl] = useState('')
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
    const [showMobileChatList, setShowMobileChatList] = useState(false)
    const [sharedContent, setSharedContent] = useState(null) // { type, id, title, image, extra, tag }
    const [geminiReplies, setGeminiReplies] = useState([])
    const [generatingSuggestions, setGeneratingSuggestions] = useState(false)
    const [showYoutubeInput, setShowYoutubeInput] = useState(false)
    const [selectedImage, setSelectedImage] = useState(null)
    const [isUserBlocked, setIsUserBlocked] = useState(false)
    const [blockerId, setBlockerId] = useState(null)
    const fileInputRef = useRef(null)

    // ... (Groq init)

    // ... (useEffect for connectionId)

    // Check if the other user is blocked (bidirectional)
    useEffect(() => {
        const checkBlockStatus = async () => {
            if (!user || !activeConversation?.otherUser?.user_id) return
            try {
                const { blocked, blockedByMe, blockedByThem } = await checkBlockRelationship(user.id, activeConversation.otherUser.user_id)
                setIsUserBlocked(blocked)

                // Priority logic for blockerId state
                if (blockedByMe) {
                    setBlockerId(user.id)
                } else if (blockedByThem) {
                    setBlockerId(activeConversation.otherUser.user_id)
                } else {
                    setBlockerId(null)
                }
            } catch (err) {
                console.error('Error checking block status:', err)
            }
        }
        checkBlockStatus()
    }, [user, activeConversation])

    // Initialize Groq
    const groq = new Groq({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true // Allowed for client-side demo
    })

    // Generate smart replies
    // Generate smart replies
    const generateSmartReplies = async (msgs = messages) => {
        if (!msgs || msgs.length === 0) return

        setGeneratingSuggestions(true)
        console.log("Generating smart replies for...", msgs.length, "messages")

        if (!import.meta.env.VITE_GROQ_API_KEY) {
            console.error("MISSING GROQ API KEY")
            setGeneratingSuggestions(false)
            return
        }

        try {
            const contextMessages = msgs.slice(-10).map(m =>
                `${m.sender_id === user.id ? 'Yo' : 'Otro usuario'}: ${m.content}`
            ).join('\n')

            const result = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Eres un asistente dentro de una app de chat para gamers/otakus (videojuegos, anime y cultura geek).
Dado un mensaje recibido, genera EXACTAMENTE 2 posibles respuestas que el usuario “Yo” podría enviar.
Las respuestas deben ser naturales, informales y realistas.
Máximo 10 palabras por respuesta.
No hagas preguntas largas ni respuestas robóticas.
Devuelve SOLO las 2 respuestas en una sola línea, separadas por una barra vertical (|).
No añadas explicaciones, ni texto extra.`
                    },
                    {
                        role: "user",
                        content: `Conversación:\n${contextMessages}\n\nRespuestas:`
                    }
                ],
                model: "llama-3.3-70b-versatile",
            })
            const text = result.choices[0]?.message?.content || ""

            const suggestions = text.split('|').map(s => s.trim()).filter(s => s.length > 0)
            if (suggestions.length > 0) {
                setGeminiReplies(suggestions.slice(0, 2))
            }
        } catch (error) {
            console.error("Error generating smart replies:", error)
            // Fallback will be handled by rendering logic (showing generic/contextual ones)
            setGeminiReplies([])
            alert("Error generando sugerencias (Quota exceeded o API Error)")
        } finally {
            setGeneratingSuggestions(false)
        }
    }

    // Reset replies when messages change or new conversation
    useEffect(() => {
        setGeminiReplies([])
        setShowQuickReplies(false)
    }, [connectionId])

    // Auto-show quick replies when gemini replies are available
    useEffect(() => {
        if (geminiReplies.length > 0) {
            setShowQuickReplies(true)
            inputRef.current?.focus()
        }
    }, [geminiReplies])

    // Helper to format message preview (strips tags or formats them)
    const formatMessagePreview = (content) => {
        if (!content) return '📷 Imagen'

        // Check for share tags
        const match = content.match(/\[(TIERLIST|WORK|DEBATE)\|([^|]+)\|([^|]+)(?:\|([^|]*))?(?:\|([^|]*))?\]/)
        if (match) {
            const [, type, id, title, image, extra] = match
            const emoji = type === 'TIERLIST' ? '📊' : type === 'WORK' ? (extra === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px' }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px' }} />) : <img src="/icons/dialog.png" alt="💬" style={{ width: '16px', height: '16px' }} />
            return `${emoji} ${title}`
        }

        // Check for YouTube
        if (content.match(/\[YOUTUBE\|/)) {
            return '📺 Video de YouTube'
        }

        return content
    }

    // Close emoji picker when clicking outside

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowEmojiPicker(null)
        if (showEmojiPicker) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [showEmojiPicker])

    // Load list of conversations/connections
    useEffect(() => {
        if (user) {
            loadAllConversations()
        }
    }, [user])

    // Load specific conversation when ID changes or list loads
    useEffect(() => {
        if (user && conversations.length > 0) {
            if (connectionId) {
                const found = conversations.find(c => c.connection_id === connectionId)
                if (found) {
                    selectConversation(found)
                }
            } else if (conversations.length > 0) {
                // Disabled auto-redirect for mobile usability
                // navigate(`/chat/${conversations[0].connection_id}`, { replace: true })
            }
        } else if (!connectionId) {
            setLoading(false)
        }
    }, [connectionId, user, conversations])

    const loadAllConversations = async () => {
        try {
            const data = await getConversations(user.id)
            setConversations(data)
        } catch (error) {
            console.error('Error loading conversations:', error)
        }
    }

    const selectConversation = async (conv) => {
        setActiveConversation(conv)
        setLoading(true)
        setShowQuickReplies(false)

        try {
            const msgs = await getMessages(conv.id, 50)
            setMessages(msgs)

            await markMessagesAsRead(conv.id, user.id)
            scrollToBottom()

            // Show quick replies if no messages yet
            if (msgs.length === 0) {
                setShowQuickReplies(true)
            }

            const unsubscribe = subscribeToMessages(conv.id, (payload) => {
                // Deduplicate - don't add if already exists
                setMessages(prev => {
                    const exists = prev.some(m => m.id === payload.id)
                    if (exists) return prev
                    return [...prev, payload]
                })
                scrollToBottom()

                if (payload.sender_id !== user.id) {
                    markMessagesAsRead(conv.id, user.id)
                }
            })

            setLoading(false)
            return () => unsubscribe()
        } catch (error) {
            console.error('Error loading messages:', error)
            setLoading(false)
        }
    }

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
    }

    const handleSend = async (e) => {
        e?.preventDefault()
        // Allow send if text, image, OR shared content exists
        if ((!newMessage.trim() && imageFiles.length === 0 && !sharedContent) || !activeConversation || uploadingImage) return

        const tempId = `temp-${Date.now()}`

        // Append shared content tag to message if exists
        let finalContent = newMessage.trim()
        if (sharedContent) {
            finalContent = finalContent ? `${finalContent} ${sharedContent.tag}` : sharedContent.tag
        }

        // Optimistic update
        const optimisticMessage = {
            id: tempId,
            conversation_id: activeConversation.id,
            sender_id: user.id,
            content: finalContent,
            created_at: new Date().toISOString(),
            is_read: false,
            _optimistic: true,
            _tempContent: finalContent,
            reply_to_id: replyTo?.id,
            replyTo: replyTo,
            image_url: imagePreviews[0] // Show first preview
        }

        try {
            setSending(true)

            // Upload all images
            let imageUrl = null
            if (imageFiles.length > 0) {
                setUploadingImage(true)
                // Upload first image (for now single image per message)
                // To support multiple: upload all and store as JSON array
                imageUrl = await uploadChatImage(imageFiles[0])
                setUploadingImage(false)
            }

            // Reset UI immediately
            setNewMessage('')
            setReplyTo(null)
            setSharedContent(null)
            clearImages()
            setShowQuickReplies(false)

            // Show optimistic
            setMessages(prev => [...prev, optimisticMessage])
            scrollToBottom()

            // Send to server
            const result = await sendMessage(activeConversation.id, user.id, finalContent, {
                replyToId: replyTo?.id,
                imageUrl: imageUrl
            })

            // Replace temp message
            if (result?.id) {
                setMessages(prev => prev.map(m =>
                    m.id === tempId
                        ? { ...result, _optimistic: false, replyTo: replyTo } // Keep replyTo context until reload
                        : m
                ))
            }

        } catch (error) {
            console.error('Error sending message:', error)
            setMessages(prev => prev.filter(m => m.id !== tempId))
            alert('Error al enviar mensaje')
            setUploadingImage(false)
        } finally {
            setSending(false)
            inputRef.current?.focus()
        }
    }

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return

        const validFiles = []
        const previews = []

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                alert('Solo se permiten imágenes')
                continue
            }
            if (file.size > 5 * 1024 * 1024) {
                alert(`${file.name} supera los 5MB`)
                continue
            }
            validFiles.push(file)
        }

        if (validFiles.length === 0) return

        // Create previews for all valid files
        validFiles.forEach(file => {
            const reader = new FileReader()
            reader.onload = (e) => {
                previews.push(e.target.result)
                if (previews.length === validFiles.length) {
                    setImagePreviews(prev => [...prev, ...previews])
                    setImageFiles(prev => [...prev, ...validFiles])
                }
            }
            reader.readAsDataURL(file)
        })
    }

    const clearImages = () => {
        setImageFiles([])
        setImagePreviews([])
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index))
        setImagePreviews(prev => prev.filter((_, i) => i !== index))
    }

    // Edit message handler
    const handleEditMessage = async () => {
        if (!editingMessage || !editingMessage.content.trim()) return

        try {
            await editMessage(editingMessage.id, user.id, editingMessage.content.trim())
            setMessages(prev => prev.map(m =>
                m.id === editingMessage.id
                    ? { ...m, content: editingMessage.content.trim(), edited_at: new Date().toISOString() }
                    : m
            ))
            setEditingMessage(null)
            setNewMessage('')
        } catch (error) {
            console.error('Error editing message:', error)
            alert('Error al editar el mensaje')
        }
    }

    // Delete message handler
    const handleDeleteMessage = async (messageId) => {
        if (!confirm('¿Seguro que quieres eliminar este mensaje?')) return

        try {
            await deleteMessage(messageId, user.id)
            setMessages(prev => prev.filter(m => m.id !== messageId))
        } catch (error) {
            console.error('Error deleting message:', error)
            alert('Error al eliminar el mensaje')
        }
    }

    // Parse YouTube URL to get video ID
    const parseYoutubeUrl = (url) => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ]
        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) return match[1]
        }
        return null
    }

    // Add YouTube video to message
    const handleAddYoutube = (urlToParse) => {
        const urlToCheck = urlToParse || youtubeUrl
        const videoId = parseYoutubeUrl(urlToCheck)

        if (!videoId) {
            alert('URL de YouTube no válida')
            return
        }
        setNewMessage(prev => prev + (prev ? ' ' : '') + `[YOUTUBE|${videoId}]`)
        setYoutubeUrl('')
        setShowYoutubeInput(false)
        inputRef.current?.focus()
    }

    const handleReaction = async (message, emoji) => {
        try {
            // Optimistic update
            const currentReactions = message.reactions || {}
            const userList = currentReactions[emoji] || []
            const hasReacted = userList.includes(user.id)

            let newReactions = { ...currentReactions }
            if (hasReacted) {
                newReactions[emoji] = userList.filter(id => id !== user.id)
                if (newReactions[emoji].length === 0) delete newReactions[emoji]
            } else {
                newReactions[emoji] = [...userList, user.id]
            }

            setMessages(prev => prev.map(m =>
                m.id === message.id ? { ...m, reactions: newReactions } : m
            ))

            await toggleMessageReaction(message.id, user.id, emoji)
        } catch (error) {
            console.error('Error toggling reaction:', error)
            // Revert on error would go here
        }
    }

    const handleQuickReply = (text) => {
        setNewMessage(text)
        setShowQuickReplies(false)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleBlockUser = async () => {
        if (!activeConversation?.otherUser?.user_id) return

        if (window.confirm('¿Estás seguro de que quieres bloquear a este usuario? No podrán contactarte.')) {
            try {
                await blockUser(user.id, activeConversation.otherUser.user_id)
                setShowChatMenu(false)
                navigate('/chat')
                loadAllConversations()
            } catch (error) {
                console.error('Error blocking user:', error)
                alert('Error al bloquear usuario')
            }
        }
    }

    // Group messages by date
    const groupedMessages = messages.reduce((groups, msg) => {
        const date = new Date(msg.created_at).toLocaleDateString()
        if (!groups[date]) groups[date] = []
        groups[date].push(msg)
        return groups
    }, {})

    if (conversations.length === 0 && !loading) {
        return (
            <div className="chat-empty-page">
                <div className="empty-state">
                    <div className="empty-icon"><img src="/icons/dialog.png" alt="💬" style={{ width: '64px', height: '64px', opacity: 0.5 }} /></div>
                    <h2>No tienes conversaciones activas</h2>
                    <p>Conecta con personas afines para empezar a chatear.</p>
                    <Link to="/discover" className="btn btn-primary btn-lg">
                        <img src="/icons/lupa.png" alt="🔍" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Ir a Descubrir
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="chat-layout">
            <ImageViewer src={selectedImage} onClose={() => setSelectedImage(null)} />

            {/* Sidebar list */}
            <aside className={`chat-sidebar ${!connectionId ? 'mobile-visible' : 'mobile-hidden'}`}>
                <div className="sidebar-header">
                    <Link to="/home" className="back-to-home-btn" title="Volver a inicio">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    </Link>
                    <h2><img src="/icons/dialog.png" alt="💬" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Mensajes</h2>
                    <span className="conv-count">{conversations.length}</span>
                </div>
                <div className="conversations-list">
                    {conversations.map(conv => (
                        <Link
                            key={conv.id}
                            to={`/chat/${conv.connection_id}`}
                            className={`conversation-item ${activeConversation?.id === conv.id ? 'active' : ''}`}
                        >
                            <div className="conv-avatar">
                                {conv.otherUser?.avatar_url ? (
                                    <img src={conv.otherUser.avatar_url} alt="" />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {conv.otherUser?.display_name?.charAt(0)}
                                    </div>
                                )}
                                <span className="online-indicator"></span>
                            </div>
                            <div className="conv-info">
                                <div className="conv-header-row">
                                    <span className="conv-name">{conv.otherUser?.display_name}</span>
                                    {conv.last_message_at && (
                                        <span className="conv-time">{formatRelativeTime(conv.last_message_at)}</span>
                                    )}
                                </div>
                                <div className="conv-preview">
                                    {conv.last_message_preview || <span><img src="/icons/star.png" alt="✨" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} /> Iniciar conversación</span>}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </aside>

            {/* Chat Area */}
            <main className={`chat-main ${connectionId ? 'mobile-visible' : 'mobile-hidden'}`}>
                {activeConversation ? (
                    <>
                        <header className="chat-header">
                            <Link to="/chat" className="back-btn mobile-only">
                                <span>←</span>
                            </Link>

                            <div className="header-user">
                                <Link to={`/profile/${activeConversation.otherUser?.username}`} className="header-avatar-link">
                                    {activeConversation.otherUser?.avatar_url ? (
                                        <img src={activeConversation.otherUser.avatar_url} alt="" className="header-avatar" />
                                    ) : (
                                        <div className="header-avatar placeholder">
                                            {activeConversation.otherUser?.display_name?.charAt(0)}
                                        </div>
                                    )}
                                </Link>
                                <div className="header-info">
                                    <h3>{activeConversation.otherUser?.display_name}</h3>
                                    <div className="header-meta">
                                        <span className="affinity-badge">
                                            <img src="/icons/star.png" alt="✨" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} /> {activeConversation.affinity_score || 0}%
                                        </span>
                                        {/* Shared works icons */}
                                        {activeConversation.commonWorks?.length > 0 && (
                                            <div className="shared-works-mini">
                                                {activeConversation.commonWorks.slice(0, 3).map((work, i) => (
                                                    <div
                                                        key={i}
                                                        className="shared-work-icon"
                                                        title={work.name}
                                                    >
                                                        {work.image_url ? (
                                                            <img src={work.image_url} alt={work.name} />
                                                        ) : (
                                                            <span>🎮</span>
                                                        )}
                                                    </div>
                                                ))}
                                                {activeConversation.commonWorks.length > 3 && (
                                                    <span className="shared-works-more">
                                                        +{activeConversation.commonWorks.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="header-actions">

                                {isUserBlocked ? (
                                    blockerId === user?.id ? (
                                        <button
                                            className="btn-success-pill"
                                            title="Desbloquear usuario"
                                            onClick={async () => {
                                                const otherUser = activeConversation.otherUser
                                                if (window.confirm(`¿Desbloquear a ${otherUser.display_name}?`)) {
                                                    try {
                                                        await unblockUser(user.id, otherUser.user_id)

                                                        // Re-check if we are still blocked by them
                                                        const { blocked, blockedByThem } = await checkBlockRelationship(user.id, otherUser.user_id)

                                                        if (blocked) {
                                                            setIsUserBlocked(true)
                                                            if (blockedByThem) {
                                                                setBlockerId(otherUser.user_id)
                                                            }
                                                        } else {
                                                            setIsUserBlocked(false)
                                                            setBlockerId(null)
                                                        }
                                                    } catch (error) {
                                                        console.error('Error unblocking user:', error)
                                                        alert('Error al desbloquear usuario')
                                                    }
                                                }
                                            }}
                                        >
                                            <span><img src="/icons/check.png" alt="✅" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Desbloquear</span>
                                        </button>
                                    ) : (
                                        // If blocked by other, show nothing or maybe a "Blocked" badge?
                                        // For now, let's just not show the unblock button.
                                        // Maybe we still allow blocking them back?
                                        <button
                                            className="btn-danger-pill"
                                            title="Bloquear usuario también"
                                            onClick={async () => {
                                                const otherUser = activeConversation.otherUser
                                                if (window.confirm(`¿Bloquear también a ${otherUser.display_name}?`)) {
                                                    try {
                                                        await blockUser(user.id, otherUser.user_id)
                                                        // Update to show that WE blocked them now (or mutual)
                                                        // Depending on backend, maybe we just refresh
                                                        setIsUserBlocked(true)
                                                        setBlockerId(user.id) // Optimistic update
                                                    } catch (error) {
                                                        alert('Error al bloquear usuario')
                                                    }
                                                }
                                            }}
                                        >
                                            <span>🚫 Bloquear</span>
                                        </button>
                                    )
                                ) : (
                                    <button
                                        className="btn-danger-pill"
                                        title="Bloquear usuario"
                                        onClick={async () => {
                                            const otherUser = activeConversation.otherUser
                                            if (!otherUser?.user_id) {
                                                alert('Error: No se pudo identificar al usuario')
                                                return
                                            }
                                            if (window.confirm(`¿Bloquear a ${otherUser.display_name}? No podrás enviar ni recibir mensajes.`)) {
                                                try {
                                                    await blockUser(user.id, otherUser.user_id)
                                                    setIsUserBlocked(true)
                                                    setBlockerId(user.id)
                                                } catch (error) {
                                                    console.error('Error blocking user:', error)
                                                    alert('Error al bloquear usuario')
                                                }
                                            }
                                        }}
                                    >
                                        <span>🚫 Bloquear</span>
                                    </button>
                                )}
                            </div>
                        </header>

                        {/* Messages Area */}
                        <div className="chat-messages" ref={chatContainerRef}>
                            {/* Group messages by date */}
                            {activeConversation.messages && activeConversation.messages.length === 0 ? (
                                <div className="chat-start-message">
                                    <div className="start-icon">👋</div>
                                    <h3>¡Saluda a {activeConversation.otherUser.display_name}!</h3>
                                    <p>Este es el comienzo de vuestra historia.</p>
                                    {activeConversation.commonWorks.length > 0 ? (
                                        <p>
                                            ¿Por qué no empezáis hablando de <strong>{activeConversation.commonWorks[0]?.name}</strong>?
                                        </p>
                                    ) : (
                                        <p>Envía un mensaje para empezar a hablar.</p>
                                    )}
                                </div>
                            ) : (
                                Object.entries(groupedMessages).map(([date, msgs]) => (
                                    <div key={date} className="message-group">
                                        <div className="date-separator">
                                            <span>{date === new Date().toLocaleDateString() ? 'Hoy' : date}</span>
                                        </div>
                                        {msgs.map((msg, idx) => {
                                            const isMe = msg.sender_id === user.id
                                            const showTime = idx === msgs.length - 1 ||
                                                msgs[idx + 1]?.sender_id !== msg.sender_id
                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`message-bubble ${isMe ? 'me' : 'them'} ${msg._optimistic ? 'sending' : ''}`}
                                                >
                                                    {/* REPLY BUTTON - Separate from reactions */}
                                                    <button
                                                        className="message-reply-btn"
                                                        title="Responder"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setReplyTo(msg)
                                                            inputRef.current?.focus()
                                                        }}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M9 14L4 9l5-5" />
                                                            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                                                        </svg>
                                                    </button>

                                                    {/* EDIT/DELETE Actions for own messages */}
                                                    {isMe && (
                                                        <div className="message-actions-menu">
                                                            <button
                                                                className="message-action-trigger"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                }}
                                                            >
                                                                ⋮
                                                            </button>
                                                            <div className="message-actions-dropdown">
                                                                <button onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setEditingMessage({ id: msg.id, content: msg.content })
                                                                    setNewMessage(msg.content)
                                                                    inputRef.current?.focus()
                                                                }}>
                                                                    ✏️ Editar
                                                                </button>
                                                                <button className="delete-action" onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDeleteMessage(msg.id)
                                                                }}>
                                                                    🗑️ Borrar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="message-content">
                                                        {msg.replyTo && (
                                                            <div className="chat-reply-preview">
                                                                <div className="reply-sender">
                                                                    {msg.replyTo.sender_id === user.id ? 'Tú' : activeConversation.otherUser.display_name}
                                                                </div>
                                                                <div className="reply-text">
                                                                    {formatMessagePreview(msg.replyTo.content)}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <MessageContent
                                                            content={msg.content}
                                                            commonWorks={activeConversation.commonWorks}
                                                            imageUrl={msg.image_url}
                                                            onImageClick={setSelectedImage}
                                                        />

                                                        {showTime && (
                                                            <span className="message-time">
                                                                {new Date(msg.created_at).toLocaleTimeString([], {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                                {isMe && msg._optimistic && <span className="sending-indicator">...</span>}
                                                            </span>
                                                        )}

                                                        {/* REACTION BUTTON - Floating in bubble */}
                                                        <div className="message-reaction-wrapper">
                                                            <button
                                                                className="message-reaction-btn"
                                                                title="Reaccionar"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)
                                                                }}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
                                                            </button>

                                                            {showEmojiPicker === msg.id && (
                                                                <div className="emoji-picker-popup">
                                                                    <div className="emoji-picker-quick">
                                                                        {['❤️', '😂', '👍', '😮', '😢', '🔥', '👏', '🎉'].map(emoji => (
                                                                            <button
                                                                                key={emoji}
                                                                                className="emoji-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    handleReaction(msg, emoji)
                                                                                    setShowEmojiPicker(null)
                                                                                }}
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                        <div className="message-reactions-floating">
                                                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                                                                <div
                                                                    key={emoji}
                                                                    className={`reaction-pill ${users.includes(user.id) ? 'active' : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleReaction(msg, emoji)
                                                                    }}
                                                                >
                                                                    <span>{emoji}</span>
                                                                    <span className="reaction-count">{users.length}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {showQuickReplies && (
                            <div className="quick-replies-panel">
                                {(geminiReplies.length > 0
                                    ? geminiReplies
                                    : (activeConversation?.commonWorks
                                        ? generateContextualSuggestions(
                                            activeConversation.commonWorks,
                                            activeConversation.affinity_score || 0
                                        )
                                        : FALLBACK_SUGGESTIONS
                                    )
                                ).map((text, i) => (
                                    <button
                                        key={i}
                                        className="quick-reply-btn"
                                        onClick={() => {
                                            handleQuickReply(text)
                                            setShowQuickReplies(false)
                                        }}
                                    >
                                        {text}
                                    </button>
                                ))}
                                {geminiReplies.length > 0 && (
                                    <button
                                        className="quick-reply-refresh-btn"
                                        onClick={() => generateSmartReplies()}
                                        disabled={generatingSuggestions}
                                        title="Generar nuevas respuestas"
                                    >
                                        {generatingSuggestions ? '⏳' : '🔄'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Blocked User State */}
                        {isUserBlocked ? (
                            <div className="blocked-chat-banner">
                                <div className="blocked-icon">🚫</div>
                                <div className="blocked-text">
                                    {blockerId === user?.id ? (
                                        <>
                                            <h4>Usuario bloqueado</h4>
                                            <p>Has bloqueado a {activeConversation.otherUser.display_name}. No puedes enviar ni recibir mensajes.</p>
                                        </>
                                    ) : (
                                        <>
                                            <h4>No disponible</h4>
                                            <p>No puedes enviar mensajes a este usuario.</p>
                                        </>
                                    )}
                                </div>
                                {blockerId === user?.id && (
                                    <button
                                        className="btn-success-pill"
                                        onClick={async () => {
                                            if (window.confirm(`¿Desbloquear a ${activeConversation.otherUser.display_name}?`)) {
                                                try {
                                                    await unblockUser(user.id, activeConversation.otherUser.user_id)

                                                    // Re-check if we are still blocked by them
                                                    const { blocked, blockedByThem } = await checkBlockRelationship(user.id, activeConversation.otherUser.user_id)

                                                    if (blocked) {
                                                        // If still blocked (by them), update state
                                                        setIsUserBlocked(true) // Should be true if they blocked us
                                                        if (blockedByThem) {
                                                            setBlockerId(activeConversation.otherUser.user_id)
                                                        }
                                                    } else {
                                                        setIsUserBlocked(false)
                                                        setBlockerId(null)
                                                    }
                                                } catch (error) {
                                                    alert('Error al desbloquear')
                                                }
                                            }
                                        }}
                                    >
                                        <span><img src="/icons/check.png" alt="✅" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Desbloquear</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                {replyTo && (
                                    <div className="reply-preview-floating">
                                        <div className="reply-preview-content">
                                            <div className="reply-preview-header">
                                                <span className="reply-icon">↩️</span>
                                                <span className="reply-target">
                                                    Respondiendo a {replyTo.sender_id === user.id ? 'ti mismo' : activeConversation.otherUser.display_name}
                                                </span>
                                            </div>
                                            <p className="reply-preview-text">
                                                {replyTo.content || (replyTo.image_url ? '📷 Imagen' : '...')}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="reply-cancel-btn"
                                            onClick={() => setReplyTo(null)}
                                            title="Cancelar respuesta"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                                <form className="chat-input-area" onSubmit={(e) => {
                                    if (editingMessage) {
                                        e.preventDefault()
                                        handleEditMessage()
                                    } else {
                                        handleSend(e)
                                    }
                                }}>
                                    {/* CLIP MENU Wrapper */}
                                    <div className="input-actions-group">
                                        <button
                                            type="button"
                                            className={`input-action-btn clip-btn ${showAttachmentMenu ? 'active' : ''}`}
                                            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                            title="Adjuntar"
                                        >
                                            📎
                                        </button>

                                        {showAttachmentMenu && (
                                            <div className="attachment-menu-popup">
                                                <button
                                                    type="button"
                                                    className="attach-option"
                                                    onClick={() => {
                                                        fileInputRef.current.click()
                                                        setShowAttachmentMenu(false)
                                                    }}
                                                >
                                                    <span className="attach-icon">📷</span>
                                                    <span>Imagen</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="attach-option"
                                                    onClick={() => {
                                                        setShowYoutubeInput(!showYoutubeInput)
                                                        setShowAttachmentMenu(false)
                                                    }}
                                                >
                                                    <span className="attach-icon" style={{ opacity: 0.8 }}><SocialIcons.YouTube width="10" height="10" /></span>
                                                    <span>YouTube</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="attach-option"
                                                    onClick={() => {
                                                        setIsShareModalOpen(true)
                                                        setShowAttachmentMenu(false)
                                                    }}
                                                >
                                                    <span className="attach-icon">📤</span>
                                                    <span>Compartir</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="attach-option"
                                                    onClick={() => {
                                                        if (geminiReplies.length > 0) {
                                                            setShowQuickReplies(!showQuickReplies)
                                                        } else {
                                                            generateSmartReplies()
                                                        }
                                                        setShowAttachmentMenu(false)
                                                    }}
                                                    disabled={generatingSuggestions}
                                                >
                                                    <span className="attach-icon">{generatingSuggestions ? '⏳' : '💡'}</span>
                                                    <span>{generatingSuggestions ? 'Generando...' : 'Sugerencias'}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="file-input"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />

                                    <div className="chat-input-wrapper enhanced-input">


                                        {sharedContent && (
                                            <div className="inline-share-preview">
                                                {sharedContent.image && <img src={sharedContent.image} alt="" className="inline-preview-img" />}
                                                <div className="inline-preview-info">
                                                    <span className="inline-preview-type">
                                                        {sharedContent.type === 'TIERLIST' ? '📊' : sharedContent.type === 'WORK' ? (sharedContent.extra === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px' }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px' }} />) : <img src="/icons/dialog.png" alt="💬" style={{ width: '16px', height: '16px' }} />}
                                                    </span>
                                                    <span className="inline-preview-title">{sharedContent.title}</span>
                                                </div>
                                                <button type="button" className="inline-remove-btn" onClick={() => setSharedContent(null)}>×</button>
                                            </div>
                                        )}

                                        {showYoutubeInput && (
                                            <div className="youtube-input-popup">
                                                <input
                                                    type="text"
                                                    placeholder="Pega aquí la URL de YouTube..."
                                                    value={youtubeUrl}
                                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            handleAddYoutube()
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="youtube-input-actions">
                                                    <button type="button" onClick={() => setShowYoutubeInput(false)} className="btn-cancel">✖</button>
                                                    <button type="button" onClick={() => handleAddYoutube()} className="btn-confirm">ADD</button>
                                                </div>
                                            </div>
                                        )}

                                        {imageFiles.length > 0 && (
                                            <div className="image-upload-preview-list">
                                                {imageFiles.map((file, idx) => (
                                                    <div key={idx} className="image-upload-preview-item">
                                                        <img src={URL.createObjectURL(file)} alt="" className="preview-img-thumb" />
                                                        <button type="button" className="remove-image-btn" onClick={() => removeImage(idx)}>×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <textarea
                                            ref={inputRef}
                                            value={newMessage}
                                            onChange={e => {
                                                if (editingMessage) {
                                                    setEditingMessage({ ...editingMessage, content: e.target.value })
                                                }
                                                setNewMessage(e.target.value)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    if (editingMessage) {
                                                        handleEditMessage()
                                                    } else {
                                                        handleSend(e)
                                                    }
                                                }
                                            }}
                                            placeholder={editingMessage ? "Editando mensaje..." : (sharedContent ? "Añade un comentario..." : "Escribe aquí...")}
                                            disabled={sending}
                                            maxLength={2000}
                                            rows={1}
                                            className="chat-textarea-mobile-big"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="send-btn"
                                        disabled={(!newMessage.trim() && imageFiles.length === 0) || sending}
                                    >
                                        {sending ? (
                                            <span className="sending-spinner"></span>
                                        ) : (
                                            <span>{editingMessage ? '💾' : '➤'}</span>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                    </>
                ) : (
                    <div className="chat-placeholder">
                        <LoadingSpinner />
                        <p>Cargando conversación...</p>
                    </div>
                )}
            </main>

            <ChatShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                onSelect={(content) => {
                    setSharedContent(content)
                    inputRef.current?.focus()
                }}
                userId={user?.id}
            />
        </div >
    )
}

