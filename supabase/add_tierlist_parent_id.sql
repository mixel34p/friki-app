-- Add parent_id to tierlists to support forking/remixing
ALTER TABLE tierlists 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tierlists(id) ON DELETE SET NULL;

-- Index for faster lookups of "remixes"
CREATE INDEX IF NOT EXISTS idx_tierlists_parent ON tierlists(parent_id);
