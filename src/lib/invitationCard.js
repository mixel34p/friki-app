import QRCode from 'qrcode'
import { profileFavorites } from './invitations.js'
import { getProfilePalette } from './colorContrast.js'
import { getProfileFontStack } from './profileFonts.js'
import { supabase } from './supabase.js'

const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 4, width: 360, color: { dark: '#101719', light: '#ffffff' } }
export const invitationQr = url => QRCode.toDataURL(url, QR_OPTIONS)

async function imageToDataUrl(url) {
    if (!url) return null
    let blob = null
    try {
        const normalized = new URL(url, window.location.href).href
        try {
            const { data, error, response } = await supabase.functions.invoke('igdb-proxy', { body: { imageUrl: normalized } })
            if (!error && data) {
                const imageType = response?.headers?.get('x-image-content-type') || 'image/jpeg'
                blob = new Blob([data], { type: imageType })
            }
        } catch { /* Fall back to a direct CORS-enabled fetch. */ }

        if (!blob) {
            const response = await fetch(normalized, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
            if (response.ok) blob = await response.blob()
        }
    } catch { /* Invalid URLs and blocked hosts are skipped. */ }
    if (!blob) return null
    return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
    })
}

async function loadImage(url) {
    const sources = [url]
    try {
        const parsed = new URL(url)
        if (parsed.hostname.endsWith('.anilist.co') && /\/(?:small|medium)\//i.test(parsed.pathname)) {
            const large = new URL(parsed.href)
            large.pathname = large.pathname.replace(/\/(?:small|medium)\//i, '/large/')
            sources.unshift(large.href)
        }
    } catch { /* Keep the original URL; imageToDataUrl will safely reject it. */ }

    for (const source of sources) {
        const dataUrl = source.startsWith('data:') ? source : await imageToDataUrl(source)
        if (!dataUrl) continue
        const image = await new Promise(resolve => {
            const loaded = new Image()
            const timer = setTimeout(() => resolve(null), 5000)
            loaded.onload = () => { clearTimeout(timer); resolve(loaded) }
            loaded.onerror = () => { clearTimeout(timer); resolve(null) }
            loaded.src = dataUrl
        })
        if (image) return image
    }
    return null
}

function cover(ctx, image, x, y, width, height, radius) {
    if (!image) return
    const scale = Math.max(width / image.width, height / image.height)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    ctx.clip()
    ctx.drawImage(image, x + (width - image.width * scale) / 2, y + (height - image.height * scale) / 2, image.width * scale, image.height * scale)
    ctx.restore()
}

function invitationFavorite(ctx, image, x, y, width, height) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.28)'
    ctx.shadowBlur = 25
    ctx.shadowOffsetY = 9
    cover(ctx, image, x, y, width, height, 11)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,.14)'
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 11)
    ctx.stroke()
}

function sideArtwork(ctx, image, x, y, width, height, angle) {
    if (!image) return
    ctx.save()
    ctx.translate(x + width / 2, y + height / 2)
    ctx.rotate(angle)
    ctx.globalAlpha = .72
    ctx.shadowColor = 'rgba(0,0,0,.48)'
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 12
    cover(ctx, image, -width / 2, -height / 2, width, height, 12)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.strokeStyle = 'rgba(255,255,255,.16)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(-width / 2, -height / 2, width, height, 12)
    ctx.stroke()
    ctx.restore()
}

function fitText(ctx, text, x, y, maxWidth, size, weight = 700, font = 'system-ui, sans-serif') {
    let fontSize = size
    do { ctx.font = `${weight} ${fontSize--}px ${font}` } while (ctx.measureText(text).width > maxWidth && fontSize > 16)
    ctx.fillText(text, x, y, maxWidth)
}

function accentGlow(ctx, x, y, radius, color, opacity, width, height) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color)
    gradient.addColorStop(.42, color)
    gradient.addColorStop(1, 'transparent')
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.filter = 'blur(54px) saturate(1.16)'
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    ctx.filter = 'none'
}

