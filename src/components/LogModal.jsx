import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { logWork, deleteWorkLog } from '../lib/libraryService'
import LoadingSpinner from './LoadingSpinner'
import './LogModal.css'

export default function LogModal({ isOpen, onClose, work, existingLog, onSaveComplete }) {
    const { user } = useAuth()
    
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [reviewText, setReviewText] = useState('')
    const [containsSpoiler, setContainsSpoiler] = useState(false)
    const [finishedDate, setFinishedDate] = useState('')
    
    const [loading, setLoading] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (isOpen) {
            if (existingLog) {
                setRating(existingLog.rating || 0)
                setReviewText(existingLog.review_text || '')
                setContainsSpoiler(existingLog.contains_spoiler || false)
                setFinishedDate(existingLog.finished_date || '')
            } else {
                setRating(0)
                setReviewText('')
                setContainsSpoiler(false)
                setFinishedDate(new Date().toISOString().split('T')[0])
            }
        }
        setConfirmDelete(false)
    }, [isOpen, existingLog])

    if (!isOpen || !work) return null

    const handleSave = async () => {
        if (!user) return
        setLoading(true)
        setError(null)
        
        try {
            const logData = {
                rating: rating > 0 ? rating : null,
                review_text: reviewText.trim() || null,
                contains_spoiler: containsSpoiler,
                finished_date: finishedDate || null
            }
            
            await logWork(user.id, work.id, work.type, logData)
            if (onSaveComplete) onSaveComplete()
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!user) return
        setLoading(true)
        setError(null)
        try {
            await deleteWorkLog(user.id, work.id, work.type)
            if (onSaveComplete) onSaveComplete()
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const renderStars = () => {
        const displayRating = hoverRating > 0 ? hoverRating : rating;
        const stars = [];
        
        for (let i = 1; i <= 5; i++) {
            let fill = "transparent";
            let opacity = 0.25;
            
            if (displayRating >= i) {
                fill = "var(--brand-primary)";
                opacity = 1;
            } else if (displayRating === i - 0.5) {
                fill = "url(#halfGradient)";
                opacity = 1;
            }
            
            stars.push(
                <svg key={i} viewBox="0 0 24 24" className="log-star-svg">
                    <defs>
                        <linearGradient id="halfGradient">
                            <stop offset="50%" stopColor="var(--brand-primary)" />
                            <stop offset="50%" stopColor="transparent" stopOpacity="1" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={fill}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        style={{ opacity, transition: 'all 0.1s' }}
                    />
                </svg>
            );
        }
        
        return (
            <div className="log-star-system" onMouseLeave={() => setHoverRating(0)}>
                <div className="log-star-visuals">
                    {stars}
                </div>
                {/* 10 invisible blocks overlaid on top as hover zones */}
                <div className="log-star-hitboxes">
                    {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(val => (
                        <div 
                            key={val} 
                            className="log-star-hitbox" 
                            onMouseEnter={() => setHoverRating(val)}
                            onClick={() => setRating(prev => prev === val ? 0 : val)}
                        ></div>
                    ))}
                </div>
                <div className="log-star-divider" />
                <div className={`log-star-number${displayRating === 0 ? ' empty' : ''}`}>
                    {displayRating > 0 ? displayRating.toFixed(1) : '−'}
                </div>
            </div>
        );
    }

    return createPortal((
        <div className="log-modal-overlay">
            <div className="log-modal-compact" onClick={event => event.stopPropagation()}>
                
                <button className="log-close-btn" onClick={onClose}>&times;</button>
                
                <div className="log-header-compact">
                    <div className="log-header-bg" style={{ backgroundImage: `url(${work.banner_url || work.image})` }}></div>
                    <div className="log-header-content">
                        <div className="log-poster-thumb" style={{ backgroundImage: `url(${work.image})` }}></div>
                        <div className="log-header-info">
                            <span className="log-badge">{work.type === 'game' ? 'VIDEOJUEGO' : 'ANIME'}</span>
                            <h2 className="log-title-compact">{work.title}</h2>
                        </div>
                    </div>
                </div>

                <div className="log-body-compact">

                    {existingLog && (
                        <div className="log-already-banner">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
                                <path d="M12 8v4M12 16h.01"/>
                            </svg>
                            Ya tienes esta obra registrada. Puedes actualizar tu valoración o eliminarla.
                        </div>
                    )}

                    <div className="log-row-compact">
                        <div className="log-field">
                            <label>Terminado el</label>
                            <input 
                                type="date" 
                                className="log-date-clean"
                                value={finishedDate}
                                onChange={(e) => setFinishedDate(e.target.value)}
                            />
                        </div>
                        
                        <div className="log-field log-rating-block">
                            <label>Valoración</label>
                            {renderStars()}
                        </div>
                    </div>

                    <div className="log-field" style={{ marginTop: '0.25rem' }}>
                        <label>Reseña <span className="log-muted">(Opcional)</span></label>
                        <textarea 
                            className="log-textarea-clean"
                            placeholder="Escribe lo que te ha parecido..."
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                        ></textarea>
                    </div>

                    <label className="log-spoiler-toggle">
                        <input 
                            type="checkbox"
                            checked={containsSpoiler}
                            onChange={(e) => setContainsSpoiler(e.target.checked)}
                        />
                        <span className="log-spoiler-checkbox">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </span>
                        <span className="log-spoiler-text">Esta reseña contiene spoilers</span>
                    </label>

                    {error && <div className="log-error-box">{error}</div>}

                    {confirmDelete ? (
                        <div className="log-confirm-delete">
                            <span>¿Eliminar este registro?</span>
                            <div className="log-confirm-actions">
                                <button className="log-confirm-cancel" onClick={() => setConfirmDelete(false)} disabled={loading}>
                                    Cancelar
                                </button>
                                <button className="log-confirm-yes" onClick={handleDelete} disabled={loading}>
                                    {loading ? <LoadingSpinner size="sm" /> : 'Sí, eliminar'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="log-footer-actions">
                            {existingLog ? (
                                <button className="log-btn-delete" onClick={() => setConfirmDelete(true)} disabled={loading}>
                                    Eliminar
                                </button>
                            ) : (
                                <div></div>
                            )}
                            <button className="log-btn-save" onClick={handleSave} disabled={loading}>
                                {loading ? <LoadingSpinner size="sm" /> : (existingLog ? 'Actualizar' : 'Guardar')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    ), document.body)
}

