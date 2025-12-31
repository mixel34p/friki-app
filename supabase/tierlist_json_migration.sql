-- Add content column to tierlists table for storing items as JSON
-- This replaces the need for a separate tierlist_items table and solves ID type issues

ALTER TABLE tierlists 
ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;

-- Example structure of content:
-- {
--   "S": [{ "id": "123", "name": "Game 1", "image": "url" }, ...],
--   "A": [...],
--   ...
-- }
