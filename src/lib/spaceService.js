import { supabase } from './supabase';

export async function getSpaces() {
    const { data, error } = await supabase
        .from('spaces')
        .select(`
            *,
            owner:profiles!spaces_owner_id_fkey (username, display_name, avatar_url),
            space_members (count)
        `)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function getSpaceById(id) {
    const { data, error } = await supabase
        .from('spaces')
        .select(`
            *,
            owner:profiles!spaces_owner_id_fkey (username, display_name, avatar_url)
        `)
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

export async function createSpace({ name, description, avatar_url, banner_url, owner_id, theme_color }) {
    const { data, error } = await supabase
        .from('spaces')
        .insert([{ name, description, avatar_url, banner_url, owner_id, theme_color }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateSpace(spaceId, updates) {
    const { data, error } = await supabase
        .from('spaces')
        .update(updates)
        .eq('id', spaceId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getSpaceChannels(spaceId) {
    const { data, error } = await supabase
        .from('space_channels')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createSpaceChannel({ space_id, name, type }) {
    const { data, error } = await supabase
        .from('space_channels')
        .insert([{ space_id, name, type }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateSpaceChannel(channelId, { name }) {
    const { data, error } = await supabase
        .from('space_channels')
        .update({ name })
        .eq('id', channelId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteSpaceChannel(channelId) {
    const { error } = await supabase
        .from('space_channels')
        .delete()
        .eq('id', channelId);
    if (error) throw error;
    return true;
}

export async function getSpaceMembers(spaceId) {
    const { data, error } = await supabase
        .from('space_members')
        .select(`
            *,
            user:profiles!space_members_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('space_id', spaceId);
    if (error) throw error;
    return data;
}

export async function checkMembership(spaceId, userId) {
    if (!userId) return false;
    const { data, error } = await supabase
        .from('space_members')
        .select('*')
        .eq('space_id', spaceId)
        .eq('user_id', userId)
        .maybeSingle();
    return !!data;
}

export async function joinSpace(spaceId, userId) {
    const { error } = await supabase
        .from('space_members')
        .insert([{ space_id: spaceId, user_id: userId }]);
    if (error) throw error;
    return true;
}

export async function leaveSpace(spaceId, userId) {
    const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', userId);
    if (error) throw error;
    return true;
}

// Chat Messages
export async function getChannelMessages(channelId, limit = 50) {
    const { data, error } = await supabase
        .from('space_messages')
        .select(`
            *,
            user:profiles (username, display_name, avatar_url),
            reactions:space_message_reactions (
                id, emoji, user_id,
                user:profiles (username, display_name, avatar_url)
            ),
            reply_to:space_messages (
                id, content,
                user:profiles (username, display_name, avatar_url)
            )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false }).limit(limit);
    if (error) {
        console.error("Error fetching messages:", error);
        throw error;
    }
    return data.reverse(); // Return in chronological order
}

export async function sendMessage(channelId, userId, content, replyToId = null) {
    const payload = { channel_id: channelId, user_id: userId, content };
    if (replyToId) payload.reply_to_id = replyToId;

    const { data, error } = await supabase
        .from('space_messages')
        .insert([payload])
        .select(`
            *,
            user:profiles (username, display_name, avatar_url),
            reactions:space_message_reactions (
                id, emoji, user_id,
                user:profiles (username, display_name, avatar_url)
            ),
            reply_to:space_messages (
                id, content,
                user:profiles (username, display_name, avatar_url)
            )
        `)
        .single();
    if (error) {
        console.error("Error inserting message:", error);
        throw error;
    }
    return data;
}

export async function updateMessage(msgId, userId, content) {
    const { data, error } = await supabase
        .from('space_messages')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', msgId)
        .eq('user_id', userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function toggleReaction(messageId, userId, emoji) {
    // Check if exists
    const { data: existing } = await supabase
        .from('space_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

    if (existing) {
        // Remove
        const { error } = await supabase
            .from('space_message_reactions')
            .delete()
            .eq('id', existing.id);
        if (error) throw error;
        return { action: 'removed', emoji };
    } else {
        // Add
        const { data, error } = await supabase
            .from('space_message_reactions')
            .insert([{ message_id: messageId, user_id: userId, emoji }])
            .select(`
                *,
                user:profiles (username, display_name, avatar_url)
            `)
            .single();
        if (error) throw error;
        return { action: 'added', reaction: data };
    }
}

// Debates (Forums)
export async function getSpaceDebates(spaceId) {
    const { data, error } = await supabase
        .from('space_debates')
        .select(`
            *,
            user:profiles!space_debates_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function getDebateById(debateId) {
    const { data, error } = await supabase
        .from('space_debates')
        .select(`
            *,
            user:profiles!space_debates_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('id', debateId)
        .single();
    if (error) throw error;
    return data;
}

export async function createDebate({ space_id, user_id, title, content }) {
    const { data, error } = await supabase
        .from('space_debates')
        .insert([{ space_id, user_id, title, content }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getDebateReplies(debateId) {
    const { data, error } = await supabase
        .from('space_debate_replies')
        .select(`
            *,
            user:profiles!space_debate_replies_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('debate_id', debateId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

export async function addDebateReply(debateId, userId, content) {
    const { data, error } = await supabase
        .from('space_debate_replies')
        .insert([{ debate_id: debateId, user_id: userId, content }])
        .select(`
            *,
            user:profiles!space_debate_replies_user_id_fkey (username, display_name, avatar_url)
        `)
        .single();
    if (error) throw error;
    return data;
}

