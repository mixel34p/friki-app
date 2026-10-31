import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getComments, addComment, deleteComment } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import './CommentSection.css'

export default function CommentSection({ tierlistId, ownerId }) {
    const { user, profile } = useAuth()
    const [comments, setComments] = useState([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadComments()
    }, [tierlistId])

    const loadComments = async () => {
        try {
            const data = await getComments(tierlistId)
            setComments(data)
        } catch (error) {
            console.error('Error loading comments:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!newComment.trim() || submitting) return

        setSubmitting(true)
        try {
            const addedComment = await addComment(tierlistId, newComment)
            setComments(prev => [...prev, addedComment])
            setNewComment('')
        } catch (error) {
            console.error('Error posting comment:', error)
            alert('Error al comentar')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (commentId) => {
        if (!confirm('¿Borrar comentario?')) return
        try {
            await deleteComment(commentId)
            setComments(prev => prev.filter(c => c.id !== commentId))
        } catch (error) {
            console.error('Error deleting comment:', error)
            alert('Error al borrar')
        }
    }

    if (loading) return <div className="loading-spinner"></div>

    return (
        <section className="comments-section">
            <h3 className="section-title">Comentarios ({comments.length})</h3>

            <div className="comments-list">
                {comments.length === 0 ? (
                    <p className="no-comments">Sé el primero en comentar.</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="comment">
                            <Link to={`/profile/${comment.profiles.username}`} className="comment-avatar">
                                {comment.profiles.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} alt={comment.profiles.username} />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {comment.profiles.display_name?.[0].toUpperCase()}
                                    </div>
                                )}
                            </Link>
                            <div className="comment-content">
                                <div className="comment-header">
                                    <Link to={`/profile/${comment.profiles.username}`} className="comment-author">
                                        {comment.profiles.display_name}
                                    </Link>
                                    <span className="comment-date">
                                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                                    </span>
                                </div>
                                <p className="comment-text">{comment.content}</p>
                            </div>
                            {(user?.id === comment.user_id || user?.id === ownerId) && (
                                <button
                                    onClick={() => handleDelete(comment.id)}
                                    className="delete-comment-btn"
                                    title="Borrar comentario"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {user && profile ? (
                <form onSubmit={handleSubmit} className="comment-form">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario..."
                        maxLength={500}
                        rows={3}
                        required
                    />
                    <button type="submit" className="btn btn-primary" disabled={submitting || !newComment.trim()}>
                        {submitting ? 'Enviando...' : 'Comentar'}
                    </button>
                </form>
            ) : (
                <div className="login-prompt">
                    <Link to={user ? '/onboarding' : '/register'} className="comment-auth-link">
                        Inicia sesión para comentar
                    </Link>
                </div>
            )}
        </section>
    )
}
