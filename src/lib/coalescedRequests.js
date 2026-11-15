/** Share in-flight reads; cancelling one consumer must not cancel another. No persistent metadata cache. */
export function coalescedRequests(execute) {
  const pending = new Map()
  return (body, signal) => {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    const key = JSON.stringify(body)
    let entry = pending.get(key)
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController()
      entry = { controller, consumers: 0, settled: false }
      entry.promise = Promise.resolve().then(() => execute(body, controller.signal))
      pending.set(key, entry)
      const remove = () => { entry.settled = true; if (pending.get(key) === entry) pending.delete(key) }
      entry.promise.then(remove, remove)
    }
    entry.consumers++
    return new Promise((resolve, reject) => {
      let finished = false
      const release = () => {
        if (finished) return false
        finished = true
        signal?.removeEventListener('abort', abort)
        entry.consumers--
        if (!entry.consumers && !entry.settled) entry.controller.abort()
        return true
      }
      const abort = () => { if (release()) reject(new DOMException('Aborted', 'AbortError')) }
      signal?.addEventListener('abort', abort, { once: true })
      entry.promise.then(value => { if (release()) resolve(value) }, error => { if (release()) reject(error) })
    })
  }
}
