import './SpoilerNotice.css'

export default function SpoilerNotice({ onReveal, text = '' }) {
  return (
    <button className="spoiler-notice" type="button" onClick={onReveal} aria-label="Mostrar reseña con spoilers">
      <span className="spoiler-notice-spacer" aria-hidden="true">{text}</span>
      <span className="spoiler-notice-heading">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3 21 21" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A11.3 11.3 0 0 1 12 5c5.5 0 9.5 4.5 10 7-.2 1.1-1.2 2.6-2.6 3.9" />
          <path d="M6.6 6.6C3.9 8.2 2.2 10.6 2 12c.5 2.5 4.5 7 10 7 1.2 0 2.3-.2 3.3-.6" />
        </svg>
        <strong>Spoiler de la reseña</strong>
      </span>
    </button>
  )
}
