-- ═══════════════════════════════════════════════════════
-- SOCIAL DISCOVERY ENHANCEMENTS
-- 1. Notificaciones de solicitud de conexión
-- 2. Comparación de bibliotecas en afinidad
-- ═══════════════════════════════════════════════════════

-- 1. TRIGGER PARA NOTIFICACIONES DE SOLICITUD
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_connection_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear notificación para el usuario destino
    INSERT INTO notifications (user_id, type, actor_id, resource_id)
    VALUES (NEW.target_id, 'connection_request', NEW.requester_id, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_connection_request_notify ON connection_requests;
CREATE TRIGGER on_connection_request_notify
AFTER INSERT ON connection_requests
FOR EACH ROW EXECUTE FUNCTION notify_connection_request();


-- 2. ACTUALIZAR CÁLCULO DE AFINIDAD (Con Library)
-- ─────────────────────────────────────────────────────────

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
    library_in_common JSONB; -- Nuevo
    score INTEGER := 0;
    max_score INTEGER := 0;
BEGIN
    -- Obtener perfiles
    SELECT * INTO p1 FROM profiles WHERE user_id = user1;
    SELECT * INTO p2 FROM profiles WHERE user_id = user2;
    
    IF p1 IS NULL OR p2 IS NULL THEN
        RETURN QUERY SELECT 0::INTEGER, '[]'::JSONB, '{}'::TEXT[], '{}'::TEXT[];
        RETURN;
    END IF;
    
    -- [MISMOS CÁLCULOS ANTERIORES - Géneros 20%]
    genre_matches := ARRAY(
        SELECT unnest(COALESCE(p1.favorite_genres, '{}')) INTERSECT SELECT unnest(COALESCE(p2.favorite_genres, '{}'))
    );
    score := score + (array_length(genre_matches, 1) * 10);
    max_score := max_score + (GREATEST(array_length(p1.favorite_genres, 1), array_length(p2.favorite_genres, 1), 1) * 10);
    
    -- [Plataformas 10%]
    platform_matches := ARRAY(
        SELECT unnest(COALESCE(p1.platforms, '{}')) INTERSECT SELECT unnest(COALESCE(p2.platforms, '{}'))
    );
    score := score + (array_length(platform_matches, 1) * 5);
    max_score := max_score + (GREATEST(array_length(p1.platforms, 1), array_length(p2.platforms, 1), 1) * 5);
    
    -- [Era 10%]
    IF p1.favorite_era = p2.favorite_era AND p1.favorite_era IS NOT NULL THEN
        score := score + 10;
    END IF;
    max_score := max_score + 10;
    
    -- [Tierlists 30%]
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
    score := score + (jsonb_array_length(works_in_common) * 8); -- 8 pts por coincidencia
    max_score := max_score + 80;

    -- [NUEVO: Comparación de Library 30%]
    -- Asumimos library es JSONB array: [{ "game_id": "123", "status": "playing" }, ...]
    
    -- Extraer IDs de juegos de library
    WITH lib1 AS (
        SELECT value->>'game_id' as game_id, value->>'status' as status 
        FROM jsonb_array_elements(COALESCE(p1.library, '[]'::jsonb))
    ),
    lib2 AS (
        SELECT value->>'game_id' as game_id, value->>'status' as status 
        FROM jsonb_array_elements(COALESCE(p2.library, '[]'::jsonb))
    ),
    common_lib AS (
        SELECT l1.game_id, l1.status as s1, l2.status as s2
        FROM lib1 l1
        INNER JOIN lib2 l2 ON l1.game_id = l2.game_id
        LIMIT 10
    )
    SELECT count(*) INTO score -- Sumar puntos básicos (5 pts por juego en común) + bonus si status coincide
    FROM common_lib;
    
    -- Ajustar score con pesos
    -- (Simplificado en SQL puro, asignamos un bloque fijo de puntos extra si hay coincidencias)
    -- En una implementación real más compleja se iteraría. Aquí sumamos 5 pts por juego en común.
    
    score := score + ((SELECT count(*) FROM (
        SELECT value->>'game_id' FROM jsonb_array_elements(COALESCE(p1.library, '[]'::jsonb))
        INTERSECT
        SELECT value->>'game_id' FROM jsonb_array_elements(COALESCE(p2.library, '[]'::jsonb))
        LIMIT 10
    ) as common_games) * 5);

    max_score := max_score + 50; -- Max 10 juegos * 5

    
    -- Calcular porcentaje final
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
