import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTemplateById, deleteTemplate } from '../../lib/listService';
import { BADGES_MAP } from '../../lib/badges';
import { getTierLabelFontSize } from '../../lib/tierLabel';
import './ViewList.css';
import '../lists/CreateList.css'; // Same styling as ViewList for structure

export default function ViewTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTemplateById(id)
      .then(data => { setTemplate(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('¿Estás seguro de eliminar esta plantilla?')) {
      try {
        await deleteTemplate(id);
        navigate('/templates');
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) return <div className="vl-page" style={{ justifyContent: 'center' }}>Cargando...</div>;
  if (error) return (
      <div className="vl-page" style={{ justifyContent: 'center' }}>
          <div className="vl-error-state">
              <h2>Error: {error}</h2>
              <Link to="/templates" className="btn btn-secondary btn-sm">Volver</Link>
          </div>
      </div>
  );
  if (!template) return (
      <div className="vl-page" style={{ justifyContent: 'center' }}>
          <div className="vl-error-state">
              <h2>Plantilla no encontrada</h2>
              <Link to="/templates" className="btn btn-secondary btn-sm">Volver</Link>
          </div>
      </div>
  );

  const isAuthor = user && template.user_id === user.id;
  const authorUsername = template.profiles?.username || 'Usuario';
  const authorDisplayName = template.profiles?.display_name || authorUsername;
  const authorAvatar = template.profiles?.avatar_url || '/default-avatar.png';
  const authorBadge = template.profiles?.featured_badge;
  const authorThemeColor = template.profiles?.theme_color || 'var(--brand-primary)';
  const date = new Date(template.created_at);
  const diffMs = new Date() - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const timeDisplay = diffDays < 1
    ? diffHours > 0
      ? `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
      : diffMins > 0
        ? `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`
        : 'hace unos segundos'
    : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const columns = template.type_config?.columns || 2;

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
                <img src={authorAvatar} alt={authorUsername} className="vl-post-avatar" style={{ borderColor: authorThemeColor }} />
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
                {isAuthor && (
                    <>
                        <Link to={`/templates/${id}/edit`} className="vl-icon-btn" title="Editar">
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
        {/* Content Info */}
        <div className="vl-post-body">
            <div className="vl-post-title-row">
                <h1 className="vl-post-title">{template.title}</h1>
                <div className="vl-post-engagement-top">
                    <span className="vl-tag" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        {template.uses_count || 0} usos
                    </span>
                </div>
            </div>

            {template.description && <p className="vl-post-desc" style={{marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5'}}>{template.description}</p>}
            
            <div className="vl-post-tags-row">
                <div className="vl-post-tags">
                    {template.list_type && (
                        <span className={'vl-tag type-' + template.list_type}>
                            {template.list_type === 'tierlist' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                            {template.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                            {template.list_type === 'grid' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                            {template.list_type === 'ranking' ? 'Ranking' : template.list_type === 'grid' ? 'Grid' : 'Tierlist'}
                        </span>
                    )}
                    {template.media_type && (
                        <span className={'vl-tag media-' + template.media_type}>
                            {template.media_type === 'game' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>}
                            {template.media_type === 'anime' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>}
                            {template.media_type === 'game' ? 'Videojuegos' : template.media_type === 'anime' ? 'Anime' : template.media_type}
                        </span>
                    )}
                </div>
                {user ? (
                    <Link to={`/lists/new?template=${template.id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Usar
                    </Link>
                ) : (
                    <button className="btn btn-primary" onClick={() => alert('Inicia sesión para usar esta plantilla')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Usar
                    </button>
                )}
            </div>

            {/* Default Items (If any) */}
            {template.default_items && template.default_items.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Ítems incluidos ({template.default_items.length})</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {template.default_items.map((item, i) => (
                            <img key={i} src={item.image_url} alt={item.name} title={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-subtle)' }} />
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Main Visual Wrapper for Preview */}
        <div className="vl-post-visual-wrapper" style={{ borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
            {template.list_type === 'tierlist' && (
                <div className="cl-tierlist">
                    {template.type_config?.tiers?.map(tier => (
                        <div key={tier.id} className="cl-tier-row">
                            <div className="cl-tier-label" style={{ backgroundColor: tier.color, color: '#000' }}>
                                <span className="cl-tier-text" style={{ fontSize: getTierLabelFontSize(tier.label) }}>{tier.label}</span>
                            </div>
                            <div className="cl-tier-drop" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
                                {/* Empty Tier */}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {template.list_type === 'ranking' && (
                <div className="cl-ranking-stack">
                    {Array.from({ length: template.type_config?.max_items || 10 }).map((_, i) => (
                        <div key={i} className={`cl-ranking-row top-${i}`}>
                            <div className="cl-ranking-badge">{i + 1}</div>
                            <div className="cl-ranking-slot">
                                <div className="cl-ranking-item cl-ranking-item-placeholder">
                                    <span className="cl-ranking-cover-placeholder" aria-hidden="true" />
                                    <span className="cl-ranking-name-view">Posición {i + 1}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {template.list_type === 'grid' && (
                <div className="cl-grid-cells" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: `${columns * 120}px`, margin: '0 auto', justifyContent: 'center' }}>
                    {template.type_config?.cells?.map((cell, i) => (
                        <div key={i} className="cl-grid-cell">
                            <div className="cl-grid-drop-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.8rem' }}>Vacío</span>
                            </div>
                            <div className="cl-grid-label">{cell.label}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
