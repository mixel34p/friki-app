-- Activity notifications for follows, likes, and comments on user-owned content.
-- Run this in the Supabase SQL editor after the interaction tables exist.
-- Re-run it after adding supported tables to install their notification triggers.

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    type text NOT NULL,
    resource_id uuid,
    resource_type text,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS resource_type text;

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_follow_cooldown_idx
    ON public.notifications (user_id, actor_id, created_at DESC)
    WHERE type = 'follow';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_activity_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recipient_id uuid;
    v_actor_id uuid;
    v_related_id uuid;
    v_related_type text;
    v_notification_type text;
BEGIN
    IF TG_TABLE_NAME = 'follows' THEN
        v_recipient_id := NEW.following_id;
        v_actor_id := NEW.follower_id;
        v_notification_type := 'follow';
        v_related_type := 'profile';
        v_related_id := NEW.following_id;
    ELSIF TG_TABLE_NAME = 'tierlist_likes' THEN
        SELECT user_id INTO v_recipient_id FROM public.tierlists WHERE id = NEW.tierlist_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'like_tierlist';
        v_related_type := 'tierlist';
        v_related_id := NEW.tierlist_id;
    ELSIF TG_TABLE_NAME = 'review_likes' OR TG_TABLE_NAME = 'library_entry_likes' THEN
        SELECT user_id INTO v_recipient_id FROM public.library_entries WHERE id = NEW.entry_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'like_review';
        v_related_type := 'review';
        v_related_id := NEW.entry_id;
    ELSIF TG_TABLE_NAME = 'user_list_likes' THEN
        SELECT user_id INTO v_recipient_id FROM public.user_lists WHERE id = NEW.list_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'like_list';
        v_related_type := 'list';
        v_related_id := NEW.list_id;
    ELSIF TG_TABLE_NAME = 'library_review_comments' THEN
        SELECT user_id INTO v_recipient_id FROM public.library_entries WHERE id = NEW.review_entry_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'comment_review';
        v_related_type := 'review';
        v_related_id := NEW.review_entry_id;
    ELSIF TG_TABLE_NAME = 'post_likes' THEN
        SELECT user_id INTO v_recipient_id FROM public.posts WHERE id = NEW.post_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'like_post';
        v_related_type := 'post';
        v_related_id := NEW.post_id;
    ELSIF TG_TABLE_NAME = 'post_comments' THEN
        SELECT user_id INTO v_recipient_id FROM public.posts WHERE id = NEW.post_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'comment_post';
        v_related_type := 'post';
        v_related_id := NEW.post_id;
    ELSIF TG_TABLE_NAME = 'list_comments' THEN
        SELECT user_id INTO v_recipient_id FROM public.user_lists WHERE id = NEW.list_id;
        v_actor_id := NEW.user_id;
        v_notification_type := 'comment_list';
        v_related_type := 'list';
        v_related_id := NEW.list_id;
    ELSE
        RETURN NEW;
    END IF;

    IF v_recipient_id IS NOT NULL AND v_actor_id IS NOT NULL AND v_recipient_id <> v_actor_id THEN
        -- Avoid follow/unfollow spam: at most one follow notice per pair every seven days.
        IF v_notification_type = 'follow' THEN
            IF EXISTS (
                SELECT 1
                FROM public.notifications AS previous_follow
                WHERE previous_follow.user_id = v_recipient_id
                  AND previous_follow.actor_id = v_actor_id
                  AND previous_follow.type = 'follow'
                  AND previous_follow.created_at >= now() - interval '7 days'
            ) THEN
                RETURN NEW;
            END IF;
        END IF;

        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, resource_type)
        VALUES (v_recipient_id, v_actor_id, v_notification_type, v_related_id, v_related_type);
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.follows') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_new_follow ON public.follows;
        CREATE TRIGGER notify_new_follow
            AFTER INSERT ON public.follows
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.tierlist_likes') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_tierlist_like ON public.tierlist_likes;
        CREATE TRIGGER notify_tierlist_like
            AFTER INSERT ON public.tierlist_likes
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.review_likes') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_review_like ON public.review_likes;
        CREATE TRIGGER notify_review_like
            AFTER INSERT ON public.review_likes
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.library_entry_likes') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_library_entry_like ON public.library_entry_likes;
        CREATE TRIGGER notify_library_entry_like
            AFTER INSERT ON public.library_entry_likes
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.user_list_likes') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_user_list_like ON public.user_list_likes;
        CREATE TRIGGER notify_user_list_like
            AFTER INSERT ON public.user_list_likes
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.library_review_comments') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_library_review_comment ON public.library_review_comments;
        CREATE TRIGGER notify_library_review_comment
            AFTER INSERT ON public.library_review_comments
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.post_likes') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_post_like ON public.post_likes;
        CREATE TRIGGER notify_post_like
            AFTER INSERT ON public.post_likes
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.post_comments') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_post_comment ON public.post_comments;
        CREATE TRIGGER notify_post_comment
            AFTER INSERT ON public.post_comments
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;

    IF to_regclass('public.list_comments') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS notify_list_comment ON public.list_comments;
        CREATE TRIGGER notify_list_comment
            AFTER INSERT ON public.list_comments
            FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'notifications'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END;
$$;
