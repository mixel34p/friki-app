import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import ListItemArtwork from './ListItemArtwork'

export default function AlignmentEditCell({ cell, onPick, onRemove, onMove }) {
  const { id, item, label } = cell
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id })
  const { setNodeRef: setDragRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `assigned:${id}`, data: { alignmentCell: id, item }, disabled: !item,
  })
  const handleKeyDown = event => {
    if (!item || !event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    onMove(id, event.key)
  }
  return <div ref={setDropRef} className={`alignment-edit-cell${isOver ? ' is-over' : ''}`}>
    <div ref={setDragRef} className="alignment-assignment" style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? .35 : 1 }}>
      <button type="button" id={`alignment-pick-${id}`} className="alignment-pick" {...(item ? attributes : {})} {...(item ? listeners : {})} onKeyDown={handleKeyDown} onClick={onPick} aria-label={`${item ? `Cambiar ${item.name}` : 'Añadir elemento'}: ${label}`} title={item ? `${item.name} · ${label}` : label}>
        {item ? <ListItemArtwork item={item}/> : '+'}
      </button>
      {item && <button type="button" className="alignment-remove" onClick={onRemove} aria-label={`Quitar ${item.name} de ${label}`}>×</button>}
    </div>
  </div>
}
