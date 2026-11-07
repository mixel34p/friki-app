import { useLayoutEffect, useRef } from 'react'
import './Mentions.css'

// Mirror the native textarea so selection, mobile input and undo stay native.
export default function MentionHighlights({ inputRef, value, enabled = true }) {
  const mirrorRef = useRef(null)
  useLayoutEffect(() => {
    const input = inputRef.current
    const mirror = mirrorRef.current
    if (!enabled || !input || !mirror) return undefined
    const sync = () => {
      const style = window.getComputedStyle(input)
      for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textIndent', 'textTransform', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) {
        mirror.style[property] = style[property]
      }
      mirror.style.width = `${input.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)}px`
      mirror.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(input)
    input.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    document.fonts?.ready.then(() => { if (mirror.isConnected) sync() })
    return () => { observer.disconnect(); input.removeEventListener('scroll', sync); window.removeEventListener('resize', sync) }
  }, [enabled, inputRef, value])
  if (!enabled) return null
  const parts = []
  let cursor = 0
  for (const match of value.matchAll(/(^|[^a-zA-Z0-9_@/])@([a-zA-Z0-9_]{0,20})(?![a-zA-Z0-9_])/g)) {
    const start = match.index + match[1].length
    if (start > cursor) parts.push(value.slice(cursor, start))
    parts.push(<mark key={start}>{`@${match[2]}`}</mark>)
    cursor = match.index + match[0].length
  }
  parts.push(value.slice(cursor))
  return <div className="mention-highlights" aria-hidden="true"><div ref={mirrorRef} className="mention-highlights-text">{parts}{'\n'}</div></div>
}
