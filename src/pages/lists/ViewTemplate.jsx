import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deleteTemplate, getMoreListsByUser, getTemplateById } from '../../lib/listService';
import { getMorePostsByUser } from '../../lib/postService';
import { BADGES_MAP } from '../../lib/badges';
import { formatRelativeDate } from '../../lib/formatRelativeDate';
import MoreContentCards, { normalizeMoreContent } from '../../components/MoreContentCards';
import { ListPostPreview } from './ViewList';
import './ViewList.css';
import '../ReviewDetail.css';
import './ViewTemplate.css';

function Avatar({ profile, className = '' }) {
  const image = profile?.avatar_url;
  const name = profile?.display_name || profile?.username || 'Usuario';
  return (
    <span className={`review-detail-avatar ${className}`} style={{ '--review-author-theme': profile?.theme_color || 'var(--brand-primary)' }}>
      {image ? <img src={image} alt="" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function DotsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
}

export default function ViewTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const menuRef = useRef(null);
  const [template, setTemplate] = useState(null);
  const [moreItems, setMoreItems] = useState([]);
  const [morePostsLoading, setMorePostsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // The app's entrance animation applies a transform to .main, which makes
    // fixed ambient backgrounds behave as if they were clipped to that panel.
    const appMain = document.querySelector('.main');
    appMain?.classList.add('template-detail-layout');
    return () => appMain?.classList.remove('template-detail-layout');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTemplateById(id).then(async data => {
      if (cancelled) return;
      setTemplate(data);
      setLoading(false);
      setMorePostsLoading(true);
      Promise.allSettled([
        getMorePostsByUser(data.user_id, null, 5),
        getMoreListsByUser(data.user_id, null, 5),
      ]).then(([postsResult, listsResult]) => {
        if (cancelled) return;
        const posts = postsResult.status === 'fulfilled' ? postsResult.value : [];
        const lists = listsResult.status === 'fulfilled' ? listsResult.value : [];
        setMoreItems(normalizeMoreContent({ posts, lists, limit: 3 }));
        if (postsResult.status === 'rejected') console.error('No se pudieron cargar más posts del autor:', postsResult.reason);
        if (listsResult.status === 'rejected') console.error('No se pudieron cargar listas del autor:', listsResult.reason);
      }).finally(() => { if (!cancelled) setMorePostsLoading(false); });
    }).catch(err => {
      if (!cancelled) { setError(err.message || 'No se pudo cargar la plantilla.'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const closeEscape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [menuOpen]);

  const profile = template?.profiles || {};
  const username = profile.username || 'usuario';
  const displayName = profile.display_name || username;
  const isAuthor = Boolean(user && template?.user_id === user.id);
  const accent = profile.theme_color || 'var(--brand-primary)';
  const previewList = useMemo(() => template ? ({ ...template, content: {} }) : null, [template]);
  const backdrop = template?.default_items?.find(item => item?.image_url)?.image_url;
  const listType = template?.list_type === 'grid' ? 'Grid' : 'Tierlist';

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) return;
    try {
      await deleteTemplate(id);
      navigate('/templates');
    } catch (err) {
      window.alert(err.message || 'No se pudo eliminar la plantilla.');
    }
  };

  if (loading) return <main className="review-detail-page template-detail-page"><article className="review-post template-detail-state">Cargando plantilla…</article></main>;
  if (error || !template) return (
    <main className="review-detail-page template-detail-page">
      <article className="review-post template-detail-state">
        <p>{error || 'No se encontró esta plantilla.'}</p>
        <Link to="/templates" className="review-detail-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12"/></svg>Volver a plantillas</Link>
      </article>
    </main>
  );

  return (
    <main className="review-detail-page vl-list-page template-detail-page" style={{ '--review-page-accent': accent, '--vl-more-accent': accent, '--review-backdrop-image': backdrop ? `url("${backdrop}")` : 'none' }}>
      <article className="review-post template-detail-post">
        <div className="vl-topbar">
          <button type="button" className="review-detail-back vl-back-inline" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Volver
          </button>
          {isAuthor && <div className="vl-menu-wrap" ref={menuRef}>
            <button type="button" className="vl-dots-btn" aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><DotsIcon /></button>
            {menuOpen && <div className="vl-dropdown">
              <Link className="vl-dropdown-item" to={`/templates/${id}/edit`} onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>Editar plantilla
              </Link>
              <button type="button" className="vl-dropdown-item danger" onClick={handleDelete}>
                <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>Eliminar plantilla
              </button>
            </div>}
          </div>}
        </div>

        <header className="review-post-header vl-author-header">
          <Link to={`/profile/${username}`} className="review-post-author">
            <Avatar profile={profile} />
            <span className="review-post-author-copy">
              <strong>{displayName}{profile.featured_badge && BADGES_MAP[profile.featured_badge] && <span className="template-featured-badge" title={BADGES_MAP[profile.featured_badge].title} style={{ color: BADGES_MAP[profile.featured_badge].color }}>{BADGES_MAP[profile.featured_badge].icon}</span>}</strong>
              <span>@{username} · {formatRelativeDate(template.created_at)}</span>
            </span>
          </Link>
        </header>

        <ListPostPreview list={previewList} />

        {template.default_items?.length > 0 && <section className="template-defaults" aria-label="Elementos predefinidos">
          <div className="template-default-items">
            {template.default_items.map((item, index) => <div className="template-default-item" key={item.id || `${item.image_url || item.name}-${index}`} title={item.name || `Elemento ${index + 1}`}>
              <div className="template-default-art">
                {item?.image_url ? <img src={item.image_url} alt={item.name || ''} loading="lazy" /> : <span aria-hidden="true">{(item?.name || '?').slice(0, 1).toUpperCase()}</span>}
              </div>
              <span className="template-default-name">{item?.name || `Elemento ${index + 1}`}</span>
            </div>)}
          </div>
        </section>}

        <div className="review-post-actions template-detail-actions">
          <span className="template-detail-action-note">{template.uses_count || 0} usos · {listType}</span>
          <span className="review-post-action-spacer" />
          {user ? <Link to={`/lists/new?template=${template.id}`} className="template-use-button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Usar plantilla</Link>
            : <Link to="/login" className="template-use-button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Inicia sesión para usarla</Link>}
        </div>
      </article>

      <aside className="vl-more-author template-more-author">
        <div className="vl-more-panel">
          <Link to={`/profile/${username}`} className="vl-more-profile">
            <Avatar profile={profile} />
            <span><strong>Más de {displayName}</strong><small>@{username}</small></span>
          </Link>
          {morePostsLoading ? <p className="vl-more-state">Cargando publicaciones…</p>
            : moreItems.length ? <MoreContentCards items={moreItems} accent={accent} />
              : <p className="vl-more-state">Aún no hay más publicaciones.</p>}
        </div>
      </aside>
    </main>
  );
}
