import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    REACTION_TYPES,
    REACTION_LABELS,
    toggleReaction,
    getReactions,
    getUserReaction,
    formatReactionsText
} from '../lib/thematicReactionsService'
import './ThematicReactions.css'

export default function ThematicReactions({ targetType, targetId }) {
    const { user } = useAuth()
    const [reactions, setReactions] = useState({})
    const [userReaction, setUserReaction] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadReactions()
    }, [targetType, targetId, user])

    const loadReactions = async () => {
        try {
            const [counts, userRxn] = await Promise.all([
                getReactions(targetType, targetId),
                user ? getUserReaction(user.id, targetType, targetId) : Promise.resolve(null)
            ])

            setReactions(counts)
            setUserReaction(userRxn)
        } catch (error) {
            console.error('Error loading reactions:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleReactionClick = async (reactionType) => {
        if (!user) return

        try {
            const result = await toggleReaction(user.id, targetType, targetId, reactionType)

            if (result.success) {
                // Recargar reacciones
                await loadReactions()
            }
        } catch (error) {
            console.error('Error toggling reaction:', error)
        }
    }

    if (loading) {
        return null
    }

    const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0)
    const summaryText = formatReactionsText(reactions)

    return (
        <div className="thematic-reactions">
            <div className="reactions-buttons">
                {Object.entries(REACTION_LABELS).map(([type, { icon, label }]) => {
                    const count = reactions[type] || 0
                    const isActive = userReaction === type

                    return (
                        <button
                            key={type}
                            className={`reaction-btn ${isActive ? 'active' : ''}`}
                            onClick={() => handleReactionClick(type)}
                            disabled={!user}
                            title={label}
                        >
                            <img src={icon} alt={label} className="reaction-image" />
                            <span className="reaction-label">{label}</span>
                            {count > 0 && <span className="reaction-count">{count}</span>}
                        </button>
                    )
                })}
            </div>

            {totalReactions > 0 && summaryText && (
                <div className="reactions-summary">
                    {summaryText}
                </div>
            )}
        </div>
    )
}
