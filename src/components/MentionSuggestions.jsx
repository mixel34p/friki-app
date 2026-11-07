import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import DefaultAvatar from './DefaultAvatar'
import { hasCustomAvatar } from '../lib/avatar'
import './Mentions.css'

export default function MentionSuggestions({ autocomplete }) {
  const { open, listId, users, selectedIndex, loading, error, selectUser, inputRef, mentionStart, value } = autocomplete
  const listRef = useRef(null)
  const [position, setPosition] = useState(null)
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!open || !input) return undefined
    // Measure the @ with the textarea's exact wrapping, font and padding.
    const mirror = document.createElement('div')
    const marker = document.createElement('span')
    mirror.setAttribute('aria-hidden', 'true')
    Object.assign(mirror.style, { position: 'fixed', left: '0', top: '0', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
    document.body.appendChild(mirror)
    const update = () => {
      const computed = window.getComputedStyle(input)
      for (const key of ['boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textIndent', 'textTransform', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'wordBreak']) mirror.style[key] = computed[key]
      mirror.style.borderStyle = 'solid'
      mirror.style.width = `${input.offsetWidth - (input.offsetWidth - input.clientWidth - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth))}px`
      mirror.replaceChildren(document.createTextNode(value.slice(0, mentionStart)), marker, document.createTextNode(value.slice(mentionStart + 1)))
      marker.textContent = '@'
      const anchor = marker.getBoundingClientRect()
      const mirrorRect = mirror.getBoundingClientRect()
      const rect = input.getBoundingClientRect()
      const parent = input.parentElement.getBoundingClientRect()
      const width = Math.min(288, parent.width, window.innerWidth - 24)
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5
      const top = rect.top - parent.top + anchor.top - mirrorRect.top - input.scrollTop + lineHeight + 5
      const left = Math.max(0, Math.min(rect.left - parent.left + anchor.left - mirrorRect.left - input.scrollLeft, parent.width - width))
      const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight
      const maxHeight = Math.max(52, Math.min(224, viewportBottom - parent.top - top - 12))
      setPosition(previous => previous?.top === top && previous?.left === left && previous?.width === width && previous?.['--mention-max-height'] === `${maxHeight}px` ? previous : { top, left, width, '--mention-max-height': `${maxHeight}px` })
    }
    const frame = requestAnimationFrame(update)
    const observer = new ResizeObserver(update)
    observer.observe(input)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      mirror.remove()
    }
  }, [open, inputRef, mentionStart, value])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])
  if (!open) return null
  return <div className="mention-popover" style={position || { visibility: 'hidden' }} onPointerDown={event => event.preventDefault()}>
    <div id={listId} className="mention-options" role="listbox" aria-label="Personas que puedes mencionar" aria-busy={loading} ref={listRef}>
      {users.map((profile, index) => <button
        key={profile.id} id={`${listId}-${profile.id}`} type="button" role="option" aria-selected={index === selectedIndex}
        className={`mention-option${index === selectedIndex ? ' is-active' : ''}`} onClick={() => selectUser(profile)}
      >
        {hasCustomAvatar(profile.avatar_url) ? <img className="mention-avatar" src={profile.avatar_url} alt="" /> : <DefaultAvatar className="mention-avatar" accent={profile.theme_color} />}
        <span className="mention-identity"><strong>{profile.display_name || profile.username}</strong><small>@{profile.username}</small></span>
        {profile.is_following && <span className="mention-following">Siguiendo</span>}
      </button>)}
    </div>
    {(loading || error || !users.length) && <p className="mention-status" role="status">{loading ? 'Buscando personas…' : error ? 'No se pudieron cargar las personas. Vuelve a escribir para reintentar.' : 'No se han encontrado personas.'}</p>}
  </div>
}
