import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getSavedIndex, savedKey, savedTarget, savedType, saveItem, unsaveItem } from '../lib/savedItemsService'

const SavedItemsContext = createContext(null)
export function SavedItemsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const owner = useRef(userId)
  owner.current = userId
  const locks = useRef(new Set())
  const generation = useRef(0)
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(new Set())
  const [retry, setRetry] = useState(0)
  const state = result && result.userId === userId ? result : { status: userId ? 'loading' : 'ready', items: [], error: null }
  useEffect(() => {
    const controller = new AbortController()
    const version = ++generation.current
    if (userId) getSavedIndex(userId, controller.signal).then(items => {
      if (!controller.signal.aborted && generation.current === version) setResult({ userId, items, status: 'ready', error: null })
    }).catch(error => {
      if (!controller.signal.aborted && generation.current === version) setResult({ userId, items: [], status: 'error', error })
    })
    return () => controller.abort()
  }, [userId, retry])
  const changeSaved = useCallback(async (type, id, save) => {
    if (!userId) throw new Error('Inicia sesión para guardar contenido.')
    const key = `${userId}:${savedKey(type, id)}`
    if (locks.current.has(key)) return
    locks.current.add(key)
    setPending(previous => new Set(previous).add(key))
    try {
      const row = save ? await saveItem(userId, type, id) : await unsaveItem(userId, type, id)
      if (owner.current !== userId) return
      setResult(previous => {
        const items = (previous?.userId === userId ? previous.items : []).filter(item => !(savedType(item) === type && String(savedTarget(item)) === String(id)))
        return { userId, items: row ? [row, ...items] : items, status: 'ready', error: null }
      })
    } finally {
      locks.current.delete(key)
      setPending(previous => { const next = new Set(previous); next.delete(key); return next })
    }
  }, [userId])
  const isSaved = (type, id) => state.items.some(item => savedType(item) === type && String(savedTarget(item)) === String(id))
  return <SavedItemsContext.Provider value={{ ...state, isSaved, changeSaved, isPending: (type, id) => pending.has(`${userId}:${savedKey(type, id)}`), reload: () => setRetry(value => value + 1) }}>{children}</SavedItemsContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useSavedItems() { return useContext(SavedItemsContext) }
