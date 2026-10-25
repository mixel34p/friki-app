import { supabase } from './supabase'
import { searchGames } from './gameService'
import { searchAnime } from './animeService'

const profileFields = 'id, username, display_name, avatar_url, bio, theme_color'
const spaceFields = 'id, name, description, avatar_url, banner_url, theme_color, owner_id, is_verified'
const listFields = 'id, title, list_type, media_type, content, user_id, created_at, visibility'

const normalized = value => String(value || '').toLocaleLowerCase()
const sortByMatch = (items, term, getName) => [...items].sort((a, b) => {
  const left = normalized(getName(a))
  const right = normalized(getName(b))
  return Number(!left.startsWith(normalized(term))) - Number(!right.startsWith(normalized(term)))
})

/** Search existing work catalogs and Supabase spaces/profiles. */
export async function searchPlatform(query, limit = 8, signal) {
  const term = query.trim()
  if (term.length < 2) return { works: [], spaces: [], users: [], lists: [], errors: {} }

  const results = await Promise.allSettled([
    Promise.all([searchGames(term, limit, { signal }), searchAnime(term, limit, { signal })]),
    supabase.from('spaces').select(`${spaceFields}, space_members(count)`).ilike('name', `%${term}%`).order('created_at', { ascending: false }).limit(limit).abortSignal(signal),
    supabase.from('profiles').select(profileFields).or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(limit).abortSignal(signal),
    supabase.from('user_lists').select(listFields).eq('visibility', 'public').ilike('title', `%${term}%`).order('created_at', { ascending: false }).limit(limit).abortSignal(signal),
  ])

  const errors = {}
  let works = []
  let spaces = []
  let users = []
  let lists = []

  if (results[0].status === 'fulfilled') {
    const [games, anime] = results[0].value
    works = sortByMatch([
      ...(games || []).map(item => ({ ...item, type: 'game', title: item.name, image: item.cover_url || item.image_url })),
      ...(anime || []).map(item => ({ ...item, type: 'anime', title: item.title, image: item.image_url || item.cover_url })),
    ], term, item => item.title).slice(0, limit)
  } else errors.works = results[0].reason

  if (results[1].status === 'fulfilled' && !results[1].value.error) {
    spaces = (results[1].value.data || []).map(space => ({
      ...space,
      member_count: space.space_members?.[0]?.count || 0,
    }))
  }
  else errors.spaces = results[1].status === 'rejected' ? results[1].reason : results[1].value.error

  if (results[2].status === 'fulfilled' && !results[2].value.error) users = results[2].value.data || []
  else errors.users = results[2].status === 'rejected' ? results[2].reason : results[2].value.error

  if (results[3].status === 'fulfilled' && !results[3].value.error) {
    lists = results[3].value.data || []
    const userIds = [...new Set(lists.map(list => list.user_id).filter(Boolean))]
    if (userIds.length) {
      const { data: profiles, error } = await supabase.from('profiles').select('id, username, display_name, avatar_url, featured_badge').in('id', userIds).abortSignal(signal)
      if (!error) {
        const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]))
        lists = lists.map(list => ({ ...list, author: profileMap.get(list.user_id) || null, type: 'list' }))
      } else lists = lists.map(list => ({ ...list, type: 'list' }))
    } else lists = lists.map(list => ({ ...list, type: 'list' }))
  } else errors.lists = results[3].status === 'rejected' ? results[3].reason : results[3].value.error

  return { works, spaces, users, lists, errors }
}

/** Small real-image samples used to decorate the category entry cards. */
export async function getSearchHighlights() {
  const [minecraft, zelda, naruto, attackOnTitan, spaces, users] = await Promise.allSettled([
    searchGames('Minecraft', 8),
    searchGames('The Legend of Zelda: Breath of the Wild', 8),
    searchAnime('Naruto', 8),
    searchAnime('Attack on Titan', 8),
    supabase.from('spaces').select('id, name, avatar_url').not('avatar_url', 'is', null).limit(4),
    supabase.from('profiles').select('id, username, avatar_url').not('avatar_url', 'is', null).limit(4),
  ])
  const selectTitle = (result, expected) => {
    if (result.status !== 'fulfilled') return null
    const items = Array.isArray(result.value) ? result.value : []
    const expectedName = normalized(expected)
    return items.find(item => normalized(item.name || item.title) === expectedName)
      || items.find(item => normalized(item.name || item.title).startsWith(expectedName))
      || null
  }
  return {
    games: [selectTitle(minecraft, 'Minecraft'), selectTitle(zelda, 'The Legend of Zelda: Breath of the Wild')].filter(Boolean),
    anime: [selectTitle(naruto, 'Naruto'), selectTitle(attackOnTitan, 'Attack on Titan')].filter(Boolean),
    spaces: spaces.status === 'fulfilled' ? spaces.value.data || [] : [],
    users: users.status === 'fulfilled' ? users.value.data || [] : [],
  }
}
