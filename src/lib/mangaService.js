import { supabase } from './supabase'
import { normalizeCatalogWork, validateWorkIdentity } from './workTypes'
import { coalescedRequests } from './coalescedRequests'
import { mangaCatalogError } from './mangaCatalogError'

export const MANGA_UNAVAILABLE = 'La búsqueda externa de manga aún no está configurada. Puedes consultar las obras ya guardadas.'
export const mangaSearchEnabled = import.meta.env.VITE_MANGA_SEARCH_ENABLED === 'true'
const invokeCatalog = coalescedRequests(async (body, signal) => {
  const result = await supabase.functions.invoke('manga-catalog', { body, signal })
  return result.error ? { ...result, error: await mangaCatalogError(result.error, result.response || result.error.context) } : result
})

// Queries never trust a user-supplied URL or provider payload. Only the Edge Function imports metadata.
export async function searchMangaLocal(query, limit = 20, { signal, offset = 0 } = {}) {
  if (query.trim().length < 2) return []
  let request = supabase.rpc('search_manga_catalog', { search_query: query.trim(), result_limit: Math.min(50, limit), result_offset: offset })
  if (signal) request = request.abortSignal(signal)
  const { data, error } = await request
  if (error) throw error
  return Object.assign((data || []).map(row => normalizeCatalogWork('manga', row)), { nextOffset: data?.length === limit ? offset + limit : null })
}

export async function searchManga(query, limit = 20, { signal, offset = 0 } = {}) {
  if (query.trim().length < 2) return []
  if (!mangaSearchEnabled) return searchMangaLocal(query, limit, { signal, offset })
  const { data, error } = await invokeCatalog({ operation: 'search', query: query.trim(), limit, offset }, signal)
  if (error) {
    if (signal?.aborted || error.name === 'AbortError') throw error
    try {
      const local = await searchMangaLocal(query, limit, { signal, offset })
      if (local.length) return local
    } catch {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      // Preserve the actionable provider error if the local fallback is also unavailable.
    }
    throw error
  }
  return Object.assign((data.items || []).map(row => normalizeCatalogWork('manga', row)), { nextOffset: data.nextOffset })
}

export async function getMangaById(id) {
  validateWorkIdentity('manga', id)
  const { data: row, error } = await supabase.from('manga').select('*').eq('id', String(id)).maybeSingle()
  if (error) throw error
  if (!mangaSearchEnabled || row?.detail_expires_at && Date.parse(row.detail_expires_at) > Date.now()) return row ? normalizeCatalogWork('manga', row) : null
  const { data, error: providerError } = await invokeCatalog({ operation: 'detail', id: String(id) })
  if (providerError && !row) throw providerError
  const result = data?.item || row
  return result ? normalizeCatalogWork('manga', { ...result, stale: Boolean(providerError) }) : null
}

// Existing genre fallback strategy, bounded and entirely local; never fabricates recommendations.
export async function getSimilarManga(id, limit = 8, genres = []) {
  if (!genres.length) return []
  const { data, error } = await supabase.from('manga').select('*').neq('id', String(id)).overlaps('genres', genres).order('title').limit(Math.min(limit, 20))
  if (error) throw error
  return (data || []).map(row => normalizeCatalogWork('manga', row))
}
