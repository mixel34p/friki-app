export const ALIGNMENT_MIN = 2
export const ALIGNMENT_MAX = 6
export const ALIGNMENT_LABEL_MAX = 60

export function createAlignmentConfig(classic = true) {
  return {
    version: 1,
    axes: {
      x: { label: '', entries: classic
        ? [{ id: 'lawful', label: 'Columna 1' }, { id: 'neutral-x', label: 'Columna 2' }, { id: 'chaotic', label: 'Columna 3' }]
        : [{ id: 'x1', label: 'Columna 1' }, { id: 'x2', label: 'Columna 2' }] },
      y: { label: '', entries: classic
        ? [{ id: 'good', label: 'Fila 1' }, { id: 'neutral-y', label: 'Fila 2' }, { id: 'evil', label: 'Fila 3' }]
        : [{ id: 'y1', label: 'Fila 1' }, { id: 'y2', label: 'Fila 2' }] },
    },
  }
}

export function validateAlignmentConfig(config, { allowEmptyLabels = false } = {}) {
  if (config?.version !== 1) throw new Error('La configuración del alineamiento no es válida.')
  for (const key of ['x', 'y']) {
    const axis = config.axes?.[key]
    if (!axis || typeof axis.label !== 'string' || axis.label.length > ALIGNMENT_LABEL_MAX
      || !Array.isArray(axis.entries) || axis.entries.length < ALIGNMENT_MIN || axis.entries.length > ALIGNMENT_MAX) {
      throw new Error(`Cada eje debe tener entre ${ALIGNMENT_MIN} y ${ALIGNMENT_MAX} categorías y un nombre de hasta ${ALIGNMENT_LABEL_MAX} caracteres.`)
    }
    const ids = new Set()
    for (const entry of axis.entries) {
      if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) || ids.has(entry.id)
        || typeof entry.label !== 'string' || (!allowEmptyLabels && !entry.label.trim()) || entry.label.length > ALIGNMENT_LABEL_MAX) {
        throw new Error('Las categorías necesitan etiquetas de 1–60 caracteres e identificadores únicos.')
      }
      ids.add(entry.id)
    }
  }
  return config
}

export const alignmentCellKey = (xId, yId) => `a:${xId}:${yId}`

export function alignmentCells(config) {
  validateAlignmentConfig(config)
  return config.axes.y.entries.flatMap(y => config.axes.x.entries.map(x => ({
    id: alignmentCellKey(x.id, y.id), x, y, label: `${y.label} · ${x.label}`,
  })))
}

export function alignmentItem(value) {
  return (Array.isArray(value) ? value[0] : value) || null
}

export function validateAlignmentContent(config, content) {
  const keys = new Set(alignmentCells(config).map(cell => cell.id))
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('El contenido del alineamiento no es válido.')
  for (const [key, value] of Object.entries(content)) {
    if (!keys.has(key)) throw new Error('El alineamiento contiene una casilla que no existe.')
    if (Array.isArray(value) && value.length > 1) throw new Error('Solo se admite un elemento por casilla.')
    const item = Array.isArray(value) ? value[0] : value
    if (item != null && (typeof item !== 'object' || Array.isArray(item)
      || !['string', 'number'].includes(typeof item.id) || !String(item.id).trim()
      || (typeof item.id === 'number' && !Number.isFinite(item.id))
      || typeof item.name !== 'string' || !item.name.trim()
      || (item.image_url != null && typeof item.image_url !== 'string'))) {
      throw new Error('Hay un elemento inválido en el alineamiento.')
    }
  }
  return content
}

export function alignmentToStored(config, content = {}) {
  validateAlignmentContent(config, content)
  return Object.fromEntries(alignmentCells(config).map(cell => [cell.id, alignmentItem(content[cell.id])]))
}

export function alignmentToEditor(config, content = {}) {
  return Object.fromEntries(Object.entries(alignmentToStored(config, content)).map(([key, item]) => [key, item ? [item] : []]))
}

export function moveAlignmentItem(config, content, source, target) {
  const next = alignmentToEditor(config, content)
  if (!(source in next) || !(target in next)) throw new Error('La casilla de destino no existe.')
  ;[next[source], next[target]] = [next[target], next[source]]
  return next
}

// Labels may temporarily be empty while editing; validate them when saving.
export function reconcileAlignmentContent(content, config) {
  const keys = new Set(config.axes.y.entries.flatMap(y => config.axes.x.entries.map(x => alignmentCellKey(x.id, y.id))))
  return {
    content: Object.fromEntries([...keys].map(key => [key, content[key] || []])),
    removed: Object.entries(content).filter(([key]) => !keys.has(key)).map(([, value]) => alignmentItem(value)).filter(Boolean),
  }
}
