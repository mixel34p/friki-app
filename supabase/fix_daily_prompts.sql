-- 1. Asegurar que la función RPC existe y funciona
CREATE OR REPLACE FUNCTION get_poll_results(poll_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  total_votes INT;
BEGIN
  -- Count total votes
  SELECT COUNT(*) INTO total_votes
  FROM daily_responses
  WHERE prompt_id = poll_id;

  -- Get vote distribution
  SELECT jsonb_object_agg(
    answer->>'choice',
    jsonb_build_object(
      'count', count,
      'percentage', ROUND((count::numeric / NULLIF(total_votes, 0)) * 100, 1)
    )
  ) INTO result
  FROM (
    SELECT 
      answer->>'choice' as choice,
      COUNT(*)::int as count
    FROM daily_responses
    WHERE prompt_id = poll_id
    GROUP BY answer->>'choice'
  ) subq;

  RETURN jsonb_build_object(
    'total', total_votes,
    'distribution', COALESCE(result, '{}'::jsonb)
  );
END;
$$;

-- 2. Corregir las imágenes del prompt de prueba (Hollow Knight vs Celeste)
UPDATE daily_prompts
SET options = '[
  {"id": "option1", "label": "Hollow Knight", "image": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.png"},
  {"id": "option2", "label": "Celeste", "image": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.png"}
]'::jsonb
WHERE content = '¿Cuál prefieres hoy?';

-- NOTA: Si la imagen de Celeste sigue fallando, usa esta alternativa segura:
-- https://upload.wikimedia.org/wikipedia/commons/c/c2/Celeste_box_art_final.png

-- 3. Crear también la función de reacciones por si acaso faltó
CREATE OR REPLACE FUNCTION get_reaction_counts(p_target_type TEXT, p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_object_agg(reaction_type, count)
  INTO result
  FROM (
    SELECT 
      reaction_type,
      COUNT(*)::int as count
    FROM thematic_reactions
    WHERE target_type = p_target_type AND target_id = p_target_id
    GROUP BY reaction_type
  ) subq;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
