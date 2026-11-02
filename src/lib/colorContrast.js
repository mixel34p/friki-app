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

function parseRgb(color) {
    const hexMatch = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color || '')
    if (hexMatch) {
        const hex = hexMatch[1].length === 3
            ? [...hexMatch[1]].map(channel => parseInt(channel + channel, 16))
            : [0, 2, 4].map(index => parseInt(hexMatch[1].slice(index, index + 2), 16))
        return hex
    }

    const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(color || '')
    if (!rgbMatch) return null
    const channels = rgbMatch[1].split(/[\s,\/]+/).slice(0, 3).map(channel => {
        const value = parseFloat(channel)
        return channel.includes('%') ? Math.round(value * 2.55) : Math.round(value)
    })
    return channels.length === 3 && channels.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255)
        ? channels
        : null
}

function toHex([red, green, blue]) {
    return `#${[red, green, blue].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function mixColors(first, second, amount) {
    return toHex(first.map((channel, index) => channel * (1 - amount) + second[index] * amount))
}

function contrastRatio(first, second) {
    const luminance = color => parseRgb(color).reduce((total, channel, index) => {
        const value = channel / 255
        const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        return total + linear * [0.2126, 0.7152, 0.0722][index]
    }, 0)
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
}

function readableText(background) {
    const light = '#f2f3f4'
    const dark = '#08090a'
    return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark
}

function readableTextAcross(backgrounds) {
    const light = '#f2f3f4'
    const dark = '#08090a'
    const lightMinimum = Math.min(...backgrounds.map(background => contrastRatio(light, background)))
    const darkMinimum = Math.min(...backgrounds.map(background => contrastRatio(dark, background)))
    return lightMinimum >= darkMinimum ? light : dark
}

function readableSecondaryText(backgrounds) {
    const preferred = parseRgb('#aab2b9')
    const white = parseRgb('#f2f3f4')
    for (let amount = 0.15; amount <= 1; amount += 0.05) {
        const candidate = mixColors(preferred, white, amount)
        if (backgrounds.every(background => contrastRatio(candidate, background) >= 4.5)) return candidate
    }
    return '#f2f3f4'
}

function readableProfileAccent(accent, backgrounds) {
    const existingVisible = getVisibleAccentColor(accent)
    if (parseRgb(existingVisible) && backgrounds.every(background => contrastRatio(existingVisible, background) >= 4.5)) {
        return existingVisible
    }
    const accentRgb = parseRgb(accent)
    const white = [255, 255, 255]
    for (let amount = 0.08; amount <= 1; amount += 0.04) {
        const candidate = mixColors(accentRgb, white, amount)
        if (backgrounds.every(background => contrastRatio(candidate, background) >= 4.5)) return candidate
    }
    return '#ffffff'
}

// Palette is scoped by the caller to the profile page. Blend the two identity
// colors first, then keep the result close to the app's dark canvas.
export function getProfilePalette(bannerColor, accentColor) {
    const accent = parseRgb(accentColor || '') ? accentColor : '#14b8a6'
    const accentRgb = parseRgb(accent)
    const bannerChannels = (Array.isArray(bannerColor) ? bannerColor : [bannerColor])
        .map(color => parseRgb(color || ''))
        .filter(Boolean)
    const bannerRgb = bannerChannels.length
        ? bannerChannels[0].map((_, index) => Math.round(bannerChannels.reduce((sum, channels) => sum + channels[index], 0) / bannerChannels.length))
        : parseRgb(accent)
    const identity = mixColors(bannerRgb, accentRgb, 0.5)
    const identityRgb = parseRgb(identity)
    const canvas = mixColors([8, 8, 8], identityRgb, 0.19)
    const canvasRgb = parseRgb(canvas)
    const surface = mixColors(canvasRgb, identityRgb, 0.16)
    const raised = mixColors(canvasRgb, identityRgb, 0.25)
    const accentSurface = mixColors(parseRgb('#101313'), accentRgb, 0.34)
    const bannerSecondary = bannerChannels[1] || bannerRgb
    const bannerTint = mixColors(canvasRgb, bannerSecondary, 0.2)
    const bannerGlow = mixColors(canvasRgb, parseRgb(bannerTint), 0.58)
    const accentHover = mixColors(accentRgb, [255, 255, 255], 0.12)
    const profileBackgrounds = [canvas, bannerGlow, surface, raised, accentSurface]
    const profileAccentVisible = readableProfileAccent(accent, profileBackgrounds)

    return {
        '--profile-accent-color': accent,
        '--profile-accent-hover': accentHover,
        '--profile-accent-dark': mixColors(accentRgb, [0, 0, 0], 0.22),
        '--profile-theme-color': accent,
        '--profile-accent-visible': profileAccentVisible,
        '--profile-accent-text': getAccentTextColor(accent),
        '--profile-accent-hover-text': readableText(accentHover),
        '--profile-page-bg': canvas,
        '--profile-banner-tint': bannerTint,
        '--profile-surface': surface,
        '--profile-surface-raised': raised,
        '--profile-accent-surface': accentSurface,
        '--profile-page-text': readableTextAcross([canvas, bannerGlow, accentSurface]),
        '--profile-surface-text': readableText(surface),
        '--profile-raised-text': readableText(raised),
        '--profile-accent-surface-text': readableText(accentSurface),
        '--profile-secondary-text': readableSecondaryText(profileBackgrounds),
        '--profile-page-border': mixColors(canvasRgb, accentRgb, 0.34),
        '--profile-shadow-tint': mixColors(canvasRgb, accentRgb, 0.22)
    }
}

export function getVisibleAccentColor(color) {
    const accent = color || '#14b8a6'
    return getAccentTextColor(accent) === '#fff'
        ? `color-mix(in srgb, ${accent} 80%, #fff)`
        : accent
}
