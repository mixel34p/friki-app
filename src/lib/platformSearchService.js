import { supabase } from './supabase'
import { searchGames, searchGamesLocal } from './gameService'
import { searchAnime, searchAnimeLocal } from './animeService'
import { getUsersByCommonWorks } from './discoverUsersService'
import { normalizeSearchText, rankSearchResults, searchMatchScore } from './searchRanking'

const profileFields = 'id, username, display_name, avatar_url, bio, theme_color'
const spaceFields = 'id, name, description, avatar_url, banner_url, theme_color, owner_id, is_verified'
const listFields = 'id, title, list_type, media_type, content, user_id, created_at, visibility'

const normalized = normalizeSearchText
const sortByMatch = (items, term, getName) => rankSearchResults(items, term, item => [getName(item), ...(item.search_terms || [])], item => item.rating || item.score || item.member_count || 0)

/** Search existing work catalogs and Supabase spaces/profiles. */
export async function searchPlatform(query, limit = 8, signal, workFilter = 'all') {
  const term = query.trim()
  if (term.length < 2) return { works: [], spaces: [], users: [], lists: [], errors: {} }

  const gameSearch = workFilter === 'anime' || ['spaces', 'lists', 'users'].includes(workFilter)
    ? Promise.resolve([]) : searchGames(term, limit, { signal })
  const animeSearch = workFilter === 'game' || ['spaces', 'lists', 'users'].includes(workFilter)
    ? Promise.resolve([]) : searchAnime(term, limit, { signal })
  const results = await Promise.allSettled([
    Promise.all([gameSearch, animeSearch]),
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
    ], term, item => item.title)
      .filter(item => searchMatchScore(term, [item.title, ...(item.search_terms || [])]) > 0)
      .slice(0, limit)
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
export async function getSearchHighlights(userId) {
  const [minecraft, zelda, naruto, attackOnTitan, spaces, users] = await Promise.allSettled([
    searchGamesLocal('Minecraft', 8),
    searchGamesLocal('The Legend of Zelda: Breath of the Wild', 8),
    searchAnimeLocal('Naruto', 8),
    searchAnimeLocal('Attack on Titan', 8),
    supabase.from('spaces').select('id, name, description, avatar_url, banner_url, theme_color, space_members(count)').order('created_at', { ascending: false }).limit(12),
    userId ? getUsersByCommonWorks(userId) : supabase.from('profiles').select('id, username, display_name, avatar_url, theme_color').limit(12),
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
    spaces: spaces.status === 'fulfilled' ? (spaces.value.data || []).map(space => ({ ...space, member_count: space.space_members?.[0]?.count || 0 })).sort((a, b) => b.member_count - a.member_count) : [],
    users: users.status === 'fulfilled' ? (userId ? users.value : users.value.data || []).slice(0, 12) : [],
  }
}
