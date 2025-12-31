-- Add anime_library column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS anime_library JSONB DEFAULT '[]';
