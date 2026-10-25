import { supabase } from './supabase'

/**
 * Registra o actualiza una obra (juego/anime) en el diario del usuario
 * @param {string} userId - ID del usuario
 * @param {string} workId - ID de la obra
 * @param {string} workType - 'game' o 'anime'
 * @param {Object} logData - Datos del log { rating, review_text, finished_date, contains_spoiler }
 */
export async function logWork(userId, workId, workType, logData) {
    const rating = logData.rating == null ? null : Number(logData.rating)
    if (rating != null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || Math.round(rating * 2) !== rating * 2)) {
        throw new Error('La valoración debe estar entre 0,5 y 5 estrellas, en pasos de media estrella.')
    }

    const { data, error } = await supabase
        .from('library_entries')
        .upsert({
            user_id: userId,
            work_id: String(workId),
            work_type: workType,
            rating,
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
 * Obtiene el log/reseÃ±a especÃ­fico de un usuario para una obra
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

// Obtener reseñas (library_entries) de una obra con paginación
export async function getWorkReviews(workId, workType, page = 1, limit = 3, rating = null) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from('library_entries')
        .select('*', { count: 'exact' })
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        .not('review_text', 'is', null)

    if (rating != null) {
        query = query.eq('rating', rating)
    }

    const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) {
        console.error('Error fetching work reviews:', error);
        return { data: [], count: 0 };
    }
    if (!data || data.length === 0) return { data: [], count: count || 0 }
    const userIds = [...new Set(data.map(entry => entry.user_id))]
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, display_name, featured_badge, theme_color')
        .in('id', userIds)
    const profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]))
    return {
        data: data.map(entry => ({ ...entry, profiles: profilesById[entry.user_id] || null })),
        count: count || 0
    }
}

// Obtener todas las valoraciones, tengan o no texto, con paginación
export async function getWorkRatings(workId, workType, page = 1, limit = 10, rating = null) {
    const from = (page - 1) * limit
    const to = from + limit - 1
    let query = supabase
        .from('library_entries')
        .select('*', { count: 'exact' })
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        .not('rating', 'is', null)

    if (rating != null) {
        query = query.eq('rating', rating)
    }

    const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) {
        console.error('Error fetching work ratings:', error)
        return { data: [], count: 0 }
    }
    if (!data || data.length === 0) return { data: [], count: count || 0 }

    const userIds = [...new Set(data.map(entry => entry.user_id))]
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, display_name, featured_badge, theme_color')
        .in('id', userIds)
    const profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]))
    return {
        data: data.map(entry => ({ ...entry, profiles: profilesById[entry.user_id] || null })),
        count: count || 0
    }
}

// Obtener el promedio de puntuación y el número total de reseñas de una obra
export async function getWorkReviewStats(workId, workType) {
    const [{ data: ratingData, count: ratingsCount, error: ratingsError }, { count: reviewCount, error: reviewsError }] = await Promise.all([
        supabase
        .from('library_entries')
        .select('rating', { count: 'exact' })
        .eq('work_id', String(workId))
        .eq('work_type', workType)
        .not('rating', 'is', null),
        supabase
            .from('library_entries')
            .select('id', { count: 'exact', head: true })
            .eq('work_id', String(workId))
            .eq('work_type', workType)
            .not('review_text', 'is', null)
    ])

    if (ratingsError || reviewsError) {
        console.error('Error fetching work review stats:', ratingsError || reviewsError)
        return { average: null, count: 0, ratingsCount: 0 }
    }

    const ratings = (ratingData || [])
        .filter(entry => entry.rating != null)
        .map(entry => Number(entry.rating))
        .filter(Number.isFinite)
    const average = ratings.length
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : null

    return { average, count: reviewCount || 0, ratingsCount: ratingsCount || 0 }
}


