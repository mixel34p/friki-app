import './LoadingSpinner.css'

const SIZES = {
    sm: '18px',
    md: '32px',
    lg: '48px',
}

export default function LoadingSpinner({ size = 'md', label = '' }) {
    return (
        <span
            className="loading-spinner-component"
            role="status"
            aria-label={label || 'Cargando'}
            style={{ '--loader-size': SIZES[size] || SIZES.md }}
        />
    )
}
