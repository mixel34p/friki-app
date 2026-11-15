import { useEffect, useId, useState } from 'react'
import { workAdapter } from '../../lib/workAdapters'
import { SortableFavoriteItem } from './SortableFavoriteItem'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'

const labels = { game: 'Juegos', anime: 'Anime', manga: 'Manga' }
const favoriteKey = item => `${item.type}:${item.id}`

export default function FavoriteWorksEditor({ value = [], onChange }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState({ query: '', items: [], loading: false, error: '' })
  const id = useId()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setSearch({ query: term, items: [], loading: false, error: '' }); return undefined }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearch({ query: term, items: [], loading: true, error: '' })
      const results = await Promise.allSettled(['game', 'anime', 'manga'].map(async type =>
        (await workAdapter(type).search(term, 6, { signal: controller.signal })).map(work => ({
          id: String(work.id), type, title: work.name || work.title,
          cover_url: work.cover_url || work.image_url || work.image,
        })),
      ))
      if (controller.signal.aborted) return
      const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      setSearch({ query: term, items, loading: false, error: items.length ? '' : 'No se encontraron obras.' })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const add = item => {
    if (value.length < 4 && !value.some(existing => favoriteKey(existing) === favoriteKey(item))) onChange([...value, item])
    setQuery('')
  }
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = value.findIndex(item => favoriteKey(item) === active.id)
    const to = value.findIndex(item => favoriteKey(item) === over.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(value, from, to))
  }

  return <div className="ep-field ep-favorite-works-editor">
    <label className="ep-label" htmlFor={id}>Obras favoritas <small>{value.length}/4</small></label>
    <p className="ep-favorite-works-hint">Combina videojuegos, anime y manga. Arrastra las carátulas para ordenarlas.</p>
    <div className="ep-favorites-grid">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.map(favoriteKey)} strategy={rectSortingStrategy}>
          {value.map((item, index) => <SortableFavoriteItem
            key={favoriteKey(item)} sortableId={favoriteKey(item)}
            item={{ ...item, name: item.title }}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />)}
        </SortableContext>
      </DndContext>
      {Array.from({ length: 4 - value.length }, (_, index) => <span className="ep-empty-slot" key={`empty-${index}`} aria-hidden="true"><span>＋</span></span>)}
    </div>
    {value.length < 4 && <div className="ep-settings-search-wrap">
      <input id={id} className="ep-settings-control" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar juego, anime o manga…" />
      {search.query === query && query.trim().length >= 2 && <div className="ep-settings-work-results" aria-live="polite">
        {search.loading ? 'Buscando…' : search.error || search.items.filter(item => !value.some(favorite => favoriteKey(favorite) === favoriteKey(item))).map(item => <button type="button" className="ep-settings-work-result" key={favoriteKey(item)} onClick={() => add(item)}>{item.cover_url && <img src={item.cover_url} alt="" />}<span>{item.title}</span><span>{labels[item.type]}</span><span>Añadir</span></button>)}
      </div>}
    </div>}
  </div>
}
