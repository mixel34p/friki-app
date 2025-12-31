-- Anime cache table (stores anime imported from Jikan/MyAnimeList)
CREATE TABLE IF NOT EXISTS anime (
    id BIGINT PRIMARY KEY,              -- MAL ID
    title TEXT NOT NULL,
    slug TEXT,                          -- Usually MAL doesn't use slugs like IGDB, but we can store title-normalized or empty
    image_url TEXT,
    start_date DATE,
    score DECIMAL(4,2),
    genres TEXT[] DEFAULT '{}',
    synopsis TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index for anime titles
CREATE INDEX IF NOT EXISTS idx_anime_title_search 
ON anime USING gin(to_tsvector('simple', title));

-- Enable RLS
ALTER TABLE anime ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anime are publicly readable" ON anime
    FOR SELECT USING (true);

-- Authenticated import access
CREATE POLICY "Authenticated users can import anime" ON anime
    FOR INSERT TO authenticated
    WITH CHECK (true);
