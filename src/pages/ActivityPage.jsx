import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import { supabase } from '../lib/supabase'
import { getAccentTextColor, getVisibleAccentColor } from '../lib/colorContrast'
import './ActivityPage.css'

function notificationTarget(item) {
  if (item.type === 'follow') return item.actor?.username ? `/profile/${item.actor.username}` : '/discover/users/all'
  if (item.resource_type === 'post' || item.type === 'like_post' || item.type === 'comment_post') return item.resource_id ? `/posts/${item.resource_id}` : '/home'
  if (item.resource_type === 'list' || item.type === 'like_list') return item.resource_id ? `/lists/${item.resource_id}` : '/home'
  if (item.resource_type === 'tierlist' || item.type === 'like_tierlist') return item.resource_id ? `/tierlist/${item.resource_id}` : '/home'
  if (item.resource_type === 'review' || item.type === 'like_review' || item.type === 'comment_review') return item.resource_id ? `/reviews/${item.resource_id}` : '/home'
  if (item.type === 'like' || item.type === 'comment') return item.resource_id ? `/lists/${item.resource_id}` : '/home'
  if (item.type === 'connection_request') return '/connections?tab=requests'
  if (item.type === 'connection_accepted') return item.resource_id ? `/chat/${item.resource_id}` : '/chat'
  return '/home'
}

function notificationMessage(item) {
  if (item.message) return item.message
  const messages = {
    follow: 'ha empezado a seguirte',
    like_list: 'le ha gustado tu lista',
    like_tierlist: 'le ha gustado tu tierlist',
    like_review: 'le ha gustado tu reseña',
    comment_review: 'ha comentado en tu reseña',
    comment_post: 'ha comentado en tu publicación',
    comment_list: 'ha comentado en tu lista',
    like_post: 'le ha gustado tu publicación',
    like: 'ha indicado que le gusta una de tus publicaciones',
    comment: 'ha comentado en una de tus listas',
    connection_request: 'quiere conectar contigo',
    connection_accepted: 'ha aceptado tu solicitud de conexión',
  }
  return messages[item.type] || 'ha interactuado contigo'
}

