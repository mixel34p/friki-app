-- Permanent public invitation links, immutable signup attribution and cosmetic rewards.
-- Auth metadata is accepted only once, at account creation, as referral input.
-- All decisions and rewards are checked against authoritative database records.
CREATE SCHEMA IF NOT EXISTS invitation_private;
REVOKE ALL ON SCHEMA invitation_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA invitation_private TO authenticated;

CREATE TABLE public.profile_invitations (
    owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.profile_referrals (
    invited_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    auto_follow boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT no_self_invitation CHECK (invited_user_id <> inviter_id)
);
CREATE INDEX profile_referrals_inviter_completed_idx ON public.profile_referrals(inviter_id, completed_at);
CREATE TABLE public.invitation_rewards (
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge text NOT NULL CHECK (badge IN ('connector', 'host', 'ambassador')),
    earned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, badge)
);
ALTER TABLE public.profile_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_invitations, public.profile_referrals, public.invitation_rewards FROM anon, authenticated;
GRANT SELECT ON public.profile_invitations, public.invitation_rewards TO anon, authenticated;
GRANT INSERT ON public.profile_invitations TO authenticated;
GRANT SELECT ON public.profile_referrals TO authenticated;
CREATE POLICY "Public invitation codes" ON public.profile_invitations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Create own invitation" ON public.profile_invitations FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Read own referral activity" ON public.profile_referrals FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = inviter_id OR (SELECT auth.uid()) = invited_user_id);
CREATE POLICY "Public earned invitation badges" ON public.invitation_rewards FOR SELECT TO anon, authenticated USING (true);

CREATE FUNCTION public.get_or_create_profile_invitation() RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_code uuid; v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.profile_invitations(owner_id) VALUES (v_user) ON CONFLICT (owner_id) DO NOTHING;
    SELECT code INTO v_code FROM public.profile_invitations WHERE owner_id = v_user;
    RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_profile_invitation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_profile_invitation() TO authenticated;

