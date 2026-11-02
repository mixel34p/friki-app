import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createCustomItemGroup,
  getCustomItemGroups,
} from '../lib/customItemGroupService'
import { getUserTemplates } from '../lib/listService'
import './CustomItemGroups.css'

const isCustomTemplateItem = item => {
  const id = String(item?.id || '')
  return id.startsWith('custom-') || id.startsWith('custom_') || id.startsWith('group-') || Boolean(item?.source_group_id)
}
const getTemplateItems = template => (template?.default_items || []).filter(isCustomTemplateItem).map((item, index) => ({
  ...item,
  id: String(item.id || `custom-import-${template.id}-${index}`),
  name: item.name || item.title || `Elemento ${index + 1}`,
  image_url: item.image_url || item.cover_url || item.imageUrl || '',
  cover_url: item.cover_url || item.image_url || item.imageUrl || '',
}))
const getTemplateCoverUrls = template => (template?.cover_items?.length ? template.cover_items : template?.default_items || [])
  .map(item => typeof item === 'string' ? item : item?.image_url || item?.cover_url || item?.cover?.url)
  .filter(Boolean).slice(0, 4)

function GroupArtwork({ group }) {
  const items = group.items?.slice(0, 4) || []
  return <span className="groups-art" aria-hidden="true">
    {items.length ? items.map((item, index) => item.image_url || item.cover_url
      ? <img key={item.id || index} src={item.image_url || item.cover_url} alt="" loading="lazy" />
      : <i key={item.id || index}>{item.name?.slice(0, 1)?.toUpperCase()}</i>)
      : <span>{group.name?.slice(0, 1)?.toUpperCase() || 'G'}</span>}
  </span>
}

