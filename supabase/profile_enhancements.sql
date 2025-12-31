-- Profile enhancements
-- Add favorite game (stored as JSON with id, name, cover_url)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_game JSONB;

-- Add banner image URL
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Theme colors (already may exist, using IF NOT EXISTS)
-- color_primary, color_secondary, color_accent should already exist
-- If not, uncomment below:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color_primary TEXT DEFAULT '#14b8a6';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color_secondary TEXT DEFAULT '#0d9488';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color_accent TEXT DEFAULT '#fbbf24';
