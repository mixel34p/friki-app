-- Actualizar el prompt de hoy al formato SIMPLIFICADO
-- Esto probará que el código del frontend es capaz de "inflar" estos datos automáticamente
UPDATE daily_prompts
SET options = '[
  {"id": "119277", "type": "game"}, 
  {"id": "26226", "type": "game"}
]'::jsonb
WHERE content = '¿Cuál prefieres hoy?';

-- NOTA:
-- 119277 es Hollow Knight
-- 26226 es Celeste
-- Ya no guardamos ni label ni image en la DB, solo la referencia.
