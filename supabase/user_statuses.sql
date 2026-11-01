CREATE TABLE IF NOT EXISTS public.user_statuses (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status_type text NOT NULL CHECK (status_type IN ('text', 'song')),
    content text,
    song jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    CONSTRAINT user_statuses_content_check CHECK (
        (status_type = 'text' AND content IS NOT NULL AND length(trim(content)) BETWEEN 1 AND 80 AND song IS NULL)
        OR (status_type = 'song' AND song IS NOT NULL AND content IS NULL)
    )
);

ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active statuses" ON public.user_statuses;
CREATE POLICY "Authenticated users can view active statuses"
    ON public.user_statuses FOR SELECT TO authenticated
    USING (
        expires_at > now()
        AND (
            auth.uid() = user_id
            OR EXISTS (
                SELECT 1
                FROM public.follows AS outgoing
                INNER JOIN public.follows AS incoming
                    ON incoming.follower_id = outgoing.following_id
                    AND incoming.following_id = outgoing.follower_id
                WHERE outgoing.follower_id = auth.uid()
                  AND outgoing.following_id = user_statuses.user_id
            )
        )
    );

DROP POLICY IF EXISTS "Users can create their own status" ON public.user_statuses;
CREATE POLICY "Users can create their own status"
    ON public.user_statuses FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own status" ON public.user_statuses;
CREATE POLICY "Users can update their own status"
    ON public.user_statuses FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own status" ON public.user_statuses;
CREATE POLICY "Users can delete their own status"
    ON public.user_statuses FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_statuses_expiration_idx ON public.user_statuses (expires_at);
