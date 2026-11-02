import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SpoilerNotice from '../components/reviews/SpoilerNotice'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import { getHomePosts } from '../lib/postService'
import { getHomeSnapshot, getFollowingUserIds } from '../lib/homeService'
import { getUsersByCommonWorks } from '../lib/discoverUsersService'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { getSpaces } from '../lib/spaceService'
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

function getListCoverImages(content) {
    const images = []
    const addImage = item => {
        const image = item?.image_url || item?.cover_url || item?.cover?.url
        if (image && !images.includes(image)) images.push(image)
    }
    const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
    const groups = Array.isArray(content) ? [content] : [
        ...priorities.filter(key => content?.[key] != null).map(key => content[key]),
        ...Object.keys(content || {}).filter(key => !priorities.includes(key)).map(key => content[key]),
    ]
    for (const group of groups) {
        for (const item of Array.isArray(group) ? group : [group]) {
            addImage(item)
            if (images.length === 4) return images
        }
    }
    return images
}

export function PostCard({ post, hideAvatar = false, hideAuthor = false, useDesktopMediaSizing = false }) {
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
        const maxHeight = useDesktopMediaSizing
            ? 260
            : Math.min(window.innerHeight * .42, isMobile ? 220 : 260)
        const proportionalHeight = image.parentElement.clientWidth * image.naturalHeight / Math.max(1, image.naturalWidth)
        setMediaFrameHeight(Math.min(proportionalHeight, maxHeight))
    }

    const accentText = getAccentTextColor(author.theme_color)
    const postText = post.body && (hasWarning && !revealed
        ? <SpoilerNotice text={post.body} label={`${warning} · pulsa para ver`} ariaLabel={`Mostrar ${warning}`} onReveal={() => setRevealed(true)} />
        : <Link className="home-post-text-link" to={`/posts/${post.id}`}><p className={media.length ? 'home-post-copy' : 'home-post-bubble'}>{post.body}</p></Link>)
    return <article className="home-post" style={{ '--home-post-accent': accent, '--home-post-text': accentText }}>
        <header className="home-post-header">
            {!hideAuthor && <Link className="home-post-author" to={profilePath} aria-label={`Ver perfil de ${name}`}>
                {!hideAvatar && <span className="home-post-avatar">
                    {author.avatar_url ? <img src={author.avatar_url} alt="" loading="lazy" /> : <DefaultAvatar accent={author.theme_color} />}
                </span>}
                <strong>{name}</strong>
            </Link>}
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
        </div>
    </article>
}

