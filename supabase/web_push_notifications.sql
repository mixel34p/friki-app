-- Web Push delivery for activity notifications.
-- VAPID private material lives in Supabase Vault, never in this file or the client.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
    ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read their push subscriptions"
    ON public.push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can create their push subscriptions"
    ON public.push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their push subscriptions"
    ON public.push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their push subscriptions"
    ON public.push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.push_delivery_jobs (
    id uuid PRIMARY KEY,
    notification_id uuid NOT NULL,
    token_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.push_delivery_jobs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.first_preview_image(p_content jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    WITH RECURSIVE nodes(value) AS (
        SELECT p_content
        UNION ALL
        SELECT child.value
        FROM nodes AS node
        CROSS JOIN LATERAL (
            SELECT item.value
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(node.value) = 'array' THEN node.value ELSE '[]'::jsonb END
            ) AS item(value)
            UNION ALL
            SELECT property.value
            FROM jsonb_each(
                CASE WHEN jsonb_typeof(node.value) = 'object' THEN node.value ELSE '{}'::jsonb END
            ) AS property(key, value)
        ) AS child
    )
    SELECT COALESCE(
        node.value ->> 'image_url',
        node.value ->> 'cover_url',
        node.value -> 'cover' ->> 'url'
    )
    FROM nodes AS node
    WHERE jsonb_typeof(node.value) = 'object'
      AND COALESCE(node.value ->> 'image_url', node.value ->> 'cover_url', node.value -> 'cover' ->> 'url') IS NOT NULL
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.first_preview_image(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.activity_preview_image(p_resource_type text, p_resource_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_image text;
BEGIN
    IF p_resource_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF p_resource_type = 'post' THEN
        SELECT (
            SELECT media_item.value ->> 'url'
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(post.media) = 'array' THEN post.media
                    WHEN jsonb_typeof(post.media) = 'object' THEN jsonb_build_array(post.media)
                    ELSE '[]'::jsonb
                END
            ) AS media_item(value)
            WHERE media_item.value ->> 'url' IS NOT NULL
            LIMIT 1
        ) INTO v_image
        FROM public.posts AS post
        WHERE post.id = p_resource_id
          AND NOT COALESCE(post.contains_spoiler, false)
          AND NOT COALESCE(post.is_sensitive, false);
        RETURN v_image;
    ELSIF p_resource_type = 'list' THEN
        SELECT private.first_preview_image(list.content)
        INTO v_image
        FROM public.user_lists AS list
        WHERE list.id = p_resource_id;
        RETURN v_image;
    ELSIF p_resource_type = 'review' THEN
        SELECT CASE entry.work_type
            WHEN 'game' THEN game.cover_url
            WHEN 'anime' THEN anime.image_url
            ELSE NULL
        END
        INTO v_image
        FROM public.library_entries AS entry
        LEFT JOIN public.games AS game ON entry.work_type = 'game' AND game.id::text = entry.work_id
        LEFT JOIN public.anime AS anime ON entry.work_type = 'anime' AND anime.id::text = entry.work_id
        WHERE entry.id = p_resource_id;
        RETURN v_image;
    ELSIF p_resource_type = 'tierlist' AND to_regclass('public.tierlists') IS NOT NULL THEN
        BEGIN
            EXECUTE 'SELECT screenshot_url FROM public.tierlists WHERE id = $1'
                INTO v_image USING p_resource_id;
        EXCEPTION WHEN undefined_column THEN
            v_image := NULL;
        END;

        IF v_image IS NOT NULL THEN
            RETURN v_image;
        END IF;

        BEGIN
            EXECUTE 'SELECT private.first_preview_image(content) FROM public.tierlists WHERE id = $1'
                INTO v_image USING p_resource_id;
        EXCEPTION WHEN undefined_column THEN
            v_image := NULL;
        END;

        IF v_image IS NOT NULL THEN
            RETURN v_image;
        END IF;

        IF to_regclass('public.tierlist_items') IS NOT NULL THEN
            BEGIN
                EXECUTE $query$
                    SELECT COALESCE(anime.image_url, game.cover_url)
                    FROM public.tierlist_items AS item
                    JOIN public.tierlists AS tierlist ON tierlist.id = item.tierlist_id
                    LEFT JOIN public.games AS game ON game.id::text = item.media_id::text AND tierlist.media_type = 'game'
                    LEFT JOIN public.anime AS anime ON anime.id::text = item.media_id::text AND tierlist.media_type = 'anime'
                    WHERE item.tierlist_id = $1
                    ORDER BY item.tier
                    LIMIT 1
                $query$ INTO v_image USING p_resource_id;
            EXCEPTION WHEN undefined_column OR undefined_table THEN
                v_image := NULL;
            END;
        END IF;
        RETURN v_image;
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.activity_preview_image(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.activity_resource_title(p_resource_type text, p_resource_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_title text;
BEGIN
    IF p_resource_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF p_resource_type = 'list' THEN
        SELECT list.title INTO v_title FROM public.user_lists AS list WHERE list.id = p_resource_id;
    ELSIF p_resource_type = 'review' THEN
        SELECT CASE entry.work_type WHEN 'game' THEN game.name WHEN 'anime' THEN anime.title ELSE NULL END
        INTO v_title
        FROM public.library_entries AS entry
        LEFT JOIN public.games AS game ON entry.work_type = 'game' AND game.id::text = entry.work_id
        LEFT JOIN public.anime AS anime ON entry.work_type = 'anime' AND anime.id::text = entry.work_id
        WHERE entry.id = p_resource_id;
    ELSIF p_resource_type = 'tierlist' AND to_regclass('public.tierlists') IS NOT NULL THEN
        BEGIN
            EXECUTE 'SELECT title FROM public.tierlists WHERE id = $1' INTO v_title USING p_resource_id;
        EXCEPTION WHEN undefined_column THEN
            v_title := NULL;
        END;
    END IF;

    RETURN v_title;
END;
$$;

REVOKE ALL ON FUNCTION private.activity_resource_title(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_push_delivery_job(p_job_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_notification_id uuid;
    v_payload jsonb;
BEGIN
    DELETE FROM private.push_delivery_jobs AS job
    WHERE job.id = p_job_id
      AND job.token_hash = extensions.digest(p_token, 'sha256')
    RETURNING job.notification_id INTO v_notification_id;

    IF v_notification_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'notification', jsonb_build_object(
            'id', notice.id,
            'user_id', notice.user_id,
            'type', notice.type,
            'resource_id', notice.resource_id,
            'resource_type', notice.resource_type,
            'created_at', notice.created_at,
            'actor_name', COALESCE(actor.display_name, actor.username, 'Alguien'),
            'actor_username', actor.username,
            'actor_avatar_url', actor.avatar_url,
            'preview_image_url', private.activity_preview_image(notice.resource_type, notice.resource_id),
            'resource_title', private.activity_resource_title(notice.resource_type, notice.resource_id)
        ),
        'subscriptions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'endpoint', subscription.endpoint,
                'p256dh', subscription.p256dh,
                'auth', subscription.auth
            ))
            FROM public.push_subscriptions AS subscription
            WHERE subscription.user_id = notice.user_id
        ), '[]'::jsonb),
        'vapid_private_key', (
            SELECT secret.decrypted_secret
            FROM vault.decrypted_secrets AS secret
            WHERE secret.name = 'webpush_vapid_private'
            ORDER BY secret.created_at DESC
            LIMIT 1
        ),
        'vapid_public_key', 'BLsU7w4IbNOle_tKobtNckRcPyOtactJChMrEjjds4RyAjRbgv7M05r_xq_pOgJsaeAI9xBLe4dDjaKEqF0QmIU',
        'vapid_subject', 'mailto:notifications@geeksphere.app'
    )
    INTO v_payload
    FROM public.notifications AS notice
    LEFT JOIN public.profiles AS actor ON actor.id = notice.actor_id
    WHERE notice.id = v_notification_id;

    RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_push_delivery_job(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_push_delivery_job(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.queue_activity_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_job_id uuid := gen_random_uuid();
    v_token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
    IF NEW.actor_id IS NULL OR NEW.actor_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    INSERT INTO private.push_delivery_jobs (id, notification_id, token_hash)
    VALUES (v_job_id, NEW.id, extensions.digest(v_token, 'sha256'));

    PERFORM net.http_post(
        url := 'https://mzkesbzdgpregglmxyrf.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('job_id', v_job_id, 'token', v_token),
        timeout_milliseconds := 10000
    );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.queue_activity_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS send_push_for_activity_notification ON public.notifications;
CREATE TRIGGER send_push_for_activity_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION private.queue_activity_push();
