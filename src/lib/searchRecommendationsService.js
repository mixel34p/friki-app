import { supabase } from './supabase'
import { loadSearchRecommendations } from './searchRecommendationRanking'

export function getSearchRecommendations(limit = 6, userId = null) {
  return loadSearchRecommendations(supabase, limit, userId)
}
