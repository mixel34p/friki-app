import { mangaSearchEnabled, MANGA_UNAVAILABLE } from '../lib/mangaService'
export default function MangaAvailability() {
  return mangaSearchEnabled ? null : <p className="manga-availability" role="status">{MANGA_UNAVAILABLE}</p>
}
