-- Games cache table (stores games imported from IGDB)
CREATE TABLE IF NOT EXISTS games (
    id BIGINT PRIMARY KEY,              -- IGDB game ID
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    cover_url TEXT,
    release_date DATE,
    rating DECIMAL(4,2),
    genres TEXT[] DEFAULT '{}',
    platforms TEXT[] DEFAULT '{}',
    summary TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index for game names
CREATE INDEX IF NOT EXISTS idx_games_name_search 
ON games USING gin(to_tsvector('simple', name));

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Public read access (games are public data)
CREATE POLICY "Games are publicly readable" ON games
    FOR SELECT USING (true);

-- Only service role can insert/update (via Edge Functions or admin)
-- If using client-side inserts, add a policy like:
CREATE POLICY "Authenticated users can import games" ON games
    FOR INSERT TO authenticated
    WITH CHECK (true);
