import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import { formatRelativeDate } from '../lib/formatRelativeDate'
import { deleteCustomItemGroup, getCustomItemGroupById, getCustomItemGroups, saveCustomItemGroup, unsaveCustomItemGroup } from '../lib/customItemGroupService'
import './ReviewDetail.css'
import './PostDetail.css'
import './CustomItemGroupDetail.css'

function GroupArtwork({ group }) {
  const items = group.items?.slice(0, 4) || []
  return <span className="group-detail-art" aria-hidden="true">
    {items.length ? items.map((item, index) => item.image_url || item.cover_url
      ? <img key={item.id || index} src={item.image_url || item.cover_url} alt="" loading="lazy" />
      : <i key={item.id || index}>{item.name?.slice(0, 1)?.toUpperCase()}</i>)
      : <span>{group.name?.slice(0, 1)?.toUpperCase() || 'G'}</span>}
  </span>
}

function Avatar({ owner }) {
  return <span className="review-detail-avatar group-detail-avatar" style={{ '--review-author-theme': owner?.theme_color || 'var(--brand-primary)' }}>
    {owner?.avatar_url ? <img src={owner.avatar_url} alt="" /> : <DefaultAvatar accent={owner?.theme_color} />}
  </span>
}

export default function CustomItemGroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [isSaved, setIsSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setGroup(null)
    Promise.all([
      getCustomItemGroupById(groupId),
      user?.id ? getCustomItemGroups(user.id).catch(() => null) : Promise.resolve(null),
    ]).then(([result, collections]) => {
      if (!active) return
      setGroup(result)
      setIsSaved(Boolean(collections?.saved?.some(saved => String(saved.id) === String(result.id))))
    }).catch(loadError => {
      if (active) setError(loadError?.code === 'PGRST116' ? 'No se encontró el grupo o no tienes permiso para verlo.' : loadError.message || 'No se pudo cargar el grupo.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [groupId, user?.id])

  useEffect(() => {
    if (!menuOpen && !deleteOpen) return undefined
    const close = event => { if (event.key === 'Escape') { setMenuOpen(false); if (!deleting) setDeleteOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen, deleteOpen, deleting])

  const isOwner = Boolean(user?.id && group?.owner_id === user.id)
  const backToGroups = () => navigate(user ? '/groups' : '/home')
  const ownerName = group?.owner?.display_name || group?.owner?.username || 'Usuario'
  const ownerPath = group?.owner?.username ? `/profile/${group.owner.username}` : '/profile'
  const items = useMemo(() => group?.items || [], [group?.items])
  const backdrop = items.find(item => item?.image_url || item?.cover_url)

  const handleSave = async () => {
    if (!user?.id || !group || saving) return
    setSaving(true)
    setActionError('')
    try {
      if (isSaved) await unsaveCustomItemGroup(group.id, user.id)
      else await saveCustomItemGroup(group.id, user.id)
      setIsSaved(!isSaved)
    } catch (saveError) { setActionError(saveError.message || 'No se pudo actualizar el grupo guardado.') }
    finally { setSaving(false) }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setMenuOpen(false)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setActionError('No se pudo copiar el enlace.') }
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(String(group.id))
      setCopiedId(true)
      setMenuOpen(false)
      window.setTimeout(() => setCopiedId(false), 1800)
    } catch { setActionError('No se pudo copiar el ID del grupo.') }
  }

  const handleDelete = async () => {
    if (!group || !isOwner || deleting) return
    setDeleting(true)
    setActionError('')
    try {
      await deleteCustomItemGroup(group.id, user.id)
      navigate('/groups', { replace: true })
    } catch (deleteError) { setActionError(deleteError.message || 'No se pudo borrar el grupo.') }
    finally { setDeleting(false) }
  }

  if (loading) return <main className="review-detail-page post-detail-page group-detail-page"><article className="review-post group-detail-state">Cargando grupo…</article></main>
  if (error || !group) return <main className="review-detail-page post-detail-page group-detail-page"><article className="review-post group-detail-state"><button className="review-detail-back" type="button" onClick={backToGroups}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Volver</button><h1>{error || 'Grupo no encontrado'}</h1></article></main>

  return <main className="review-detail-page post-detail-page group-detail-page" style={{ '--review-page-accent': group.owner?.theme_color || 'var(--brand-primary)', '--review-backdrop-image': backdrop ? `url("${backdrop.image_url || backdrop.cover_url}")` : 'none' }}>
    <article className="review-post post-detail-card group-detail-card">
      <div className="post-detail-topbar">
        <button className="review-detail-back" type="button" onClick={backToGroups}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Grupos</button>
        <div className="post-detail-menu-wrap">
          <button className="post-detail-dots" type="button" aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
          {menuOpen && <div className="post-detail-menu">
            <button type="button" onClick={handleCopyId}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>{copiedId ? 'ID copiado' : 'Copiar ID'}</button>
          </div>}
        </div>
      </div>

      <header className="review-post-header post-detail-author group-detail-author">
        <Link className="review-post-author" to={ownerPath}><Avatar owner={group.owner}/><span className="review-post-author-copy"><strong>{ownerName}</strong><span>@{group.owner?.username || 'usuario'} · {formatRelativeDate(group.updated_at || group.created_at)}</span></span></Link>
        <span className={`group-detail-visibility${group.visibility === 'public' ? ' is-public' : ''}`} role="img" title={group.visibility === 'public' ? 'Público' : 'Privado'} aria-label={group.visibility === 'public' ? 'Público' : 'Privado'}>{group.visibility === 'public' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>}</span>
      </header>

      <section className="group-detail-intro">
        <GroupArtwork group={group}/>
        <div><h1>{group.name}</h1>{group.description && <p className="group-detail-description">{group.description}</p>}<span className="group-detail-count">{items.length} {items.length === 1 ? 'elemento' : 'elementos'}</span></div>
      </section>

      <div className="group-detail-actions">
        {isOwner ? <>
          <Link to={`/groups/${group.id}/edit`} className="group-detail-action"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>Editar grupo</Link>
          <button type="button" className="group-detail-action is-danger" onClick={() => setDeleteOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>Eliminar</button>
        </> : user ? <button type="button" className={`group-detail-save${isSaved ? ' is-saved' : ''}`} onClick={handleSave} disabled={saving} aria-pressed={isSaved}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z"/></svg>{saving ? 'Guardando…' : isSaved ? 'Guardado' : 'Guardar grupo'}</button> : <Link to="/register" className="group-detail-save"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z"/></svg>Crear cuenta para guardar</Link>}
        <button type="button" className="group-detail-action group-detail-share" onClick={handleCopyLink}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>{copied ? 'Enlace copiado' : 'Compartir'}</button>
      </div>
      {actionError && <p className="group-detail-error" role="alert">{actionError}</p>}

      <div className="group-detail-items-heading"><h2>Elementos</h2><span>{items.length}</span></div>
      {items.length ? <div className="group-detail-items">{items.map((item, index) => <article className="group-detail-item" key={item.id || index}>
        {item.image_url || item.cover_url ? <img src={item.image_url || item.cover_url} alt="" loading="lazy"/> : <span className="group-detail-item-fallback">{item.name?.slice(0,1)?.toUpperCase() || '?'}</span>}
        <strong title={item.name}>{item.name}</strong>
      </article>)}</div> : <p className="group-detail-empty">Este grupo todavía no tiene elementos.</p>}
    </article>

    {deleteOpen && createPortal(<div className="group-detail-delete-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false) }}>
      <section className="group-detail-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="group-detail-delete-title" aria-describedby="group-detail-delete-copy">
        <span className="group-detail-delete-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg></span>
        <h2 id="group-detail-delete-title">¿Eliminar este grupo?</h2><p id="group-detail-delete-copy">Se eliminará «{group.name}» de tus grupos.</p>
        {actionError && <p className="group-detail-delete-error" role="alert">{actionError}</p>}
        <footer><button type="button" className="group-detail-delete-cancel" onClick={() => { setDeleteOpen(false); setActionError('') }} disabled={deleting}>Cancelar</button><button type="button" className="group-detail-delete-confirm" onClick={handleDelete} disabled={deleting}>{deleting ? 'Eliminando…' : 'Eliminar grupo'}</button></footer>
      </section>
    </div>, document.body)}
  </main>
}
