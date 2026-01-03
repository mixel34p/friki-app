-- 1. Asegurar que la columna 'answer' existe en daily_responses
ALTER TABLE daily_responses 
ADD COLUMN IF NOT EXISTS answer JSONB DEFAULT '{}'::jsonb;

-- 2. Reescribir la función RPC usando alias explícito de tabla (r)
-- Esto evita ambigüedades y errores de scope
CREATE OR REPLACE FUNCTION get_poll_results(poll_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  total_votes INT;
BEGIN
  -- Count total votes con alias
  SELECT COUNT(*) INTO total_votes
  FROM daily_responses r
  WHERE r.prompt_id = poll_id;

  -- Get vote distribution con alias explícito
  SELECT jsonb_object_agg(
    choice,
    jsonb_build_object(
      'count', count,
      'percentage', ROUND((count::numeric / NULLIF(total_votes, 0)) * 100, 1)
    )
  ) INTO result
  FROM (
    SELECT 
      r.answer->>'choice' as choice,
      COUNT(*)::int as count
    FROM daily_responses r
    WHERE r.prompt_id = poll_id
    GROUP BY r.answer->>'choice'
  ) subq;

  RETURN jsonb_build_object(
    'total', total_votes,
    'distribution', COALESCE(result, '{}'::jsonb)
  );
END;
$$;

-- 3. Otorgar permisos nuevamente por si acaso
GRANT EXECUTE ON FUNCTION get_poll_results(uuid) TO anon, authenticated, service_role;
