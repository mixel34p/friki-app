import { supabase } from './supabase'

/**
 * Servicio para gestionar reacciones temáticas
 * Tipos: epic (🔥), interesting (🧠), meh (😴), destroyed (💀)
 */

export const REACTION_TYPES = {
    EPIC: 'epic',
    INTERESTING: 'interesting',
    MEH: 'meh',
    DESTROYED: 'destroyed'
}

export const REACTION_LABELS = {
    epic: { icon: '/icons/fire.gif', label: 'Épico', emoji: '🔥' },
    interesting: { icon: '/icons/scale.png', label: 'Interesante', emoji: '🧠' },
    meh: { icon: '/icons/mushroom.png', label: 'Meh', emoji: '😴' },
    destroyed: { icon: '/icons/cross.png', label: 'Me destruyó', emoji: '💀' }
}

/**
 * Añade o actualiza la reacción del usuario a un contenido
 */
export async function addReaction(userId, targetType, targetId, reactionType) {
    try {
        const { data, error } = await supabase
            .from('thematic_reactions')
            .upsert({
                user_id: userId,
                target_type: targetType,
                target_id: targetId,
                reaction_type: reactionType
            }, {
                onConflict: 'user_id,target_type,target_id'
            })
            .select()
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error adding reaction:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Elimina la reacción del usuario a un contenido
 */
export async function removeReaction(userId, targetType, targetId) {
    try {
        const { error } = await supabase
            .from('thematic_reactions')
            .delete()
            .eq('user_id', userId)
            .eq('target_type', targetType)
            .eq('target_id', targetId)

        if (error) throw error
        return { success: true }
    } catch (error) {
        console.error('Error removing reaction:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Obtiene todas las reacciones de un contenido (agregadas)
 */
export async function getReactions(targetType, targetId) {
    try {
        const { data, error } = await supabase
            .rpc('get_reaction_counts', {
                p_target_type: targetType,
                p_target_id: targetId
            })

        if (error) throw error
        return data || {}
    } catch (error) {
        console.error('Error fetching reactions:', error)
        return {}
    }
}

/**
 * Obtiene la reacción del usuario actual a un contenido
 */
export async function getUserReaction(userId, targetType, targetId) {
    try {
        const { data, error } = await supabase
            .from('thematic_reactions')
            .select('reaction_type')
            .eq('user_id', userId)
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .maybeSingle()

        if (error) throw error
        return data?.reaction_type || null
    } catch (error) {
        console.error('Error fetching user reaction:', error)
        return null
    }
}

/**
 * Genera un texto descriptivo para mostrar las reacciones
 */
export function formatReactionsText(reactions) {
    if (!reactions || Object.keys(reactions).length === 0) {
        return null
    }

    // Encontrar la reacción más común
    let maxType = null
    let maxCount = 0

    Object.keys(reactions).forEach(type => {
        if (reactions[type] > maxCount) {
            maxCount = reactions[type]
            maxType = type
        }
    })

    if (!maxType) return null

    const reaction = REACTION_LABELS[maxType]
    return `A la gente le pareció ${reaction.emoji || ''} ${reaction.label}`
}

/**
 * Toggle de reacción
 */
export async function toggleReaction(userId, targetType, targetId, reactionType) {
    try {
        // Primero verificar si ya tiene una reacción
        const currentReaction = await getUserReaction(userId, targetType, targetId)

        if (currentReaction === reactionType) {
            // Si es la misma, la eliminamos
            return await removeReaction(userId, targetType, targetId)
        } else {
            // Si es diferente o no existe, la añadimos/actualizamos
            return await addReaction(userId, targetType, targetId, reactionType)
        }
    } catch (error) {
        console.error('Error toggling reaction:', error)
        return { success: false, error: error.message }
    }
}
