import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { getPostById } from '../lib/postService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import './PostDetail.css'

export default function PostDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getPostById(postId).then(result => {
      if (active) setPost(result)
    }).catch(err => {
      console.error('No se pudo cargar la publicación:', err)
      if (active) setError('No se pudo cargar la publicación.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [postId])

  if (loading) return <div className="post-detail-state"><LoadingSpinner /></div>
  if (error || !post) return <main className="post-detail-page"><div className="post-detail-card"><button className="post-detail-back" type="button" onClick={() => navigate(-1)}>← Volver</button><h1>{error || 'Publicación no encontrada'}</h1></div></main>

  const author = post.author || {}
  const displayName = author.display_name || author.username || 'Usuario'
  const warningLabel = post.contains_spoiler && post.is_sensitive
    ? 'Esta publicación contiene spoilers y contenido sensible.'
    : post.contains_spoiler ? 'Esta publicación contiene spoilers.' : 'Esta publicación puede contener contenido sensible.'
  const media = Array.isArray(post.media) ? post.media : []

  return <main className="post-detail-page" style={{ '--post-accent': author.theme_color || 'var(--brand-primary)', '--post-backdrop': media[0]?.url ? `url("${media[0].url}")` : 'none' }}>
    <article className="post-detail-card">
      <button className="post-detail-back" type="button" onClick={() => navigate(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Volver</button>
      <header className="post-detail-author">
        <Link className="post-detail-avatar" to={author.username ? `/profile/${author.username}` : '/profile'}>
          {author.avatar_url ? <img src={author.avatar_url} alt="" /> : <span>{displayName.slice(0, 1).toLocaleUpperCase()}</span>}
        </Link>
        <div><Link className="post-detail-name" to={author.username ? `/profile/${author.username}` : '/profile'}>{displayName}</Link><span>@{author.username || 'usuario'} · {formatRelativeDate(post.created_at)}</span></div>
      </header>
      {(post.contains_spoiler || post.is_sensitive) && !revealed
        ? <button className="post-detail-warning" type="button" onClick={() => setRevealed(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2.1h16a1.4 1.4 0 0 0 1.2-2.1L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg><span>{warningLabel}<small>Pulsa para mostrar</small></span></button>
        : <>
          {(post.contains_spoiler || post.is_sensitive) && <div className="post-detail-warning is-revealed"><span>{warningLabel}</span><button type="button" onClick={() => setRevealed(false)}>Ocultar</button></div>}
          {post.spoiler_work_title && <div className="post-detail-spoiler-work">Spoiler: {post.spoiler_work_title}</div>}
          {post.body && <p className="post-detail-body">{post.body}</p>}
          {!!media.length && <div className={`post-detail-media count-${media.length}`}>
            {media.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir imagen ${index + 1}`}><img src={item.url} alt={item.name || ''} loading="lazy" /></a>)}
          </div>}
        </>}
    </article>
  </main>
}
