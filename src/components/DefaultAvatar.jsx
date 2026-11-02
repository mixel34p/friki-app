export function getDefaultAvatarDataUrl(accent = '#14b8a6') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none"><circle cx="128" cy="128" r="128" fill="#111719"/><circle cx="128" cy="92" r="42" stroke="${accent}" stroke-width="12"/><path d="M48 218c8-43 39-70 80-70s72 27 80 70" stroke="${accent}" stroke-width="12" stroke-linecap="round"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export default function DefaultAvatar({ accent = '#14b8a6', className = '', title, style }) {
  const src = getDefaultAvatarDataUrl(accent)
  return <img src={src} className={className} style={style} alt={title || ''} aria-hidden={title ? undefined : true} />
}
