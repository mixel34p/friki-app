import { supabase } from './supabase';

export async function getSpaces() {
    const { data, error } = await supabase
        .from('spaces')
        .select(`
            *,
            owner:profiles!spaces_owner_id_fkey (username, display_name, avatar_url, featured_badge),
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
            owner:profiles!spaces_owner_id_fkey (username, display_name, avatar_url, featured_badge)
        `)
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

export async function createSpace({ name, description, avatar_url, banner_url, owner_id, theme_color, related_works = [] }) {
    const { data, error } = await supabase
        .from('spaces')
        .insert([{ name, description, avatar_url, banner_url, owner_id, theme_color, related_works }])
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

export async function deleteSpace(spaceId) {
    try {
        // 1. Delete all custom emojis for this space
        await supabase.from('custom_emojis').delete().eq('space_id', spaceId);

        // 2. Delete all members of this space
        await supabase.from('space_members').delete().eq('space_id', spaceId);

        // 3. Handle debates (Forums)
        const { data: debates } = await supabase.from('space_debates').select('id').eq('space_id', spaceId);
        if (debates && debates.length > 0) {
            const debateIds = debates.map(d => d.id);
            // Delete all replies for these debates
            await supabase.from('space_debate_replies').delete().in('debate_id', debateIds);
            // Delete the debates themselves
            await supabase.from('space_debates').delete().eq('space_id', spaceId);
        }

        // 4. Handle channels and their messages
        const { data: channels } = await supabase.from('space_channels').select('id').eq('space_id', spaceId);
        if (channels && channels.length > 0) {
            const channelIds = channels.map(c => c.id);
            
            // Delete messages in these channels
            const { data: messages } = await supabase.from('space_messages').select('id').in('channel_id', channelIds);
            if (messages && messages.length > 0) {
                const messageIds = messages.map(m => m.id);
                // Delete reactions for these messages
                await supabase.from('space_message_reactions').delete().in('message_id', messageIds);
                // Delete the messages themselves
                await supabase.from('space_messages').delete().in('channel_id', channelIds);
            }
            // Delete the channels
            await supabase.from('space_channels').delete().eq('space_id', spaceId);
        }

        // 5. Finally, delete the space itself
        const { data: deletedSpace, error: spaceError } = await supabase
            .from('spaces')
            .delete()
            .eq('id', spaceId)
            .select();

        if (spaceError) throw spaceError;

        if (!deletedSpace || deletedSpace.length === 0) {
            throw new Error('El espacio no se pudo borrar. Es posible que te falte la política RLS (Row Level Security) de tipo DELETE en la tabla "spaces" en Supabase.');
        }

        return true;
    } catch (error) {
        console.error("Manual cascade delete failed:", error);
        throw error;
    }
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
            user:profiles!space_members_user_id_fkey (username, display_name, avatar_url, featured_badge)
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
            user:profiles (username, display_name, avatar_url, featured_badge),
            reactions:space_message_reactions (
                id, emoji, user_id,
                user:profiles (username, display_name, avatar_url, featured_badge)
            ),
            reply_to:space_messages (
                id, content,
                user:profiles (username, display_name, avatar_url, featured_badge)
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
            user:profiles (username, display_name, avatar_url, featured_badge),
            reactions:space_message_reactions (
                id, emoji, user_id,
                user:profiles (username, display_name, avatar_url, featured_badge)
            ),
            reply_to:space_messages (
                id, content,
                user:profiles (username, display_name, avatar_url, featured_badge)
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
                user:profiles (username, display_name, avatar_url, featured_badge)
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
            user:profiles!space_debates_user_id_fkey (username, display_name, avatar_url, featured_badge)
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
            user:profiles!space_debates_user_id_fkey (username, display_name, avatar_url, featured_badge)
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
            user:profiles!space_debate_replies_user_id_fkey (username, display_name, avatar_url, featured_badge)
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
            user:profiles!space_debate_replies_user_id_fkey (username, display_name, avatar_url, featured_badge)
        `)
        .single();
    if (error) throw error;
    return data;
}


// Emojis Custom
export async function getCustomEmojis() {
    const { data, error } = await supabase
        .from('custom_emojis')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function getSpaceEmojis(spaceId) {
    const { data, error } = await supabase
        .from('custom_emojis')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createCustomEmoji(spaceId, name, imageUrl) {
    const { data, error } = await supabase
        .from('custom_emojis')
        .insert([{ space_id: spaceId, name: name.trim().toLowerCase(), image_url: imageUrl }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCustomEmoji(id) {
    const { error } = await supabase
        .from('custom_emojis')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

export async function updateCustomEmoji(id, name) {
    const { data, error } = await supabase
        .from('custom_emojis')
        .update({ name: name.trim().toLowerCase() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getUserSpaces(userId) {
    const { data, error } = await supabase.from('space_members').select('space:spaces(*)').eq('user_id', userId);
    if (error) throw error;
    return data.map(m => m.space);
}

export async function getSpacesByWork(workId) {
    const { data, error } = await supabase
        .from('spaces')
        .select(`
            *,
            owner:profiles!spaces_owner_id_fkey (username, display_name, avatar_url, featured_badge)
        `)
        .contains('related_works', `[{"id": ${workId}}]`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching spaces by work:", error);
        return [];
    }
    
    // Fetch members count for each space to populate member_count if needed
    for (const space of data) {
        const { count } = await supabase
            .from('space_members')
            .select('*', { count: 'exact', head: true })
            .eq('space_id', space.id);
            
        space.member_count = count || 0;
    }
    
    return data;
}