export default function CustomItemGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState({ mine: [], public: [], saved: [] })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState({ name: '', description: '', visibility: 'private', sourceTemplateId: '' })
  const [userTemplates, setUserTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const reload = async (showLoading = true) => {
    if (!user?.id) return
    if (showLoading) setLoading(true)
    try {
      setGroups(await getCustomItemGroups(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los grupos.')
    } finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [user?.id])

  useEffect(() => {
    if (!createOpen) return undefined
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return
      if (templatePickerOpen) setTemplatePickerOpen(false)
      else setCreateOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [createOpen, templatePickerOpen])

  const publicGroups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    if (!search) return groups.public
    return groups.public.filter(group => [group.name, group.description, ...(group.items || []).map(item => item.name)]
      .some(value => value?.toLocaleLowerCase().includes(search)))
  }, [groups.public, query])
  const templatesWithItems = useMemo(() => userTemplates.filter(template => getTemplateItems(template).length > 0), [userTemplates])
  const filteredTemplates = useMemo(() => {
    const search = templateQuery.trim().toLocaleLowerCase()
    return search ? templatesWithItems.filter(template => template.title?.toLocaleLowerCase().includes(search)) : templatesWithItems
  }, [templatesWithItems, templateQuery])

  const openCreate = async () => {
    setCreateDraft({ name: '', description: '', visibility: 'private', sourceTemplateId: '' })
    setTemplateQuery('')
    setTemplatePickerOpen(false)
    setError('')
    setCreateOpen(true)
    setTemplatesLoading(true)
    try { setUserTemplates(await getUserTemplates(user.id)) }
    catch (loadError) { setError(loadError.message || 'No se pudieron cargar tus plantillas.') }
    finally { setTemplatesLoading(false) }
  }

  const createGroup = async event => {
    event.preventDefault()
    if (!createDraft.name.trim() || creating) return
    const sourceTemplate = userTemplates.find(template => String(template.id) === String(createDraft.sourceTemplateId))
    setCreating(true)
    setError('')
    try {
      await createCustomItemGroup({
        name: createDraft.name.trim(),
        description: createDraft.description.trim(),
        visibility: createDraft.visibility,
        items: sourceTemplate ? getTemplateItems(sourceTemplate) : [],
        owner_id: user.id,
      })
      setCreateOpen(false)
      setCreateDraft({ name: '', description: '', visibility: 'private', sourceTemplateId: '' })
      await reload(false)
    } catch (saveError) {
      setError(saveError.message || 'No se pudo crear el grupo.')
    } finally { setCreating(false) }
  }

  return <main className="custom-groups-page">
    <header className="custom-groups-header">
      <div>
        <h1>Tus grupos</h1>
        <p>Elementos que puedes reutilizar en tus plantillas.</p>
      </div>
      <button type="button" className="groups-create-button" onClick={openCreate}><span>＋</span> Crear grupo</button>
    </header>

    {error && !createOpen && <p className="groups-error" role="alert">{error}</p>}
    <section className="groups-owned-section" aria-label="Grupos creados por ti">
      {loading ? <p className="groups-empty">Cargando tus grupos…</p>
        : groups.mine.length ? <div className="groups-owned-grid">{groups.mine.map(group => <article className="groups-owned-tile" key={group.id}>
          <Link to={`/groups/${group.id}`} className="groups-owned-open" aria-label={`Abrir grupo ${group.name}`}><span className="groups-owned-artwork"><GroupArtwork group={group} /><span className={`groups-visibility ${group.visibility === 'public' ? 'is-public' : ''}`} role="img" aria-label={group.visibility === 'public' ? 'Público' : 'Privado'} title={group.visibility === 'public' ? 'Público' : 'Privado'}>{group.visibility === 'public' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>}</span></span>
            <span className="groups-tile-copy"><strong>{group.name}</strong><small>{group.items?.length || 0} elementos</small></span>
          </Link>
        </article>)}</div>
          : <p className="groups-empty groups-owned-empty">Aún no has creado grupos. Crea uno para tener tus elementos a mano.</p>}
    </section>

    <section className="groups-public-section" aria-label="Explorar grupos" aria-live="polite">
      <div className="groups-discover-heading"><h2>Explorar</h2></div>
      <div className="groups-search-row">
        <label className="groups-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar grupos..." aria-label="Buscar grupos" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda">×</button>}
        </label>
      </div>
      {loading ? <p className="groups-empty">Cargando grupos…</p>
        : publicGroups.length ? <div className="groups-grid">{publicGroups.map(group => <article className="groups-public-tile" key={group.id}>
          <Link to={`/groups/${group.id}`} className="groups-public-open" aria-label={`Ver grupo ${group.name}`}>
            <GroupArtwork group={group} /><span className="groups-tile-copy"><strong>{group.name}</strong><small>{group.items?.length || 0} elementos</small></span>
          </Link>
        </article>)}</div>
          : <div className="groups-empty">{query ? 'No hay grupos públicos que coincidan con tu búsqueda.' : 'Todavía no hay grupos públicos.'}</div>}
    </section>

    {createOpen && createPortal(<div className="groups-create-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !creating) setCreateOpen(false) }}>
      <section className={`groups-create-dialog${templatePickerOpen ? ' is-template-picker' : ''}`} role="dialog" aria-modal="true" aria-labelledby="groups-create-title">
        <header className="groups-create-dialog-header">{templatePickerOpen && <button type="button" className="groups-create-back" onClick={() => setTemplatePickerOpen(false)} aria-label="Volver al formulario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}<h2 id="groups-create-title">{templatePickerOpen ? 'Importar desde una plantilla' : 'Crear grupo'}</h2><button type="button" onClick={() => { setCreateOpen(false); setTemplatePickerOpen(false) }} disabled={creating} aria-label="Cerrar">×</button></header>
        {!templatePickerOpen ? <form onSubmit={createGroup} className="groups-create-form">
          <label>Nombre<input autoFocus value={createDraft.name} onChange={event => setCreateDraft(current => ({ ...current, name: event.target.value }))} maxLength={80} placeholder="Ej.: Personajes de Mario Bros" required /></label>
          <label>Descripción<textarea value={createDraft.description} onChange={event => setCreateDraft(current => ({ ...current, description: event.target.value }))} maxLength={240} rows={3} placeholder="¿Qué tienen en común estos elementos?" /></label>
          <fieldset className="groups-visibility-field"><legend>Visibilidad</legend><div className={`groups-visibility-switch${createDraft.visibility === 'public' ? ' is-public' : ''}`} role="group" aria-label="Visibilidad del grupo"><button type="button" className={createDraft.visibility === 'private' ? 'active' : ''} aria-pressed={createDraft.visibility === 'private'} onClick={() => setCreateDraft(current => ({ ...current, visibility: 'private' }))}>Privado</button><button type="button" className={createDraft.visibility === 'public' ? 'active' : ''} aria-pressed={createDraft.visibility === 'public'} onClick={() => setCreateDraft(current => ({ ...current, visibility: 'public' }))}>Público</button></div></fieldset>
          <div className="groups-template-import"><span className="groups-import-label">Importar desde</span><button type="button" className="groups-template-trigger" onClick={() => { setTemplatePickerOpen(true); setTemplateQuery('') }}><span className="groups-template-plus">＋</span><span>{createDraft.sourceTemplateId ? userTemplates.find(template => String(template.id) === String(createDraft.sourceTemplateId))?.title : 'Añadir desde una plantilla'}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>{createDraft.sourceTemplateId && <small className="groups-create-hint">Se añadirán {getTemplateItems(userTemplates.find(template => String(template.id) === String(createDraft.sourceTemplateId))).length} elementos personalizados predefinidos.</small>}</div>
          {error && <p className="groups-error" role="alert">{error}</p>}
          <footer><button type="button" className="groups-create-cancel" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</button><button type="submit" className="groups-create-submit" disabled={creating || !createDraft.name.trim()}>{creating ? 'Creando…' : 'Crear grupo'}</button></footer>
        </form> : <div className="groups-template-browse"><label className="groups-template-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg><input autoFocus type="search" value={templateQuery} onChange={event => setTemplateQuery(event.target.value)} placeholder="Buscar plantillas..." aria-label="Buscar tus plantillas" /></label><div className="groups-template-options" role="listbox" aria-label="Tus plantillas">{templatesLoading ? <p>Cargando plantillas…</p> : filteredTemplates.length ? <><button type="button" className="groups-template-none" role="option" aria-selected={!createDraft.sourceTemplateId} onClick={() => { setCreateDraft(current => ({ ...current, sourceTemplateId: '' })); setTemplatePickerOpen(false) }}>No importar elementos</button>{filteredTemplates.map(template => { const covers = getTemplateCoverUrls(template); return <button type="button" role="option" aria-selected={String(template.id) === String(createDraft.sourceTemplateId)} key={template.id} onClick={() => { setCreateDraft(current => ({ ...current, sourceTemplateId: String(template.id) })); setTemplatePickerOpen(false) }}><span className={`groups-template-option-art has-${covers.length}`} aria-hidden="true">{covers.length ? covers.map((cover, index) => <img key={`${cover}-${index}`} src={cover} alt="" loading="lazy" />) : <span>{template.title?.slice(0, 1)?.toUpperCase() || 'T'}</span>}</span><span className="groups-template-option-copy"><strong>{template.title || 'Plantilla sin título'}</strong><small>{getTemplateItems(template).length} elementos personalizados</small></span></button>})}</> : <p>{templatesWithItems.length ? 'No hay plantillas que coincidan.' : 'No tienes plantillas con elementos predefinidos.'}</p>}</div></div>}
      </section>
    </div>, document.body)}

  </main>
}
