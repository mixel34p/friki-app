import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './RecommendationCard.css'

export default function RecommendationCard({ recommendation, onAddToLibrary }) {
    const { user } = useAuth()
    const [isAdding, setIsAdding] = useState(false)

    const { work_id, media_type, score, reasons, title, image_url } = recommendation

    // Determine link based on media type
    const detailsLink = media_type === 'game'
        ? `/game/${work_id}`
        : `/anime/${work_id}`

    const handleAddToLibrary = async (status = 'wishlist') => {
        if (!user || isAdding) return

        setIsAdding(true)
        try {
            if (onAddToLibrary) {
                await onAddToLibrary(recommendation, status)
            }
        } catch (error) {
            console.error('Error adding to library:', error)
        } finally {
            setIsAdding(false)
        }
    }

    // Determine score color
    const getScoreClass = () => {
        if (score >= 80) return 'high'
        if (score >= 60) return 'medium'
        return 'low'
    }

    return (
        <div className="recommendation-card">
            <Link to={detailsLink} className="recommendation-link">
                <div className="recommendation-image">
                    {image_url ? (
                        <img src={image_url} alt={title || 'Recommendation'} />
                    ) : (
                        <div className="recommendation-placeholder">
                            {media_type === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '40px', height: '40px', opacity: 0.5 }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '40px', height: '40px', opacity: 0.5 }} />}
                        </div>
                    )}

                    {/* Social Source Avatar (instead of score) */}
                    {reasons && reasons[0]?.type === 'following' && reasons[0]?.user?.avatar_url && (
                        <div className="recommendation-social-avatar" title={`Recomendado por ${reasons[0].user.username}`}>
                            <img src={reasons[0].user.avatar_url} alt={reasons[0].user.username} />
                        </div>
                    )}
                </div>

                <div className="recommendation-content">
                    <h3 className="recommendation-title">
                        {title || 'Sin título'}
                    </h3>

                    {reasons && reasons.length > 0 && (
                        <div className="recommendation-reasons">
                            {reasons.map((reason, i) => (
                                <div key={i} className="reason-item" title={reason.text}>
                                    <span className="reason-icon">
                                        {reason.icon === '✅' ? (
                                            <img src="/icons/check.png" alt="✅" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                        ) : reason.icon === '📋' ? (
                                            <img src="/icons/checklist.png" alt="📋" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                        ) : reason.icon === '🔥' ? (
                                            <img src="/icons/fire.gif" alt="🔥" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                        ) : reason.icon === '💯' ? (
                                            <img src="/icons/crown.png" alt="💯" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                        ) : reason.icon}
                                    </span>
                                    <span className="reason-text">{reason.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Link >

            <div className="recommendation-actions">
                <button
                    className="btn-add-quick"
                    onClick={() => handleAddToLibrary('wishlist')}
                    disabled={isAdding}
                    title="Añadir a wishlist"
                >
                    {isAdding ? '...' : '+ Lista de deseos'}
                </button>
            </div>
        </div >
    )
}
