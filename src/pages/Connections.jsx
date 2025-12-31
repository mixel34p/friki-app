import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    getPendingRequests,
    getConnections,
    respondToRequest
} from '../lib/socialDiscoveryService'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import './Connections.css'

export default function Connections() {
    const { user } = useAuth()
    const [pendingRequests, setPendingRequests] = useState([])
    const [connections, setConnections] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('connections') // 'connections' | 'requests'

    useEffect(() => {
        if (user) {
            loadData()

            // Subscribe to new requests
            const channel = supabase
                .channel(`requests:${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'connection_requests',
                        filter: `target_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('New request!', payload)
                        loadData() // Reload to get full details
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [user])

    const loadData = async () => {
        try {
            setLoading(true)
            const [requests, conns] = await Promise.all([
                getPendingRequests(user.id),
                getConnections(user.id)
            ])
            setPendingRequests(requests)
            setConnections(conns)

            // Auto switch tab if requests exist and no connections
            if (requests.length > 0 && conns.length === 0) {
                setActiveTab('requests')
            }
        } catch (error) {
            console.error('Error loading connections:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRespond = async (requestId, accept) => {
        try {
            await respondToRequest(requestId, accept)

            // Update UI optimistically
            setPendingRequests(prev => prev.filter(r => r.id !== requestId))

            if (accept) {
                // Ideally reload connections to get the new one
                loadData()
            }
        } catch (error) {
            console.error('Error responding:', error)
            alert('Error al procesar la solicitud')
        }
    }

    if (loading) {
        return <div className="connections-loading"><LoadingSpinner /></div>
    }

    return (
        <div className="connections-page">
            <div className="container">
                <header className="connections-header">
                    <h1 className="page-title">Conexiones</h1>

                    <div className="tabs">
                        <button
                            className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
                            onClick={() => setActiveTab('connections')}
                        >
                            👥 Mis Conexiones ({connections.length})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            📬 Solicitudes
                            {pendingRequests.length > 0 && (
                                <span className="badge-count">{pendingRequests.length}</span>
                            )}
                        </button>
                    </div>
                </header>

                {activeTab === 'requests' && (
                    <div className="requests-list">
                        {pendingRequests.length === 0 ? (
                            <div className="empty-state">
                                <p>No tienes solicitudes pendientes.</p>
                                <Link to="/discover" className="btn btn-primary btn-sm">Descubrir personas</Link>
                            </div>
                        ) : (
                            pendingRequests.map(request => (
                                <div key={request.id} className="request-card">
                                    <div className="request-user-info">
                                        <div className="request-avatar">
                                            {request.requester.avatar_url ? (
                                                <img src={request.requester.avatar_url} alt="" />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {request.requester.display_name?.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="request-details">
                                            <h3>{request.requester.display_name}</h3>
                                            <div className="affinity-badge-small">
                                                {request.affinity_score}% Afinidad
                                            </div>
                                            {request.message && (
                                                <div className="request-message">
                                                    "{request.message}"
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Snapshot of common works */}
                                    {request.common_works_snapshot?.length > 0 && (
                                        <div className="request-common-works">
                                            <span>En común:</span>
                                            <div className="works-mini-list">
                                                {request.common_works_snapshot.slice(0, 3).map((w, i) => (
                                                    <span key={i} className="work-chip">{w.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="request-actions">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleRespond(request.id, false)}
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleRespond(request.id, true)}
                                        >
                                            Aceptar
                                        </button>
                                        <Link to={`/compare/${request.requester.user_id}`} className="btn btn-ghost btn-sm">
                                            Ver Perfil
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'connections' && (
                    <div className="connections-grid">
                        {connections.length === 0 ? (
                            <div className="empty-state">
                                <p>Aún no tienes conexiones.</p>
                                <p className="empty-subtitle">¡Busca personas con gustos similares en Descubrir!</p>
                                <Link to="/discover" className="btn btn-primary">Ir a Descubrir</Link>
                            </div>
                        ) : (
                            connections.map(conn => (
                                <Link key={conn.id} to={`/chat/${conn.id}`} className="connection-card">
                                    <div className="connection-avatar">
                                        {conn.otherUser?.avatar_url ? (
                                            <img src={conn.otherUser.avatar_url} alt="" />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                {conn.otherUser?.display_name?.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="connection-info">
                                        <h3>{conn.otherUser?.display_name}</h3>
                                        <span className="connection-status">@{conn.otherUser?.username}</span>
                                        <div className="connection-meta">
                                            <span className="affinity-text"><img src="/icons/star.png" alt="✨" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }} /> {conn.affinity_score}% Afinidad</span>
                                        </div>
                                    </div>
                                    <div className="connection-action">
                                        <img src="/icons/dialog.png" alt="💬" style={{ width: '20px', height: '20px', opacity: 0.7 }} />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
