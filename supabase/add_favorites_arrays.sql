ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_games jsonb[] DEFAULT ARRAY[]::jsonb[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_animes jsonb[] DEFAULT ARRAY[]::jsonb[];