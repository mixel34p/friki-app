import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './PwaMoreDrawer.css'

export default function PwaMoreDrawer({ children, contentRef, returnFocusRef, onClose, style }) {
  useLayoutEffect(() => {
    const dialog = contentRef.current
    const trigger = returnFocusRef.current
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector('a[href], button:not(:disabled)')?.focus({ preventScroll: true })
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
        <div className="pwa-more-content">{children}</div>
      </section>
    </dialog>,
    document.body,
  )
}
