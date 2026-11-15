import { searchGames, searchGamesLocal, getGameById, getSimilarGames } from './gameService'
import { searchAnime, searchAnimeLocal, getAnimeById, getSimilarAnime } from './animeService'
import { searchManga, searchMangaLocal, getMangaById, getSimilarManga } from './mangaService'
import { workType } from './workTypes'

const adapters = {
  game: { search: searchGames, searchLocal: searchGamesLocal, detail: getGameById, similar: getSimilarGames },
  anime: { search: searchAnime, searchLocal: searchAnimeLocal, detail: getAnimeById, similar: getSimilarAnime },
  manga: { search: searchManga, searchLocal: searchMangaLocal, detail: getMangaById, similar: getSimilarManga },
}
export function workAdapter(type) { return { ...workType(type), ...adapters[type] } }
export function searchWorks(type, query, limit = 20, options = {}) { return workAdapter(type).search(query, limit, options) }
