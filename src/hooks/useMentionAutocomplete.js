import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { completeMention, getActiveMention } from '../lib/mentions'

export default function useMentionAutocomplete({ inputRef, value, onValueChange, maxLength = 2000, enabled = true, userId }) {
  const listId = useId()
  const [active, setActive] = useState(null)
  const [search, setSearch] = useState({ query: null, users: [], loading: false, error: false })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dismissedRef = useRef(null)
  const query = enabled && active ? active.query : null
  const open = query !== null
  const currentSearch = search.query === query && search.userId === userId ? search : { users: [], loading: true, error: false }
  const users = currentSearch.users

  useEffect(() => {
    if (query === null) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_post_mention_users', { search_query: query }).abortSignal(controller.signal)
        if (error) throw error
        if (!controller.signal.aborted) setSearch({ query, userId, users: data || [], loading: false, error: false })
      } catch {
        if (!controller.signal.aborted) setSearch({ query, userId, users: [], loading: false, error: true })
      }
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, userId])

  const close = () => {
    dismissedRef.current = active ? `${active.start}:${active.query}` : null
    setActive(null)
  }
  const syncSelection = element => {
    if (!enabled || !element) return
    const next = getActiveMention(element.value, element.selectionStart, element.selectionEnd)
    if (next && dismissedRef.current === `${next.start}:${next.query}`) return
    setActive(next)
    if (!next || next.query !== active?.query) setSelectedIndex(0)
  }
  const restoreCaret = caret => requestAnimationFrame(() => {
    const input = inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    input.setSelectionRange(caret, caret)
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  })
  const selectUser = profile => {
    if (!active) return
    const completed = completeMention(value, active, profile.username, maxLength)
    if (!completed) return
    onValueChange(completed.text)
    close()
    dismissedRef.current = `${active.start}:${profile.username}`
    restoreCaret(completed.caret)
  }
  const insertMention = () => {
    const input = inputRef.current
    if (!input || !enabled) return
    dismissedRef.current = null
    const existing = getActiveMention(value, input.selectionStart, input.selectionEnd)
    if (existing) {
      setActive(existing)
      setSelectedIndex(0)
      input.focus({ preventScroll: true })
      return
    }
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const prefix = start > 0 && /[a-zA-Z0-9_@/]/.test(value[start - 1]) ? ' @' : '@'
    const text = value.slice(0, start) + prefix + value.slice(end)
    if (text.length > maxLength) return
    onValueChange(text)
    const caret = start + prefix.length
    setActive(getActiveMention(text, caret))
    setSelectedIndex(0)
    restoreCaret(caret)
  }

  return {
    inputRef, mentionStart: active?.start, value,
    open, listId, users, selectedIndex, loading: currentSearch.loading, error: currentSearch.error, selectUser, insertMention,
    inputProps: {
      role: enabled ? 'combobox' : undefined,
      'aria-haspopup': enabled ? 'listbox' : undefined,
      'aria-autocomplete': enabled ? 'list' : undefined,
      'aria-controls': open ? listId : undefined,
      'aria-expanded': enabled ? open : undefined,
      'aria-activedescendant': open && users[selectedIndex] ? `${listId}-${users[selectedIndex].id}` : undefined,
      onChange: event => {
        dismissedRef.current = null
        onValueChange(event.target.value)
        syncSelection(event.target)
      },
      onSelect: event => syncSelection(event.target),
      onFocus: event => { dismissedRef.current = null; syncSelection(event.target) },
      onBlur: close,
      onKeyDown: event => {
        if (!open || event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
        if (!users.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setSelectedIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + users.length) % users.length)
        } else if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          selectUser(users[selectedIndex] || users[0])
        }
      },
    },
  }
}
