import { useState, useEffect } from 'react'
import { createReview, updateReview } from '../../lib/reviewService'
import { useAuth } from '../../context/AuthContext'

export default function QuickReviewModal({
    workId,
    workType,
    workTitle,
    imageUrl,
    existingReview,
    onClose,
    onSaved
}) {
    const { user } = useAuth()
    const [rating, setRating] = useState(existingReview?.rating || 0)
    const [hoverRating, setHoverRating] = useState(0)
    const [content, setContent] = useState(existingReview?.content || '')
    const [isSpoiler, setIsSpoiler] = useState(existingReview?.is_spoiler || false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            if (existingReview) {
                await updateReview(existingReview.id, {
                    title: existingReview.title || workTitle,
                    content,
                    rating,
                    isSpoiler
                })
            } else {
                await createReview({
                    workId,
                    workType,
                    title: workTitle,
                    content,
                    rating,
                    isSpoiler,
                    userId: user.id
                })
            }
            onSaved()
        } catch (error) {
            console.error(error)
            alert('Error al guardar la reseña')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Reseña: {workTitle}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {imageUrl && (
                        <div style={{ flexShrink: 0, width: '80px' }}>
                            <img 
                                src={imageUrl} 
                                alt={workTitle} 
                                style={{ width: '100%', borderRadius: '4px', aspectRatio: '3/4', objectFit: 'cover' }} 
                            />
                            <div style={{ 
                                marginTop: '0.5rem', 
                                textAlign: 'center', 
                                fontSize: '0.7rem', 
                                background: 'var(--bg-tertiary)', 
                                padding: '2px 4px', 
                                borderRadius: '4px',
                                color: 'var(--text-secondary)'
                            }}>
                                {workType === 'game' ? 'Juego' : 'Anime'}
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', gap: '4px', cursor: 'pointer' }} onMouseLeave={() => setHoverRating(0)}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <svg
                                        key={star}
                                        width="28" height="28" viewBox="0 0 24 24"
                                        fill={(hoverRating || rating) >= star ? '#fbbf24' : 'transparent'}
                                        stroke="#fbbf24" strokeWidth="2"
                                        strokeLinecap="round" strokeLinejoin="round"
                                        onMouseEnter={() => setHoverRating(star)}
                                        onClick={() => setRating(star)}
                                    >
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                ))}
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {rating > 0 ? `${rating} estrellas` : 'Sin calificación'}
                            </span>
                        </div>

                        <textarea
                            className="input"
                            placeholder={`Tu opinión sobre ${workTitle}... (Opcional)`}
                            rows={4}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            <input
                                type="checkbox"
                                checked={isSpoiler}
                                onChange={(e) => setIsSpoiler(e.target.checked)}
                            />
                            Contiene spoilers
                        </label>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                {isSubmitting ? 'Guardando...' : 'Guardar reseña'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
