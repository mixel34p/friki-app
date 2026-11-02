-- Reusable custom item groups for list templates and lists.
CREATE TABLE IF NOT EXISTS public.custom_item_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(trim(name)) > 0),
    description text NOT NULL DEFAULT '',
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_item_groups_public_recent_idx
    ON public.custom_item_groups (created_at DESC)
    WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS custom_item_groups_owner_idx
    ON public.custom_item_groups (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_custom_item_groups (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.custom_item_groups(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, group_id)
);

ALTER TABLE public.custom_item_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_custom_item_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public custom item groups" ON public.custom_item_groups;
CREATE POLICY "Anyone can read public custom item groups"
    ON public.custom_item_groups FOR SELECT
    USING (visibility = 'public' OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own custom item groups" ON public.custom_item_groups;
CREATE POLICY "Users can create their own custom item groups"
    ON public.custom_item_groups FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own custom item groups" ON public.custom_item_groups;
CREATE POLICY "Users can update their own custom item groups"
    ON public.custom_item_groups FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own custom item groups" ON public.custom_item_groups;
CREATE POLICY "Users can delete their own custom item groups"
    ON public.custom_item_groups FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can read their saved custom item groups" ON public.saved_custom_item_groups;
CREATE POLICY "Users can read their saved custom item groups"
    ON public.saved_custom_item_groups FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can save public custom item groups" ON public.saved_custom_item_groups;
CREATE POLICY "Users can save public custom item groups"
    ON public.saved_custom_item_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.custom_item_groups groups
            WHERE groups.id = group_id AND groups.visibility = 'public'
        )
    );

DROP POLICY IF EXISTS "Users can unsave their custom item groups" ON public.saved_custom_item_groups;
CREATE POLICY "Users can unsave their custom item groups"
    ON public.saved_custom_item_groups FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

GRANT SELECT ON public.custom_item_groups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.custom_item_groups TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_custom_item_groups TO authenticated;