function timeLabel(dateValue) {
  if (!dateValue) return ''
  const elapsed = Math.max(0, Date.now() - new Date(dateValue).getTime())
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} d`
  return new Date(dateValue).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function dayKey(dateValue) {
  const date = new Date(dateValue)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayHeading(dateValue) {
  const date = new Date(dateValue)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return 'Hoy'
  if (dayKey(date) === dayKey(yesterday)) return 'Ayer'
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

const PAGE_SIZE = 100
const ACTOR_NOTIFICATION_TYPES = [
  'follow', 'like_list', 'like_tierlist', 'like_review', 'comment_review',
  'like_post', 'comment_post', 'comment_list', 'like', 'comment', 'connection_request', 'connection_accepted',
]

function parseListContent(content) {
  if (typeof content !== 'string') return content
  try { return JSON.parse(content) } catch { return null }
}

function listPreviewImages(content) {
  const parsed = parseListContent(content)
  const images = []
  const addImage = item => {
    const image = item?.image_url || item?.cover_url || item?.cover?.url
    if (image && !images.includes(image)) images.push(image)
  }
  const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
  const groups = Array.isArray(parsed) ? [parsed] : [
    ...priorities.filter(key => parsed?.[key] != null).map(key => parsed[key]),
    ...Object.keys(parsed || {}).filter(key => !priorities.includes(key)).map(key => parsed[key]),
  ]
  for (const group of groups) {
    for (const item of Array.isArray(group) ? group : [group]) {
      addImage(item)
      if (images.length === 4) return images
    }
  }
  return images
}

function highResolutionArtwork(type, url) {
  if (!url) return null
  if (type === 'game') return url.replace(/\/t_[^/]+\//, '/t_original/')
  if (type === 'anime') return url.replace('/cover/large/', '/cover/original/').replace('/cover/medium/', '/cover/original/')
  return url
}

function notificationActors(item) {
  const source = item.groupedItems || [item]
  const seen = new Set()
  return source.flatMap(row => {
    const actor = row.actor
    const id = actor?.id || row.actor_id
    if (!actor || seen.has(id)) return []
    seen.add(id)
    return [actor]
  }).slice(0, 2)
}

function activityIcon(type) {
  if (type === 'follow') return <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></>
  if (type?.startsWith('comment_')) return <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></>
  return <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
}

function collapseDayLikes(items) {
  const collapsed = new Map()
  items.forEach(item => {
    const isLike = item.type?.startsWith('like_') || item.type === 'like'
    const key = isLike && item.resource_id
      ? `${item.type}:${item.resource_type || ''}:${item.resource_id}`
      : `notification:${item.id}`
    const existing = collapsed.get(key)
    if (existing) {
      existing.groupedItems.push(item)
      existing.is_read = existing.is_read && item.is_read
    }
    else collapsed.set(key, { ...item, groupedItems: [item] })
  })
  return [...collapsed.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function collapseRepeatedFollows(items) {
  const collapsed = new Map()
  items.forEach(item => {
    const key = item.type === 'follow' && item.actor_id
      ? `follow:${item.actor_id}`
      : `notification:${item.id}`
    const existing = collapsed.get(key)
    if (existing) {
      existing.groupedItems.push(item)
      existing.is_read = existing.is_read && item.is_read
    } else {
      collapsed.set(key, { ...item, groupedItems: [item] })
    }
  })
  return [...collapsed.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function notificationResourceType(item) {
  if (item.resource_type) return item.resource_type
  if (item.type === 'like_post' || item.type === 'comment_post') return 'post'
  if (item.type === 'comment_list') return 'list'
  if (item.type === 'like_list') return 'list'
  if (item.type === 'like_tierlist') return 'tierlist'
  if (item.type === 'like_review') return 'review'
  return null
}

function activityCopy(item) {
  const type = item.type
  const actors = notificationActors(item)
  const names = actors.map(actor => actor.display_name || actor.username || 'Alguien')
  const total = new Set((item.groupedItems || [item]).map(row => row.actor_id)).size
  const resourceType = notificationResourceType(item)
  const thing = resourceType === 'review' ? 'tu reseña' : resourceType === 'tierlist' ? 'tu tierlist' : resourceType === 'post' ? 'tu publicación' : 'tu lista'
  const actorName = (index, fallback = 'Alguien') => {
    const name = names[index] || fallback
    return <strong>{name}</strong>
  }
  const action = text => <span className="activity-message-link">{text}</span>
  if (type?.startsWith('like_') || type === 'like') {
    if (total <= 1) return <>{actorName(0)} {action(`le ha dado me gusta a ${thing}`)}</>
    return <>{actorName(0)}{total === 2 ? <> y {actorName(1, 'otra persona')}</> : <>, {actorName(1, 'otra persona')} y {total - 2} más</>} {action(`han dado me gusta a ${thing}`)}</>
  }
  if (type === 'follow') return <>{actorName(0)} {action('ha empezado a seguirte')}</>
  return <>{actorName(0)} {action(notificationMessage(item))}</>
}

export default function ActivityPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const profileAccent = profile?.theme_color || '#14b8a6'
  const isBlackAccent = /^#(?:000|000000)$/i.test(profileAccent.trim())
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [visibleDayCount, setVisibleDayCount] = useState(7)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [followingIds, setFollowingIds] = useState(() => new Set())
  const [followedByIds, setFollowedByIds] = useState(() => new Set())
  const [followingBusy, setFollowingBusy] = useState(() => new Set())
  const offsetRef = useRef(0)

  const enrichRows = useCallback(async rows => {
    const actorIds = [...new Set(rows.map(row => row.actor_id).filter(Boolean))]
    let actors = {}
    let rowsWithExistingActors = rows
    if (actorIds.length) {
      const { data: profiles, error: profileFetchError } = await supabase.from('profiles')
        .select('id, username, display_name, avatar_url, theme_color')
        .in('id', actorIds)
      if (profileFetchError) {
        console.error('No se pudieron comprobar las cuentas de las notificaciones:', profileFetchError)
      } else {
        actors = Object.fromEntries((profiles || []).map(actor => [actor.id, actor]))
        const existingActorIds = new Set(Object.keys(actors))
        const missingActorIds = actorIds.filter(id => !existingActorIds.has(id))
        rowsWithExistingActors = rows.filter(row => !row.actor_id || existingActorIds.has(row.actor_id))

        if (user?.id && missingActorIds.length) {
          const { error: deleteMissingActorsError } = await supabase.from('notifications')
            .delete()
            .eq('user_id', user.id)
            .in('actor_id', missingActorIds)
          if (deleteMissingActorsError) console.error('No se pudieron borrar las notificaciones de cuentas inexistentes:', deleteMissingActorsError)
        }
      }

      if (user?.id) {
        const followActorIds = rowsWithExistingActors.filter(row => row.type === 'follow').map(row => row.actor_id).filter(Boolean)
        if (followActorIds.length) {
          const [followedRowsResult, followingMeRowsResult] = await Promise.all([
            supabase.from('follows').select('following_id')
              .eq('follower_id', user.id).in('following_id', followActorIds),
            supabase.from('follows').select('follower_id')
              .eq('following_id', user.id).in('follower_id', followActorIds)
          ])
          const currentlyFollowing = new Set((followedRowsResult.data || []).map(row => row.following_id))
          const currentlyFollowedBy = new Set((followingMeRowsResult.data || []).map(row => row.follower_id))
          setFollowingIds(current => {
            const next = new Set(current)
            followActorIds.forEach(id => next.delete(id))
            currentlyFollowing.forEach(id => next.add(id))
            return next
          })
          setFollowedByIds(current => {
            const next = new Set(current)
            followActorIds.forEach(id => next.delete(id))
            currentlyFollowedBy.forEach(id => next.add(id))
            return next
          })
        }
      }
    }

    // Deleting an auth account sets notifications.actor_id to NULL via the
    // database foreign key. These event types always require a real actor.
    if (user?.id) {
      const { error: deleteOrphansError } = await supabase.from('notifications')
        .delete()
        .eq('user_id', user.id)
        .is('actor_id', null)
        .in('type', ACTOR_NOTIFICATION_TYPES)
      if (deleteOrphansError) console.error('No se pudieron borrar las notificaciones sin cuenta asociada:', deleteOrphansError)
      rowsWithExistingActors = rowsWithExistingActors.filter(row => row.actor_id || !ACTOR_NOTIFICATION_TYPES.includes(row.type))
    }

    const listIds = [...new Set(rowsWithExistingActors.filter(row => notificationResourceType(row) === 'list').map(row => row.resource_id).filter(Boolean))]
    const reviewIds = [...new Set(rowsWithExistingActors.filter(row => notificationResourceType(row) === 'review').map(row => row.resource_id).filter(Boolean))]
    const tierlistIds = [...new Set(rowsWithExistingActors.filter(row => notificationResourceType(row) === 'tierlist').map(row => row.resource_id).filter(Boolean))]
    const postIds = [...new Set(rowsWithExistingActors.filter(row => notificationResourceType(row) === 'post').map(row => row.resource_id).filter(Boolean))]
    const resources = {}

    if (listIds.length) {
      const { data } = await supabase.from('user_lists').select('id, title, content').in('id', listIds)
      ;(data || []).forEach(list => { resources[`list:${list.id}`] = { title: list.title, image_urls: listPreviewImages(list.content) } })
    }

    if (postIds.length) {
      const { data } = await supabase.from('posts').select('id, media, contains_spoiler, is_sensitive').in('id', postIds)
      ;(data || []).forEach(post => {
        const firstImage = !post.contains_spoiler && !post.is_sensitive && Array.isArray(post.media)
          ? post.media.find(media => media?.url)?.url
          : null
        resources[`post:${post.id}`] = { title: 'Publicación', image_url: firstImage || null }
      })
    }

    if (reviewIds.length) {
      const { data } = await supabase.from('library_entries').select('id, work_id, work_type').in('id', reviewIds)
      const entries = data || []
      const mediaByType = { game: new Set(), anime: new Set() }
      entries.forEach(entry => { if (mediaByType[entry.work_type]) mediaByType[entry.work_type].add(String(entry.work_id)) })
      const workMaps = {}
      for (const type of ['game', 'anime']) {
        const ids = [...mediaByType[type]]
        if (!ids.length) continue
        const table = type === 'game' ? 'games' : 'anime'
        const fields = type === 'game' ? 'id, name, cover_url' : 'id, title, image_url'
        const { data: works } = await supabase.from(table).select(fields).in('id', ids)
        workMaps[type] = Object.fromEntries((works || []).map(work => [String(work.id), work]))
      }
      entries.forEach(entry => {
        const work = workMaps[entry.work_type]?.[String(entry.work_id)]
        const rawImage = work?.cover_url || work?.image_url || null
        resources[`review:${entry.id}`] = {
          title: work?.name || work?.title || 'Reseña',
          image_url: highResolutionArtwork(entry.work_type, rawImage),
          fallback_image_url: rawImage,
        }
      })
    }

    if (tierlistIds.length) {
      const { data } = await supabase.from('tierlists').select('id, title, media_type, tierlist_items(tier, media_id)').in('id', tierlistIds)
      const lists = data || []
      const mediaByType = { game: new Set(), anime: new Set() }
      lists.forEach(list => (list.tierlist_items || []).forEach(item => {
        if (mediaByType[list.media_type] && item.media_id) mediaByType[list.media_type].add(String(item.media_id))
      }))
      const workMaps = {}
      for (const type of ['game', 'anime']) {
        const ids = [...mediaByType[type]]
        if (!ids.length) continue
        const table = type === 'game' ? 'games' : 'anime'
        const fields = type === 'game' ? 'id, cover_url' : 'id, image_url'
        const { data: works } = await supabase.from(table).select(fields).in('id', ids)
        workMaps[type] = Object.fromEntries((works || []).map(work => [String(work.id), work]))
      }
      lists.forEach(list => {
        const tierOrder = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
        const tierRank = tier => { const rank = tierOrder.indexOf(tier); return rank < 0 ? tierOrder.length : rank }
        const orderedItems = [...(list.tierlist_items || [])].sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
        const image_urls = []
        orderedItems.forEach(item => {
          const work = workMaps[list.media_type]?.[String(item.media_id)]
          const image = work?.cover_url || work?.image_url
          if (image && !image_urls.includes(image) && image_urls.length < 4) image_urls.push(image)
        })
        resources[`tierlist:${list.id}`] = {
          title: list.title,
          image_urls,
        }
      })
    }

    return rowsWithExistingActors.map(row => ({
      ...row,
      actor: actors[row.actor_id],
      resource: resources[`${notificationResourceType(row)}:${row.resource_id}`] || null,
    }))
  }, [user?.id])

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)

    if (fetchError) {
      setError('No se pudo cargar la actividad. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    const rows = data || []
    offsetRef.current = rows.length
    setHasMore(rows.length === PAGE_SIZE)
    setNotifications(await enrichRows(rows))
    setError('')
    setLoading(false)
  }, [user?.id, enrichRows])

  useEffect(() => {
    loadNotifications()
    if (!user?.id) return undefined
    const channel = supabase
      .channel(`activity-page-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadNotifications)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadNotifications])

  useEffect(() => {
    if (!user?.id) return undefined
    return () => {
      void supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .then(({ error: updateError }) => {
          if (updateError) console.error('No se pudieron marcar las notificaciones como leídas:', updateError)
        })
    }
  }, [user?.id])

  const groupedNotifications = useMemo(() => {
    const groups = new Map()
    collapseRepeatedFollows(notifications).forEach(item => {
      const key = dayKey(item.created_at)
      if (!groups.has(key)) groups.set(key, { key, heading: dayHeading(item.created_at), items: [] })
      groups.get(key).items.push(item)
    })
    return [...groups.values()].map(group => ({ ...group, items: collapseDayLikes(group.items) }))
  }, [notifications])

  const loadMore = async () => {
    if (!user?.id || loadingMore || !hasMore) return
    setLoadingMore(true)
    const start = offsetRef.current
    const { data, error: fetchError } = await supabase.from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).range(start, start + PAGE_SIZE - 1)
    if (fetchError) {
      setError('No se pudieron cargar más notificaciones.')
      setLoadingMore(false)
      return
    }
    const rows = data || []
    offsetRef.current += rows.length
    setHasMore(rows.length === PAGE_SIZE)
    const enrichedRows = await enrichRows(rows)
    setNotifications(current => [...current, ...enrichedRows])
    setVisibleDayCount(count => count + 7)
    setLoadingMore(false)
  }

  const hasHiddenDays = groupedNotifications.length > visibleDayCount
  const showMoreButton = hasHiddenDays || hasMore

  const toggleFollow = async actor => {
    if (!user?.id) {
      navigate('/register')
      return
    }
    if (!profile) {
      navigate('/onboarding')
      return
    }
    if (!actor?.id || followingBusy.has(actor.id)) return
    const wasFollowing = followingIds.has(actor.id)
    setFollowingBusy(current => new Set(current).add(actor.id))
    try {
      const result = wasFollowing
        ? await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', actor.id)
        : await supabase.from('follows').insert({ follower_id: user.id, following_id: actor.id })
      if (!wasFollowing && result.error?.code === '23505') {
        // The follow may already exist if this notification's relationship state was stale.
        setFollowingIds(current => new Set(current).add(actor.id))
        setError('')
        return
      }
      if (result.error) throw result.error
      setFollowingIds(current => {
        const next = new Set(current)
        if (wasFollowing) next.delete(actor.id)
        else next.add(actor.id)
        return next
      })
      setError('')
    } catch (followError) {
      console.error('No se pudo actualizar el seguimiento desde Actividad:', followError)
      setError('No se pudo actualizar el seguimiento.')
    } finally {
      setFollowingBusy(current => { const next = new Set(current); next.delete(actor.id); return next })
    }
  }

  return (
    <section className="activity-page" style={{
      '--activity-accent': profileAccent,
      '--activity-accent-visible': isBlackAccent ? '#fff' : getVisibleAccentColor(profileAccent),
      '--activity-accent-text': getAccentTextColor(profileAccent),
      '--activity-accent-border': isBlackAccent ? '#fff' : `color-mix(in srgb, ${profileAccent} 72%, white)`,
    }}>
      <header className="activity-page-header">
        <h1>Actividad</h1>
      </header>

      {error && <p className="activity-error" role="alert">{error}</p>}
      {loading ? <section className="activity-loading" aria-label="Cargando actividad" aria-busy="true">
        <div className="activity-skeleton-day"><span className="activity-skeleton-heading" />
          <div className="activity-skeleton-feed">{Array.from({ length: 6 }, (_, index) => <div className="activity-skeleton-row" key={index} aria-hidden="true">
            <span className="activity-skeleton-avatar" />
            <span className="activity-skeleton-copy"><i /><i className={index % 2 ? 'short' : ''} /><i className="tiny" /></span>
            <span className="activity-skeleton-preview" />
          </div>)}</div>
        </div>
      </section> : groupedNotifications.length ? (
        <>
          {groupedNotifications.slice(0, visibleDayCount).map(group => (
            <section className="activity-day-group" key={group.key}>
              <h2>{group.heading}</h2>
              <div className="activity-feed">
                {group.items.map(item => {
                  const actors = notificationActors(item)
                  const primaryActor = actors[0] || item.actor
                  const isFollow = item.type === 'follow'
                  const isComment = item.type?.startsWith('comment_')
                  const isPost = notificationResourceType(item) === 'post'
                  const isFollowing = primaryActor ? followingIds.has(primaryActor.id) : false
                  const isFollowedBy = primaryActor ? followedByIds.has(primaryActor.id) : false
                  const preview = item.resource?.image_url
                  const previewImages = item.resource?.image_urls || []
                  const target = notificationTarget({ ...item, ownerUsername: profile?.username })
                  return (
                    <article
                      className={`activity-feed-item ${item.is_read ? '' : 'unread'}`}
                      key={item.id}
                      data-notification-type={item.type}
                      tabIndex={0}
                      aria-label={`Abrir ${item.resource?.title || notificationMessage(item)}`}
                      aria-roledescription="enlace"
                      onClick={event => {
                        if (event.target.closest('a, button, [role="button"]')) return
                        navigate(target)
                      }}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
                        event.preventDefault()
                        navigate(target)
                      }}
                    >
                      <div className="activity-notification-identity">
                        <span className="activity-actor-group">
                          {actors.map((actor, index) => {
                            const name = actor.display_name || actor.username || 'Usuario'
                            const avatar = <span className="activity-avatar-wrap" key={actor.id || index} style={{ zIndex: index + 1 }}>
                              <span className="activity-feed-avatar" style={{ borderColor: actor.theme_color || 'var(--brand-primary)' }}>
                                {actor.avatar_url ? <img src={actor.avatar_url} alt="" /> : <DefaultAvatar accent={actor.theme_color} />}
                              </span>
                              {index === actors.length - 1 && <i className={`activity-type-badge ${isFollow ? 'follow' : isComment ? 'activity-comment' : 'like'}`}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">{activityIcon(item.type)}</svg>
                              </i>}
                            </span>
                            return avatar
                          })}
                        </span>
                      </div>
                      <div className="activity-notification-content">
                        <div className="activity-feed-copy">
                          <span className="activity-notification-description">{activityCopy(item)}</span>
                          {!isPost && item.resource?.title && <span className="activity-content-title">{item.resource.title}</span>}
                          <time className="activity-notification-time" dateTime={item.created_at}>{timeLabel(item.created_at)}</time>
                        </div>
                      </div>
                      {!isPost && <div className="activity-notification-trailing">
                        {isFollow ? <button
                          className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} activity-follow-action${isFollowing && isFollowedBy ? ' activity-friends-button' : ''}`}
                          type="button"
                          onClick={() => toggleFollow(primaryActor)}
                          disabled={!primaryActor || followingBusy.has(primaryActor.id)}
                        >{followingBusy.has(primaryActor?.id) ? '…' : isFollowing ? isFollowedBy ? 'Amigos' : 'Siguiendo' : isFollowedBy ? 'Seguir también' : 'Seguir'}</button> : previewImages.length ? <span className="activity-preview-link" aria-hidden="true"><span className={`activity-list-poster${previewImages.length === 2 ? ' count-two' : ''}${previewImages.length === 3 ? ' count-three' : ''}`}>
                          {previewImages.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" loading="lazy" />)}
                        </span></span> : preview ? <span className="activity-preview-link" aria-hidden="true"><img className="activity-content-preview" src={preview} alt="" loading="lazy" onError={event => {
                          const fallback = item.resource?.fallback_image_url
                          if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback
                        }} /></span> : <span className="activity-preview-link" aria-hidden="true"><span className="activity-content-placeholder">{notificationResourceType(item) === 'review' ? '✎' : '▤'}</span></span>}
                      </div>}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
          {showMoreButton && <button className="activity-show-more" type="button" onClick={() => hasHiddenDays ? setVisibleDayCount(count => count + 7) : loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : 'Mostrar más'}
          </button>}
        </>
      ) : (
        <div className="activity-empty">
          <h2>Aún no hay actividad</h2>
        </div>
      )}
    </section>
  )
}
