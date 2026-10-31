import './SpoilerNotice.css'

export default function SpoilerNotice({ onReveal }) {
  return (
    <button
      className="spoiler-notice"
      type="button"
      onClick={onReveal}
      aria-label="Mostrar reseña con spoilers"
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        maxWidth: '100%',
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        margin: '8px 0',
        padding: '.45rem .85rem',
        appearance: 'none',
        WebkitAppearance: 'none',
        border: '1px solid var(--border-default, rgba(255,255,255,.1))',
        borderRadius: 9999,
        color: 'var(--text-primary, #f5f5f5)',
        backgroundColor: 'var(--bg-tertiary, #1b1b20)',
        font: '600 .78rem/1.2 var(--font-sans, sans-serif)',
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
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
