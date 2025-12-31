import { useState, useEffect } from 'react'
import { createReview, updateReview } from '../../lib/reviewService'
import { useAuth } from '../../context/AuthContext'
import './Reviews.css'

export default function ReviewForm({ workId, workType, onClose, onReviewAdded, initialData = null }) {
    const { user } = useAuth()
    const [rating, setRating] = useState(initialData?.rating || 0)
    const [title, setTitle] = useState(initialData?.title || '')
    const [content, setContent] = useState(initialData?.content || '')
    const [isSpoiler, setIsSpoiler] = useState(initialData?.is_spoiler || false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [hoverRating, setHoverRating] = useState(0)

    useEffect(() => {
        if (initialData) {
            setRating(initialData.rating)
            setTitle(initialData.title || '')
            setContent(initialData.content || '')
            setIsSpoiler(initialData.is_spoiler || false)
        }
    }, [initialData])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (rating === 0) {
            setError('Por favor selecciona una puntuación')
            return
        }
        if (!content.trim()) {
            setError('Escribe tu opinión')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            if (initialData) {
                await updateReview(initialData.id, {
                    title,
                    content: content.trim(),
                    rating,
                    isSpoiler
                })
            } else {
                await createReview({
                    workId,
                    workType,
                    title,
                    content: content.trim(),
                    rating,
                    isSpoiler,
                    userId: user.id
                })
            }

            if (onReviewAdded) onReviewAdded()
            if (onClose) onClose()
        } catch (err) {
            console.error(err)
            setError('Error al publicar la review')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="review-form-overlay" onClick={onClose}>
            <div className="review-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>&times;</button>
                <div className="modal-title">
                    {initialData ? 'Editar Review' : 'Escribir Review'}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Rating Stars - Large & Animated */}
                    <div className="form-rating-section">
                        <label className="input-label">Tu Puntuación</label>
                        <div className="star-input-group">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    className={`star-input ${star <= (hoverRating || rating) ? 'active' : ''}`}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="form-group">
                        <label className="input-label">Título (Opcional)</label>
                        <input
                            type="text"
                            className="modern-input"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ej: Una obra maestra indispensable"
                            maxLength={60}
                        />
                    </div>

                    {/* Content */}
                    <div className="form-group" style={{ marginTop: '1.5rem' }}>
                        <label className="input-label">Tu Reseña</label>
                        <textarea
                            className="modern-input"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="¿Qué te ha parecido? Personajes, historia, aspectos técnicos..."
                            rows={6}
                            maxLength={2000}
                            style={{ resize: 'vertical', minHeight: '120px' }}
                        />
                        <div className="char-counter">{content.length}/2000</div>
                    </div>

                    {/* Spoiler Toggle */}
                    <div className="form-group checkbox-group" style={{ marginTop: '1rem' }}>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isSpoiler}
                                onChange={e => setIsSpoiler(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>Contiene Spoilers</span>
                        </label>
                    </div>

                    {error && (
                        <div className="error-message" style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            padding: '0.8rem',
                            borderRadius: 'var(--radius-md)',
                            marginTop: '1rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-submit" disabled={submitting}>
                            {submitting ? 'Guardando...' : (initialData ? 'Actualizar' : 'Publicar Review')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
