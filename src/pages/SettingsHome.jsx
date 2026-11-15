import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import usePwaSettingsScreen from '../hooks/usePwaSettingsScreen'
import { navigateWorkBack, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import './SettingsHome.css'

const groups = [
  { title: 'Personalización', options: [
    { to: '/settings/profile', title: 'Perfil', description: 'Cambia tu foto, biografía, favoritos y estilo del perfil.' },
  ] },
  { title: 'Privacidad', options: [
    { to: '/settings/blocked', title: 'Usuarios bloqueados', description: 'Consulta y gestiona las cuentas que has bloqueado.' },
  ] },
  { title: 'Cuenta', options: [
    { to: '/settings/account', title: 'Conexiones y acceso', description: 'Vincula tus cuentas, cierra sesión o gestiona tu cuenta.' },
  ] },
]

export default function SettingsHome() {
  const navigate = useNavigate()
  const location = useLocation()
  usePwaSettingsScreen(true)
  useEffect(() => { signalPwaRouteReady(location.pathname) }, [location.pathname])

  return createPortal(<div className="settings-pwa-page">
    <div className="settings-pwa-content">
      <header className="settings-pwa-header">
        <button type="button" className="pwa-settings-back" onClick={() => navigateWorkBack(navigate, '/profile')} aria-label="Volver al perfil">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h1>Ajustes</h1>
      </header>
      <div className="settings-pwa-groups">
        {groups.map(group => <section className="settings-pwa-group" key={group.title} aria-label={group.title}>
          <h2>{group.title}</h2>
          <div className="settings-pwa-options">
            {group.options.map(option => <Link className="settings-pwa-option" to={option.to} key={option.to}>
              <span className="settings-pwa-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
              <svg className="settings-pwa-option-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </Link>)}
          </div>
        </section>)}
      </div>
    </div>
  </div>, document.body)
}
