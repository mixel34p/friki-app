import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import DebateReactions from './DebateReactions'
import './DebateComponents.css'

export default function DebatePost({
    post,
    isOriginal = false,
    debateMedia = [],
    onQuote,
    onDelete,
    currentUserId,
    debateOwnerId
}) {
    const [showMenu, setShowMenu] = useState(false)
    const [spoilerRevealed, setSpoilerRevealed] = useState(false)

    const canDelete = currentUserId === post.user_id || currentUserId === debateOwnerId
    const isSpoiler = post.is_spoiler && !spoilerRevealed

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_small')
    }

    const handleDelete = () => {
        if (window.confirm('¿Eliminar este post?')) {
            onDelete?.(post.id)
        }
        setShowMenu(false)
    }

    return (
        <div className={`debate-post ${isOriginal ? 'is-original' : ''} ${post.is_spoiler ? 'has-spoiler' : ''}`}>
            {/* Header */}
            <div className="debate-post-header">
                <Link to={`/profile/${post.profiles?.username}`}>
                    {post.profiles?.avatar_url ? (
                        <img
                            src={post.profiles.avatar_url}
                            alt=""
                            className="debate-post-avatar"
                        />
                    ) : (
                        <div
                            className="debate-post-avatar-placeholder"
                            style={{
                                background: `linear-gradient(135deg, ${post.profiles?.color_primary || '#8b5cf6'}, ${post.profiles?.color_secondary || '#6366f1'})`
                            }}
                        >
                            {post.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                </Link>

                <div className="debate-post-author-info">
                    <Link
                        to={`/profile/${post.profiles?.username}`}
                        className="debate-post-author"
                    >
                        {post.profiles?.display_name || post.profiles?.username}
                    </Link>
                    <span className="debate-post-meta">
                        {formatDistanceToNow(new Date(post.created_at), {
                            addSuffix: true,
                            locale: es
                        })}
                        {isOriginal && ' • Post original'}
                    </span>
                </div>

                {canDelete && (
                    <div className="debate-post-actions-menu">
                        <button
                            className="debate-post-menu-btn"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            ⋮
                        </button>
                        {showMenu && (
                            <div
                                className="dropdown-menu"
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-xs)',
                                    zIndex: 10
                                }}
                            >
                                <button
                                    onClick={handleDelete}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        color: 'var(--error)',
                                        cursor: 'pointer',
                                        fontSize: 'var(--text-sm)',
                                        width: '100%',
                                        textAlign: 'left'
                                    }}
                                >
                                    🗑️ Eliminar
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quoted Post */}
            {post.quoted_post && (
                <div className="debate-post-quote">
                    <div className="debate-post-quote-author">
                        ↩️ {post.quoted_post.profiles?.display_name || 'Usuario'}
                    </div>
                    <div className="debate-post-quote-content">
                        {post.quoted_post.content}
                    </div>
                </div>
            )}

            {/* Mentioned Media */}
            {post.mentionedMedia && (
                <Link
                    to={`/${post.mentionedMedia.media_type || 'game'}/${post.mentionedMedia.id}`}
                    className="debate-post-mentioned-media"
                    style={{ textDecoration: 'none' }}
                >
                    {post.mentionedMedia.cover_url && (
                        <img
                            src={getHighResImage(post.mentionedMedia.cover_url)}
                            alt=""
                            className="debate-post-mentioned-cover"
                        />
                    )}
                    <span className="debate-post-mentioned-name">
                        {post.mentionedMedia.name}
                    </span>
                </Link>
            )}

            {/* Content */}
            {isSpoiler ? (
                <div
                    className="debate-post-spoiler"
                    onClick={() => setSpoilerRevealed(true)}
                >
                    <div className="debate-post-spoiler-icon"><img src="/icons/lupa.png" alt="👁️" style={{ width: '24px', height: '24px' }} /></div>
                    <div className="debate-post-spoiler-text">
                        ⚠️ Este mensaje contiene spoilers
                    </div>
                    <div className="debate-post-spoiler-hint">
                        Click para revelar
                    </div>
                </div>
            ) : (
                <div className="debate-post-content">
                    {post.is_spoiler && (
                        <span className="debate-post-spoiler-badge">⚠️ Spoiler</span>
                    )}
                    {post.content}
                </div>
            )}

            {/* Footer */}
            <div className="debate-post-footer">
                {!isOriginal && (
                    <button
                        className="debate-post-reply-btn"
                        onClick={() => onQuote?.(post)}
                    >
                        ↩️ Citar
                    </button>
                )}
                {isOriginal && <div />}

                {!isOriginal && (
                    <DebateReactions
                        postId={post.id}
                        initialReaction={post.userReaction}
                        initialCounts={post.reactionCounts || { good_argument: 0, interesting: 0, strong_opinion: 0 }}
                    />
                )}
            </div>
        </div>
    )
}
