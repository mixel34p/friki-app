-- Integration checks run in a transaction: every fixture and notification is rolled back.
BEGIN;
DO $$
DECLARE
    v_owner uuid := gen_random_uuid(); v_owner2 uuid := gen_random_uuid();
    v_user uuid; v_code uuid; v_code2 uuid; v_status text; v_badges text[];
BEGIN
    INSERT INTO auth.users(id,email,created_at,email_confirmed_at,raw_user_meta_data)
        VALUES (v_owner,v_owner || '@example.invalid',now()-interval '2 days',now(),'{}'),
               (v_owner2,v_owner2 || '@example.invalid',now()-interval '2 days',now(),'{}');
    INSERT INTO public.profiles(id,username,display_name,onboarding_completed,badges,featured_badge)
        VALUES (v_owner,'iv_' || replace(v_owner::text,'-',''),'Invitation test',true,ARRAY['vip'],'vip'),
               (v_owner2,'iv_' || replace(v_owner2::text,'-',''),'Second test',true,'{}',null);
    ASSERT (SELECT cardinality(badges)=0 AND featured_badge IS NULL FROM public.profiles WHERE id=v_owner), 'Forged signup badges must be rejected';

    PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
    SET LOCAL ROLE authenticated;
    v_code := public.get_or_create_profile_invitation();
    ASSERT public.get_or_create_profile_invitation() = v_code, 'Code must be stable';
    RESET ROLE;
    INSERT INTO public.profile_invitations(owner_id) VALUES(v_owner2) RETURNING code INTO v_code2;

    -- Email signup survives a different browser and waits for email confirmation.
    v_user := gen_random_uuid();
    INSERT INTO auth.users(id,email,created_at,raw_user_meta_data)
        VALUES(v_user,v_user || '@example.invalid',now(),jsonb_build_object('invitation_code',v_code,'invitation_auto_follow',false));
    ASSERT (SELECT inviter_id=v_owner AND NOT auto_follow AND completed_at IS NULL FROM public.profile_referrals WHERE invited_user_id=v_user), 'Email signup attribution';
    INSERT INTO public.profiles(id,username,display_name,onboarding_completed) VALUES(v_user,'iv_' || replace(v_user::text,'-',''),'Test invitee',true);
    ASSERT NOT EXISTS(SELECT 1 FROM public.invitation_rewards WHERE owner_id=v_owner), 'No reward before confirmed email';
    UPDATE auth.users SET email_confirmed_at=now() WHERE id=v_user;
    ASSERT (SELECT completed_at IS NOT NULL FROM public.profile_referrals WHERE invited_user_id=v_user), 'Confirmation completes referral';
    ASSERT NOT EXISTS(SELECT 1 FROM public.follows WHERE follower_id=v_user AND following_id=v_owner), 'Follow opt-out respected';
    ASSERT EXISTS(SELECT 1 FROM public.invitation_rewards WHERE owner_id=v_owner AND badge='connector'), 'First reward earned';

    -- Confirmation before onboarding, automatic follow, milestones and idempotency.
    FOR i IN 2..10 LOOP
        v_user := gen_random_uuid();
        INSERT INTO auth.users(id,email,created_at,email_confirmed_at,raw_user_meta_data)
            VALUES(v_user,v_user || '@example.invalid',now(),now(),jsonb_build_object('invitation_code',v_code));
        ASSERT (SELECT completed_at IS NULL FROM public.profile_referrals WHERE invited_user_id=v_user), 'No reward before profile';
        INSERT INTO public.profiles(id,username,display_name,onboarding_completed) VALUES(v_user,'iv_' || replace(v_user::text,'-',''),'Test invitee',true);
        ASSERT EXISTS(SELECT 1 FROM public.follows WHERE follower_id=v_user AND following_id=v_owner), 'Default auto-follow';
        UPDATE public.profiles SET onboarding_completed=true WHERE id=v_user;
        ASSERT (SELECT count(*)=i FROM public.profile_referrals WHERE inviter_id=v_owner AND completed_at IS NOT NULL), 'Repeated completion cannot duplicate credit';
        IF i=5 THEN ASSERT EXISTS(SELECT 1 FROM public.invitation_rewards WHERE owner_id=v_owner AND badge='host'), 'Fifth reward'; END IF;
    END LOOP;
    ASSERT (SELECT count(*)=3 FROM public.invitation_rewards WHERE owner_id=v_owner), 'All three milestone rewards';
    SELECT badges INTO v_badges FROM public.profiles WHERE id=v_owner;
    ASSERT v_badges @> ARRAY['connector','host','ambassador'], 'Rewards available in existing profile settings';
    DELETE FROM public.follows WHERE follower_id=v_user AND following_id=v_owner;
    UPDATE public.profiles SET onboarding_completed=true WHERE id=v_user;
    ASSERT NOT EXISTS(SELECT 1 FROM public.follows WHERE follower_id=v_user AND following_id=v_owner), 'Never refollow after an explicit unfollow';

    -- OAuth uses the authenticated caller and cannot overwrite a first invitation.
    v_user := gen_random_uuid();
    INSERT INTO auth.users(id,email,created_at,email_confirmed_at,raw_user_meta_data) VALUES(v_user,v_user || '@example.invalid',now(),now(),'{}');
    PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT public.claim_profile_invitation(v_code,false)='pending', 'OAuth claim';
    ASSERT public.claim_profile_invitation(v_code2,true)='pending', 'First claim preserved';
    ASSERT (SELECT inviter_id=v_owner AND NOT auto_follow FROM public.profile_referrals WHERE invited_user_id=v_user), 'Immutable inviter and preference';
    ASSERT (SELECT count(*)=1 FROM public.profile_referrals), 'RLS isolates referral history';
    BEGIN
        INSERT INTO public.invitation_rewards(owner_id,badge) VALUES(v_user,'ambassador');
        RAISE EXCEPTION 'Client reward forgery allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
        INSERT INTO public.profile_referrals(invited_user_id,inviter_id) VALUES(v_user,v_owner2);
        RAISE EXCEPTION 'Client referral forgery allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    INSERT INTO public.profiles(id,username,display_name,onboarding_completed) VALUES(v_user,'iv_' || replace(v_user::text,'-',''),'Test invitee',true);
    ASSERT NOT EXISTS(SELECT 1 FROM public.follows WHERE follower_id=v_user AND following_id=v_owner), 'OAuth opt-out respected';
    UPDATE auth.users SET raw_user_meta_data=jsonb_build_object('invitation_code',v_code2) WHERE id=v_user;
    ASSERT (SELECT inviter_id=v_owner FROM public.profile_referrals WHERE invited_user_id=v_user), 'Metadata changes cannot reattribute';

    -- Existing accounts, self-invitations and invalid links cannot earn rewards.
    PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT public.claim_profile_invitation(v_code,true)='ineligible', 'Self invitation rejected';
    RESET ROLE;
    v_user := gen_random_uuid();
    INSERT INTO auth.users(id,email,created_at,raw_user_meta_data) VALUES(v_user,v_user || '@example.invalid',now()-interval '2 days','{}');
    PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT public.claim_profile_invitation(v_code,true)='ineligible', 'Old accounts rejected';
    RESET ROLE;
    v_user := gen_random_uuid();
    INSERT INTO auth.users(id,email,created_at,raw_user_meta_data) VALUES(v_user,v_user || '@example.invalid',now(),'{}');
    PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT public.claim_profile_invitation(gen_random_uuid(),true)='invalid', 'Missing invitation rejected';
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub','',true);
    SET LOCAL ROLE anon;
    PERFORM code FROM public.profile_invitations WHERE code=v_code;
    BEGIN
        PERFORM public.claim_profile_invitation(v_code,true);
        RAISE EXCEPTION 'Anonymous claiming allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
        PERFORM invited_user_id FROM public.profile_referrals;
        RAISE EXCEPTION 'Anonymous referral history allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
END;
$$;
ROLLBACK;
SELECT 'Invitation integration checks passed; all fixtures rolled back' AS result;
