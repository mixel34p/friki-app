import { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { navigateWorkBack, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import './SettingsHome.css'

const options = [
  { to: '/settings/profile', title: 'Perfil', description: 'Foto, biografía, favoritos y personalización.', icon: 'user' },
  { to: '/settings/account', title: 'Cuenta', description: 'Conexiones, acceso y opciones de cuenta.', icon: 'account' },
  { to: '/settings/blocked', title: 'Bloqueados y silenciados', description: 'Gestiona las cuentas que has bloqueado.', icon: 'shield' },
]

function SettingsIcon({ name }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    account: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

export default function SettingsHome() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => { signalPwaRouteReady(location.pathname) }, [location.pathname])

  return <div className="settings-pwa-page">
    <header className="settings-pwa-header">
      <button type="button" className="pwa-settings-back" onClick={() => navigateWorkBack(navigate, '/profile')} aria-label="Volver al perfil">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <h1>Ajustes</h1>
    </header>
    <section className="settings-pwa-options" aria-label="Opciones de ajustes">
      {options.map(option => <Link className="settings-pwa-option" to={option.to} key={option.to}>
        <span className="settings-pwa-option-icon"><SettingsIcon name={option.icon} /></span>
        <span className="settings-pwa-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
        <svg className="settings-pwa-option-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </Link>)}
    </section>
  </div>
}
