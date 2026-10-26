export function getAccentTextColor(color) {
    const hexMatch = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color || '')
    let channels = null

    if (hexMatch) {
        const hex = hexMatch[1].length === 3
            ? [...hexMatch[1]].map(channel => parseInt(channel + channel, 16))
            : [0, 2, 4].map(index => parseInt(hexMatch[1].slice(index, index + 2), 16))
        channels = hex.map(channel => channel / 255)
    } else {
        const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(color || '')
        if (rgbMatch) {
            channels = rgbMatch[1].split(/[\s,\/]+/).slice(0, 3).map(channel => {
                const value = parseFloat(channel)
                return channel.includes('%') ? value / 100 : value / 255
            })
        }
    }

    if (!channels || channels.length !== 3 || channels.some(channel => !Number.isFinite(channel))) return '#000'
    const luminance = channels.reduce((total, channel, index) => {
        const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        return total + linear * [0.2126, 0.7152, 0.0722][index]
    }, 0)
    return luminance > 0.179 ? '#000' : '#fff'
}

export function getVisibleAccentColor(color) {
    const accent = color || '#14b8a6'
    return getAccentTextColor(accent) === '#fff'
        ? `color-mix(in srgb, ${accent} 80%, #fff)`
        : accent
}
