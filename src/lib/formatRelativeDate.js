export function formatRelativeDate(dateValue) {
    if (!dateValue) return ''

    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    if (seconds < 60) return 'ahora'

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    if (days < 35) return `${Math.floor(days / 7)}sem`

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