export default function Home() {
    const { user, profile, loading: authLoading } = useAuth()
    const isGuest = !authLoading && !user
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeFeed, setActiveFeed] = useState('home')
    const [snapshot, setSnapshot] = useState(null)
    const [snapshotError, setSnapshotError] = useState(false)
    const [compatibleUser, setCompatibleUser] = useState(null)
    const [activeSpaces, setActiveSpaces] = useState([])
    const [activeSpacesLoading, setActiveSpacesLoading] = useState(true)

    useEffect(() => {
        let active = true
        setLoading(true)
        setError('')
        const loadPosts = activeFeed === 'following'
            ? getFollowingUserIds(user?.id).then(ids => getHomePosts(30, ids, user?.id))
            : getHomePosts(30, null, user?.id)
        loadPosts
            .then(items => { if (active) setPosts(items) })
            .catch(err => {
                console.error('No se pudieron cargar las publicaciones del inicio:', err)
                if (active) setError('No se pudieron cargar las publicaciones.')
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [activeFeed, user?.id])

    useEffect(() => {
        let active = true
        getHomeSnapshot()
            .then(data => { if (active) setSnapshot(data) })
            .catch(err => {
                console.error('No se pudo cargar el resumen de hoy:', err)
                if (active) setSnapshotError(true)
            })
        return () => { active = false }
    }, [])

    useEffect(() => {
        let active = true
        setCompatibleUser(null)
        if (!user?.id) return () => { active = false }
        getUsersByCommonWorks(user.id)
            .then(people => { if (active) setCompatibleUser(people.find(person => person.commonWorks > 0) || null) })
            .catch(err => console.error('No se pudo cargar el usuario compatible:', err))
        return () => { active = false }
    }, [user?.id])

    useEffect(() => {
        let active = true
        getSpaces()
            .then(spaces => {
                if (!active) return
                setActiveSpaces((spaces || [])
                    .map(space => ({ ...space, memberCount: space.space_members?.[0]?.count ?? 0 }))
                    .sort((a, b) => b.memberCount - a.memberCount)
                    .slice(0, 3))
            })
            .catch(error => console.error('No se pudieron cargar los espacios activos:', error))
            .finally(() => { if (active) setActiveSpacesLoading(false) })
        return () => { active = false }
    }, [])

    const today = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
    const workPath = work => work ? `/${work.type}/${work.id}` : '#'
    const reviewWork = snapshot?.review?.work
    const recentListImages = getListCoverImages(snapshot?.recentList?.content)

    return <main className={`home-feed-layout${isGuest ? ' is-guest' : ''}`}>
      <div className="home-feed-page">
        {isGuest && <section className="home-guest-create-actions is-mobile" aria-label="Crear una lista">
          <header className="home-daily-header"><h1>Empieza una lista</h1></header>
          <Link to="/lists/new?type=grid"><span className="home-guest-create-icon" aria-hidden="true">▦</span><strong>Crear un grid</strong><b aria-hidden="true">→</b></Link>
          <Link to="/lists/new?type=tierlist"><span className="home-guest-create-icon" aria-hidden="true">≡</span><strong>Crear una tierlist</strong><b aria-hidden="true">→</b></Link>
        </section>}
        {snapshot?.daily?.work && <section className="home-mobile-daily" aria-label="Resumen de hoy">
          {snapshot.daily.work.image && <span className="home-mobile-daily-backdrop" aria-hidden="true"><img src={snapshot.daily.work.image} alt="" loading="lazy" /></span>}
          <div className="home-mobile-daily-heading"><h1>Resumen de hoy</h1><time>{today}</time></div>
          <Link className="home-mobile-daily-card" to={workPath(snapshot.daily.work)}>
            <span className="home-mobile-daily-cover">{snapshot.daily.work.image ? <img src={snapshot.daily.work.image} alt="" loading="lazy" /> : '✦'}</span>
            <span className="home-mobile-daily-copy">
              <small className="home-summary-eyebrow">{snapshot.daily.work.type === 'anime' ? 'Anime' : 'Videojuego'} más registrado hoy</small>
              <strong>{snapshot.daily.work.title}</strong>
              <small className={`home-summary-daily-rating${snapshot.daily.ratingAverage == null ? ' is-unrated' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {snapshot.daily.ratingAverage == null ? <span aria-label="Sin valoraciones">–</span> : snapshot.daily.ratingAverage.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                {' · '}{snapshot.daily.count.toLocaleString('es-ES')} {snapshot.daily.count === 1 ? 'registro' : 'registros'}
              </small>
            </span>
          </Link>
        </section>}
        <nav className="home-feed-tabs" aria-label="Secciones del inicio">
            <button type="button" className={activeFeed === 'home' ? 'is-active' : ''} onClick={() => setActiveFeed('home')} aria-pressed={activeFeed === 'home'}>Inicio</button>
            <button type="button" className={activeFeed === 'following' ? 'is-active' : ''} onClick={() => setActiveFeed('following')} aria-pressed={activeFeed === 'following'}>Siguiendo</button>
        </nav>
        {loading
            ? <section className="home-post-grid home-post-grid-skeleton" aria-label="Cargando publicaciones" aria-busy="true">
                {[0, 1].map(column => <div className="home-post-column" key={column}>
                  {[0, 1, 2].map((card, index) => <article className="home-post-skeleton" key={card} aria-hidden="true">
                    <div className="home-post-skeleton-header"><span className="home-skeleton-block is-avatar" /><span className="home-skeleton-block is-name" /><span className="home-skeleton-block is-time" /></div>
                    {((column + index) % 2 === 0) && <span className="home-skeleton-block is-media" />}
                    <div className="home-post-skeleton-copy"><span /><span /><span /></div>
                  </article>)}
                </div>)}
              </section>
            : error
                ? <p className="home-feed-state">{error}</p>
                : posts.length
                    ? <section className="home-post-grid" aria-label={activeFeed === 'following' ? 'Publicaciones de personas que sigues' : 'Publicaciones'}>
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
                    : <p className="home-feed-state">{activeFeed === 'following' ? 'Todavía no hay publicaciones de las personas que sigues.' : 'Todavía no hay publicaciones.'}</p>}
      </div>
      <aside className="home-daily-summary" aria-label="Resumen de hoy">
        {isGuest && <section className="home-guest-create-actions is-desktop" aria-label="Crear una lista">
          <header className="home-daily-header"><h1>Empieza una lista</h1></header>
          <Link to="/lists/new?type=grid"><span className="home-guest-create-icon" aria-hidden="true">▦</span><strong>Crear un grid</strong><b aria-hidden="true">→</b></Link>
          <Link to="/lists/new?type=tierlist"><span className="home-guest-create-icon" aria-hidden="true">≡</span><strong>Crear una tierlist</strong><b aria-hidden="true">→</b></Link>
        </section>}
        <header className="home-daily-header">
          <h1>Resumen de hoy</h1>
          <time>{today}</time>
        </header>
        {snapshotError && <p className="home-summary-empty">No se pudo cargar el resumen ahora mismo.</p>}
        {!snapshot && !snapshotError && <div className="home-summary-loading" aria-label="Cargando resumen" aria-busy="true">
          <span className="home-summary-skeleton-cover" aria-hidden="true" />
          <span className="home-summary-skeleton-copy" aria-hidden="true"><i /><i /><i /></span>
        </div>}
        {snapshot && <>
          <section className="home-summary-daily-work">
            {snapshot.daily?.work
              ? <Link className="home-summary-daily-link" to={workPath(snapshot.daily.work)}>
                  <span className="home-summary-daily-cover">{snapshot.daily.work.image ? <img src={snapshot.daily.work.image} alt="" loading="lazy" /> : '✦'}</span>
                  <span>
                    <small className="home-summary-eyebrow">{snapshot.daily.work.type === 'anime' ? 'Anime' : 'Videojuego'} más registrado hoy</small>
                    <strong>{snapshot.daily.work.title}</strong>
                    <small className={`home-summary-daily-rating${snapshot.daily.ratingAverage == null ? ' is-unrated' : ''}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      {snapshot.daily.ratingAverage == null ? <span aria-label="Sin valoraciones">–</span> : snapshot.daily.ratingAverage.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      {' · '}{snapshot.daily.count.toLocaleString('es-ES')} {snapshot.daily.count === 1 ? 'registro' : 'registros'}
                    </small>
                  </span>
                </Link>
              : <p className="home-summary-empty">Todavía no hay registros de hoy.</p>}
          </section>
          <section className="home-summary-review">
            {snapshot.review && reviewWork
              ? <Link to={`/reviews/${snapshot.review.id}`} className="home-summary-review-card">
                  <span className="home-summary-review-avatar" style={{ '--review-accent': snapshot.review.profile?.theme_color || 'var(--brand-primary)' }}>{snapshot.review.profile?.avatar_url ? <img src={snapshot.review.profile.avatar_url} alt="" loading="lazy" /> : <DefaultAvatar accent={snapshot.review.profile?.theme_color} />}</span>
                  <span className="home-summary-review-copy">
                    <small className="home-summary-eyebrow">Reseña reciente</small>
                    <strong className="home-summary-review-quote">“{snapshot.review.review_text}”</strong>
                    <span className="home-summary-review-meta">
                      {snapshot.review.rating != null && <span className="home-summary-review-stars" style={{ '--review-accent': snapshot.review.profile?.theme_color || 'var(--brand-primary)' }} aria-label={`${snapshot.review.rating} de 5 estrellas`}><span>{'★'.repeat(Math.round(snapshot.review.rating))}</span><i>{'★'.repeat(5 - Math.round(snapshot.review.rating))}</i></span>}
                      <span className="home-summary-review-work">{snapshot.review.profile?.display_name || snapshot.review.profile?.username || 'Usuario'} sobre {reviewWork.title}</span>
                    </span>
                  </span>
                </Link>
              : <p className="home-summary-empty">Aún no hay reseñas recientes.</p>}
          </section>
          <section className="home-summary-recent-list">
            {snapshot.recentList
              ? <Link className="home-summary-recent-list-link" to={`/lists/${snapshot.recentList.id}`}>
                  <span className={`home-summary-recent-list-cover${recentListImages.length === 2 ? ' count-two' : ''}${recentListImages.length === 3 ? ' count-three' : ''}`} aria-hidden="true">
                    {recentListImages.length
                      ? recentListImages.map(image => <img key={image} src={image} alt="" loading="lazy" />)
                      : <span className="home-summary-recent-list-empty">Lista</span>}
                  </span>
                  <span className="home-summary-recent-list-copy">
                    <small className="home-summary-eyebrow">Lista reciente</small>
                    <strong>{snapshot.recentList.title || 'Lista sin título'}</strong>
                    <small>por {snapshot.recentList.profile?.display_name || snapshot.recentList.profile?.username || 'Usuario'}</small>
                  </span>
                </Link>
              : <p className="home-summary-empty">Todavía no hay listas públicas.</p>}
          </section>
        </>}
        <section className="home-active-spaces" aria-label="Espacios activos">
          <header className="home-active-spaces-header"><h2>Espacios activos</h2><Link to="/discover/spaces">todo <span aria-hidden="true">→</span></Link></header>
          {activeSpacesLoading
            ? <div className="home-active-spaces-skeleton" aria-label="Cargando espacios activos" aria-busy="true">
                {[0, 1, 2].map(index => <div className="home-active-space-skeleton" key={index} aria-hidden="true">
                  <span className="home-space-skeleton-avatar" />
                  <span className="home-space-skeleton-copy"><i /><i /></span>
                </div>)}
              </div>
            : activeSpaces.map(space => <Link className="home-active-space" to={`/spaces/${space.id}`} key={space.id} style={{ '--space-accent': space.theme_color || 'var(--brand-primary)' }}>
            <span className="home-active-space-avatar">{space.avatar_url ? <img src={space.avatar_url} alt="" loading="lazy" /> : <span>{(space.name || 'E').slice(0, 1).toLocaleUpperCase()}</span>}</span>
            <span className="home-active-space-copy"><strong>{space.name}</strong><small>{space.memberCount.toLocaleString('es-ES')} {space.memberCount === 1 ? 'miembro' : 'miembros'}</small></span>
          </Link>)}
        </section>
        {compatibleUser && <section className="home-compatible-section" aria-label="Usuario compatible">
          <h2 className="home-compatible-heading">USUARIO COMPATIBLE</h2>
          <Link className="home-compatible-card" to={`/profile/${compatibleUser.username || compatibleUser.user_id}`} style={{ '--compatible-own-accent': profile?.theme_color || 'var(--brand-primary)', '--compatible-match-accent': compatibleUser.theme_color || 'var(--brand-primary)' }}>
            <span className="home-compatible-avatars" aria-hidden="true">
              <span className="home-compatible-avatar is-current" style={{ '--compatible-accent': profile?.theme_color || 'var(--brand-primary)' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy" /> : <DefaultAvatar accent={profile?.theme_color} />}
              </span>
              <span className="home-compatible-avatar is-match" style={{ '--compatible-accent': compatibleUser.theme_color || 'var(--brand-primary)' }}>
                {compatibleUser.avatar_url ? <img src={compatibleUser.avatar_url} alt="" loading="lazy" /> : <DefaultAvatar accent={compatibleUser.theme_color} />}
              </span>
            </span>
            <span className="home-compatible-copy">
              <strong><span>Tú</span><i aria-hidden="true">×</i><span className="home-compatible-match-name">{compatibleUser.display_name || compatibleUser.username || 'Usuario'}</span></strong>
              <small className="home-compatible-count"><b>{compatibleUser.commonWorks}</b> {compatibleUser.commonWorks === 1 ? 'título en común' : 'títulos en común'}</small>
            </span>
          </Link>
        </section>}
      </aside>
    </main>
}
