import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import { BADGES_MAP } from '../lib/badges'
import './FollowsModal.css'

const IconClose = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

export default function FollowsModal({ isOpen, onClose, type, userId }) {
    const { user: currentUser } = useAuth()
    const [currentTab, setCurrentTab] = useState(type)
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [myFollowingIds, setMyFollowingIds] = useState(new Set())

    useEffect(() => {
        if (isOpen) {
            setCurrentTab(type)
            setSearchQuery('')
        }
    }, [isOpen, type])

    useEffect(() => {
        if (isOpen && userId) {
            loadUsers()
            loadMyFollows()
        }
    }, [isOpen, userId, currentTab])

    const loadMyFollows = async () => {
        if (!currentUser) return
        const { data } = await supabase.from('follows').select('following_id').eq('follower_id', currentUser.id)
        if (data) {
            setMyFollowingIds(new Set(data.map(d => d.following_id)))
        }
    }

    const loadUsers = async () => {
        setLoading(true)
        try {
            let ids = []
            if (currentTab === 'followers') {
                const { data } = await supabase.from('follows').select('follower_id').eq('following_id', userId)
                ids = data?.map(d => d.follower_id) || []
            } else {
                const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
                ids = data?.map(d => d.following_id) || []
            }

            if (ids.length === 0) {
                setUsers([])
                setLoading(false)
                return
            }

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url, bio, featured_badge')
                .in('id', ids)

            setUsers(profiles || [])
        } catch (error) {
            console.error('Error loading follows:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleFollow = async (e, targetUserId) => {
        e.preventDefault()
        e.stopPropagation()
        if (!currentUser) return

        const isFollowing = myFollowingIds.has(targetUserId)
        const newSet = new Set(myFollowingIds)

        if (isFollowing) {
            newSet.delete(targetUserId)
            setMyFollowingIds(newSet)
            await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId)
        } else {
            newSet.add(targetUserId)
            setMyFollowingIds(newSet)
            await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: targetUserId })
        }
    }

    if (!isOpen) return null

    const filteredUsers = users.filter(u => 
        u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="follows-modal-overlay" onClick={onClose}>
            <div className="follows-modal-card" onClick={e => e.stopPropagation()}>
                <div className="follows-modal-header">
                    <div className="follows-tabs">
                        <button 
                            className={`follows-tab ${currentTab === 'followers' ? 'active' : ''}`}
                            onClick={() => setCurrentTab('followers')}
                        >
                            Seguidores
                        </button>
                        <button 
                            className={`follows-tab ${currentTab === 'following' ? 'active' : ''}`}
                            onClick={() => setCurrentTab('following')}
                        >
                            Siguiendo
                        </button>
                    </div>
                    <button className="follows-close-btn" onClick={onClose}>
                        <IconClose />
                    </button>
                </div>

                <div className="follows-search-wrap">
                    <input
                        type="text"
                        className="follows-search-input"
                        placeholder="Buscar personas..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="follows-list-body">
                    {loading ? (
                        <div className="follows-loading">
                            <LoadingSpinner />
                            <p>Cargando usuarios...</p>
                        </div>
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map(u => {
                            const isMe = currentUser?.id === u.id
                            const isFollowing = myFollowingIds.has(u.id)

                            return (
                                <Link 
                                    key={u.id} 
                                    to={`/profile/${u.username}`} 
                                    className="follows-user-row"
                                    onClick={onClose}
                                >
                                    <div className="follows-user-info">
                                        {u.avatar_url ? (
                                            <img src={u.avatar_url} alt="" className="follows-user-avatar" />
                                        ) : (
                                            <div className="follows-user-placeholder">
                                                {u.display_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div className="follows-user-text">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="follows-user-name">{u.display_name}</span>
                                                {u.featured_badge && BADGES_MAP[u.featured_badge] && (
                                                    <div style={{ color: BADGES_MAP[u.featured_badge].color, display: 'flex', alignItems: 'center' }} title={BADGES_MAP[u.featured_badge].title}>
                                                        {BADGES_MAP[u.featured_badge].icon}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="follows-user-username">@{u.username}</span>
                                        </div>
                                    </div>
                                    
                                    {!isMe && (
                                        <button 
                                            className={isFollowing ? 'follows-btn-unfollow' : 'follows-btn-follow'}
                                            onClick={(e) => handleToggleFollow(e, u.id)}
                                        >
                                            {isFollowing ? 'Siguiendo' : 'Seguir'}
                                        </button>
                                    )}
                                </Link>
                            )
                        })
                    ) : (
                        <div className="follows-empty">
                            {searchQuery 
                                ? 'No se encontraron usuarios que coincidan con tu búsqueda.' 
                                : currentTab === 'followers' 
                                    ? 'Aún no tiene seguidores.' 
                                    : 'Aún no sigue a nadie.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
