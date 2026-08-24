import { supabase } from './supabase'

/**
 * Registra o actualiza una obra (juego/anime) en el diario del usuario
 * @param {string} userId - ID del usuario
 * @param {string} workId - ID de la obra
 * @param {string} workType - 'game' o 'anime'
 * @param {Object} logData - Datos del log { rating, review_text, finished_date, contains_spoiler }
 */
export async function logWork(userId, workId, workType, logData) {
    const { data, error } = await supabase
        .from('library_entries')
        .upsert({
            user_id: userId,
            work_id: String(workId),
            work_type: workType,
            rating: logData.rating || null,
            review_text: logData.review_text || null,
            contains_spoiler: logData.contains_spoiler || false,
            finished_date: logData.finished_date || null,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id, work_id, work_type'
        })
        .select()
        .single()
        
    if (error) {
        console.error('Error logging work:', error)
        throw error
    }
    
    return data
}

/**
 * Obtiene el log/reseña específico de un usuario para una obra
 */
export async function getWorkLog(userId, workId, workType) {
    if (!userId || !workId) return null
    
    const { data, error } = await supabase
        .from('library_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        .maybeSingle()
        
    if (error) {
        console.error('Error fetching work log:', error)
        return null
    }
    
    return data
}

/**
 * Obtiene toda la biblioteca/logs de un usuario (para su perfil)
 */
export async function getUserLibrary(userId) {
    const { data, error } = await supabase
        .from('library_entries')
        .select('*')
        .eq('user_id', userId)
        .order('finished_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        
    if (error) {
        console.error('Error fetching user library:', error)
        throw error
    }
    
    return data
}

/**
 * Elimina un log de la biblioteca
 */
export async function deleteWorkLog(userId, workId, workType) {
    const { error } = await supabase
        .from('library_entries')
        .delete()
        .eq('user_id', userId)
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        
    if (error) {
        console.error('Error deleting work log:', error)
        throw error
    }
    
    return true
}