-- This private helper can only be called by internal triggers / authenticated claim.
CREATE FUNCTION invitation_private.complete_referral(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ref public.profile_referrals%ROWTYPE; v_count bigint;
BEGIN
    SELECT * INTO v_ref FROM public.profile_referrals WHERE invited_user_id = p_user FOR UPDATE;
    IF NOT FOUND OR v_ref.completed_at IS NOT NULL THEN RETURN false; END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user AND email_confirmed_at IS NOT NULL AND NOT COALESCE(is_anonymous, false))
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND onboarding_completed IS TRUE) THEN
        RETURN false;
    END IF;
    -- Serialize rewards for the same inviter, including concurrent completions.
    PERFORM 1 FROM public.profiles WHERE id = v_ref.inviter_id FOR UPDATE;
    UPDATE public.profile_referrals SET completed_at = now() WHERE invited_user_id = p_user;
    IF v_ref.auto_follow THEN
        INSERT INTO public.follows(follower_id, following_id) VALUES (p_user, v_ref.inviter_id)
            ON CONFLICT (follower_id, following_id) DO NOTHING;
    END IF;
    SELECT count(*) INTO v_count FROM public.profile_referrals WHERE inviter_id = v_ref.inviter_id AND completed_at IS NOT NULL;
    INSERT INTO public.invitation_rewards(owner_id, badge)
        SELECT v_ref.inviter_id, reward.badge FROM (VALUES (1, 'connector'), (5, 'host'), (10, 'ambassador')) AS reward(threshold, badge)
        WHERE v_count >= reward.threshold ON CONFLICT DO NOTHING;
    -- Existing profile badge protection merges the trusted reward ledger below.
    UPDATE public.profiles SET updated_at = now() WHERE id = v_ref.inviter_id;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION invitation_private.complete_referral(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION invitation_private.capture_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_code uuid; v_inviter uuid; v_input text := NEW.raw_user_meta_data ->> 'invitation_code';
BEGIN
    IF v_input IS NULL OR v_input !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN NEW; END IF;
    v_code := v_input::uuid;
    SELECT owner_id INTO v_inviter FROM public.profile_invitations WHERE code = v_code AND created_at <= NEW.created_at;
    IF v_inviter IS NULL OR v_inviter = NEW.id OR COALESCE(NEW.is_anonymous, false) THEN RETURN NEW; END IF;
    INSERT INTO public.profile_referrals(invited_user_id, inviter_id, auto_follow)
        VALUES (NEW.id, v_inviter, COALESCE(NEW.raw_user_meta_data ->> 'invitation_auto_follow', 'true') <> 'false')
        ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION invitation_private.capture_signup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_profile_invitation AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION invitation_private.capture_signup();

CREATE FUNCTION invitation_private.finalize_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM invitation_private.complete_referral(NEW.id);
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION invitation_private.finalize_signup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER complete_profile_invitation AFTER INSERT OR UPDATE OF onboarding_completed ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION invitation_private.finalize_signup();
CREATE TRIGGER confirm_profile_invitation AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION invitation_private.finalize_signup();

CREATE FUNCTION invitation_private.claim(invitation_code uuid, auto_follow boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_inviter uuid; v_created timestamptz; v_completed timestamptz;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
    -- Serialize claims for this account: a second invitation can never replace the first.
    SELECT created_at INTO v_created FROM auth.users WHERE id = v_user AND NOT COALESCE(is_anonymous, false) FOR UPDATE;
    IF NOT FOUND THEN RETURN 'ineligible'; END IF;
    SELECT completed_at INTO v_completed FROM public.profile_referrals WHERE invited_user_id = v_user;
    IF FOUND THEN
        PERFORM invitation_private.complete_referral(v_user);
        RETURN CASE WHEN EXISTS (SELECT 1 FROM public.profile_referrals WHERE invited_user_id = v_user AND completed_at IS NOT NULL) THEN 'completed' ELSE 'pending' END;
    END IF;
    -- OAuth fallback: only a fresh account with no published profile may claim.
    IF v_created < now() - interval '24 hours' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN RETURN 'ineligible'; END IF;
    SELECT owner_id INTO v_inviter FROM public.profile_invitations WHERE code = invitation_code AND created_at <= v_created;
    IF v_inviter IS NULL OR v_inviter = v_user THEN RETURN 'invalid'; END IF;
    INSERT INTO public.profile_referrals(invited_user_id, inviter_id, auto_follow)
        VALUES (v_user, v_inviter, COALESCE(auto_follow, true)) ON CONFLICT DO NOTHING;
    RETURN 'pending';
END;
$$;
REVOKE ALL ON FUNCTION invitation_private.claim(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION invitation_private.claim(uuid, boolean) TO authenticated;
CREATE FUNCTION public.claim_profile_invitation(invitation_code uuid, auto_follow boolean DEFAULT true) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT invitation_private.claim(invitation_code, auto_follow);
$$;
REVOKE ALL ON FUNCTION public.claim_profile_invitation(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_profile_invitation(uuid, boolean) TO authenticated;

-- Keep existing administrator-assigned badges immutable, merge only server-earned rewards,
-- and reject invented badges on INSERT as well as UPDATE.
CREATE OR REPLACE FUNCTION public.protect_badges_security() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_badges text[];
BEGIN
    SELECT COALESCE(array_agg(DISTINCT badge), '{}'::text[]) INTO v_badges FROM (
        SELECT unnest(CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.badges, '{}'::text[]) ELSE '{}'::text[] END) AS badge
        UNION SELECT badge FROM public.invitation_rewards WHERE owner_id = NEW.id
    ) AS earned;
    NEW.badges := v_badges;
    IF NEW.featured_badge IS NOT NULL AND NOT (NEW.featured_badge = ANY(v_badges)) THEN NEW.featured_badge := NULL; END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_badges_trigger ON public.profiles;
CREATE TRIGGER protect_badges_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_badges_security();
