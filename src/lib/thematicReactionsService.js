import { supabase } from './supabase'

/**
 * Servicio para gestionar reacciones temáticas
 * Tipos: epic (🔥 Épico), interesting (🧠 Interesante), meh (😴 Meh), destroyed (💀 Me destruyó)
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

// ... (funciones addReaction, removeReaction, getReactions, getUserReaction siguen igual)

/**
 * Genera un texto descriptivo para mostrar las reacciones
 * @param {Object} reactions - Conteo de reacciones
 * @returns {string} Texto descriptivo
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
    // Usamos el emoji unicode para el texto descriptivo, no la imagen
    return `A la gente le pareció ${reaction.emoji || ''} ${reaction.label}`
}

/**
 * Toggle de reacción: añade si no existe, elimina si ya existe la misma, cambia si existe otra
 * @param {string} userId - ID del usuario
 * @param {string} targetType - Tipo de contenido
 * @param {string} targetId - ID del contenido
 * @param {string} reactionType - Tipo de reacción
 * @returns {Promise<Object>} Resultado de la operación
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
