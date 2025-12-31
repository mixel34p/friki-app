import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { DEBATE_TYPES } from '../../lib/debateService'
import './DebateComponents.css'

export default function DebateCard({ debate }) {
    const debateType = DEBATE_TYPES[debate.debate_type] || DEBATE_TYPES.opinion

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_small')
    }

    // Show max 3 covers, then +N
    const visibleMedia = debate.media?.slice(0, 3) || []
    const extraCount = (debate.media?.length || 0) - 3

    return (
        <Link to={`/debate/${debate.id}`} className="debate-card">
            <div className="debate-card-header">
                {/* Media Stack */}
                <div className="debate-media-stack">
                    {visibleMedia.map((media, index) => (
                        <img
                            key={`${media.media_type}-${media.id}`}
                            src={getHighResImage(media.cover_url)}
                            alt={media.name}
                            className="debate-media-cover"
                            style={{ zIndex: visibleMedia.length - index }}
                            onError={(e) => {
                                e.target.src = media.media_type === 'anime' ? '/icons/anime.png' : '/icons/videogame.png'
                            }}
                        />
                    ))}
                    {extraCount > 0 && (
                        <div className="debate-media-more">+{extraCount}</div>
                    )}
                </div>

                {/* Info */}
                <div className="debate-card-info">
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="debate-type-badge">
                            <span>
                                {debateType.emoji === '❓' ? (
                                    <img src="/icons/interrogation.png" alt="❓" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                ) : debateType.emoji === '⚖️' ? (
                                    <img src="/icons/scale.png" alt="⚖️" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                ) : debateType.emoji === '💭' ? (
                                    <img src="/icons/opinion.png" alt="💭" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                ) : debateType.emoji === '🏆' ? (
                                    <img src="/icons/medal.png" alt="🏆" style={{ width: '14px', height: '14px', verticalAlign: 'middle' }} />
                                ) : debateType.emoji}
                            </span>
                            <span>{debateType.label}</span>
                        </span>
                        {debate.is_locked && (
                            <span className="debate-locked-badge" style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                                borderRadius: 'var(--radius-full)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500
                            }}>
                                🔒 Cerrado
                            </span>
                        )}
                    </div>
                    <h3 className="debate-card-title">{debate.title}</h3>
                    <p className="debate-card-excerpt">{debate.content}</p>
                </div>
            </div>

            <div className="debate-card-footer">
                <div className="debate-card-author">
                    {debate.profiles?.avatar_url ? (
                        <img
                            src={debate.profiles.avatar_url}
                            alt=""
                            className="debate-card-avatar"
                        />
                    ) : (
                        <div
                            className="debate-card-avatar-placeholder"
                            style={{
                                background: `linear-gradient(135deg, ${debate.profiles?.color_primary || '#8b5cf6'}, ${debate.profiles?.color_secondary || '#6366f1'})`
                            }}
                        >
                            {debate.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                    <span className="debate-card-username">
                        {debate.profiles?.display_name || debate.profiles?.username}
                    </span>
                </div>

                <div className="debate-card-stats">
                    <span className="debate-card-stat">
                        <img src="/icons/dialog.png" alt="💬" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px', opacity: 0.7 }} /> {debate.posts_count}
                    </span>
                    <span className="debate-card-stat">
                        {formatDistanceToNow(new Date(debate.created_at), {
                            addSuffix: true,
                            locale: es
                        })}
                    </span>
                </div>
            </div>
        </Link>
    )
}
