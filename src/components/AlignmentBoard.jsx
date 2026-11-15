import { useLayoutEffect, useRef } from 'react'
import ListItemArtwork from './ListItemArtwork'
import { alignmentCellKey, alignmentItem, validateAlignmentConfig, ALIGNMENT_MIN, ALIGNMENT_LABEL_MAX } from '../lib/alignment'
import './AlignmentBoard.css'

export function AlignmentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="6" y="6" width="15" height="15" rx="1"/><path d="M11 6v15M16 6v15M6 11h15M6 16h15M2 8V2h6M2 2l3 3"/></svg>
}

function AlignmentHeading({ entry, index, axis, entries, onChange }) {
  const inputRef = useRef(null)
  useLayoutEffect(() => {
    if (axis !== 'y' || !inputRef.current) return
    const input = inputRef.current
    input.style.height = '0px'
    input.style.height = `${input.scrollHeight}px`
  }, [axis, entry.label, onChange])
  const kind = axis === 'x' ? 'columna' : 'fila'
  const move = offset => {
    const next = [...entries]
    ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
    onChange(axis, next)
  }
  return <div role={axis === 'x' ? 'columnheader' : 'rowheader'} className={`alignment-heading${axis === 'y' ? ' alignment-row-heading' : ''}${onChange ? ' is-editable' : ''}`} title={entry.label}>
    {onChange ? <>
      <textarea ref={inputRef} className="alignment-label-input" aria-label={`Texto de ${kind} ${index + 1}`} value={entry.label} maxLength={ALIGNMENT_LABEL_MAX} placeholder={kind === 'columna' ? 'Columna…' : 'Fila…'} rows={axis === 'y' ? 1 : 2}
        onChange={event => onChange(axis, entries.map(value => value.id === entry.id ? { ...value, label: event.target.value } : value))}/>
      <div className="alignment-heading-tools">
        <button type="button" disabled={index === 0} aria-label={`Mover ${kind} ${index + 1} antes`} onClick={() => move(-1)}>{axis === 'x' ? '←' : '↑'}</button>
        <button type="button" disabled={index === entries.length - 1} aria-label={`Mover ${kind} ${index + 1} después`} onClick={() => move(1)}>{axis === 'x' ? '→' : '↓'}</button>
        <button type="button" disabled={entries.length <= ALIGNMENT_MIN} aria-label={`Eliminar ${kind} ${index + 1}`} onClick={() => onChange(axis, entries.filter(value => value.id !== entry.id))}>×</button>
      </div>
    </> : entry.label}
  </div>
}

export default function AlignmentBoard({ config, content = {}, renderCell, fit = false, onConfigChange }) {
  try { validateAlignmentConfig(config, { allowEmptyLabels: Boolean(onConfigChange) }) } catch {
    return <p role="status" className="alignment-invalid">Este alineamiento no está disponible.</p>
  }
  const { x, y } = config.axes
  const updateAxis = onConfigChange ? (axis, entries) => onConfigChange({ ...config, axes: { ...config.axes, [axis]: { ...config.axes[axis], entries } } }) : null
  return <div className="alignment-scroll" tabIndex={0} aria-label="Tabla de alineamiento">
    <div className={`alignment-board${fit ? ' is-fitted' : ''}`} role="table" aria-label="Alineamiento" style={{ '--alignment-columns': x.entries.length, width: fit ? '100%' : `${100 + x.entries.length * 120}px`, maxWidth: `${100 + x.entries.length * 120}px` }}>
      <div role="row" className="alignment-row">
        <div className="alignment-corner" aria-hidden="true"/>
        {x.entries.map((entry, index) => <AlignmentHeading key={entry.id} entry={entry} index={index} axis="x" entries={x.entries} onChange={updateAxis}/>)}
      </div>
      {y.entries.map((row, index) => <div role="row" className="alignment-row" key={row.id}>
        <AlignmentHeading entry={row} index={index} axis="y" entries={y.entries} onChange={updateAxis}/>
        {x.entries.map(column => {
          const id = alignmentCellKey(column.id, row.id)
          const item = alignmentItem(content[id])
          const label = `${row.label} · ${column.label}`
          return <div role="cell" key={id} className="alignment-cell cl-grid-drop-wrapper" aria-label={`${label}${item ? `: ${item.name}` : ': vacía'}`}>
            {renderCell ? renderCell({ id, item, label, x: column, y: row }) : item
              ? <ListItemArtwork item={item} hideName/>
              : <div className="alignment-empty"/>}
          </div>
        })}
      </div>)}
    </div>
  </div>
}
