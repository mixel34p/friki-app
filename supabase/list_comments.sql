-- Comentarios para posts de listas (user_lists)
-- Ejecutar este script en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS public.list_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id uuid NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
    parent_comment_id uuid REFERENCES public.list_comments(id) ON DELETE SET NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Asegurar columna parent_comment_id por si la tabla ya existía
ALTER TABLE public.list_comments
    ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.list_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS list_comments_list_created_idx
    ON public.list_comments (list_id, created_at ASC);

ALTER TABLE public.list_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "List comments are readable by everyone" ON public.list_comments;
CREATE POLICY "List comments are readable by everyone"
    ON public.list_comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can comment as themselves" ON public.list_comments;
CREATE POLICY "Users can comment as themselves"
    ON public.list_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own list comments or list owner" ON public.list_comments;
CREATE POLICY "Users can delete their own list comments or list owner"
    ON public.list_comments FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR auth.uid() = (SELECT user_id FROM public.user_lists WHERE id = list_id)
    );

DROP POLICY IF EXISTS "Users can update their own list comments" ON public.list_comments;
CREATE POLICY "Users can update their own list comments"
    ON public.list_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_comments TO authenticated;
GRANT SELECT ON public.list_comments TO anon;
