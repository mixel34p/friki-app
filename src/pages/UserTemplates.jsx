import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserTemplates } from '../lib/listService'
import LoadingSpinner from '../components/LoadingSpinner'
import '../components/LibraryGrid.css'
import './UserReviews.css' // Reusing header styles

export default function UserTemplates() {
    const { username } = useParams()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)
    const [templates, setTemplates] = useState([])

    useEffect(() => {
        const fetchUserAndTemplates = async () => {
            if (!username) return
            setLoading(true)
            try {
                // Get profile ID from username
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .eq('username', username)
                    .single()
                
                if (userError || !userData) {
                    console.error('User not found')
                    setLoading(false)
                    return
                }
                setProfile(userData)

                const userTemplates = await getUserTemplates(userData.id)
                setTemplates(userTemplates)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        
        fetchUserAndTemplates()
    }, [username])

    if (loading) return <LoadingSpinner />

    return (
        <div className="page-container user-reviews-page">
            <div className="user-page-header">
                <div className="user-page-header-content">
                    <div className="user-page-title-row">
                        <Link to={`/profile/${username}`}>
                            <div 
                                className="user-page-avatar" 
                                style={{ backgroundImage: `url(${profile?.avatar_url || '/default-avatar.png'})` }}
                            ></div>
                        </Link>
                        <h2>
                            Plantillas de <Link to={`/profile/${username}`} className="user-link">@{username}</Link>
                        </h2>
                    </div>
                </div>
                <div className="user-page-stats">{templates.length} {templates.length === 1 ? 'plantilla' : 'plantillas'}</div>
            </div>

            <div className="reviews-list-container">
                {templates.length === 0 ? (
                    <div className="activity-empty">Este usuario no ha creado ninguna plantilla todavía.</div>
                ) : (
                    <div className="diary-entries" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {templates.map(t => (
                            <div key={t.id} className="diary-entry" style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                                <Link to={`/templates/${t.id}`} className="diary-entry-poster">
                                    <div className="diary-micro-poster" style={{ width: '45px', height: '65px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                        {t.list_type === 'tierlist' || !t.list_type ? <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> : null}
                                        {t.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                                        {t.list_type === 'grid' && <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                    </div>
                                </Link>
                                <div className="diary-entry-info" style={{ flex: 1 }}>
                                    <Link to={`/templates/${t.id}`} className="diary-entry-title" style={{ fontSize: '1.1rem', marginBottom: '4px' }}>
                                        {t.title}
                                    </Link>
                                    <div className="diary-entry-header" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                        <span>{t.uses_count || 0}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
