import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getListById, deleteList, getListLikesCount, checkUserListLike, toggleListLike } from '../../lib/listService';
import { BADGES_MAP } from '../../lib/badges';
import './ViewList.css';
import '../lists/CreateList.css'; // MANTENER ESTILOS IDÉNTICOS AL EDITOR

const TYPE_LABELS  = { tierlist: 'Tierlist', ranking: 'Ranking', grid: 'Grid' };
const MEDIA_LABELS = { game: 'Juegos', anime: 'Anime' };

function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 1) {
        if (diffHours > 0) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
        if (diffMins > 0) return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
        return 'hace unos segundos';
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ViewList() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, profile, updateProfile } = useAuth();

    const [list, setList]       = useState(null);
    const [likes, setLikes]     = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        getListById(id)
            .then(data => { setList(data); setLoading(false); })
            .catch(err  => { setError(err.message); setLoading(false); });

        getListLikesCount(id).then(setLikes).catch(console.error);
        if (user) {
            checkUserListLike(id, user.id).then(setIsLiked).catch(console.error);
        }
    }, [id, user]);

    const handleLike = async () => {
        if (!user) { alert('Inicia sesión para dar me gusta'); return; }
        try {
            const nowLiked = !isLiked;
            setIsLiked(nowLiked);
            setLikes(l => nowLiked ? l + 1 : l - 1);
            await toggleListLike(id, user.id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Estás seguro de eliminar esta lista?')) return;
        try {
            await deleteList(id);
            navigate('/profile');
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return (
        <div className="vl-loading">
            <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 8 }} />
        </div>
    );

    if (error) return (
        <div className="vl-error-state">
            <h2>Algo salió mal</h2>
            <p>{error}</p>
            <Link to="/" className="btn btn-secondary btn-sm">Volver al inicio</Link>
        </div>
    );

    if (!list) return (
        <div className="vl-error-state">
            <h2>Lista no encontrada</h2>
            <Link to="/" className="btn btn-secondary btn-sm">Volver al inicio</Link>
        </div>
    );

    const isAuthorCheck = user && list.user_id === user.id;
    const timeDisplay = getRelativeTime(list.created_at);

    const authorUsername = list.author?.username || 'Usuario';
    const authorDisplayName = list.author?.display_name || authorUsername;
    const authorAvatar = list.author?.avatar_url || '/default-avatar.png';
    const authorBadge = list.author?.featured_badge;

    return (
        <div className="vl-page">
            <div className="vl-nav-top">
                <button onClick={() => navigate(-1)} className="vl-back-btn">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    <span>Volver atrás</span>
                </button>
            </div>

            <div className="vl-post-card">
                
                {/* Header (Author & Meta) */}
                <div className="vl-post-header">
                    <Link to={`/profile/${authorUsername}`} className="vl-post-author">
                        <img src={authorAvatar} alt={authorUsername} className="vl-post-avatar" />
                        <div className="vl-post-author-info">
                            <div className="vl-post-author-name-row">
                                <span className="vl-post-displayname">{authorDisplayName}</span>
                                {authorBadge && BADGES_MAP[authorBadge] && (
                                    <span style={{ color: BADGES_MAP[authorBadge].color, display: 'inline-flex', alignItems: 'center', width: '16px', height: '16px' }} title={BADGES_MAP[authorBadge].title}>
                                        {BADGES_MAP[authorBadge].icon}
                                    </span>
                                )}
                            </div>
                            <div className="vl-post-author-handle-row">
                                <span className="vl-post-username">@{authorUsername}</span>
                                <span className="vl-post-dot">•</span>
                                <span className="vl-post-date">{timeDisplay}</span>
                            </div>
                        </div>
                    </Link>
                    
                    <div className="vl-post-actions-top">
                        {isAuthorCheck && (
                            <>
                                <Link to={`/lists/${list.id}/edit`} className="vl-icon-btn" title="Editar">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </Link>
                                <button onClick={handleDelete} className="vl-icon-btn vl-icon-btn-danger" title="Eliminar">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content Info */}
                <div className="vl-post-body">
                    <div className="vl-post-title-row">
                        <h1 className="vl-post-title">{list.title}</h1>
                        <div className="vl-post-engagement-top">
                            <button className={`vl-like-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span>{likes}</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="vl-post-tags-row">
                        <div className="vl-post-tags">
                            {list.list_type && (
                                <span className={'vl-tag type-' + list.list_type}>
                                    {list.list_type === 'tierlist' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                                    {list.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                                    {list.list_type === 'grid' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                    {TYPE_LABELS[list.list_type] || list.list_type}
                                </span>
                            )}
                            {list.media_type && (
                                <span className={'vl-tag media-' + list.media_type}>
                                    {list.media_type === 'game' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>}
                                    {list.media_type === 'anime' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>}
                                    {MEDIA_LABELS[list.media_type] || list.media_type}
                                </span>
                            )}
                        </div>
                        {list.template_id && (
                            <div className="vl-post-template-ref">
                                <Link to={`/templates/${list.template_id}`}>Ver plantilla</Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Visual */}
                <div className="vl-post-visual-wrapper">
                    <div className="vl-post-visual">
                        {list.list_type === 'tierlist' && <TierlistView list={list} />}
                        {list.list_type === 'ranking' && <RankingView list={list} />}
                        {list.list_type === 'grid' && <GridView list={list} />}
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── Tierlist View ───────────────────────────────────────────────────────────
function TierlistView({ list }) {
    const tiers = list.type_config?.tiers || [];
    
    // Exact match of CreateList tier structure
    return (
        <div className="cl-tierlist">
            {tiers.map(tier => {
                const items = list.content[tier.id] || [];
                return (
                    <div key={tier.id} className="cl-tier-row">
                        <div className="cl-tier-label" style={{ backgroundColor: tier.color, color: '#000' }}>
                            {tier.label}
                        </div>
                        <div className="cl-tier-drop" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
                            {items.map((item, idx) => (
                                <ItemCard key={item.id || idx} item={item} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Ranking View ────────────────────────────────────────────────────────────
function RankingView({ list }) {
    const items = list.content || [];
    const maxItems = list.type_config?.max_items || 10;
    
    // Fill array up to maxItems
    const fullSlots = Array.from({ length: maxItems }).map((_, i) => ({
        item: items['r' + i] || (Array.isArray(items) ? items[i] : null), 
        rank: i + 1 
    }));
    
    // Exact match of CreateList ranking structure
    return (
        <div className="cl-ranking-stack">
            {fullSlots.map(({ item, rank }, i) => (
                <div key={rank} className={`cl-ranking-row top-${i}`}>
                    <div className="cl-ranking-badge">{rank}</div>
                    <div className="cl-ranking-slot">
                        {item && <ItemCard item={item} hideName={true} />}
                        {item && <span className="cl-ranking-name-view">{item.name}</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Grid View ───────────────────────────────────────────────────────────────
function GridView({ list }) {
    const cells = list.type_config?.cells || [];
    const columns = list.type_config?.columns || 2;
    
    // Exact match of CreateList grid structure
    return (
        <div className="cl-grid-cells" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: `${columns * 120}px`, margin: '0 auto', justifyContent: 'center' }}>
            {cells.map((cell, i) => {
                const item = list.content['c' + i];
                return (
                    <div key={i} className="cl-grid-cell">
                        <div className="cl-grid-drop-wrapper">
                            {item && <ItemCard item={item} hideName={true} />}
                        </div>
                        <div className="cl-grid-label">{cell.label}</div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Helper Item Card ────────────────────────────────────────────────────────
function ItemCard({ item, hideName }) {
    const imgUrl = item.image_url || item.cover_url || item.cover?.url;
    return (
        <div className="cl-item">
            {imgUrl && <img src={imgUrl} alt={item.name} />}
            {!hideName && (
                <div className="cl-item-overlay">
                    <span className="cl-item-name">{item.name}</span>
                </div>
            )}
        </div>
    );
}
