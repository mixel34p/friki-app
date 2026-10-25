import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUsersByCommonWorks } from '../lib/discoverUsersService'
import SEO from '../components/SEO'
import './DiscoverWorks.css'
import './DiscoverUsers.css'

export default function DiscoverUsers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    if (!user?.id) return undefined

    setLoading(true)
    setError(false)
    getUsersByCommonWorks(user.id)
      .then(results => { if (active) setPeople(results) })
      .catch(err => {
        console.error('Error loading discover users:', err)
        if (active) setError(true)
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [user?.id])

  return (
    <main className="discover-users-page">
      <SEO title="Descubrir usuarios" description="Encuentra personas con gustos en común." />
      <header className="discover-users-header">
        <div className="discover-title-group">
          <button type="button" className="discover-back-button" onClick={() => navigate('/discover')} aria-label="Volver">
            <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1>Usuarios</h1>
        </div>
      </header>

      <section className="common-people-section" aria-labelledby="common-people-title">
        <div className="common-people-heading">
          <div>
            <h2 id="common-people-title">Afinidad por obras</h2>
            <p>Usuarios compatibles contigo</p>
          </div>
          {!error && <Link className="common-people-view-all" to="/discover/users/all">Ver todos</Link>}
        </div>

        {loading ? (
          <div className="common-people-row" aria-label="Cargando usuarios">
            {Array.from({ length: 9 }, (_, index) => <div className="common-person-skeleton" key={index}><span/><i/><b/></div>)}
          </div>
        ) : error ? (
          <div className="common-people-empty">
            <p>No se pudieron cargar los usuarios.</p>
            <button type="button" onClick={() => { setLoading(true); setError(false); getUsersByCommonWorks(user.id).then(setPeople).catch(() => setError(true)).finally(() => setLoading(false)) }}>Volver a intentar</button>
          </div>
        ) : people.length === 0 ? (
          <div className="common-people-empty">
            <p className="common-people-empty-title">Aún no has encontrado a ninguna persona afín :(</p>
            <p>Registra tus obras para encontrarla.</p>
          </div>
        ) : (
          <div className="common-people-row" aria-label="Personas ordenadas por obras en común">
            {people.slice(0, 9).map(person => {
              const displayName = person.display_name || person.username || 'Usuario'
              const href = person.username ? `/profile/${person.username}` : `/profile/${person.user_id}`
              const themeColor = person.theme_color || 'var(--brand-primary)'
              return (
                <Link
                  className="common-person-card"
                  key={person.user_id}
                  to={href}
                  title={displayName}
                >
                  <span className="common-person-avatar" style={{ '--person-theme': themeColor }}>
                    {person.avatar_url
                      ? <img src={person.avatar_url} alt="" loading="lazy" />
                      : <span aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
                  </span>
                  <strong className="common-person-name">{displayName}</strong>
                  <span className="common-person-matches">
                    {person.commonWorks} {person.commonWorks === 1 ? 'obra en común' : 'obras en común'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
