-- Add library column to profiles (stores user's game collection as JSON)
-- Format: [{ "game_id": "123", "name": "Elden Ring", "image_url": "...", "status": "playing", "rating": 9, "added_at": "..." }, ...]
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS library JSONB DEFAULT '[]'::jsonb;

-- Create index for faster library queries
CREATE INDEX IF NOT EXISTS idx_profiles_library ON profiles USING GIN (library);

-- Note: Status values can be: 'playing', 'completed', 'backlog', 'dropped', 'wishlist'
