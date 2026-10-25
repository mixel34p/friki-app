import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserLists, deleteList } from '../lib/listService'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ListLikeButton from '../components/ListLikeButton'
import '../components/LibraryGrid.css'
import './UserReviews.css' // Reusing header styles

export default function UserTierlists() {
    const { username } = useParams()
    const { user, updateProfile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)
    const [lists, setLists] = useState([])
    const [openMenuId, setOpenMenuId] = useState(null)

    const isOwnProfile = user && profile && user.id === profile.id;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.review-menu-container')) {
                setOpenMenuId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleDelete = async (t) => {
        if (!window.confirm('¿Seguro que quieres eliminar esta tierlist?')) return;
        try {
            await deleteList(t.id)
            setLists(lists.filter(l => l.id !== t.id))
            setOpenMenuId(null)
            if (profile?.pinned_list_id === t.id) {
                await updateProfile({ pinned_list_id: null })
            }
        } catch (e) {
            alert('Error al eliminar la tierlist')
        }
    }

    const getCollageImages = (content) => {
        let images = [];
        if (!content) return images;
        
        const addImg = (item) => {
            if (!item) return;
            const img = item.image_url || item.cover_url || (item.cover && item.cover.url);
            if (img && !images.includes(img)) {
                images.push(img);
            }
        };

        if (Array.isArray(content)) {
            // Ranking format
            for (const item of content) {
                addImg(item);
                if (images.length === 4) return images;
            }
        } else {
            // Tierlist or Grid format
            const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F'];
            for (const key of priorities) {
                if (content[key]) {
                    if (Array.isArray(content[key])) {
                        for (const item of content[key]) {
                            addImg(item);
                            if (images.length === 4) return images;
                        }
                    } else {
                        addImg(content[key]);
                        if (images.length === 4) return images;
                    }
                }
            }
            for (const key in content) {
                if (!priorities.includes(key) && content[key]) {
                    if (Array.isArray(content[key])) {
                        for (const item of content[key]) {
                            addImg(item);
                            if (images.length === 4) return images;
                        }
                    } else {
                        addImg(content[key]);
                        if (images.length === 4) return images;
                    }
                }
            }
        }
        return images;
    }

    useEffect(() => {
        const fetchUserAndLists = async () => {
            if (!username) return
            setLoading(true)
            try {
                // Get profile ID from username
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, pinned_list_id')
                    .eq('username', username)
                    .single()
                
                if (userError || !userData) {
                    console.error('User not found')
                    setLoading(false)
                    return
                }
                setProfile(userData)

                let userLists = await getUserLists(userData.id)
                
                if (userData.pinned_list_id) {
                    const pinnedIdx = userLists.findIndex(l => l.id === userData.pinned_list_id);
                    if (pinnedIdx > -1) {
                        const pinnedList = userLists.splice(pinnedIdx, 1)[0];
                        pinnedList.isPinned = true;
                        userLists.unshift(pinnedList);
                    }
                }

                setLists(userLists)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        
        fetchUserAndLists()
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
                            Tierlists de <Link to={`/profile/${username}`} className="user-link">@{username}</Link>
                        </h2>
                    </div>
                </div>
                <div className="user-page-stats">{lists.length} {lists.length === 1 ? 'tierlist' : 'tierlists'}</div>
            </div>

            <div className="reviews-list-container">
                {lists.length === 0 ? (
                    <div className="activity-empty">Este usuario no ha creado ninguna tierlist todavía.</div>
                ) : (
                    <div className="reviews-list-stack">
                        {lists.map(t => {
                            const images = getCollageImages(t.content);

                            return (
                                <div key={t.id} className="review-card" style={{ gap: '1.5rem', paddingBottom: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
                                    {t.isPinned && !isOwnProfile && (
                                    <div className="review-pin-badge" title="Tierlist destacada">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                    </div>
                                )}
                                {isOwnProfile && (
                                    <div className="review-menu-container">
                                        {t.isPinned && (
                                            <div className="review-menu-pin-badge" title="Tierlist destacada">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                            </div>
                                        )}
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === t.id ? null : t.id) }}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex', alignItems: 'center' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                        </button>
                                        {openMenuId === t.id && (
                                            <div className="review-dropdown-menu">
                                                <button 
                                                    className="review-dropdown-btn"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        try {
                                                            await updateProfile({ pinned_list_id: t.isPinned ? null : t.id });
                                                            const newLists = [...lists];
                                                            const idx = newLists.findIndex(l => l.id === t.id);
                                                            if (idx > -1) {
                                                                if (t.isPinned) {
                                                                    newLists[idx].isPinned = false;
                                                                    setLists(newLists);
                                                                } else {
                                                                    newLists.forEach(l => l.isPinned = false);
                                                                    newLists[idx].isPinned = true;
                                                                    const p = newLists.splice(idx, 1)[0];
                                                                    newLists.unshift(p);
                                                                    setLists(newLists);
                                                                }
                                                            }
                                                            setProfile({...profile, pinned_list_id: t.isPinned ? null : t.id});
                                                            setOpenMenuId(null);
                                                        } catch (err) {
                                                            alert('Error al fijar');
                                                        }
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                                                    {t.isPinned ? "Quitar destacada" : "Fijar en perfil"}
                                                </button>
                                                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }}></div>
                                                <button 
                                                    className="review-dropdown-btn danger"
                                                    onClick={(e) => { e.preventDefault(); handleDelete(t); }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                    Eliminar tierlist
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                    <Link to={`/lists/${t.id}`} className="review-poster-link">
                                        {images.length > 0 ? (
                                            <div className="review-poster" style={{ 
                                                width: '90px',
                                                height: '135px',
                                                display: 'grid', 
                                                gridTemplateColumns: images.length > 1 ? '1fr 1fr' : '1fr',
                                                gridTemplateRows: images.length > 2 ? '1fr 1fr' : '1fr',
                                                gap: 0, 
                                                background: 'var(--bg-tertiary)',
                                                overflow: 'hidden'
                                            }}>
                                                {images.map((img, i) => (
                                                    <div key={i} style={{ 
                                                        backgroundImage: `url(${img})`, 
                                                        backgroundSize: 'cover', 
                                                        backgroundPosition: 'center',
                                                        width: '100%',
                                                        height: '100%',
                                                        gridColumn: images.length === 3 && i === 2 ? '1 / -1' : undefined
                                                    }} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="review-poster" style={{ width: '90px', height: '135px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin imagen</span>
                                            </div>
                                        )}
                                    </Link>
                                    <div className="review-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                                        <div className="review-header">
                                            <Link to={`/lists/${t.id}`} className="review-title" style={{ fontSize: '1.1rem' }}>
                                                {t.title}
                                            </Link>
                                        </div>
                                        <div className="review-metadata vl-post-tags-row" style={{ marginTop: '6px', marginBottom: '8px' }}>
                                            <div className="vl-post-tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {t.list_type && (
                                                    <span className={'vl-tag type-' + t.list_type}>
                                                        {t.list_type === 'tierlist' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                                                        {t.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                                                        {t.list_type === 'grid' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                                        {t.list_type === 'ranking' ? 'Ranking' : t.list_type === 'grid' ? 'Grid' : 'Tierlist'}
                                                    </span>
                                                )}
                                                {t.media_type && (
                                                    <span className={'vl-tag media-' + t.media_type}>
                                                        {t.media_type === 'game' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>}
                                                        {t.media_type === 'anime' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>}
                                                        {t.media_type === 'game' ? 'Videojuegos' : t.media_type === 'anime' ? 'Anime' : t.media_type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ListLikeButton listId={t.id} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
