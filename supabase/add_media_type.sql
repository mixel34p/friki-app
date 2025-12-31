-- Add media_type column to tierlists if it doesn't exist
ALTER TABLE tierlists 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'game'; -- 'game' or 'anime'
