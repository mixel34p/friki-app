-- Comments for reviews stored in public.library_entries.
-- Run once in the Supabase SQL editor before using the comment form.

CREATE TABLE IF NOT EXISTS public.library_review_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_entry_id uuid NOT NULL REFERENCES public.library_entries(id) ON DELETE CASCADE,
    parent_comment_id uuid REFERENCES public.library_review_comments(id) ON DELETE SET NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add reply support to databases where this table already exists.
ALTER TABLE public.library_review_comments
    ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.library_review_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS library_review_comments_review_created_idx
    ON public.library_review_comments (review_entry_id, created_at ASC);

ALTER TABLE public.library_review_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Review comments are readable by signed-in users" ON public.library_review_comments;
CREATE POLICY "Review comments are readable by signed-in users"
    ON public.library_review_comments FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can comment as themselves" ON public.library_review_comments;
CREATE POLICY "Users can comment as themselves"
    ON public.library_review_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own review comments" ON public.library_review_comments;
CREATE POLICY "Users can delete their own review comments"
    ON public.library_review_comments FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own review comments" ON public.library_review_comments;
CREATE POLICY "Users can update their own review comments"
    ON public.library_review_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_review_comments TO authenticated;
