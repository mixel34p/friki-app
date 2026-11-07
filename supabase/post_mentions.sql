-- Post mentions: public profile search, validated references, and atomic notifications.
-- Apply with the Supabase migration tool; safe to re-run.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.post_mentions (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS post_mentions_user_id_idx ON public.post_mentions(user_id);
ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_mentions FROM anon, authenticated;
GRANT SELECT ON public.post_mentions TO anon, authenticated;
DROP POLICY IF EXISTS "Mentions follow post visibility" ON public.post_mentions;
CREATE POLICY "Mentions follow post visibility" ON public.post_mentions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.posts AS post WHERE post.id = post_id));

CREATE OR REPLACE FUNCTION public.search_post_mention_users(search_query text DEFAULT '')
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text, theme_color text, is_following boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH query AS (
    SELECT lower(left(trim(coalesce(search_query, '')), 20)) AS term,
           (SELECT auth.uid()) AS viewer_id
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.theme_color,
         EXISTS (SELECT 1 FROM public.follows AS f WHERE f.follower_id = q.viewer_id AND f.following_id = p.id) AS is_following
  FROM public.profiles AS p CROSS JOIN query AS q
  WHERE q.viewer_id IS NOT NULL
    AND p.username ~ '^[a-zA-Z0-9_]{3,20}$'
    AND (q.term = '' OR strpos(lower(p.username), q.term) > 0 OR strpos(lower(coalesce(p.display_name, '')), q.term) > 0)
  ORDER BY is_following DESC,
           (lower(p.username) = q.term) DESC,
           (strpos(lower(p.username), q.term) = 1) DESC,
           (strpos(lower(coalesce(p.display_name, '')), q.term) = 1) DESC,
           lower(p.username), p.id
  LIMIT 8;
$$;
REVOKE ALL ON FUNCTION public.search_post_mention_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_post_mention_users(text) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_post_mention_unique_idx
  ON public.notifications (user_id, resource_id) WHERE type = 'mention_post';

-- Trigger-only code needs elevated rights to write notifications and references;
-- it is kept outside the API schema and checks the authenticated author.
CREATE OR REPLACE FUNCTION private.sync_post_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  mentioned record;
  previous_user_ids uuid[];
  current_user_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications WHERE type = 'mention_post' AND resource_id = OLD.id;
    RETURN OLD;
  END IF;

  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Only the post author can change mentions' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(m.user_id), ARRAY[]::uuid[]) INTO previous_user_ids
    FROM public.post_mentions AS m WHERE m.post_id = NEW.id;

  FOR mentioned IN
    SELECT DISTINCT p.id, p.username
    FROM regexp_matches(coalesce(NEW.body, ''), '(^|[^a-zA-Z0-9_@/])@([a-zA-Z0-9_]{3,20})(?![a-zA-Z0-9_])', 'g') AS matched(parts)
    JOIN public.profiles AS p ON lower(p.username) = lower(matched.parts[2])
  LOOP
    current_user_ids := array_append(current_user_ids, mentioned.id);
    INSERT INTO public.post_mentions (post_id, user_id, username)
      VALUES (NEW.id, mentioned.id, mentioned.username)
      ON CONFLICT (post_id, user_id) DO UPDATE SET username = EXCLUDED.username;

    IF mentioned.id <> NEW.user_id AND NOT (mentioned.id = ANY(previous_user_ids)) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, resource_id, resource_type)
        VALUES (mentioned.id, NEW.user_id, 'mention_post', NEW.id, 'post')
        ON CONFLICT (user_id, resource_id) WHERE type = 'mention_post' DO NOTHING;
    END IF;
  END LOOP;

  DELETE FROM public.post_mentions WHERE post_id = NEW.id AND NOT (user_id = ANY(current_user_ids));
  DELETE FROM public.notifications WHERE type = 'mention_post' AND resource_id = NEW.id AND NOT (user_id = ANY(current_user_ids));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_post_mentions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_post_mentions ON public.posts;
CREATE TRIGGER sync_post_mentions AFTER INSERT OR UPDATE OF body ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.sync_post_mentions();
DROP TRIGGER IF EXISTS cleanup_post_mentions ON public.posts;
CREATE TRIGGER cleanup_post_mentions AFTER DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.sync_post_mentions();

-- Resolve mentions on existing posts without notifying people retroactively.
INSERT INTO public.post_mentions (post_id, user_id, username)
SELECT DISTINCT post.id, p.id, p.username
FROM public.posts AS post
CROSS JOIN LATERAL regexp_matches(coalesce(post.body, ''), '(^|[^a-zA-Z0-9_@/])@([a-zA-Z0-9_]{3,20})(?![a-zA-Z0-9_])', 'g') AS matched(parts)
JOIN public.profiles AS p ON lower(p.username) = lower(matched.parts[2])
ON CONFLICT (post_id, user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
