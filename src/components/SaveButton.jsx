import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSavedItems } from '../context/SavedItemsContext'
import { useToast } from './Toast'
import './SaveButton.css'

export default function SaveButton({ type, targetId, className = 'review-post-action' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isSaved, changeSaved, isPending, status, reload } = useSavedItems()
  const { toast } = useToast()
  const saved = isSaved(type, targetId)
  const busy = isPending(type, targetId)
  const action = async event => {
    event.stopPropagation()
    if (!user) { navigate('/register'); return }
    if (status === 'error') { reload(); toast({ title: 'Reintentando cargar tus guardados', type: 'info' }); return }
    try {
      await changeSaved(type, targetId, !saved)
      toast({ title: saved ? 'Quitado de guardados' : 'Añadido a guardados', type: 'success' })
    } catch { toast({ title: 'No se pudo actualizar el guardado. Inténtalo de nuevo.', type: 'error' }) }
  }
  return <button type="button" className={`${className} save-item-button${saved ? ' is-saved' : ''}`} disabled={busy || Boolean(user && status === 'loading')} onClick={action} aria-pressed={saved} aria-busy={busy} title={status === 'error' ? 'Reintentar cargar guardados' : saved ? 'Quitar de guardados' : 'Guardar'} aria-label={saved ? 'Quitar de guardados' : 'Guardar'}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z" /></svg><span>{busy ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}</span>
  </button>
}
