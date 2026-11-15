// Until image export rights are verified, MAL covers are replaced with visible artwork.
// Metadata permission is not permission to redistribute covers in exported images.
export function isMangaCover(url) {
  try { return new URL(url).hostname === 'cdn.myanimelist.net' } catch { return false }
}
export function mangaExportPlaceholder() {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#172128"/><path d="M120 90v110m0-110c-25-15-55-15-75-5v110c25-10 50-10 75 5 25-15 50-15 75-5V85c-25-10-50-10-75 5Z" fill="none" stroke="#8da8b8" stroke-width="4"/><text x="120" y="250" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#dde8ee">Portada no exportable</text></svg>')
}
