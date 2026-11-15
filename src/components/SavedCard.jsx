import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PostCard } from '../pages/Home'
import { ListPostPreview } from '../pages/lists/ViewList'
import { savedHref, savedTitle } from '../lib/savedItemsPresentation'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { WorkStars } from './WorkRatings'
import DefaultAvatar from './DefaultAvatar'

function SavedPostHeader({ item, review = false }) {
  const author = item.author || {}
  const name = author.display_name || author.username || 'Usuario'
  const identity = <><span className="home-post-avatar">{author.avatar_url ? <img src={author.avatar_url} alt="" loading="lazy" /> : <DefaultAvatar accent={author.theme_color} />}</span><span className="saved-author-copy"><strong>{name}</strong>{review && item.rating != null && <WorkStars rating={Number(item.rating)} />}</span></>
  return <header className="home-post-header saved-post-header">
    {author.username ? <Link className="home-post-author" to={`/profile/${encodeURIComponent(author.username)}`}>{identity}</Link> : <span className="home-post-author">{identity}</span>}
    {item.created_at && <time dateTime={item.created_at}>{formatRelativeDate(item.created_at)}</time>}
  </header>
}

// Render the same list preview as its detail page on a fixed canvas, then scale
// the complete canvas into the column just like an image. No rows are cropped.
function SavedListImage({ list }) {
  const frame = useRef(null)
  const canvas = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const measure = () => {
      const width = frame.current?.clientWidth || 0
      const height = canvas.current?.offsetHeight || 0
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(frame.current)
    observer.observe(canvas.current)
    measure()
    return () => observer.disconnect()
  }, [])
  const scale = size.width / 640
  return <div className="saved-list-image" ref={frame} style={{ height: size.height && scale ? size.height * scale : 140 }}>
    <div className="saved-list-canvas" ref={canvas} style={{ transform: `scale(${scale || 1})`, visibility: size.width ? 'visible' : 'hidden' }}><ListPostPreview list={list} /></div>
  </div>
}

export default function SavedCard({ entry, onOpen, onRemove, removing }) {
  const item = entry.content
  const [coverFailed, setCoverFailed] = useState(false)
  const open = () => onOpen(entry)
  if (entry.type === 'post' && item) return <PostCard post={item} className="saved-card saved-card--post saved-card-open" />
  const accent = item?.author?.theme_color || 'var(--brand-primary)'
  const openFromCard = event => { if (!event.target.closest('a,button')) open() }
  const openFromKeyboard = event => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open() }
  }
  const cover = entry.type === 'review' ? item?.work?.image_url : item?.image_url || item?.cover_url
  if (!item) return <article className={`saved-card saved-card--${entry.type} saved-unavailable`}><div className="saved-unavailable-copy"><span>Contenido no disponible</span><small>Se ha eliminado o ya no tienes acceso.</small><button type="button" onClick={() => onRemove(entry)} disabled={removing}>{removing ? 'Quitando…' : 'Quitar de guardados'}</button></div></article>
  if (entry.type === 'work') return <article className="home-post saved-card saved-card--work"><Link className="saved-card-open saved-cover-button" to={savedHref(entry)} aria-label={`Ver ${savedTitle(entry)}`}>
    {cover && !coverFailed ? <img className="saved-full-cover" src={cover} alt={`Portada de ${savedTitle(entry)}`} loading="lazy" onError={() => setCoverFailed(true)} /> : <span className="saved-cover-placeholder">{savedTitle(entry)}</span>}
  </Link></article>
  return <article className={`home-post saved-card saved-card--${entry.type} saved-card-open`} role="link" tabIndex={0} aria-label={`Ver ${savedTitle(entry)}`} onClick={openFromCard} onKeyDown={openFromKeyboard} style={{ '--home-post-accent': accent, '--work-accent': accent }}>
    {entry.type === 'list' ? <><SavedPostHeader item={item} /><SavedListImage list={item} /></> : <>
      <div className="saved-review-details"><SavedPostHeader item={item} review /></div>
      <div className="saved-review-cover">
        {cover && !coverFailed ? <img className="saved-full-cover" src={cover} alt={`Portada de ${savedTitle(entry)}`} loading="lazy" onError={() => setCoverFailed(true)} /> : <span className="saved-cover-placeholder">{item.work?.title || 'Sin portada'}</span>}
      </div>
    </>}

  </article>
}
