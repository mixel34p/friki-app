import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCustomItemGroups, saveCustomItemGroup, unsaveCustomItemGroup } from '../lib/customItemGroupService'
import './CustomItemGroupsPicker.css'

const PERSONAL_TABS = [
  { id: 'mine', label: 'Mis grupos' },
  { id: 'saved', label: 'Guardados' },
]

function GroupArtwork({ group }) {
  const items = (group.items || []).slice(0, 4)
  if (!items.length) return <span className="cig-art cig-art-empty">{group.name?.slice(0, 1)?.toUpperCase() || 'G'}</span>
  return <span className="cig-art" aria-hidden="true">{items.map((item, index) => {
    const image = typeof item === 'string' ? item : item?.image_url || item?.cover_url || item?.cover_image || item?.imageUrl || item?.cover?.url
    const name = typeof item === 'string' ? '' : item?.name || item?.title || ''
    return image
      ? <img key={item?.id || `${image}-${index}`} src={image} alt="" loading="lazy" />
      : <i key={item?.id || index}>{name.slice(0, 1)?.toUpperCase() || '·'}</i>
  })}</span>
}

export default function CustomItemGroupsPicker({ userId, onAddGroup }) {
  const [groups, setGroups] = useState({ mine: [], public: [], saved: [] })
  const [activeTab, setActiveTab] = useState('mine')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyGroupId, setBusyGroupId] = useState(null)

  const loadGroups = async () => {
    setLoading(true)
    try {
      setGroups(await getCustomItemGroups(userId))
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los grupos.')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadGroups() }, [userId])

  const toggleSaved = async group => {
    if (!userId || busyGroupId) return
    setBusyGroupId(group.id)
    try {
      if (group.is_saved || activeTab === 'saved') await unsaveCustomItemGroup(group.id, userId)
      else await saveCustomItemGroup(group.id, userId)
      await loadGroups()
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el grupo.')
    } finally { setBusyGroupId(null) }
  }

  const personalGroups = groups[activeTab] || []
  const publicGroups = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return groups.public
    return groups.public.filter(group => [group.name, group.description, ...(group.items || []).map(item => typeof item === 'string' ? item : item?.name || item?.title)]
      .filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(term)))
  }, [groups.public, query])

  const renderGroup = (group, tab) => <article className="cig-group" key={group.id}>
    <GroupArtwork group={group} />
    <div className="cig-group-copy"><strong>{group.name}</strong><small>{group.items?.length || 0} elementos</small></div>
    <button className="cig-add" type="button" onClick={() => onAddGroup(group)}>Añadir</button>
    {tab !== 'mine' && <button className={`cig-save${group.is_saved || tab === 'saved' ? ' is-saved' : ''}`} type="button" title={group.is_saved || tab === 'saved' ? 'Quitar de guardados' : 'Guardar grupo'} aria-label={group.is_saved || tab === 'saved' ? `Quitar ${group.name} de guardados` : `Guardar ${group.name}`} disabled={busyGroupId === group.id} onClick={() => toggleSaved(group)}>{busyGroupId === group.id ? '…' : group.is_saved || tab === 'saved' ? '✓' : '♡'}</button>}
  </article>

  return <section className="cig-picker" aria-label="Grupos de elementos">
    {userId && <>
      <div className="cig-personal-heading"><strong>Tus grupos</strong><Link to="/groups">Gestionar</Link></div>
      <div className="cig-personal-tabs" role="tablist" aria-label="Tus grupos">
        {PERSONAL_TABS.map(tab => <button type="button" role="tab" key={tab.id} aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </div>
      {loading ? <p className="cig-state">Cargando grupos…</p> : error ? <p className="cig-state is-error">{error}</p> : personalGroups.length ? <div className="cig-list">{personalGroups.map(group => renderGroup(group, activeTab))}</div> : <p className="cig-state">{activeTab === 'mine' ? 'Aún no tienes grupos.' : 'Todavía no has guardado grupos.'}</p>}
    </>}

    <div className="cig-public-heading"><strong>Grupos públicos</strong></div>
    <label className="cig-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar grupos públicos…" aria-label="Buscar grupos públicos" /></label>
    {loading ? <p className="cig-state">Cargando grupos…</p> : error ? <p className="cig-state is-error">{error}</p> : publicGroups.length ? <div className="cig-list cig-public-list">{publicGroups.map(group => renderGroup(group, 'public'))}</div> : <p className="cig-state">{query ? 'No hay grupos que coincidan con la búsqueda.' : 'Todavía no hay grupos públicos.'}</p>}
  </section>
}
