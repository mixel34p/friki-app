-- Publicaciones normales creadas desde /share.
-- Las imágenes se alojan fuera de Supabase; `media` solo guarda sus URLs y metadatos.

CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body text NOT NULL DEFAULT '',
    media jsonb NOT NULL DEFAULT '[]'::jsonb,
    contains_spoiler boolean NOT NULL DEFAULT false,
    is_sensitive boolean NOT NULL DEFAULT false,
    spoiler_work_id text,
    spoiler_work_type text,
    spoiler_work_title text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT posts_body_max_length CHECK (char_length(body) <= 2000),
    CONSTRAINT posts_media_array_max_three CHECK (
        CASE
            WHEN jsonb_typeof(media) = 'array' THEN jsonb_array_length(media) <= 3
            ELSE false
        END
    ),
    CONSTRAINT posts_body_or_media_required CHECK (
        char_length(btrim(body)) > 0 OR
        CASE
            WHEN jsonb_typeof(media) = 'array' THEN jsonb_array_length(media) > 0
            ELSE false
        END
    ),
    CONSTRAINT posts_spoiler_work_type_valid CHECK (
        spoiler_work_type IS NULL OR spoiler_work_type IN ('game', 'anime')
    )
);

CREATE INDEX IF NOT EXISTS posts_created_at_desc_idx
    ON public.posts (created_at DESC);

CREATE INDEX IF NOT EXISTS posts_user_created_at_desc_idx
    ON public.posts (user_id, created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts are readable by everyone" ON public.posts;
CREATE POLICY "Posts are readable by everyone"
    ON public.posts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
    ON public.posts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
    ON public.posts FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
    ON public.posts FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
