-- Add new columns for Profile Overhaul
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS favorite_anime JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS featured_tierlists JSONB DEFAULT '[]', -- Store array of tierlist objects or IDs
ADD COLUMN IF NOT EXISTS anime_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_tags TEXT[] DEFAULT '{}';

-- Rename/Migrate existing columns if needed (we'll keep favorite_genres as game_tags for compatibility, or alias it)
-- We will treat 'favorite_genres' as 'Game Tags' in the UI.
