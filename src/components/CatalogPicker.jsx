import { useEffect, useId, useRef, useState } from 'react'

export default function CatalogPicker({ value, onChange, options, label, pill = false }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const optionRefs = useRef([])
  const searchRef = useRef({ text: '', time: 0 })
  const id = useId()
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    const option = optionRefs.current[activeIndex]
    const list = listRef.current
    option?.focus({ preventScroll: true })
    if (option && list) {
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
    }
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, activeIndex])

  const choose = index => {
    onChange(options[index].value)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }
  const onOptionsKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      const now = event.timeStamp
      const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
      const text = (now - searchRef.current.time < 700 ? searchRef.current.text : '') + normalize(event.key)
      searchRef.current = { text, time: now }
      const index = options.findIndex(option => normalize(option.label).startsWith(text))
      if (index >= 0) setActiveIndex(index)
    }
  }

  return <div className={'discover-sort-picker' + (pill ? ' discover-genre-picker' : '')} ref={rootRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); triggerRef.current?.focus({ preventScroll: true }) } }}>
    <button ref={triggerRef} type="button" className={'discover-sort-trigger' + (pill ? ' discover-genre-trigger' : '')} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => { searchRef.current = { text: '', time: 0 }; setActiveIndex(selectedIndex); setOpen(current => !current) }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(selectedIndex); setOpen(true) } }}>
      {pill && <svg className="discover-genre-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>}
      <span>{options[selectedIndex]?.label}</span><svg className="discover-picker-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    {open && <div ref={listRef} id={id} className={'discover-sort-options' + (pill ? ' discover-genre-options' : '')} role="listbox" aria-label={label} onKeyDown={onOptionsKeyDown}>{options.map((option, index) => <div key={option.value} ref={node => { optionRefs.current[index] = node }} className={'discover-sort-option' + (value === option.value ? ' active' : '')} role="option" aria-selected={value === option.value} tabIndex={index === activeIndex ? 0 : -1} onFocus={() => setActiveIndex(index)} onClick={() => choose(index)}><span>{option.label}</span>{value === option.value && <svg className="discover-picker-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}</div>)}</div>}
  </div>
}

