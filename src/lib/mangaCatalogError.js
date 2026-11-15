/** Read SDK HTTP errors before their response body is lost. Never display secret values. */
export async function mangaCatalogError(error, response = error?.context) {
  if (error?.name === 'AbortError') return error
  let payload = null
  try { payload = await response?.clone().json() } catch { /* Network failures do not have an HTTP body. */ }
  const status = response?.status || null
  const code = payload?.code || (status === 429 ? 'MANGA_RATE_LIMITED' : 'MANGA_UNAVAILABLE')
  const messages = {
    MANGA_NOT_CONFIGURED: payload?.disabled
      ? 'La búsqueda de manga está desactivada en el servidor. Las obras guardadas siguen disponibles.'
      : 'La búsqueda de manga necesita completar su configuración. Las obras guardadas siguen disponibles.',
    MANGA_RATE_LIMITED: 'Se ha alcanzado el límite temporal de búsquedas de manga. Inténtalo más tarde.',
    MANGA_UNAVAILABLE: 'No se pudo consultar el catálogo externo de manga. Inténtalo más tarde.',
  }
  const result = new Error(messages[code] || messages.MANGA_UNAVAILABLE, { cause: error })
  result.code = code
  result.status = status
  result.disabled = payload?.disabled === true
  result.missing = Array.isArray(payload?.missing) ? payload.missing.filter(name => typeof name === 'string' && /^[A-Z_]+$/.test(name)) : []
  result.invalid = Array.isArray(payload?.invalid) ? payload.invalid.filter(name => typeof name === 'string' && /^[A-Z_]+$/.test(name)) : []
  return result
}
