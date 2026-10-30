ALTER TABLE games
    ADD COLUMN IF NOT EXISTS igdb_category integer,
    ADD COLUMN IF NOT EXISTS igdb_parent_game bigint,
    ADD COLUMN IF NOT EXISTS igdb_version_parent bigint,
    ADD COLUMN IF NOT EXISTS igdb_metadata_checked_at timestamptz;
