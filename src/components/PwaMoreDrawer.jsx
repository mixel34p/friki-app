import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './PwaMoreDrawer.css'

export default function PwaMoreDrawer({ children, contentRef, returnFocusRef, onClose, style }) {
  const closeRef = useRef(null)

  useLayoutEffect(() => {
    const dialog = contentRef.current
    const trigger = returnFocusRef.current
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    dialog.showModal()
    closeRef.current.focus({ preventScroll: true })
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousRootOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [contentRef, returnFocusRef])

  const trapFocus = event => {
    if (event.key !== 'Tab') return
    const controls = [...contentRef.current.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0)
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return createPortal(
    <dialog
      id="pwa-more-menu"
      ref={contentRef}
      className="pwa-more-overlay"
      aria-label="Más opciones"
      aria-modal="true"
      style={style}
      onCancel={event => { event.preventDefault(); onClose() }}
      onKeyDown={trapFocus}
      onClick={event => {
        if (event.target === event.currentTarget || event.target.closest('a[href]')) onClose()
      }}
    >
      <section className="pwa-more-drawer">
        <div className="pwa-more-toolbar">
          <span>GeekSphere</span>
          <button ref={closeRef} className="pwa-more-close" type="button" aria-label="Cerrar menú" onClick={onClose}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="pwa-more-content">{children}</div>
      </section>
    </dialog>,
    document.body,
  )
}
