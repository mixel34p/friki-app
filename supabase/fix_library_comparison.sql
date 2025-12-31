-- CORREGIR CLAVE DE COMPARACIÓN DE LIBRERÍA
-- Usar 'id' en lugar de 'game_id' para coincidir con el esquema de Library.jsx

CREATE OR REPLACE FUNCTION calculate_user_affinity(user1 UUID, user2 UUID)
RETURNS TABLE (
    affinity_score INTEGER,
    common_works JSONB,
    matching_genres TEXT[],
    matching_platforms TEXT[]
) AS $$
DECLARE
    p1 RECORD;
    p2 RECORD;
    genre_matches TEXT[];
    platform_matches TEXT[];
    works_in_common JSONB;
    score INTEGER := 0;
    max_score INTEGER := 0;
BEGIN
    SELECT * INTO p1 FROM profiles WHERE user_id = user1;
    SELECT * INTO p2 FROM profiles WHERE user_id = user2;
    
    IF p1 IS NULL OR p2 IS NULL THEN
        RETURN QUERY SELECT 0::INTEGER, '[]'::JSONB, '{}'::TEXT[], '{}'::TEXT[];
        RETURN;
    END IF;
    
    -- Géneros (20%)
    genre_matches := ARRAY(
        SELECT unnest(COALESCE(p1.favorite_genres, '{}')) 
        INTERSECT 
        SELECT unnest(COALESCE(p2.favorite_genres, '{}'))
    );
    score := score + COALESCE(array_length(genre_matches, 1), 0) * 10;
    max_score := max_score + GREATEST(
        COALESCE(array_length(p1.favorite_genres, 1), 0),
        COALESCE(array_length(p2.favorite_genres, 1), 0),
        1
    ) * 10;
    
    -- Plataformas (10%)
    platform_matches := ARRAY(
        SELECT unnest(COALESCE(p1.platforms, '{}')) 
        INTERSECT 
        SELECT unnest(COALESCE(p2.platforms, '{}'))
    );
    score := score + COALESCE(array_length(platform_matches, 1), 0) * 5;
    max_score := max_score + GREATEST(
        COALESCE(array_length(p1.platforms, 1), 0),
        COALESCE(array_length(p2.platforms, 1), 0),
        1
    ) * 5;
    
    -- Era (10%)
    IF p1.favorite_era = p2.favorite_era AND p1.favorite_era IS NOT NULL THEN
        score := score + 10;
    END IF;
    max_score := max_score + 10;
    
    -- Tierlists (30%)
    WITH user1_items AS (
        SELECT DISTINCT ti.media_id, t.media_type
        FROM tierlist_items ti
        JOIN tierlists t ON t.id = ti.tierlist_id
        WHERE t.user_id = user1 AND ti.media_id IS NOT NULL
    ),
    user2_items AS (
        SELECT DISTINCT ti.media_id, t.media_type
        FROM tierlist_items ti
        JOIN tierlists t ON t.id = ti.tierlist_id
        WHERE t.user_id = user2 AND ti.media_id IS NOT NULL
    ),
    common AS (
        SELECT u1.media_id, u1.media_type
        FROM user1_items u1
        INNER JOIN user2_items u2 ON u1.media_id = u2.media_id AND u1.media_type = u2.media_type
        LIMIT 10
    )
    SELECT jsonb_agg(jsonb_build_object('media_id', media_id, 'media_type', media_type))
    INTO works_in_common
    FROM common;
    
    works_in_common := COALESCE(works_in_common, '[]'::jsonb);
    score := score + (jsonb_array_length(works_in_common) * 8);
    max_score := max_score + 80;

    -- Library (30%) - CORREGIDO: Usar 'id' en lugar de 'game_id'
    score := score + ((SELECT count(*) FROM (
        SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p1.library, '[]'::jsonb))
        INTERSECT
        SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p2.library, '[]'::jsonb))
        LIMIT 10
    ) as common_games) * 5);
    max_score := max_score + 50;

    -- Calcular porcentaje
    IF max_score > 0 THEN
        affinity_score := ROUND((score::FLOAT / max_score::FLOAT) * 100)::INTEGER;
    ELSE
        affinity_score := 0;
    END IF;
    
    RETURN QUERY SELECT 
        LEAST(affinity_score, 100)::INTEGER,
        works_in_common,
        COALESCE(genre_matches, '{}'),
        COALESCE(platform_matches, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
