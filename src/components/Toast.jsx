import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Toast.css'

/* ── Context ── */
const ToastContext = createContext(null)
let _id = 0

/* ── Default SVG icons ── */
const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

const IconWarning = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
)

const IconInfo = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
)

const IconCopy = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

const IconDiscord = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
)

const DEFAULT_ICONS = {
    success: <IconCheck />,
    error:   <IconX />,
    warning: <IconWarning />,
    info:    <IconInfo />,
    copy:    <IconCopy />,
    discord: <IconDiscord />,
}

/* ── Single toast card ── */
function ToastItem({ id, title, message, type = 'info', icon, duration, exiting, onDismiss, variant }) {
    const resolvedIcon = icon ?? DEFAULT_ICONS[type] ?? DEFAULT_ICONS.info

    return (
        <div
            className={`toast-card${variant ? ` toast-card-${variant}` : ''}${exiting ? ' exiting' : ''}`}
            data-type={type}
            role="alert"
            aria-live="polite"
        >
            <div className="toast-icon-wrap">
                {resolvedIcon}
            </div>

            <div className="toast-body">
                <div className="toast-title">{title}</div>
                {message && <div className="toast-message">{message}</div>}
            </div>

            <button className="toast-dismiss" onClick={onDismiss} aria-label="Cerrar">
                <IconX />
            </button>

            {duration > 0 && (
                <div className="toast-progress-wrap">
                    <div
                        className="toast-progress-bar"
                        style={{ '--toast-duration': `${duration}ms` }}
                    />
                </div>
            )}
        </div>
    )
}

/* ── Provider ── */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
    }, [])

    const toast = useCallback(({ title, message, type = 'info', icon, duration = 4000, position = 'bottom', variant } = {}) => {
        const id = ++_id
        setToasts(prev => [...prev, { id, title, message, type, icon, duration, position, variant, exiting: false }])
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration)
        }
        return id
    }, [dismiss])

    useEffect(() => {
        const accountLabel = sessionStorage.getItem('geeksphere.account-switched-toast')
        if (accountLabel === null) return
        sessionStorage.removeItem('geeksphere.account-switched-toast')
        toast({ title: `Ahora estás en ${accountLabel || 'tu cuenta'}`, type: 'success', position: 'top', variant: 'account-switch', duration: 2000 })
    }, [toast])

    return (
        <ToastContext.Provider value={{ toast, dismiss }}>
            {children}
            {createPortal(
                <div className="toast-container toast-container-top" aria-label="Notificaciones">
                    {toasts.filter(t => t.position === 'top').map(t => (
                        <ToastItem
                            key={t.id}
                            {...t}
                            onDismiss={() => dismiss(t.id)}
                        />
                    ))}
                </div>,
                document.body
            )}
            {createPortal(
                <div className="toast-container" aria-label="Notificaciones">
                    {toasts.filter(t => t.position !== 'top').map(t => (
                        <ToastItem key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    )
}

/* ── Hook ── */
export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
    return ctx
}
