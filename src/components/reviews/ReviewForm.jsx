import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createReview, updateReview } from '../../lib/reviewService'
import { useAuth } from '../../context/AuthContext'
import './Reviews.css'

function formatReviewAge(dateValue) {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    if (elapsedSeconds < 60) return `hace ${elapsedSeconds} ${elapsedSeconds === 1 ? 'segundo' : 'segundos'}`

    const elapsedMinutes = Math.floor(elapsedSeconds / 60)
    if (elapsedMinutes < 60) return `hace ${elapsedMinutes} ${elapsedMinutes === 1 ? 'minuto' : 'minutos'}`

    const elapsedHours = Math.floor(elapsedMinutes / 60)
    if (elapsedHours < 24) return `hace ${elapsedHours} ${elapsedHours === 1 ? 'hora' : 'horas'}`

    const elapsedDays = Math.floor(elapsedHours / 24)
    if (elapsedDays < 7) return `hace ${elapsedDays} ${elapsedDays === 1 ? 'día' : 'días'}`

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReviewForm({ workId, workType, onClose, onReviewAdded, initialData = null }) {
    const { user, profile } = useAuth()
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

    return createPortal((
        <div className="review-form-overlay" onClick={onClose}>
            <div className="review-modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>&times;</button>
                {initialData?.created_at && (
                    <time className="review-modal-date" dateTime={initialData.created_at}>
                        {formatReviewAge(initialData.created_at)}
                    </time>
                )}
                <div className="modal-title">
                    {initialData ? 'Editar Review' : 'Escribir Review'}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="review-composer-layout">
                        <div className="review-composer-author">
                            <img
                                className="review-composer-avatar"
                                src={profile?.avatar_url || 'https://via.placeholder.com/64'}
                                alt={profile?.display_name || profile?.username || 'Tu perfil'}
                            />
                            <span className="review-composer-name">
                                {profile?.display_name || profile?.username || 'Tu perfil'}
                            </span>
                        </div>

                        <div className="review-composer-rating">
                            <div className="star-input-group">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        className={`star-input ${star <= (hoverRating || rating) ? 'active' : ''}`}
                                        aria-label={`${star} estrellas`}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setRating(star)}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                            <span className="review-composer-score">
                                {hoverRating || rating ? `${hoverRating || rating}.0` : '—'}
                            </span>
                        </div>

                        <div className="review-composer-fields">
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

                            <div className="form-group">
                                <label className="input-label">Tu Reseña</label>
                                <textarea
                                    className="modern-input"
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="¿Qué te ha parecido? Personajes, historia, aspectos técnicos..."
                                    rows={6}
                                    maxLength={2000}
                                    style={{ resize: 'vertical', minHeight: '120px', textAlign: 'left' }}
                                />
                                <div className="char-counter">{content.length}/2000</div>
                            </div>
                        </div>
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
    ), document.body)
}
