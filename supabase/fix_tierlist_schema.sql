-- Fix tierlist_items schema to support Game/Anime IDs (BIGINT) instead of UUID
-- This is necessary because games and anime use IGDB/MAL integer IDs

BEGIN;

-- 1. Alter tierlist_items media_id to BIGINT
-- Note: This will wipe existing UUID data in this column which is likely invalid for games anyway
ALTER TABLE tierlist_items 
  DROP COLUMN media_id,
  ADD COLUMN media_id BIGINT;

-- 2. Add index for performance
CREATE INDEX IF NOT EXISTS idx_tierlist_items_media_id ON tierlist_items(media_id);

COMMIT;
