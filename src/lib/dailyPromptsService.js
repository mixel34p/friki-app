import { supabase } from './supabase'
import { getGameById } from './gameService'
import { getAnimeById } from './animeService'

/**
 * Servicio para gestionar prompts diarios y respuestas
 * Implementa votaciones "¿Cuál prefieres?" y preguntas diarias
 */

/**
 * Obtiene el prompt del día actual
 * @param {string} type - 'poll' o 'question' (opcional, devuelve ambos si no se especifica)
 * @returns {Promise<Object|null>} Prompt del día o null si no existe
 */
export async function getTodayPrompt(type = null) {
    try {
        const today = new Date().toISOString().split('T')[0]

        let query = supabase
            .from('daily_prompts')
            .select('*')
            .eq('date', today)

        if (type) {
            query = query.eq('type', type)
        }

        const { data, error } = await query

        if (error) throw error

        // Si hay múltiples prompts, devolver el primero (poll tiene prioridad)
        if (data && data.length > 0) {
            let prompt = type ? data[0] : data.find(p => p.type === 'poll') || data[0]

            // ENRIQUECIMIENTO AUTOMÁTICO
            // Si las opciones tienen 'id' y 'type' pero no 'image', buscamos en la DB
            // ENRIQUECIMIENTO AUTOMÁTICO
            // Si las opciones tienen 'id' y 'type' pero no 'image', buscamos en la DB
            if (prompt.type === 'poll' && Array.isArray(prompt.options) && prompt.options.length > 0) {
                console.log('🔄 Iniciando enriquecimiento de opciones...')

                let newOptions = []

                // Usar bucle for clásico para evitar problemas de async/await y mayor claridad
                for (const opt of prompt.options) {
                    // Si ya tiene label e imagen, lo guardamos tal cual
                    if (opt.label && opt.image) {
                        newOptions.push(opt)
                        continue
                    }

                    // Si es referencia a juego/anime
                    if (opt.id && (opt.type || prompt.media_type)) {
                        try {
                            const mediaType = opt.type || prompt.media_type
                            const id = opt.id

                            let media = null

                            console.log(`🔎 Resolviendo ${mediaType} #${id} usando servicios...`)

                            if (mediaType === 'game') {
                                // gameService maneja búsqueda local y fallback a IGDB
                                const gameId = parseInt(id)
                                if (!isNaN(gameId)) {
                                    media = await getGameById(gameId)
                                }
                            } else if (mediaType === 'anime') {
                                // animeService maneja búsqueda local y fallback a Jikan
                                const animeId = parseInt(id)
                                if (!isNaN(animeId)) {
                                    media = await getAnimeById(animeId)
                                }
                            }

                            if (media) {
                                // Los servicios devuelven formato estandarizado: name, cover_url/image_url
                                const img = media.cover_url || media.image_url
                                // Intentar mejorar calidad si es posible (IGDB thumbnails)
                                let finalImg = img
                                if (img && img.includes('igdb') && img.includes('t_thumb')) {
                                    finalImg = img.replace('t_thumb', 't_cover_big')
                                } else if (img && img.includes('igdb') && img.includes('t_cover_small')) {
                                    finalImg = img.replace('t_cover_small', 't_cover_big')
                                }

                                newOptions.push({
                                    ...opt,
                                    label: media.name || media.title, // anime usa title, games usa name (estandarizar si es posible)
                                    image: finalImg
                                })
                                console.log(`✅ ${media.name || media.title} resuelto correctamente`)
                            } else {
                                console.warn(`⚠️ No se pudo resolver ID ${id} con los servicios`)
                                newOptions.push(opt) // Devolver original para no romper UI
                            }
                        } catch (err) {
                            console.error('❌ Error resolviendo media:', err)
                            newOptions.push(opt)
                        }
                    } else {
                        newOptions.push(opt)
                    }
                }

                prompt.options = newOptions
                console.log('✨ Options finales:', prompt.options)
            }

            return prompt
        }

        return null
    } catch (error) {
        console.error('Error fetching today prompt:', error.message || error)
        return null
    }
}

/**
 * Verifica si el usuario ya respondió a un prompt
 * @param {string} promptId - ID del prompt
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} Respuesta del usuario o null
 */
export async function getUserResponse(promptId, userId) {
    try {
        const { data, error } = await supabase
            .from('daily_responses')
            .select('*')
            .eq('prompt_id', promptId)
            .eq('user_id', userId)
            .maybeSingle()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Error fetching user response:', error)
        return null
    }
}

/**
 * Guarda la respuesta del usuario a un prompt
 * @param {string} promptId - ID del prompt
 * @param {string} userId - ID del usuario
 * @param {Object} answer - Respuesta del usuario (JSON)
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function submitResponse(promptId, userId, answer) {
    try {
        const { data, error } = await supabase
            .from('daily_responses')
            .insert({
                prompt_id: promptId,
                user_id: userId,
                answer
            })
            .select()
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error submitting response:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Obtiene resultados agregados de una votación (sin exponer usuarios)
 * @param {string} promptId - ID del prompt
 * @returns {Promise<Object>} Estadísticas agregadas
 */
export async function getAggregatedResults(promptId) {
    try {
        const { data, error } = await supabase
            .rpc('get_poll_results', { poll_id: promptId })

        if (error) throw error

        return data || { total: 0, distribution: {} }
    } catch (error) {
        console.error('Error fetching aggregated results:', JSON.stringify(error, null, 2))
        return { total: 0, distribution: {} }
    }
}

/**
 * Genera un texto descriptivo de los resultados (sin mostrar quién votó)
 * @param {Object} results - Resultados agregados
 * @param {Array} options - Opciones del prompt
 * @returns {string} Texto descriptivo
 */
export function formatResultsText(results, options) {
    if (!results || results.total === 0) {
        return 'Todavía no hay votos'
    }

    const { distribution } = results

    // Encontrar la opción más votada
    let maxChoice = null
    let maxPercentage = 0

    Object.keys(distribution).forEach(choice => {
        const percentage = distribution[choice].percentage
        if (percentage > maxPercentage) {
            maxPercentage = percentage
            maxChoice = choice
        }
    })

    // Determinar el tipo de mensaje según la distribución
    if (maxPercentage >= 70) {
        const option = options.find(opt => opt.id === maxChoice)
        return `La mayoría prefiere ${option?.label || maxChoice}`
    } else if (maxPercentage >= 55) {
        const option = options.find(opt => opt.id === maxChoice)
        return `Más gente eligió ${option?.label || maxChoice}`
    } else {
        return 'Opiniones divididas'
    }
}

/**
 * Crea un nuevo prompt diario (admin/sistema)
 * @param {Object} promptData - Datos del prompt
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function createDailyPrompt(promptData) {
    try {
        const { data, error } = await supabase
            .from('daily_prompts')
            .insert(promptData)
            .select()
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error creating daily prompt:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Obtiene todas las respuestas a una pregunta (solo texto, sin usuarios)
 * @param {string} promptId - ID del prompt
 * @param {number} limit - Número máximo de respuestas
 * @returns {Promise<Array>} Array de respuestas
 */
export async function getQuestionResponses(promptId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('daily_responses')
            .select('answer, created_at')
            .eq('prompt_id', promptId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        // Devolver solo el texto de las respuestas, sin info de usuarios
        return data?.map(r => ({
            text: r.answer.text,
            timestamp: r.created_at
        })) || []
    } catch (error) {
        console.error('Error fetching question responses:', error)
        return []
    }
}
