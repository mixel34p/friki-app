-- Helper function to find tierlists containing a specific game/anime ID
-- This is needed because tierlist items are stored in a JSONB 'content' column
-- and querying nested JSON arrays efficiently requires a server-side function.

CREATE OR REPLACE FUNCTION get_tierlists_containing_media(
    media_id_input BIGINT, 
    media_type_input TEXT,
    limit_count INT DEFAULT 20
)
RETURNS SETOF tierlists
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM tierlists
    WHERE media_type = media_type_input
    AND visibility = 'public'
    AND EXISTS (
        -- Check if any key (S, A, B...) in content JSON contains the ID in its array
        SELECT 1 FROM jsonb_each(content) AS tiers(key, val)
        WHERE val @> format('[{"id": %s}]', media_id_input)::jsonb
    )
    ORDER BY created_at DESC
    LIMIT limit_count;
END;
$$;