export async function createInvitationCard(profile, url) {
    const favorites = profileFavorites(profile)
    const [qr, avatar, ...loadedImages] = await Promise.all([
        invitationQr(url).then(loadImage),
        profile.avatar_url ? loadImage(profile.avatar_url) : Promise.resolve(null),
        ...favorites.map(item => loadImage(item.image)),
    ])
    if (!qr) throw new Error('No se pudo generar el QR. Inténtalo de nuevo.')
    const images = loadedImages.filter(Boolean)
    await document.fonts?.ready
    const canvas = document.createElement('canvas')
    canvas.width = 1440
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    const accent = getProfilePalette(null, profile.theme_color)['--profile-accent-color']
    const bodyFont = '"Inter", system-ui, sans-serif'
    const headingFont = '"Space Grotesk", system-ui, sans-serif'
    ctx.fillStyle = '#0b0c0f'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const width = canvas.width
    const center = width / 2
    const card = { x: 360, y: 58, width: 720, height: 964 }
    accentGlow(ctx, 120, 410, 560, accent, .42, width, canvas.height)
    accentGlow(ctx, 1320, 500, 560, accent, .38, width, canvas.height)
    accentGlow(ctx, 720, 0, 670, accent, .2, width, canvas.height)

    // Large, layered side covers match the invitation page; the card masks their inner edges.
    const sidePositions = [
        { x: 22, y: 142, width: 244, height: 366, angle: -.12 },
        { x: 1182, y: 142, width: 244, height: 366, angle: .12 },
        { x: 132, y: 326, width: 244, height: 366, angle: .07 },
        { x: 1064, y: 326, width: 244, height: 366, angle: -.07 },
        { x: 72, y: 572, width: 244, height: 366, angle: -.09 },
        { x: 1124, y: 572, width: 244, height: 366, angle: .09 },
    ]
    sidePositions.slice(0, images.length).forEach((position, index) => {
        sideArtwork(ctx, images[index], position.x, position.y, position.width, position.height, position.angle)
    })

    const edgeShade = ctx.createLinearGradient(0, 0, width, 0)
    edgeShade.addColorStop(0, 'rgba(5,6,8,.24)')
    edgeShade.addColorStop(.28, 'rgba(5,6,8,.01)')
    edgeShade.addColorStop(.72, 'rgba(5,6,8,.01)')
    edgeShade.addColorStop(1, 'rgba(5,6,8,.24)')
    ctx.fillStyle = edgeShade
    ctx.fillRect(0, 0, width, canvas.height)
    ctx.fillStyle = 'rgba(5,6,8,.08)'
    ctx.fillRect(0, 0, width, canvas.height)

    ctx.fillStyle = '#101114'
    ctx.beginPath()
    ctx.roundRect(card.x, card.y, card.width, card.height, 34)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.1)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.textAlign = 'center'
    if (avatar) cover(ctx, avatar, center - 70, 102, 140, 140, 70)
    else {
        ctx.fillStyle = '#171717'
        ctx.beginPath()
        ctx.arc(center, 172, 70, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = accent
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(center, 156, 22, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(center - 44, 222)
        ctx.bezierCurveTo(center - 38, 182, center + 38, 182, center + 44, 222)
        ctx.stroke()
    }
    ctx.strokeStyle = '#555555'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(center, 172, 75, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#f0f0f0'
    fitText(ctx, profile.display_name || profile.username, center, 304, 580, 43, 700, getProfileFontStack(profile.name_font))
    ctx.fillStyle = '#9a9a9a'
    fitText(ctx, `@${profile.username}`, center, 344, 580, 25, 400, bodyFont)
    ctx.fillStyle = '#f0f0f0'
    fitText(ctx, 'Mi perfil en GeekSphere', center, 454, 580, 40, 700, headingFont)
    ctx.fillStyle = '#9a9a9a'
    fitText(ctx, 'Anime, videojuegos y mucho en común.', center, 494, 580, 23, 400, bodyFont)
    const count = images.length
    // Scale the page's 72×108px cover tiles and 10px gap by the card-width ratio (720/576).
    const coverWidth = 90
    const coverHeight = 135
    const gap = 12.5
    const start = center - (count * coverWidth + Math.max(0, count - 1) * gap) / 2
    images.forEach((image, i) => invitationFavorite(ctx, image, start + i * (coverWidth + gap), 552, coverWidth, coverHeight))
    const footerY = count ? 718 : 568
    ctx.strokeStyle = '#ffffff17'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(card.x + 56, footerY)
    ctx.lineTo(card.x + card.width - 56, footerY)
    ctx.stroke()
    cover(ctx, qr, center - 220, footerY + 28, 158, 158, 8)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0f0f0'
    fitText(ctx, '¿Te unes?', center - 34, footerY + 72, 250, 31, 700, headingFont)
    ctx.fillStyle = '#9a9a9a'
    fitText(ctx, 'Escanea para ver mi perfil', center - 34, footerY + 112, 250, 20, 400, bodyFont)
    fitText(ctx, new URL(url).host, center - 34, footerY + 146, 250, 18, 400, bodyFont)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#777777'
    fitText(ctx, 'geeksphere', center, card.y + card.height - 28, card.width - 80, 20, 600, headingFont)
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.')), 'image/png'))
}

export function downloadInvitation(blob, username) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `geeksphere-${username}-invitacion.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
