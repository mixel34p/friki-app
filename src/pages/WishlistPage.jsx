import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import './UserReviews.css'
import './Library.css'

export default function WishlistPage() {
    const { username } = useParams()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single()
                
                if (error) throw error
                setProfile(data)
            } catch (err) {
                console.error('Error fetching profile:', err)
            } finally {
                setLoading(false)
            }
        }
        
        loadProfile()
    }, [username])

    if (loading) {
        return (
            <div className="wishlist-page flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="wishlist-page container">
                <h2>Usuario no encontrado</h2>
            </div>
        )
    }

    const wishlist = profile.wishlist || []

    return (
        <div className="page-container user-reviews-page wishlist-page">
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
                            Deseados de <Link to={`/profile/${username}`} className="user-link">@{username}</Link>
                        </h2>
                    </div>
                </div>
                <div className="user-page-stats">
                    {wishlist.length} {wishlist.length === 1 ? 'obra pendiente' : 'obras pendientes'}
                </div>
            </div>

            {wishlist.length === 0 ? (
                <div className="activity-empty">
                    Este usuario no tiene obras en su lista de deseados todavÃ­a.
                </div>
            ) : (
                <div className="covers-grid">
                    {wishlist.map(item => (
                        <div key={`${item.type}-${item.id}`} className="cover-cell">
                            <Link to={`/${item.type}/${item.id}`}>
                                <img src={item.image_url} alt={item.title} className="cover-img" loading="lazy" />
                                <div className="cover-overlay">
                                    <div className="cover-overlay-content">
                                        <h3 className="overlay-title">{item.title}</h3>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <span style={{ 
                                                fontSize: '0.7rem', 
                                                background: 'rgba(255,255,255,0.1)', 
                                                padding: '2px 6px', 
                                                borderRadius: '4px' 
                                            }}>
                                                {item.type === 'game' ? 'JUEGO' : 'ANIME'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}



