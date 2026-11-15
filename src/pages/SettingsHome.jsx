import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import usePwaSettingsScreen from '../hooks/usePwaSettingsScreen'
import { navigateWorkBack, signalPwaRouteReady } from '../lib/pwaRouteTransition'
import './SettingsHome.css'

const groups = [
  { title: 'Personalización', options: [
    { to: '/settings/profile', title: 'Editar perfil', description: 'Cambia tu foto, biografía, favoritos y estilo del perfil.' },
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
  const { profile } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  usePwaSettingsScreen(true)
  useEffect(() => { signalPwaRouteReady(location.pathname) }, [location.pathname])
  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])
  const term = query.trim().toLocaleLowerCase('es')
  const visibleGroups = groups.map(group => ({ ...group, options: group.options.filter(option => `${option.title} ${option.description}`.toLocaleLowerCase('es').includes(term)) })).filter(group => group.options.length)

  return createPortal(<div className="settings-pwa-page">
    <div className="settings-pwa-content">
      <header className="settings-pwa-header">
        <button type="button" className="pwa-settings-back" onClick={() => navigateWorkBack(navigate, '/profile')} aria-label="Volver al perfil">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h1>Ajustes</h1>
        <button type="button" className="pwa-settings-back settings-pwa-search-toggle" aria-label={searchOpen ? 'Cerrar búsqueda de ajustes' : 'Buscar en ajustes'} aria-expanded={searchOpen} aria-controls="settings-search" onClick={() => { setSearchOpen(open => !open); setQuery('') }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{searchOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>}</svg>
        </button>
      </header>
      {profile?.username && <p className="settings-pwa-username">@{profile.username}</p>}
      {searchOpen && <input ref={searchRef} id="settings-search" className="settings-pwa-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en ajustes…" aria-label="Buscar en ajustes" />}
      <div className="settings-pwa-groups">
        {visibleGroups.map(group => <section className="settings-pwa-group" key={group.title} aria-label={group.title}>
          <h2>{group.title}</h2>
          <div className="settings-pwa-options">
            {group.options.map(option => <Link className="settings-pwa-option" to={option.to} key={option.to}>
              <span className="settings-pwa-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
              <svg className="settings-pwa-option-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </Link>)}
          </div>
        </section>)}
        {!visibleGroups.length && <p className="settings-pwa-empty" role="status">No hay ajustes que coincidan con tu búsqueda.</p>}
      </div>
    </div>
  </div>, document.body)
}
