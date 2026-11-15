import AlignmentBoard from './AlignmentBoard'
import { ALIGNMENT_MIN, ALIGNMENT_MAX } from '../lib/alignment'

export default function AlignmentConfigEditor({ config, onChange, content, renderCell }) {
  const resize = (axis, delta) => {
    const entries = config.axes[axis].entries
    if (entries.length + delta < ALIGNMENT_MIN || entries.length + delta > ALIGNMENT_MAX) return
    const next = delta < 0 ? entries.slice(0, -1) : [...entries, {
      id: `${axis}-${globalThis.crypto.randomUUID()}`,
      label: `${axis === 'x' ? 'Columna' : 'Fila'} ${entries.length + 1}`,
    }]
    onChange({ ...config, axes: { ...config.axes, [axis]: { ...config.axes[axis], entries: next } } })
  }
  return <section className="alignment-config" aria-label="Configurar alineamiento">
    <div className="alignment-size-controls">
      {['x', 'y'].map(axis => {
        const count = config.axes[axis].entries.length
        const singular = axis === 'x' ? 'columna' : 'fila'
        return <div className="alignment-size-control" role="group" aria-label={axis === 'x' ? 'Columnas' : 'Filas'} key={axis}>
          <span>{axis === 'x' ? 'Columnas' : 'Filas'}</span>
          <button type="button" disabled={count <= ALIGNMENT_MIN} aria-label={`Quitar una ${singular}`} onClick={() => resize(axis, -1)}>−</button>
          <strong>{count}</strong>
          <button type="button" disabled={count >= ALIGNMENT_MAX} aria-label={`Añadir una ${singular}`} onClick={() => resize(axis, 1)}>+</button>
        </div>
      })}
    </div>
    <AlignmentBoard config={config} content={content} renderCell={renderCell} onConfigChange={onChange}/>
  </section>
}
