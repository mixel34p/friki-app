import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    compareProfiles,
    sendConnectionRequest,
    isConnectedWith,
    canSendRequest,
    isBlocked
} from '../lib/socialDiscoveryService'
import LoadingSpinner from '../components/LoadingSpinner'
import './CompareProfiles.css'

const TIER_COLORS = {
    S: '#ff7f7f',
    A: '#ffbf7f',
    B: '#ffff7f',
    C: '#7fff7f',
    D: '#7fbfff',
    F: '#bf7fff'
}

export default function CompareProfiles() {
    const { userId } = useParams()
    const { user, profile: myProfile } = useAuth()
    const navigate = useNavigate()

    const [comparison, setComparison] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [connectionStatus, setConnectionStatus] = useState(null) // null, 'connected', 'blocked', 'can_request'
    const [requestsRemaining, setRequestsRemaining] = useState(0)
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [requestMessage, setRequestMessage] = useState('')
    const [sending, setSending] = useState(false)

    useEffect(() => {
        if (userId && user) {
            loadComparison()
        }
    }, [userId, user])

    const loadComparison = async () => {
        try {
            setLoading(true)
            setError(null)

            // Check blocks first
            const blocked = await isBlocked(user.id, userId)
            if (blocked) {
                setConnectionStatus('blocked')
                setLoading(false)
                return
            }

            // Check connection status
            const connected = await isConnectedWith(user.id, userId)
            if (connected) {
                setConnectionStatus('connected')
            } else {
                const { canSend, remaining } = await canSendRequest(user.id)
                setConnectionStatus('can_request')
                setRequestsRemaining(remaining)
            }

            // Load comparison data
            const data = await compareProfiles(user.id, userId)
            setComparison(data)
        } catch (err) {
            console.error('Error loading comparison:', err)
            setError('No se pudo cargar la comparación')
        } finally {
            setLoading(false)
        }
    }

    const handleSendRequest = async () => {
        try {
            setSending(true)
            await sendConnectionRequest(user.id, userId, requestMessage || null)
            setShowRequestModal(false)
            setConnectionStatus('request_sent')
        } catch (err) {
            alert(err.message || 'Error al enviar solicitud')
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return (
            <div className="compare-profiles-loading">
                <LoadingSpinner />
                <p>Comparando perfiles...</p>
            </div>
        )
    }

    if (connectionStatus === 'blocked') {
        return (
            <div className="compare-profiles-error">
                <h2>🚫 Perfil no disponible</h2>
                <p>No puedes ver esta comparación.</p>
                <Link to="/discover" className="btn btn-primary">Volver a Descubrir</Link>
            </div>
        )
    }

    if (error || !comparison) {
        return (
            <div className="compare-profiles-error">
                <h2>😕 Error</h2>
                <p>{error || 'No se encontró el perfil'}</p>
                <Link to="/discover" className="btn btn-primary">Volver</Link>
            </div>
        )
    }

    const { profile1, profile2, affinity, matches, commonWorks, tierlists1, tierlists2 } = comparison

    return (
        <div className="compare-profiles">
            <div className="container">
                {/* Header with both users */}
                <div className="compare-header">
                    <div className="compare-user">
                        {profile1?.avatar_url ? (
                            <img src={profile1.avatar_url} alt="" className="compare-avatar" />
                        ) : (
                            <div className="compare-avatar-placeholder">
                                {profile1?.display_name?.charAt(0) || 'T'}
                            </div>
                        )}
                        <span className="compare-name">Tú</span>
                    </div>

                    <div className={`affinity-display affinity-${affinity >= 70 ? 'high' : affinity >= 40 ? 'medium' : 'low'}`}>
                        <div className="affinity-circle">
                            <span className="affinity-value">{affinity}%</span>
                        </div>
                        <span className="affinity-label">Afinidad</span>
                    </div>

                    <div className="compare-user">
                        {profile2?.avatar_url ? (
                            <img src={profile2.avatar_url} alt="" className="compare-avatar" />
                        ) : (
                            <div className="compare-avatar-placeholder">
                                {profile2?.display_name?.charAt(0) || '?'}
                            </div>
                        )}
                        <Link to={`/profile/${profile2?.username}`} className="compare-name">
                            {profile2?.display_name}
                        </Link>
                    </div>
                </div>

                {/* Connection actions */}
                <div className="compare-actions">
                    {connectionStatus === 'connected' && (
                        <Link to="/connections" className="btn btn-success">
                            <img src="/icons/check.png" alt="✅" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '8px' }} /> Conectados - Ir al chat
                        </Link>
                    )}
                    {connectionStatus === 'can_request' && (
                        <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
                            <img src="/icons/wishlist.png" alt="🤝" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginRight: '6px' }} /> Conectar por gustos
                        </button>
                    )}
                    {connectionStatus === 'request_sent' && (
                        <button className="btn btn-secondary" disabled>
                            📨 Solicitud enviada
                        </button>
                    )}
                </div>

                {/* Matches Section */}
                {matches.length > 0 && (
                    <section className="compare-section">
                        <h2><img src="/icons/star.png" alt="✨" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Coincidencias</h2>
                        <div className="matches-grid">
                            {matches.map((match, i) => (
                                <div key={i} className="match-chip">
                                    <span className="match-icon">{match.icon === '🎮' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '20px', height: '20px' }} /> : match.icon}</span>
                                    <span className="match-value">{match.value}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Common Works Section */}
                {commonWorks.length > 0 && (
                    <section className="compare-section">
                        <h2>🎮 Obras en común (Tierlists)</h2>
                        <div className="common-works-grid">
                            {commonWorks.map((work, i) => (
                                <div key={i} className={`common-work-card ${work.sameTier ? 'same-tier' : ''}`}>
                                    {work.image_url && (
                                        <img src={work.image_url} alt="" className="work-image" />
                                    )}
                                    <div className="work-info">
                                        <span className="work-name">{work.name}</span>
                                        <div className="work-tiers">
                                            <span className="tier-badge" style={{ background: TIER_COLORS[work.tier1] }}>
                                                Tú: {work.tier1}
                                            </span>
                                            <span className="tier-badge" style={{ background: TIER_COLORS[work.tier2] }}>
                                                {profile2?.display_name?.split(' ')[0]}: {work.tier2}
                                            </span>
                                        </div>
                                        {work.sameTier && <span className="same-tier-badge"><img src="/icons/recom.png" alt="🎯" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} /> Mismo tier!</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Common Library Section */}
                {comparison?.commonLibrary?.length > 0 && (
                    <section className="compare-section">
                        <h2>🎮 Juegos compartidos ({comparison.commonLibrary.length})</h2>
                        <div className="common-works-grid">
                            {comparison.commonLibrary.map((num, i) => (
                                <div key={i} className="common-work-card lib-card">
                                    {num.image_url && (
                                        <img src={num.image_url} alt="" className="work-image" />
                                    )}
                                    <div className="work-info">
                                        <span className="work-name">{num.title || num.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Common Anime Library Section */}
                {comparison?.commonAnimeLibrary?.length > 0 && (
                    <section className="compare-section">
                        <h2><img src="/icons/anime.png" alt="📺" style={{ width: '24px', height: '24px', verticalAlign: '-3px', marginRight: '8px' }} /> Animes compartidos ({comparison.commonAnimeLibrary.length})</h2>
                        <div className="common-works-grid">
                            {comparison.commonAnimeLibrary.map((anime, i) => (
                                <div key={i} className="common-work-card lib-card anime-card">
                                    {anime.image_url && (
                                        <img src={anime.image_url} alt="" className="work-image" />
                                    )}
                                    <div className="work-info">
                                        <span className="work-name">{anime.title || anime.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Common Anime Tags Section */}
                {comparison?.commonAnimeTags?.length > 0 && (
                    <section className="compare-section">
                        <h2>🏷️ Tags de anime en común</h2>
                        <div className="matches-grid">
                            {comparison.commonAnimeTags.map((tag, i) => (
                                <div key={i} className="match-chip">
                                    <span className="match-icon"><img src="/icons/anime.png" alt="📺" style={{ width: '20px', height: '20px' }} /></span>
                                    <span className="match-value">{tag}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                <section className="compare-section tierlists-comparison">
                    <h2><img src="/icons/tierlist.png" alt="📊" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '8px' }} /> Tierlists</h2>
                    <div className="tierlists-side-by-side">
                        <div className="tierlists-column">
                            <h3>Tus Tierlists ({tierlists1.length})</h3>
                            {tierlists1.slice(0, 5).map(t => (
                                <Link key={t.id} to={`/tierlist/${t.id}`} className="tierlist-mini-card">
                                    <span className="tierlist-emoji">{t.media_type === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px' }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px' }} />}</span>
                                    <span className="tierlist-title">{t.title}</span>
                                </Link>
                            ))}
                        </div>
                        <div className="tierlists-column">
                            <h3>{profile2?.display_name}'s Tierlists ({tierlists2.length})</h3>
                            {tierlists2.slice(0, 5).map(t => (
                                <Link key={t.id} to={`/tierlist/${t.id}`} className="tierlist-mini-card">
                                    <span className="tierlist-emoji">{t.media_type === 'anime' ? <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px' }} /> : <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px' }} />}</span>
                                    <span className="tierlist-title">{t.title}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Request Modal */}
                {showRequestModal && (
                    <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                        <div className="modal-content request-modal" onClick={e => e.stopPropagation()}>
                            <h2><img src="/icons/wishlist.png" alt="🤝" style={{ width: '20px', height: '20px', verticalAlign: 'middle', marginRight: '8px' }} /> Conectar con {profile2?.display_name}</h2>

                            {commonWorks.length > 0 && (
                                <div className="modal-common-works">
                                    <p>Tenéis {commonWorks.length} obras en común:</p>
                                    <div className="modal-works-preview">
                                        {commonWorks.slice(0, 3).map((w, i) => (
                                            <span key={i} className="work-preview-chip">{w.name}</span>
                                        ))}
                                        {commonWorks.length > 3 && <span className="work-preview-more">+{commonWorks.length - 3} más</span>}
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Mensaje opcional (máx. 200 caracteres)</label>
                                <textarea
                                    value={requestMessage}
                                    onChange={e => setRequestMessage(e.target.value.slice(0, 200))}
                                    placeholder="¡Ey! Vi que también te gusta..."
                                    rows={3}
                                />
                                <span className="char-count">{requestMessage.length}/200</span>
                            </div>

                            <div className="modal-info">
                                <p>📬 Te quedan <strong>{requestsRemaining}</strong> solicitudes hoy</p>
                                <p className="info-subtle">Si {profile2?.display_name} acepta, podréis chatear.</p>
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSendRequest}
                                    disabled={sending}
                                >
                                    {sending ? 'Enviando...' : 'Enviar solicitud'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
