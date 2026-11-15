import { useEffect, useId, useState } from 'react'
import { searchManga } from '../../lib/mangaService'
import MangaAvailability from '../MangaAvailability'

export default function MangaFavoritesEditor({ value = [], onChange }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState({ items: [], query: '', loading: false, error: '' })
  const id = useId()
  useEffect(() => {
    if (query.trim().length < 2) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearch({ query, items: [], loading: true, error: '' })
      try {
        const items = await searchManga(query, 8, { signal: controller.signal })
        if (!controller.signal.aborted) setSearch({ query, items, loading: false, error: '' })
      } catch {
        if (!controller.signal.aborted) setSearch({ query, items: [], loading: false, error: 'No se pudo buscar manga.' })
      }
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])
  const move = (index, delta) => {
    const next = [...value]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    onChange(next)
  }
  const add = manga => {
    if (value.length < 4 && !value.some(item => item.id === manga.id)) onChange([...value, { id: manga.id, title: manga.title, cover_url: manga.image_url, type: 'manga' }])
    setQuery('')
  }
  return <div className="ep-settings-row manga-favorites-editor">
    <label htmlFor={id}>Manga favoritos <small>{value.length}/4</small></label>
    <div className="ep-settings-selected-works">{value.map((item, index) => <div className="ep-settings-selected-work" key={item.id}>
      {item.cover_url && <img src={item.cover_url} alt="" />}<span>{item.title}</span>
      <button type="button" disabled={!index} onClick={() => move(index, -1)} aria-label={`Subir ${item.title}`}>↑</button>
      <button type="button" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar ${item.title}`}>↓</button>
      <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Quitar ${item.title}`}>×</button>
    </div>)}</div>
    {value.length < 4 && <div className="ep-settings-search-wrap"><input id={id} className="ep-settings-control" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar manga…" />
      {search.query === query && query.trim().length >= 2 && <div className="ep-settings-work-results" aria-live="polite">{search.loading ? 'Buscando…' : search.error || search.items.filter(item => !value.some(favorite => favorite.id === item.id)).map(item => <button type="button" className="ep-settings-work-result" key={item.id} onClick={() => add(item)}>{item.image_url && <img src={item.image_url} alt="" />}<span>{item.title}</span><span>Añadir</span></button>)}</div>}
    </div>}
    <MangaAvailability />
  </div>
}
