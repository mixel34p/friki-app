import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createDebate, DEBATE_TYPES } from '../lib/debateService'
import MediaSelector from '../components/debates/MediaSelector'
import './Debates.css'

export default function CreateDebate() {
    const navigate = useNavigate()

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [debateType, setDebateType] = useState('opinion')
    const [selectedMedia, setSelectedMedia] = useState([])
    const [showMediaSelector, setShowMediaSelector] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        // Validations
        if (selectedMedia.length === 0) {
            setError('Debes seleccionar al menos una obra')
            return
        }

        if (title.trim().length < 5) {
            setError('El título debe tener al menos 5 caracteres')
            return
        }

        if (content.trim().length < 20) {
            setError('El contenido debe tener al menos 20 caracteres')
            return
        }

        setSubmitting(true)
        try {
            const debate = await createDebate({
                title: title.trim(),
                content: content.trim(),
                debateType,
                mediaItems: selectedMedia
            })

            navigate(`/debate/${debate.id}`)
        } catch (err) {
            console.error('Error creating debate:', err)
            setError(err.message || 'Error al crear el debate')
        } finally {
            setSubmitting(false)
        }
    }

    const handleRemoveMedia = (item) => {
        setSelectedMedia(prev => prev.filter(
            m => !(m.id === item.id && m.media_type === item.media_type)
        ))
    }

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_small')
    }

    return (
        <div className="create-debate-page">
            <div className="container">
                <Link
                    to="/debates"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-lg)',
                        fontSize: 'var(--text-sm)'
                    }}
                >
                    ← Volver a debates
                </Link>

                <h1>✍️ Crear nuevo debate</h1>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--error)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        color: 'var(--error)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        {error}
                    </div>
                )}

                <form className="create-debate-form" onSubmit={handleSubmit}>
                    {/* Media Selection */}
                    <div className="create-debate-section">
                        <label>
                            Obras relacionadas <span>*</span>
                        </label>
                        <p style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            Selecciona los juegos o anime sobre los que quieres debatir
                        </p>

                        {selectedMedia.length > 0 && (
                            <div className="create-debate-media-list">
                                {selectedMedia.map(item => (
                                    <div
                                        key={`${item.media_type}-${item.id}`}
                                        className="create-debate-media-item"
                                    >
                                        <img
                                            src={getHighResImage(item.cover_url)}
                                            alt=""
                                            onError={(e) => {
                                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" fill="%231c1c1c"><rect width="32" height="42"/></svg>'
                                            }}
                                        />
                                        <span title={item.name}>
                                            {item.media_type === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '4px' }} />} {item.name}
                                        </span>
                                        <button
                                            type="button"
                                            className="create-debate-media-remove"
                                            onClick={() => handleRemoveMedia(item)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            className="create-debate-add-media"
                            onClick={() => setShowMediaSelector(true)}
                        >
                            ➕ {selectedMedia.length > 0 ? 'Añadir más' : 'Seleccionar obras'}
                        </button>
                    </div>

                    {/* Debate Type */}
                    <div className="create-debate-section">
                        <label>Tipo de debate</label>
                        <div className="create-debate-types">
                            {Object.entries(DEBATE_TYPES).map(([key, { emoji, label }]) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={`create-debate-type-btn ${debateType === key ? 'active' : ''}`}
                                    onClick={() => setDebateType(key)}
                                >
                                    {emoji} {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="create-debate-section">
                        <label>
                            Título <span>*</span>
                        </label>
                        <input
                            type="text"
                            className="create-debate-input"
                            placeholder="Ej: ¿Cuál es el mejor Final Fantasy?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={150}
                            required
                        />
                        <div className="create-debate-char-count">
                            {title.length} / 150
                        </div>
                    </div>

                    {/* Content */}
                    <div className="create-debate-section">
                        <label>
                            Tu opinión / Post inicial <span>*</span>
                        </label>
                        <textarea
                            className="create-debate-textarea"
                            placeholder="Comparte tu punto de vista, argumentos o pregunta inicial..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            maxLength={5000}
                            required
                        />
                        <div className="create-debate-char-count">
                            {content.length} / 5000
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="create-debate-actions">
                        <Link to="/debates" className="btn btn-secondary">
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? 'Creando...' : '🚀 Crear debate'}
                        </button>
                    </div>
                </form>

                {/* Media Selector Modal */}
                <MediaSelector
                    isOpen={showMediaSelector}
                    onClose={() => setShowMediaSelector(false)}
                    onSelect={setSelectedMedia}
                    selectedMedia={selectedMedia}
                    maxSelections={5}
                />
            </div>
        </div>
    )
}
