import { supabase } from './supabase'

const PUBLIC_PROFILE = 'id,username,display_name,avatar_url,favorite_games,favorite_animes,theme_color,name_font'

export async function getProfileInvitation(code) {
    const { data, error } = await supabase.from('profile_invitations')
        .select(`code,profile:profiles!profile_invitations_owner_id_fkey(${PUBLIC_PROFILE})`).eq('code', code).maybeSingle()
    if (error) throw error
    return data?.profile ? data : null
}

export async function getMyInvitation(userId) {
    const { data, error } = await supabase.rpc('get_or_create_profile_invitation')
    if (error) throw error
    const [completed, pending, rewards] = await Promise.all([
        supabase.from('profile_referrals').select('invited_user_id', { count: 'exact', head: true }).eq('inviter_id', userId).not('completed_at', 'is', null),
        supabase.from('profile_referrals').select('invited_user_id', { count: 'exact', head: true }).eq('inviter_id', userId).is('completed_at', null),
        supabase.from('invitation_rewards').select('badge').eq('owner_id', userId),
    ])
    for (const result of [completed, pending, rewards]) if (result.error) throw result.error
    return { code: data, completed: completed.count || 0, pending: pending.count || 0, rewards: rewards.data.map(reward => reward.badge) }
}

export async function claimInvitation(invitation) {
    const { data, error } = await supabase.rpc('claim_profile_invitation', { invitation_code: invitation.code, auto_follow: invitation.autoFollow !== false })
    if (error) throw error
    return data
}
