import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createCustomItemGroup,
  deleteCustomItemGroup,
  getUserCustomItemGroups,
  updateCustomItemGroup,
} from '../lib/customItemGroupService'
import './CustomItemGroups.css'

const blankGroup = () => ({ name: '', description: '', visibility: 'private', items: [] })
const newItemId = () => `custom-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

export default function CustomItemGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [draft, setDraft] = useState(blankGroup)
  const [editingId, setEditingId] = useState(null)
  const [itemName, setItemName] = useState('')
  const [itemImage, setItemImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      setGroups(await getUserCustomItemGroups(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar tus grupos.')
    } finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [user?.id])

  const startEdit = group => {
    setEditingId(group.id)
    setDraft({ name: group.name, description: group.description || '', visibility: group.visibility, items: group.items || [] })
    setItemName('')
    setItemImage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetDraft = () => {
    setEditingId(null)
    setDraft(blankGroup())
    setItemName('')
    setItemImage('')
    setError('')
  }

  const addItem = () => {
    if (!itemName.trim()) return
    setDraft(current => ({
      ...current,
      items: [...current.items, { id: newItemId(), name: itemName.trim(), image_url: itemImage.trim(), cover_url: itemImage.trim() }],
    }))
    setItemName('')
    setItemImage('')
  }

  const saveGroup = async event => {
    event.preventDefault()
    if (!draft.name.trim() || draft.items.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const payload = { name: draft.name.trim(), description: draft.description.trim(), visibility: draft.visibility, items: draft.items, owner_id: user.id }
      if (editingId) await updateCustomItemGroup(editingId, payload, user.id)
      else await createCustomItemGroup(payload)
      resetDraft()
      await reload()
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el grupo.')
    } finally { setSaving(false) }
  }

  const removeGroup = async group => {
    if (!window.confirm(`¿Borrar el grupo «${group.name}»?`)) return
    try {
      await deleteCustomItemGroup(group.id, user.id)
      if (editingId === group.id) resetDraft()
      await reload()
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo borrar el grupo.')
    }
  }

  return (
    <main className="custom-groups-page">
      <header className="custom-groups-header">
        <Link to="/share" className="custom-groups-back">← Volver</Link>
        <p className="custom-groups-eyebrow">BIBLIOTECA PERSONAL</p>
        <h1>Grupos de elementos</h1>
        <p>Crea colecciones reutilizables para añadir muchos elementos a tus plantillas de una vez.</p>
      </header>

      <div className="custom-groups-layout">
        <form className="custom-groups-form" onSubmit={saveGroup}>
          <div className="custom-groups-form-heading">
            <div><span>{editingId ? 'EDITAR GRUPO' : 'NUEVO GRUPO'}</span><h2>{editingId ? 'Actualiza tu grupo' : 'Crea un grupo'}</h2></div>
            {editingId && <button type="button" className="custom-groups-cancel" onClick={resetDraft}>Cancelar</button>}
          </div>
          <label>Nombre<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} maxLength={80} placeholder="Ej.: Personajes de Mario Bros" required /></label>
          <label>Descripción <span>(opcional)</span><textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} maxLength={240} rows={2} placeholder="Qué elementos incluye este grupo" /></label>
          <fieldset className="custom-groups-visibility">
            <legend>Visibilidad</legend>
            <label><input type="radio" name="group-visibility" value="public" checked={draft.visibility === 'public'} onChange={() => setDraft(current => ({ ...current, visibility: 'public' }))} /><span><strong>Público</strong><small>Cualquiera puede encontrarlo y usarlo.</small></span></label>
            <label><input type="radio" name="group-visibility" value="private" checked={draft.visibility === 'private'} onChange={() => setDraft(current => ({ ...current, visibility: 'private' }))} /><span><strong>Privado</strong><small>Solo tú puedes encontrarlo y añadirlo.</small></span></label>
          </fieldset>
          <div className="custom-groups-items-heading"><strong>Elementos</strong><span>{draft.items.length}</span></div>
          <div className="custom-groups-add-item">
            <input value={itemName} onChange={event => setItemName(event.target.value)} maxLength={100} placeholder="Nombre del elemento" aria-label="Nombre del elemento" />
            <input value={itemImage} onChange={event => setItemImage(event.target.value)} type="url" placeholder="URL de imagen (opcional)" aria-label="URL de imagen (opcional)" />
            <button type="button" onClick={addItem} disabled={!itemName.trim()}>Añadir</button>
          </div>
          {draft.items.length > 0 && <ul className="custom-groups-item-list">
            {draft.items.map((item, index) => <li key={item.id || index}>
              {item.image_url ? <img src={item.image_url} alt="" /> : <span className="custom-groups-item-placeholder">{item.name?.slice(0, 1)?.toUpperCase()}</span>}
              <span>{item.name}</span>
              <button type="button" onClick={() => setDraft(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Quitar ${item.name}`}>×</button>
            </li>)}
          </ul>}
          {error && <p className="custom-groups-error" role="alert">{error}</p>}
          <button className="custom-groups-save" type="submit" disabled={saving || !draft.name.trim() || !draft.items.length}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear grupo'}</button>
        </form>

        <section className="custom-groups-list-section">
          <div className="custom-groups-form-heading"><div><span>TUS COLECCIONES</span><h2>Mis grupos <small>{groups.length}</small></h2></div></div>
          {loading ? <p className="custom-groups-empty">Cargando grupos…</p> : groups.length === 0 ? <p className="custom-groups-empty">Aún no tienes grupos. Crea uno añadiendo elementos manualmente.</p> : <div className="custom-groups-cards">
            {groups.map(group => <article className="custom-groups-card" key={group.id}>
              <div className="custom-groups-card-art">{group.items?.slice(0, 4).map((item, index) => item.image_url ? <img key={item.id || index} src={item.image_url} alt="" /> : <span key={item.id || index}>{item.name?.slice(0, 1)?.toUpperCase()}</span>)}</div>
              <div className="custom-groups-card-copy"><h3>{group.name}</h3><p>{group.items?.length || 0} elementos · {group.visibility === 'public' ? 'Público' : 'Privado'}</p>{group.description && <small>{group.description}</small>}</div>
              <div className="custom-groups-card-actions"><button type="button" onClick={() => startEdit(group)}>Editar</button><button type="button" onClick={() => removeGroup(group)} aria-label={`Borrar ${group.name}`}>Borrar</button></div>
            </article>)}
          </div>}
        </section>
      </div>
    </main>
  )
}
