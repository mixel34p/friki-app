// Supabase caches channels by topic. Each Postgres listener owns a channel so
// overlapping screens and effect remounts never register on a subscribed one.
// The namespace also separates module instances during Fast Refresh.
const namespace = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let nextId = 0

export function createPostgresChannel(client, topic, options) {
    return client.channel(`${topic}:${namespace}:${++nextId}`, options)
}
