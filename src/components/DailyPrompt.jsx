import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    getTodayPrompt,
    getUserResponse,
    submitResponse,
    getAggregatedResults,
    formatResultsText,
    getQuestionResponses
} from '../lib/dailyPromptsService'
import './DailyPrompt.css'

export default function DailyPrompt() {
    const { user } = useAuth()
    const [prompt, setPrompt] = useState(null)
    const [userResponse, setUserResponse] = useState(null)
    const [results, setResults] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [questionText, setQuestionText] = useState('')
    const [questionResponses, setQuestionResponses] = useState([])

    useEffect(() => {
        loadPrompt()
    }, [user])

    const loadPrompt = async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            // Obtener prompt del día (prioridad a poll)
            const todayPrompt = await getTodayPrompt()

            if (!todayPrompt) {
                setLoading(false)
                return
            }

            setPrompt(todayPrompt)

            // Verificar si el usuario ya respondió
            const response = await getUserResponse(todayPrompt.id, user.id)
            setUserResponse(response)

            // Si ya respondió, cargar resultados
            if (response) {
                if (todayPrompt.type === 'poll') {
                    const aggregated = await getAggregatedResults(todayPrompt.id)
                    setResults(aggregated)
                } else if (todayPrompt.type === 'question') {
                    const responses = await getQuestionResponses(todayPrompt.id)
                    setQuestionResponses(responses)
                }
            }
        } catch (error) {
            console.error('Error loading daily prompt:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePollVote = async (optionId) => {
        if (!user || submitting || userResponse) return

        setSubmitting(true)
        try {
            const result = await submitResponse(prompt.id, user.id, { choice: optionId })

            if (result.success) {
                setUserResponse(result.data)
                // Cargar resultados
                const aggregated = await getAggregatedResults(prompt.id)
                setResults(aggregated)
            }
        } catch (error) {
            console.error('Error submitting vote:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleQuestionSubmit = async (e) => {
        e.preventDefault()
        if (!user || submitting || userResponse || !questionText.trim()) return

        setSubmitting(true)
        try {
            const result = await submitResponse(prompt.id, user.id, { text: questionText.trim() })

            if (result.success) {
                setUserResponse(result.data)
                // Cargar otras respuestas
                const responses = await getQuestionResponses(prompt.id)
                setQuestionResponses(responses)
                setQuestionText('')
            }
        } catch (error) {
            console.error('Error submitting answer:', error)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return null // O un skeleton loader
    }

    if (!prompt) {
        return null // No mostrar nada si no hay prompt
    }

    // POLL - ¿Cuál prefieres hoy?
    if (prompt.type === 'poll') {
        const options = prompt.options || []

        return (
            <div className="daily-prompt">
                <div className="daily-prompt-header">
                    <h3>
                        <img
                            src="/icons/videogame.png"
                            alt="Poll"
                            style={{ width: '28px', height: '28px', marginRight: '10px', verticalAlign: 'middle' }}
                        />
                        {prompt.content}
                    </h3>
                    <span className="daily-badge">
                        <img src="/icons/clock.png" alt="Time" style={{ width: '12px', height: '12px', marginRight: '4px', filter: 'brightness(0) invert(1)' }} />
                        Hoy
                    </span>
                </div>

                {!userResponse ? (
                    <div className="poll-options">
                        {options.map(option => (
                            <button
                                key={option.id}
                                className="poll-option"
                                onClick={() => handlePollVote(option.id)}
                                disabled={submitting}
                            >
                                {option.image && (
                                    <div className="poll-option-image">
                                        <img src={option.image} alt={option.label} />
                                    </div>
                                )}
                                <div className="poll-option-label">
                                    {option.label}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="poll-results">
                        <div className="results-header">
                            <span className="check-icon">✓</span>
                            <span>Ya votaste</span>
                        </div>

                        {results && (
                            <>
                                <div className="results-text">
                                    {formatResultsText(results, options)}
                                </div>

                                <div className="results-bars">
                                    {options.map(option => {
                                        const optionData = results.distribution[option.id]
                                        const percentage = optionData?.percentage || 0
                                        const isUserChoice = userResponse.answer.choice === option.id

                                        return (
                                            <div key={option.id} className={`result-bar ${isUserChoice ? 'user-choice' : ''}`}>
                                                <div className="result-label">
                                                    {option.label}
                                                    {isUserChoice && <span className="your-vote"> (tu voto)</span>}
                                                </div>
                                                <div className="result-bar-track">
                                                    <div
                                                        className="result-bar-fill"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                                <div className="result-percentage">{percentage}%</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // QUESTION - Pregunta diaria
    if (prompt.type === 'question') {
        return (
            <div className="daily-prompt daily-question">
                <div className="daily-prompt-header">
                    <h3>
                        <img
                            src="/icons/dialog.png"
                            alt="Question"
                            style={{ width: '28px', height: '28px', marginRight: '10px', verticalAlign: 'middle' }}
                        />
                        {prompt.content}
                    </h3>
                    <span className="daily-badge">
                        <img src="/icons/clock.png" alt="Time" style={{ width: '12px', height: '12px', marginRight: '4px', filter: 'brightness(0) invert(1)' }} />
                        Hoy
                    </span>
                </div>

                {!userResponse ? (
                    <form onSubmit={handleQuestionSubmit} className="question-form">
                        <textarea
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            maxLength={200}
                            disabled={submitting}
                            rows={3}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || !questionText.trim()}
                        >
                            {submitting ? 'Enviando...' : 'Responder'}
                        </button>
                    </form>
                ) : (
                    <div className="question-results">
                        <div className="results-header">
                            <span className="check-icon">✓</span>
                            <span>Respondiste: "{userResponse.answer.text}"</span>
                        </div>

                        {questionResponses.length > 0 && (
                            <div className="other-responses">
                                <h4>Otras respuestas</h4>
                                <div className="responses-list">
                                    {questionResponses.slice(0, 10).map((resp, idx) => (
                                        <div key={idx} className="response-item">
                                            <p>"{resp.text}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return null
}
