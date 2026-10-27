-- ============================================================
-- SQL para los comentarios de listas (list_comments)
-- Ejecutar en el Editor SQL de Supabase
-- ============================================================

-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.list_comments (
    id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id           uuid        NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
    user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_comment_id uuid        REFERENCES public.list_comments(id) ON DELETE SET NULL,
    content           text        NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
    created_at        timestamptz DEFAULT timezone('utc', now()) NOT NULL,
    updated_at        timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS list_comments_list_id_idx    ON public.list_comments(list_id);
CREATE INDEX IF NOT EXISTS list_comments_user_id_idx    ON public.list_comments(user_id);
CREATE INDEX IF NOT EXISTS list_comments_parent_idx     ON public.list_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS list_comments_created_at_idx ON public.list_comments(created_at);

-- 3. RLS
ALTER TABLE public.list_comments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas  (DROP primero para poder relanzar el script sin errores)
DROP POLICY IF EXISTS "list_comments_select" ON public.list_comments;
DROP POLICY IF EXISTS "list_comments_insert" ON public.list_comments;
DROP POLICY IF EXISTS "list_comments_update" ON public.list_comments;
DROP POLICY IF EXISTS "list_comments_delete" ON public.list_comments;

CREATE POLICY "list_comments_select"
    ON public.list_comments FOR SELECT
    USING (true);

CREATE POLICY "list_comments_insert"
    ON public.list_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "list_comments_update"
    ON public.list_comments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "list_comments_delete"
    ON public.list_comments FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS list_comments_updated_at ON public.list_comments;
CREATE TRIGGER list_comments_updated_at
    BEFORE UPDATE ON public.list_comments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
