import test from 'node:test'
import assert from 'node:assert/strict'
import { createAlignmentConfig, alignmentCells, alignmentToStored, alignmentToEditor, alignmentCellKey, moveAlignmentItem, validateAlignmentConfig, validateAlignmentContent, reconcileAlignmentContent } from '../src/lib/alignment.js'
import { collectListPreviewImages } from '../src/lib/discoverListPreview.js'

const item = (id = 'hero') => ({ id, name: `Personaje ${id}`, image_url: `https://images.test/${id}.png` })

test('standalone structure edits keep matching assignments and recover removed cells for the library', () => {
  const config = createAlignmentConfig()
  const retained = alignmentCellKey('lawful', 'good')
  const removed = alignmentCellKey('chaotic', 'good')
  const content = alignmentToEditor(config, { [retained]: item('kept'), [removed]: item('returned') })
  config.axes.x.entries = config.axes.x.entries.filter(entry => entry.id !== 'chaotic').reverse()
  config.axes.x.entries[0].label = '' // intermediate text edits must not discard content
  assert.doesNotThrow(() => validateAlignmentConfig(config, { allowEmptyLabels: true }))
  assert.throws(() => validateAlignmentConfig(config))
  const result = reconcileAlignmentContent(content, config)
  assert.equal(result.content[retained][0].id, 'kept')
  assert.equal(result.content[removed], undefined)
  assert.deepEqual(result.removed, [item('returned')])
})

test('classic and rectangular templates expose every intersection in row order', () => {
  const classic = createAlignmentConfig()
  assert.equal(alignmentCells(classic).length, 9)
  const rectangular = createAlignmentConfig(false)
  rectangular.axes.x.entries.push({ id: 'third', label: 'Otra categoría' })
  assert.equal(alignmentCells(rectangular).length, 6)
  assert.equal(alignmentCells(rectangular)[3].id, alignmentCellKey('x1', 'y2'))
  assert.equal(createAlignmentConfig().axes.x.entries.length, 3)
})

test('renaming and reordering axes preserve saved assignments', () => {
  const config = createAlignmentConfig()
  const key = alignmentCellKey('lawful', 'good')
  const saved = alignmentToStored(config, { [key]: item() })
  config.axes.x.entries.reverse()
  config.axes.y.entries[0].label = 'Una etiqueta completamente diferente'
  const loaded = alignmentToEditor(config, saved)
  assert.deepEqual(loaded[key], [item()])
  assert.equal(alignmentCells(config)[2].id, key)
})

test('round trip keeps holes, metadata and repeated artworks in independent cells', () => {
  const config = createAlignmentConfig(false)
  const [a, b, c] = alignmentCells(config).map(cell => cell.id)
  const source = { [a]: [{ ...item(), source_group_id: 'group' }], [b]: [], [c]: [item()] }
  const saved = alignmentToStored(config, source)
  assert.equal(saved[b], null)
  assert.equal(saved[a].source_group_id, 'group')
  assert.deepEqual(alignmentToStored(config, alignmentToEditor(config, saved)), saved)
  assert.equal(saved[a].id, saved[c].id)
})

test('moving swaps occupied cells and moves into empty cells without mutating its source', () => {
  const config = createAlignmentConfig()
  const [a, b, c] = alignmentCells(config).map(cell => cell.id)
  const source = { [a]: [item('one')], [b]: [item('two')] }
  const swapped = moveAlignmentItem(config, source, a, b)
  assert.equal(swapped[a][0].id, 'two')
  assert.equal(swapped[b][0].id, 'one')
  const moved = moveAlignmentItem(config, swapped, b, c)
  assert.deepEqual(moved[b], [])
  assert.equal(moved[c][0].id, 'one')
  assert.equal(source[a][0].id, 'one')
  assert.throws(() => moveAlignmentItem(config, source, a, 'missing'))
})

test('axes reject invalid sizes, duplicate IDs, separators and blank or oversized categories', () => {
  for (const change of [
    c => { c.version = 2 },
    c => { c.axes.x.entries = [] },
    c => { c.axes.y.entries = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, label: 'Extra' })) },
    c => { c.axes.x.entries[1].id = c.axes.x.entries[0].id },
    c => { c.axes.x.entries[0].id = 'invalid:separator' },
    c => { c.axes.x.entries[0].label = ' ' },
    c => { c.axes.x.entries[0].label = 'a'.repeat(61) },
  ]) {
    const config = createAlignmentConfig()
    change(config)
    assert.throws(() => validateAlignmentConfig(config))
  }
  const config = createAlignmentConfig(false)
  config.axes.x.label = ''
  assert.doesNotThrow(() => validateAlignmentConfig(config))
})

test('content rejects unknown cells, primitive items, overfilled cells and invalid item metadata', () => {
  const config = createAlignmentConfig()
  const key = alignmentCells(config)[0].id
  for (const content of [null, [], { unknown: null }, { [key]: false }, { [key]: 0 }, { [key]: '' }, { [key]: [item(), item()] }, { [key]: {} }, { [key]: { ...item(), name: '' } }, { [key]: { ...item(), image_url: 3 } }]) {
    assert.throws(() => validateAlignmentContent(config, content))
  }
})

test('alignment previews collect artwork without treating stable cell keys as tier names', () => {
  const config = createAlignmentConfig()
  const key = alignmentCells(config)[0].id
  assert.deepEqual(collectListPreviewImages(alignmentToStored(config, { [key]: item() })), [item().image_url])
})
