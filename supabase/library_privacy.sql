-- Add library privacy setting
-- Valid values: 'public', 'private', 'followers' (future proofing)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS library_privacy TEXT DEFAULT 'public';

-- Update RLS policies (conceptual, implementation depends on applied RLS)
-- Since profiles are generally public readable in this app structure, logic will be handled in UI/API layer for now
-- or via basic check.
