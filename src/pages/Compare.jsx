import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import './Compare.css'

export default function Compare() {
    const { userId } = useParams()
    const { user, profile: myProfile } = useAuth()
    const [otherProfile, setOtherProfile] = useState(null)
    const [affinity, setAffinity] = useState(0)
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchComparisonData()
    }, [userId])

    const fetchComparisonData = async () => {
        try {
            const { data: other } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            setOtherProfile(other)
            calculateAffinity(myProfile, other)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateAffinity = (me, other) => {
        if (!me || !other) return

        const matchList = []
        let score = 0, maxScore = 0

        // Genre matches
        const myGenres = me.favorite_genres || []
        const otherGenres = other.favorite_genres || []
        const genreMatches = myGenres.filter(g => otherGenres.includes(g))
        genreMatches.forEach(g => matchList.push({ type: 'genre', value: g }))
        score += genreMatches.length * 15
        maxScore += Math.max(myGenres.length, otherGenres.length) * 15

        // Platform matches
        const myPlatforms = me.platforms || []
        const otherPlatforms = other.platforms || []
        const platformMatches = myPlatforms.filter(p => otherPlatforms.includes(p))
        platformMatches.forEach(p => matchList.push({ type: 'platform', value: p }))
        score += platformMatches.length * 10
        maxScore += Math.max(myPlatforms.length, otherPlatforms.length) * 10

        // Era match
        if (me.favorite_era === other.favorite_era) {
            matchList.push({ type: 'era', value: me.favorite_era })
            score += 20
        }
        maxScore += 20

        setMatches(matchList)
        setAffinity(maxScore > 0 ? Math.round((score / maxScore) * 100) : 0)
    }

    if (loading) {
        return <div className="compare-loading"><LoadingSpinner /></div>
    }

    if (!otherProfile) {
        return <div className="compare-error"><h2>Usuario no encontrado</h2></div>
    }

    return (
        <div className="compare">
            <div className="container container-sm">
                <h1 className="page-title">🔀 Comparar Gustos</h1>

                <div className="compare-users">
                    <div className="compare-user">
                        <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${myProfile?.color_primary}, ${myProfile?.color_secondary})` }}>
                            {myProfile?.display_name?.charAt(0) || '?'}
                        </div>
                        <span className="user-name">Tú</span>
                    </div>
                    <div className={`affinity-circle affinity-${affinity >= 70 ? 'high' : affinity >= 40 ? 'medium' : 'low'}`}>
                        <span className="affinity-value">{affinity}%</span>
                        <span className="affinity-label">Afinidad</span>
                    </div>
                    <div className="compare-user">
                        <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${otherProfile.color_primary}, ${otherProfile.color_secondary})` }}>
                            {otherProfile.display_name?.charAt(0) || '?'}
                        </div>
                        <span className="user-name">{otherProfile.display_name}</span>
                    </div>
                </div>

                <div className="matches-section">
                    <h2><img src="/icons/check.png" alt="✅" style={{ width: '22px', height: '22px', verticalAlign: 'middle', marginRight: '8px' }} /> Coincidencias</h2>
                    {matches.length === 0 ? (
                        <p className="no-matches">No hay coincidencias directas, ¡pero eso no significa que no tengan de qué hablar!</p>
                    ) : (
                        <div className="matches-list">
                            {matches.map((m, i) => (
                                <div key={i} className="match-item">
                                    <span className="match-icon">
                                        {m.type === 'genre' && <img src="/icons/videogame.png" alt="🎮" style={{ width: '20px', height: '20px' }} />}
                                        {m.type === 'platform' && '🖥️'}
                                        {m.type === 'era' && '⏰'}
                                    </span>
                                    <span className="match-value">{m.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="compare-actions">
                    <Link to={`/profile/${otherProfile.username}`} className="btn btn-primary">
                        Ver perfil completo
                    </Link>
                </div>
            </div>
        </div>
    )
}
