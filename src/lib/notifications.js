export const createNotification = async (userId, type, actorId, resourceId = null) => {
    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            type,
            actor_id: actorId,
            resource_id: resourceId
        })

    if (error) console.error('Error creating notification:', error)
}
