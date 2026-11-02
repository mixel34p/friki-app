import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createCustomItemGroup,
  getUserCustomItemGroups,
  updateCustomItemGroup,
} from '../lib/customItemGroupService'
import { getUserTemplates } from '../lib/listService'
import './CustomItemGroupEditor.css'

const emptyDraft = () => ({ name: '', description: '', visibility: 'private', items: [] })
const newItemId = () => `custom-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
const isCustomTemplateItem = item => {
  const id = String(item?.id || '')
  return id.startsWith('custom-') || id.startsWith('custom_') || id.startsWith('group-') || Boolean(item?.source_group_id)
}

function normalizeTemplateItem(item, index) {
  const image = item.image_url || item.cover_url || item.cover_image || item.imageUrl || ''
  return { ...item, id: String(item.id || newItemId()), name: item.name || item.title || `Elemento ${index + 1}`, image_url: image, cover_url: image }
}

function ItemArtwork({ item }) {
  return item.image_url || item.cover_url
    ? <img src={item.image_url || item.cover_url} alt="" loading="lazy" />
    : <span>{item.name?.slice(0, 1)?.toUpperCase() || '?'}</span>
}

export default function CustomItemGroupEditor() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(groupId)
  const [draft, setDraft] = useState(emptyDraft)
  const [itemName, setItemName] = useState('')
  const [itemImage, setItemImage] = useState('')
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateLoadError, setTemplateLoadError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  useEffect(() => {
    if (!groupId || !user?.id) { setLoading(false); return }
    let active = true
    getUserCustomItemGroups(user.id).then(groups => {
      const group = groups.find(item => String(item.id) === String(groupId))
      if (!group) throw new Error('No se encontró el grupo o no tienes permiso para editarlo.')
      if (active) setDraft({ name: group.name || '', description: group.description || '', visibility: group.visibility || 'private', items: group.items || [] })
    }).catch(loadError => { if (active) setError(loadError.message || 'No se pudo cargar el grupo.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [groupId, user?.id])

  useEffect(() => {
    if (groupId || !user?.id) return undefined
    let active = true
    setTemplatesLoading(true)
    getUserTemplates(user.id).then(data => { if (active) setTemplates(data || []) })
      .catch(loadError => { if (active) setTemplateLoadError(loadError.message || 'No se pudieron cargar tus plantillas.') })
      .finally(() => { if (active) setTemplatesLoading(false) })
    return () => { active = false }
  }, [groupId, user?.id])

  const selectSourceTemplate = templateId => {
    const nextTemplate = templates.find(template => String(template.id) === String(templateId))
    const previousTemplate = templates.find(template => String(template.id) === String(selectedTemplateId))
    const previousImportedIds = new Set((previousTemplate?.default_items || []).filter(isCustomTemplateItem).map(item => String(item.id)))
    const importedItems = (nextTemplate?.default_items || []).filter(isCustomTemplateItem).map(normalizeTemplateItem)
    setDraft(current => {
      const keptItems = current.items.filter(item => !previousImportedIds.has(String(item.id)))
      const seen = new Set(keptItems.map(item => String(item.id)))
      const nextItems = [...keptItems]
      importedItems.forEach(item => {
        const key = String(item.id)
        if (seen.has(key)) return
        seen.add(key)
        nextItems.push(item)
      })
      return { ...current, items: nextItems }
    })
    setSelectedTemplateId(templateId)
  }

  const addItem = () => {
    const name = itemName.trim()
    if (!name) return
    const image = itemImage.trim()
    setDraft(current => ({ ...current, items: [...current.items, { id: newItemId(), name, image_url: image, cover_url: image }] }))
    setItemName('')
    setItemImage('')
    setError('')
  }

  const save = async event => {
    event.preventDefault()
    if (!draft.name.trim() || draft.items.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const payload = { name: draft.name.trim(), description: draft.description.trim(), visibility: draft.visibility, items: draft.items, owner_id: user.id }
      if (groupId) await updateCustomItemGroup(groupId, payload, user.id)
      else await createCustomItemGroup(payload)
      navigate('/groups')
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el grupo.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="group-editor-page"><div className="group-editor-state">Cargando grupo…</div></main>

  return <main className="group-editor-page">
    <header className="group-editor-header">
      <button type="button" className="group-editor-back" onClick={() => navigate('/groups')} aria-label="Volver a grupos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7" /></svg></button>
      <div className="group-editor-heading"><h1>{isEditing ? 'Editar grupo' : 'Crear grupo'}</h1><p>{isEditing ? 'Actualiza tu colección de elementos.' : 'Prepara una colección para reutilizarla en tus plantillas.'}</p></div>
      <button type="submit" form="group-editor-form" className="group-editor-save" disabled={saving || loading || !draft.name.trim() || !draft.items.length}>{saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear grupo'}</button>
    </header>

    <form id="group-editor-form" className="group-editor-layout" onSubmit={save}>
      <div className="group-editor-main">
        {error && <p className="group-editor-error" role="alert">{error}</p>}
        {!isEditing && <section className="group-editor-section group-editor-source-template">
          <div className="group-editor-section-heading"><div><h2>Importar desde una plantilla <small className="group-editor-optional">Opcional</small></h2><p>Añade sus elementos personalizados predefinidos a este grupo.</p></div></div>
          <label className="group-editor-field">Plantilla de origen
            <select value={selectedTemplateId} onChange={event => selectSourceTemplate(event.target.value)} disabled={templatesLoading || templates.length === 0}>
              <option value="">{templatesLoading ? 'Cargando tus plantillas…' : templates.length ? 'Elige una plantilla' : 'No tienes plantillas creadas'}</option>
              {templates.map(template => {
                const customCount = (template.default_items || []).filter(isCustomTemplateItem).length
                return <option key={template.id} value={template.id}>{template.title} · {customCount} elementos personalizados</option>
              })}
            </select>
          </label>
          {templateLoadError && <p className="group-editor-inline-error" role="alert">{templateLoadError}</p>}
        </section>}

        <section className="group-editor-section group-editor-details">
          <div className="group-editor-section-heading"><div><h2>Detalles</h2><p>Elige un nombre y una descripción para reconocerlo.</p></div></div>
          <label className="group-editor-field">Nombre<input autoFocus={!isEditing} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} maxLength={80} placeholder="Ej.: Personajes de Mario Bros" required /></label>
          <label className="group-editor-field">Descripción<textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} maxLength={240} rows={3} placeholder="¿Qué tienen en común estos elementos?" /></label>
        </section>

        <section className="group-editor-section group-editor-privacy-section">
          <div className="group-editor-section-heading"><div><h2>Visibilidad</h2><p>Elige quién puede encontrar y guardar este grupo.</p></div></div>
          <div className={`group-editor-visibility${draft.visibility === 'public' ? ' is-public' : ''}`} role="group" aria-label="Visibilidad del grupo">
            <button type="button" className={draft.visibility === 'private' ? 'is-selected' : ''} aria-pressed={draft.visibility === 'private'} onClick={() => setDraft(current => ({ ...current, visibility: 'private' }))}>Privado</button>
            <button type="button" className={draft.visibility === 'public' ? 'is-selected' : ''} aria-pressed={draft.visibility === 'public'} onClick={() => setDraft(current => ({ ...current, visibility: 'public' }))}>Público</button>
          </div>
          <p className="group-editor-visibility-note">{draft.visibility === 'public' ? 'Cualquiera podrá descubrirlo y guardarlo.' : 'Solo tú podrás descubrirlo y añadirlo a tus plantillas.'}</p>
        </section>

        <section className="group-editor-section group-editor-items-section">
          <div className="group-editor-section-heading group-editor-items-heading"><div><h2>Elementos <small>{draft.items.length}</small></h2><p>Añade los elementos que formarán parte de tu colección.</p></div></div>
          <div className="group-editor-item-entry">
            <label>Nombre<input value={itemName} onChange={event => setItemName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addItem() } }} maxLength={100} placeholder="Ej.: Mario" /></label>
            <label>URL de imagen<input type="url" value={itemImage} onChange={event => setItemImage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addItem() } }} placeholder="https://..." /></label>
            <button type="button" onClick={addItem} disabled={!itemName.trim()} aria-label="Añadir elemento"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>Añadir elemento</span></button>
          </div>
          {draft.items.length ? <div className="group-editor-item-grid">{draft.items.map((item, index) => <article className="group-editor-item-card" key={item.id || index}>
            <ItemArtwork item={item} /><strong title={item.name}>{item.name}</strong>
            <button type="button" onClick={() => setDraft(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Quitar ${item.name}`} title="Quitar elemento"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
          </article>)}</div> : <div className="group-editor-items-empty"><span>＋</span><strong>Aún no hay elementos</strong><small>Añade el primero con los campos de arriba.</small></div>}
          {error && <p className="group-editor-error" role="alert">{error}</p>}
          <button type="submit" className="group-editor-save-bottom" disabled={saving || !draft.name.trim() || !draft.items.length}>{saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear grupo'}</button>
        </section>
      </div>

      <aside className="group-editor-preview">
        <div className="group-editor-preview-heading"><span>VISTA PREVIA</span><strong>{draft.visibility === 'public' ? 'Público' : 'Privado'}</strong></div>
        <div className="group-editor-preview-art" aria-hidden="true">{draft.items.slice(0, 4).map((item, index) => <ItemArtwork item={item} key={item.id || index} />)}{!draft.items.length && <span className="group-editor-preview-placeholder">G</span>}</div>
        <h2>{draft.name || 'Nombre del grupo'}</h2>
        <p>{draft.description || 'La descripción aparecerá aquí.'}</p>
        <div className="group-editor-preview-count"><strong>{draft.items.length}</strong><span>{draft.items.length === 1 ? 'elemento' : 'elementos'}</span></div>
        <small className="group-editor-preview-note">Al añadir el grupo a una plantilla, sus elementos se incorporarán como predefinidos.</small>
      </aside>
    </form>
  </main>
}
