import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import SpoilerNotice from '../components/reviews/SpoilerNotice'
import { getHomePosts } from '../lib/postService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import './Home.css'

function getAccentTextColor(color) {
    let channels
    const hex = String(color || '').match(/^#([\da-f]{3}|[\da-f]{6})$/i)
    if (hex) {
        let value = hex[1]
        if (value.length === 3) value = [...value].map(char => char + char).join('')
        channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16))
    } else {
        const rgb = String(color || '').match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
        if (rgb) channels = rgb.slice(1, 4).map(Number)
    }
    if (!channels) return '#fff'
    const luminance = channels.map(value => {
        const channel = value / 255
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
    const blackContrast = (luminance + .05) / .058
    const whiteContrast = 1.05 / (luminance + .05)
    return blackContrast >= whiteContrast ? '#17151a' : '#fff'
}

function PostCard({ post }) {
    const [revealed, setRevealed] = useState(false)
    const [mediaFrameHeight, setMediaFrameHeight] = useState(null)
    const author = post.author || {}
    const name = author.display_name || author.username || 'Usuario'
    const accent = author.theme_color || 'var(--brand-primary)'
    const media = Array.isArray(post.media) ? post.media : []
    const hasWarning = Boolean(post.contains_spoiler || post.is_sensitive)
    const warning = post.contains_spoiler
        ? `Spoiler de ${post.spoiler_work_title || 'la publicación'}`
        : 'Contenido sensible'
    const profilePath = author.username ? `/profile/${author.username}` : '/profile'
    const handleMediaLoad = event => {
        const image = event.currentTarget
        const isMobile = window.innerWidth <= 600
        const maxHeight = Math.min(window.innerHeight * (isMobile ? .42 : .42), isMobile ? 220 : 260)
        const proportionalHeight = image.parentElement.clientWidth * image.naturalHeight / Math.max(1, image.naturalWidth)
        setMediaFrameHeight(Math.min(proportionalHeight, maxHeight))
    }

    const accentText = getAccentTextColor(author.theme_color)
    const postText = post.body && (hasWarning && !revealed
        ? <SpoilerNotice text={post.body} label={`${warning} · pulsa para ver`} ariaLabel={`Mostrar ${warning}`} onReveal={() => setRevealed(true)} />
        : <Link className="home-post-text-link" to={`/posts/${post.id}`}><p className={media.length ? 'home-post-copy' : 'home-post-bubble'}>{post.body}</p></Link>)
    return <article className="home-post" style={{ '--home-post-accent': accent, '--home-post-text': accentText }}>
        <header className="home-post-header">
            <Link className="home-post-author" to={profilePath} aria-label={`Ver perfil de ${name}`}>
                <span className="home-post-avatar">
                    {author.avatar_url ? <img src={author.avatar_url} alt="" loading="lazy" /> : <span>{name.slice(0, 1).toLocaleUpperCase()}</span>}
                </span>
                <strong>{name}</strong>
            </Link>
            <time dateTime={post.created_at}>{formatRelativeDate(post.created_at)}</time>
        </header>
        <div className={`home-post-content${media.length ? ' has-media' : ''}`}>
            {!!media.length && (hasWarning && !revealed
                ? <button className="home-post-media-trigger" type="button" onClick={() => setRevealed(true)} aria-label={`Mostrar ${warning}`}>
                    <span className="home-post-media count-1 is-obscured" style={mediaFrameHeight ? { height: `${mediaFrameHeight}px` } : undefined}>
                        {media[0] && <img src={media[0].url} alt="" loading="lazy" onLoad={handleMediaLoad} />}
                        <span className="home-post-media-warning"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3 21 21"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11.3 11.3 0 0 1 12 5c5.5 0 9.5 4.5 10 7-.2 1.1-1.2 2.6-2.6 3.9"/><path d="M6.6 6.6C3.9 8.2 2.2 10.6 2 12c.5 2.5 4.5 7 10 7 1.2 0 2.3-.2 3.3-.6"/></svg><strong>{warning}</strong><small>Pulsa para ver</small></span>
                    </span>
                </button>
                : <Link className="home-post-media-link" to={`/posts/${post.id}`} aria-label={`Abrir publicación de ${name}`}><span className="home-post-media count-1" style={mediaFrameHeight ? { height: `${mediaFrameHeight}px` } : undefined}>
                    {media[0] && <img src={media[0].url} alt={media[0].name || ''} loading="lazy" onLoad={handleMediaLoad} />}
                </span></Link>)}
            {postText}
            {(hasWarning && revealed) && <Link className="home-post-open-link" to={`/posts/${post.id}`}>Abrir publicación</Link>}
        </div>
    </article>
}

export default function Home() {
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        getHomePosts(30)
            .then(items => { if (active) setPosts(items) })
            .catch(err => {
                console.error('No se pudieron cargar las publicaciones del inicio:', err)
                if (active) setError('No se pudieron cargar las publicaciones.')
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    return <main className="home-feed-page">
        {loading
            ? <div className="home-feed-state"><LoadingSpinner /></div>
            : error
                ? <p className="home-feed-state">{error}</p>
                : posts.length
                    ? <section className="home-post-grid" aria-label="Publicaciones">
                        {posts.reduce((columns, post) => {
                            const estimatedHeight = 64 + (post.body ? Math.min(150, Math.ceil(post.body.length / 34) * 22) : 0) + (post.media?.length ? 190 : 0)
                            const targetColumn = columns[0].height <= columns[1].height ? 0 : 1
                            columns[targetColumn].height += estimatedHeight + 12
                            columns[targetColumn].posts.push(post)
                            return columns
                        }, [{ height: 0, posts: [] }, { height: 0, posts: [] }]).map((column, index) => <div className="home-post-column" key={index}>
                            {column.posts.map(post => <PostCard key={post.id} post={post} />)}
                        </div>)}
                    </section>
                    : <p className="home-feed-state">Todavía no hay publicaciones.</p>}
    </main>
}
