import { useEffect, useRef, useState } from 'react'
import SavedCard from './SavedCard'

function estimateHeight(entry, width) {
  const item = entry.content
  if (!item) return 110
  if (entry.type === 'work') return width * 1.5
  if (entry.type === 'list') return 60 + Math.max(140, (item.type_config?.tiers?.length || 3) * 80) * width / 640
  if (entry.type === 'review') return width * 1.5 + 64
  const text = item.body
  return 60 + Math.min(4, Math.ceil((text?.length || 0) / Math.max(15, width / 8))) * 22 + (entry.type === 'post' && item.media?.length ? 190 : 0)
}

export default function SavedMasonry({ items, onOpen, onRemove, removing }) {
  const ref = useRef(null)
  const [layout, setLayout] = useState({ columns: 2, width: 180 })
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width || 0
      const mobile = window.matchMedia('(max-width: 768px)').matches
      const gap = mobile ? 14 : 22
      const columns = Math.max(2, Math.min(4, Math.floor((width + gap) / ((mobile ? 150 : 230) + gap))))
      const cardWidth = (width - gap * (columns - 1)) / columns
      setLayout(previous => previous.columns === columns && previous.width === cardWidth ? previous : { columns, width: cardWidth })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const columns = Array.from({ length: layout.columns }, () => ({ height: 0, items: [] }))
  for (const entry of items) {
    const column = columns.reduce((shortest, candidate) => candidate.height < shortest.height ? candidate : shortest)
    column.items.push(entry)
    column.height += estimateHeight(entry, layout.width) + 20
  }
  return <div className="saved-masonry" ref={ref} style={{ '--saved-columns': layout.columns }}>
    {columns.map((column, index) => <div className="saved-column" key={index}>{column.items.map(entry => <SavedCard key={entry.key} entry={entry} onOpen={onOpen} onRemove={onRemove} removing={removing === entry.key} />)}</div>)}
  </div>
}
