BEGIN;

-- Las listas de ranking existentes se conservan como listas normales; se les quita
-- la referencia a la plantilla para poder borrar esta última sin perder contenido.
UPDATE public.user_lists
SET template_id = NULL
WHERE template_id IN (
    SELECT id
    FROM public.list_templates
    WHERE list_type = 'ranking'
);

DELETE FROM public.list_templates
WHERE list_type = 'ranking';

-- Impide que la API vuelva a insertar plantillas de ranking.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'list_templates_no_ranking'
          AND conrelid = 'public.list_templates'::regclass
    ) THEN
        ALTER TABLE public.list_templates
            ADD CONSTRAINT list_templates_no_ranking
            CHECK (list_type <> 'ranking');
    END IF;
END
$$;

COMMIT;
