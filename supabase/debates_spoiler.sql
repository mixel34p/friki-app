-- Add spoiler field to debate_posts
ALTER TABLE debate_posts ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN DEFAULT false;
