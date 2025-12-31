import { useState } from 'react'
import { toggleReaction, REACTION_TYPES } from '../../lib/debateService'
import './DebateComponents.css'

export default function DebateReactions({
    postId,
    initialReaction = null,
    initialCounts = { good_argument: 0, interesting: 0, strong_opinion: 0 }
}) {
    const [currentReaction, setCurrentReaction] = useState(initialReaction)
    const [counts, setCounts] = useState(initialCounts)
    const [loading, setLoading] = useState(false)

    const handleReaction = async (reactionType) => {
        if (loading) return

        setLoading(true)
        try {
            // Optimistic update
            if (currentReaction === reactionType) {
                // Toggle off
                setCurrentReaction(null)
                setCounts(prev => ({
                    ...prev,
                    [reactionType]: Math.max(0, prev[reactionType] - 1)
                }))
            } else {
                // New reaction or switch
                if (currentReaction) {
                    setCounts(prev => ({
                        ...prev,
                        [currentReaction]: Math.max(0, prev[currentReaction] - 1)
                    }))
                }
                setCurrentReaction(reactionType)
                setCounts(prev => ({
                    ...prev,
                    [reactionType]: prev[reactionType] + 1
                }))
            }

            const result = await toggleReaction(postId, reactionType)

            // If API returns different result, sync
            if (result !== (currentReaction === reactionType ? null : reactionType)) {
                setCurrentReaction(result)
            }
        } catch (error) {
            console.error('Error toggling reaction:', error)
            // Revert on error
            setCurrentReaction(initialReaction)
            setCounts(initialCounts)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="debate-reactions">
            {Object.entries(REACTION_TYPES).map(([type, { emoji, label }]) => (
                <button
                    key={type}
                    className={`debate-reaction-btn ${currentReaction === type ? 'active' : ''}`}
                    onClick={() => handleReaction(type)}
                    disabled={loading}
                    title={label}
                >
                    <span>{emoji}</span>
                    {counts[type] > 0 && (
                        <span className="debate-reaction-count">{counts[type]}</span>
                    )}
                </button>
            ))}
        </div>
    )
}

