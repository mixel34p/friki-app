export function formatRelativeDate(dateValue) {
    if (!dateValue) return ''

    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    if (seconds < 60) return `hace ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`

    const days = Math.floor(hours / 24)
    if (days < 7) return `hace ${days} ${days === 1 ? 'día' : 'días'}`

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
