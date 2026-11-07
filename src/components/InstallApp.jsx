import { useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { getInstallState, promptInstall, subscribeInstall } from '../lib/pwa'
import './InstallApp.css'

export default function InstallApp({ className = '' }) {
  const state = useSyncExternalStore(subscribeInstall, getInstallState)
  const dialog = useRef(null)
  const [busy, setBusy] = useState(false)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (state === 'installed') return null

  async function install() {
    setBusy(true)
    try {
      if (!await promptInstall()) dialog.current.showModal()
    } catch {
      dialog.current.showModal()
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button type="button" className={`pwa-install ${className}`} onClick={install} disabled={busy} aria-label="Instalar GeekSphere" title="Instalar GeekSphere">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg>
      <span>Instalar GeekSphere</span>
    </button>
    {createPortal(<dialog className="pwa-dialog" ref={dialog} aria-labelledby={`pwa-title-${className}`}>
      <form method="dialog">
        <img src="/icons/pwa-192.png" width="64" height="64" alt="" />
        <h2 id={`pwa-title-${className}`}>GeekSphere en tu móvil</h2>
        {isIOS ? <p>Abre esta web en Safari, toca <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>. Si aparece la opción, activa «Abrir como app web» y pulsa «Añadir».</p>
          : <p>Abre el menú de tu navegador y elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>. Si no aparece, prueba con Chrome o Edge.</p>}
        <p>Después podrás abrir GeekSphere desde su icono. Necesitas conexión a internet para usar la comunidad.</p>
        <button className="btn btn-primary" type="submit">Entendido</button>
      </form>
    </dialog>, document.body)}
  </>
}
