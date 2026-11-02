import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCustomItemGroups, saveCustomItemGroup, unsaveCustomItemGroup } from '../lib/customItemGroupService'
import './CustomItemGroupsPicker.css'

const TABS = [
  { id: 'mine', label: 'Mis grupos' },
  { id: 'public', label: 'Públicos' },
  { id: 'saved', label: 'Guardados' },
]

export default function CustomItemGroupsPicker({ userId, onAddGroup }) {
  const [groups, setGroups] = useState({ mine: [], public: [], saved: [] })
  const [activeTab, setActiveTab] = useState('mine')
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

  const activeGroups = groups[activeTab] || []
  return (
    <section className="cig-picker" aria-label="Grupos de elementos">
      <div className="cig-picker-heading"><strong>Grupos de elementos</strong><Link to="/custom-groups">Gestionar</Link></div>
      <div className="cig-picker-tabs" role="tablist" aria-label="Grupos disponibles">
        {TABS.map(tab => <button type="button" role="tab" key={tab.id} aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </div>
      {loading ? <p className="cig-picker-state">Cargando grupos…</p> : error ? <p className="cig-picker-state is-error">{error}</p> : activeGroups.length === 0 ? <p className="cig-picker-state">{activeTab === 'mine' ? 'Aún no tienes grupos.' : activeTab === 'public' ? 'No hay grupos públicos disponibles.' : 'Todavía no has guardado grupos.'}</p> : (
        <div className="cig-picker-list">
          {activeGroups.map(group => <article className="cig-picker-group" key={group.id}>
            <div className="cig-picker-group-art" aria-hidden="true">{(group.items || []).slice(0, 3).map((item, index) => item.image_url ? <img key={item.id || index} src={item.image_url} alt="" /> : <span key={item.id || index}>{item.name?.slice(0, 1)?.toUpperCase()}</span>)}</div>
            <div className="cig-picker-group-copy"><strong>{group.name}</strong><small>{group.items?.length || 0} elementos{activeTab === 'mine' && group.visibility === 'private' ? ' · Privado' : ''}</small></div>
            <button className="cig-picker-add" type="button" onClick={() => onAddGroup(group)}>Añadir</button>
            {activeTab !== 'mine' && <button className={`cig-picker-save${group.is_saved || activeTab === 'saved' ? ' is-saved' : ''}`} type="button" title={group.is_saved || activeTab === 'saved' ? 'Quitar de guardados' : 'Guardar grupo'} aria-label={group.is_saved || activeTab === 'saved' ? `Quitar ${group.name} de guardados` : `Guardar ${group.name}`} disabled={busyGroupId === group.id} onClick={() => toggleSaved(group)}>{busyGroupId === group.id ? '…' : group.is_saved || activeTab === 'saved' ? '✓' : '♡'}</button>}
          </article>)}
        </div>
      )}
    </section>
  )
}
