import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getAccentTextColor } from '../lib/colorContrast'
import { deleteUserStatus, getActiveStatuses, saveUserStatus } from '../lib/statusService'
import './HomeStatuses.css'

function deezerJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `homeStatusDz_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const finish = value => { script.remove(); delete window[callback]; resolve(value) }
    const timeout = window.setTimeout(() => finish(null), 5000)
    window[callback] = value => { window.clearTimeout(timeout); finish(value) }
    script.onerror = () => {
      window.clearTimeout(timeout)
      delete window[callback]
      script.remove()
      reject(new Error('No se pudo conectar con Deezer.'))
    }
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${callback}`
    document.body.appendChild(script)
  })
}

async function findSongs(query) {
  const result = await deezerJsonp(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=6`)
  return (result?.data || []).map(track => ({
    trackId: track.id,
    name: track.title,
    artist: track.artist?.name || 'Artista desconocido',
    cover: track.album?.cover_medium,
    previewUrl: track.preview,
    provider: 'deezer',
  })).filter(track => track.previewUrl)
}

function Avatar({ person }) {
  const name = person.display_name || person.username || 'Usuario'
  return <span className="home-status-avatar" style={{ '--status-accent': person.theme_color || 'var(--brand-primary)' }}>
    {person.avatar_url ? <img src={person.avatar_url} alt="" loading="lazy" /> : name.slice(0, 1).toLocaleUpperCase()}
  </span>
}

function StatusSong({ song, playing, onToggle }) {
  return <div className="home-status-song-detail">
    {song.cover && <img src={song.cover} alt="" />}
    <span><strong>{song.name}</strong><small>{song.artist}</small></span>
    <button type="button" className="home-status-play" onClick={onToggle} aria-label={playing ? 'Pausar canción' : 'Reproducir canción'}>
      {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM15 5h4v14h-4z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>}
    </button>
  </div>
}

export default function HomeStatuses({ user, profile, friends = [] }) {
  const [statuses, setStatuses] = useState({})
  const [textEditing, setTextEditing] = useState(false)
  const [text, setText] = useState('')
  const [songPickerOpen, setSongPickerOpen] = useState(false)
  const [songQuery, setSongQuery] = useState('')
  const [songResults, setSongResults] = useState([])
  const [searchingSongs, setSearchingSongs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewed, setViewed] = useState(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const searchSequence = useRef(0)
  const textRef = useRef(null)
  const people = useMemo(() => [
    ...(user ? [{ ...profile, id: user.id, username: profile?.username, display_name: profile?.display_name || 'Tú', avatar_url: profile?.avatar_url, theme_color: profile?.theme_color }] : []),
    ...friends.filter(friend => friend.id !== user?.id).slice(0, user ? 4 : 5),
  ], [user, profile, friends])

  useEffect(() => {
    let active = true
    let timer
    const loadStatuses = async () => {
      try {
        const items = await getActiveStatuses(people.map(person => person.id))
        if (!active) return
        setStatuses(Object.fromEntries(items.map(item => [item.user_id, item])))
      } catch (err) { console.error('No se pudieron cargar los estados:', err) }
      if (active) timer = window.setTimeout(loadStatuses, 60_000)
    }
    loadStatuses()
    return () => { active = false; window.clearTimeout(timer) }
  }, [people])

  useEffect(() => {
    if (!songPickerOpen || songQuery.trim().length < 2) {
      setSongResults([])
      return undefined
    }
    const sequence = ++searchSequence.current
    const timer = window.setTimeout(async () => {
      setSearchingSongs(true)
      try {
        const results = await findSongs(songQuery.trim())
        if (sequence === searchSequence.current) setSongResults(results)
      } catch (err) {
        if (sequence === searchSequence.current) setError(err.message)
      } finally {
        if (sequence === searchSequence.current) setSearchingSongs(false)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [songPickerOpen, songQuery])

  useEffect(() => {
    if (textEditing && textRef.current) {
      const textarea = textRef.current
      textarea.focus()
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [textEditing])

  useEffect(() => {
    if (!viewed) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') setViewed(null) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [viewed])

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  useEffect(() => {
    if (viewed || !audioRef.current) return
    audioRef.current.pause()
    audioRef.current = null
    setPlaying(false)
  }, [viewed])

  const stopSong = () => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    audioRef.current = null
    setPlaying(false)
  }

  const toggleSong = async song => {
    if (audioRef.current) {
      if (audioRef.current.dataset.trackId === String(song.trackId) && !audioRef.current.paused) {
        audioRef.current.pause()
        setPlaying(false)
        return
      }
      stopSong()
    }
    let preview = song.previewUrl
    if (song.trackId) {
      try {
        const result = await deezerJsonp(`https://api.deezer.com/track/${encodeURIComponent(song.trackId)}`)
        preview = result?.preview || preview
      } catch { /* Use the preview stored with the status. */ }
    }
    if (!preview) return
    const audio = new Audio(preview)
    audio.dataset.trackId = String(song.trackId)
    audio.volume = 0.5
    audio.onplay = () => setPlaying(true)
    audio.onpause = () => setPlaying(false)
    audio.onended = () => { setPlaying(false); audio.currentTime = 0; audio.volume = 0.5 }
    audio.ontimeupdate = () => {
      if (!audio.duration) return
      const remaining = audio.duration - audio.currentTime
      if (remaining < 3 && remaining > 0) audio.volume = Math.max(0, remaining / 3 * 0.5)
    }
    audioRef.current = audio
    try { await audio.play() } catch (err) { console.warn('No se pudo reproducir la canción del estado:', err) }
  }

  const beginTextEdit = () => {
    setText(statuses[user?.id]?.status_type === 'text' ? statuses[user.id].content : '')
    setError('')
    setSongPickerOpen(false)
    setTextEditing(true)
  }

  const saveStatus = async status => {
    if (!user?.id) return false
    setError('')
    setSaving(true)
    try {
      const saved = await saveUserStatus(user.id, status)
      setStatuses(current => ({ ...current, [user.id]: saved }))
      setTextEditing(false)
      setSongPickerOpen(false)
      setSongQuery('')
      return true
    } catch (err) {
      console.error('No se pudo guardar el estado:', err)
      setError('No se pudo guardar. Inténtalo de nuevo.')
      return false
    } finally { setSaving(false) }
  }

  const submitText = event => {
    event?.preventDefault?.()
    if (!text.trim()) { setError('Escribe algo para compartir.'); return }
    saveStatus({ type: 'text', content: text })
  }

  const resizeText = event => {
    event.currentTarget.style.height = 'auto'
    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
    setText(event.currentTarget.value)
    setError('')
  }

  const selectSong = song => saveStatus({ type: 'song', song })

  const removeOwnStatus = async () => {
    try {
      await deleteUserStatus(user.id)
      setStatuses(current => { const next = { ...current }; delete next[user.id]; return next })
      setViewed(null)
    } catch (err) { console.error('No se pudo borrar el estado:', err) }
  }

  const detailModal = viewed && <div className="home-status-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setViewed(null) }}>
    <section className="home-status-dialog" role="dialog" aria-modal="true" aria-label={`Estado de ${viewed.person.display_name || viewed.person.username || 'Usuario'}`}>
      <button className="home-status-close" type="button" onClick={() => setViewed(null)} aria-label="Cerrar">×</button>
      <header className="home-status-dialog-author"><Avatar person={viewed.person}/><span><strong>{viewed.person.display_name || viewed.person.username || 'Usuario'}</strong><small>Estado · vence a las {new Date(viewed.status.expires_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></span></header>
      {viewed.status.status_type === 'song'
        ? <StatusSong song={viewed.status.song} playing={playing} onToggle={() => toggleSong(viewed.status.song)} />
        : <p className="home-status-dialog-text">{viewed.status.content}</p>}
      <footer className="home-status-dialog-actions">
        {viewed.isOwn && <button type="button" className="home-status-delete" onClick={removeOwnStatus}>Eliminar estado</button>}
        {!viewed.isOwn && <button type="button" className="home-status-reply" disabled title="Los mensajes estarán disponibles próximamente">Responder · próximamente</button>}
      </footer>
    </section>
  </div>

  const selfPerson = people[0]
  const ownStatus = selfPerson ? statuses[selfPerson.id] : null
  const expandedComposer = textEditing || songPickerOpen
  const ownAccent = selfPerson?.theme_color || '#14b8a6'
  const ownBubbleStyle = { '--status-accent': ownAccent, '--status-text': getAccentTextColor(ownAccent) }

  return <section className="home-summary-friends">
    <span className="home-summary-label">Amigos conectados</span>
    {expandedComposer && selfPerson
      ? <div className="home-status-expanded" style={ownBubbleStyle}>
          <button className="home-status-expanded-close" type="button" onClick={() => { setTextEditing(false); setSongPickerOpen(false); setError('') }} aria-label="Cerrar editor">×</button>
          {textEditing
            ? <form className="home-status-bubble home-status-expanded-bubble home-status-inline-editor" onSubmit={submitText}>
                <textarea ref={textRef} value={text} maxLength={80} onChange={resizeText} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) submitText(event) }} placeholder="¿Qué tienes en mente?" aria-label="Escribe tu estado" />
                <span className="home-status-inline-actions"><small>{text.length}/80</small><button type="submit" disabled={saving || !text.trim()} aria-label="Publicar estado" title="Publicar">✓</button></span>
              </form>
            : <div className="home-status-bubble home-status-expanded-bubble is-expanded-song-prompt"><span>{ownStatus?.status_type === 'song' ? `♫ ${ownStatus.song?.name || 'Canción'}` : ownStatus?.content || 'Elige una canción para tu estado'}</span></div>}
          <div className="home-status-expanded-avatar"><Avatar person={selfPerson}/><span className="home-status-connected-dot" aria-hidden="true" /></div>
          <strong className="home-status-expanded-name">{profile?.display_name || profile?.username || 'Tú'}</strong>
          <button type="button" className="home-status-music-button is-expanded" onClick={() => { setSongPickerOpen(true); setTextEditing(false); setError('') }} aria-label="Añadir una canción al estado" title="Añadir canción">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </button>
          {error && <p className="home-status-inline-error" role="alert">{error}</p>}
        </div>
      : <div className="home-status-list">
      {people.map((person, index) => {
        const isOwn = index === 0 && person.id === user?.id
        const status = statuses[person.id]
        const name = isOwn ? 'Tú' : person.display_name || person.username || 'Usuario'
        const label = status?.status_type === 'song' ? `♫ ${status.song?.name || 'Canción'}` : status?.content
        const accent = person.theme_color || '#14b8a6'
        const bubbleStyle = { '--status-accent': accent, '--status-text': getAccentTextColor(accent) }
        const openFriendStatus = () => {
          if (!status) return
          setViewed({ person, status, isOwn })
          if (status.status_type === 'song' && status.song) toggleSong(status.song)
        }
        return <div key={person.id} className={`home-status-person${isOwn ? ' is-self' : ''}`}>
          {isOwn
              ? <button type="button" className={`home-status-bubble${status?.status_type === 'song' ? ' is-song' : ''}${status ? '' : ' is-placeholder'}`} style={bubbleStyle} onClick={status?.status_type === 'song' ? openFriendStatus : beginTextEdit}>
                  <span>{label || 'Escribe un estado'}</span>
                </button>
              : status && <button type="button" className={`home-status-bubble${status.status_type === 'song' ? ' is-song' : ''}`} style={bubbleStyle} onClick={openFriendStatus}><span>{label}</span></button>}
          <div className="home-status-avatar-wrap">
            {isOwn
              ? <button type="button" className="home-status-avatar-button" onClick={beginTextEdit} aria-label="Escribe tu estado"><Avatar person={person}/></button>
              : <Link className="home-status-avatar-button" to={person.username ? `/profile/${person.username}` : '/profile'} aria-label={`Ver el perfil de ${name}`}><Avatar person={person}/></Link>}
            <span className="home-status-connected-dot" aria-hidden="true" />
          </div>
          <span className="home-status-name">{name}</span>
        </div>
      })}
    </div>}
    {songPickerOpen && <div className={`home-status-song-popover${expandedComposer ? ' is-expanded' : ''}`}>
      <header><strong>Añadir canción</strong><button type="button" onClick={() => { setSongPickerOpen(false); setError('') }} aria-label="Cerrar búsqueda">×</button></header>
      <input autoFocus value={songQuery} onChange={event => { setSongQuery(event.target.value); setError('') }} placeholder="Busca una canción…" aria-label="Buscar canción" />
      {searchingSongs && <p className="home-status-search-hint">Buscando…</p>}
      {songResults.length > 0 && <div className="home-status-song-results">{songResults.map(song => <button type="button" key={song.trackId} onClick={() => selectSong(song)} disabled={saving}>{song.cover && <img src={song.cover} alt="" />}<span><strong>{song.name}</strong><small>{song.artist}</small></span><b>{saving ? '…' : 'Elegir'}</b></button>)}</div>}
      {!searchingSongs && songQuery.trim().length >= 2 && !songResults.length && <p className="home-status-search-hint">No se encontraron canciones con vista previa.</p>}
      {error && <p className="home-status-error" role="alert">{error}</p>}
    </div>}
    {typeof document !== 'undefined' && detailModal && createPortal(detailModal, document.body)}
  </section>
}
