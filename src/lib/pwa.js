// Capture the browser's one-use installation event before React mounts.
let installPrompt = null
let installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true
const listeners = new Set()
const notify = () => listeners.forEach(listener => listener())

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  installPrompt = event
  notify()
})
window.addEventListener('appinstalled', () => {
  installed = true
  installPrompt = null
  notify()
})
window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').addEventListener('change', event => {
  installed = event.matches || navigator.standalone === true
  notify()
})

export const subscribeInstall = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getInstallState = () => installed ? 'installed' : installPrompt ? 'ready' : 'manual'

export async function promptInstall() {
  if (!installPrompt) return false
  const prompt = installPrompt
  installPrompt = null
  notify()
  await prompt.prompt()
  await prompt.userChoice
  return true
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(error => {
      console.error('No se pudo preparar el modo sin conexión:', error)
    })
  }, { once: true })
}
