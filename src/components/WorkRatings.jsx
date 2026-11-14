import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import DefaultAvatar from './DefaultAvatar'

const STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
const number = value => Number(value).toLocaleString('es-ES', { maximumFractionDigits: 1 })
const compactNumber = value => Number(value).toLocaleString('es-ES', { notation: 'compact', maximumFractionDigits: 1 })

export function WorkMembers({ stats, compact = false }) {
  return <div className="work-community">{stats && <>
    <span className="work-member-avatars">{stats.recentMembers.map(member => <Link key={member.id} to={`/profile/${member.username}`} title={member.username} style={{ borderColor: member.theme_color || 'var(--work-accent)' }}>{member.avatar_url ? <img src={member.avatar_url} alt={member.username} loading="lazy" /> : <DefaultAvatar accent={member.theme_color} />}</Link>)}</span>
    <span><strong>{compact ? compactNumber(stats.membersCount) : stats.membersCount.toLocaleString('es-ES')}</strong> {compact ? stats.membersCount === 1 ? 'usuario' : 'usuarios' : stats.membersCount === 1 ? 'persona ha registrado esta obra' : 'personas han registrado esta obra'}</span>
  </>}</div>
}

export function WorkStars({ rating }) {
  const id = useId().replace(/:/g, '')
  return <span className="work-stars" role="img" aria-label={rating == null ? 'Sin valoración' : `${number(rating)} de 5 estrellas`}>
    {[0, 1, 2, 3, 4].map(index => {
      const fill = Math.max(0, Math.min(1, Math.round(Number(rating || 0) * 2) / 2 - index)) * 100
      const gradient = `work-star-${id}-${index}`
      return <svg key={index} viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id={gradient}><stop offset={`${fill}%`} stopColor="currentColor" /><stop offset={`${fill}%`} stopColor="transparent" /></linearGradient></defs><path d={STAR} fill={`url(#${gradient})`} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
    })}
  </span>
}

export function WorkRatingDistribution({ distribution, total }) {
  const [active, setActive] = useState(null)
  const tooltipId = useId()
  const maximum = Math.max(1, ...distribution.map(bin => bin.count))
  const selected = distribution[active]
  return <div className="work-distribution">
    <div className="work-distribution-bars" role="group" aria-label="Distribución de valoraciones de media a cinco estrellas">
      {distribution.map((bin, index) => <button type="button" key={bin.rating} className={`work-distribution-column${bin.count ? '' : ' is-empty'}${active === index ? ' is-active' : ''}`} aria-label={`${number(bin.rating)} estrellas: ${bin.count} ${bin.count === 1 ? 'valoración' : 'valoraciones'}, ${number(total ? bin.count / total * 100 : 0)} %`} aria-describedby={active === index ? tooltipId : undefined} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)}>
        <span style={{ '--bar-height': `${bin.count / maximum * 100}%` }} />
      </button>)}
      {selected && <span className="work-distribution-tooltip" id={tooltipId} role="tooltip" style={{ '--tooltip-position': `${(active + .5) * 10}%` }}><strong>{number(selected.rating)} ★</strong><span>{selected.count} {selected.count === 1 ? 'valoración' : 'valoraciones'} · {number(total ? selected.count / total * 100 : 0)} %</span></span>}
    </div>
    <div className="work-distribution-axis" aria-hidden="true"><span>½</span><span>5<span>★</span></span></div>
  </div>
}

export default function WorkRatings({ state, onRetry, variant = 'default' }) {
  if (!state || state.status === 'loading') return <section className="work-rating-block work-rating-loading" aria-label="Cargando valoraciones" aria-busy="true"><span className="work-skeleton" /><span className="work-skeleton" /></section>
  if (state.status === 'error') return <section className="work-rating-block work-rating-error"><p>No se pudieron cargar las valoraciones.</p><button type="button" onClick={onRetry}>Reintentar</button></section>
  const stats = state.data
  return <section className="work-rating-block" aria-label="Valoraciones de la comunidad">
    <div className="work-rating-summary"><strong className="work-rating-average">{stats.avgRating == null ? '—' : Number(stats.avgRating).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><div><WorkStars rating={stats.avgRating} /><span className="work-rating-count">{variant === 'pwa' ? `promedio de ${compactNumber(stats.ratingsCount)}` : number(stats.ratingsCount)} {stats.ratingsCount === 1 ? 'valoración' : 'valoraciones'}</span></div></div>
    {stats.ratingsCount ? <WorkRatingDistribution distribution={stats.distribution} total={stats.ratingsCount} /> : <p className="work-unrated">Todavía no hay valoraciones.</p>}
    {variant === 'pwa' && <WorkMembers stats={stats} compact />}
  </section>
}
