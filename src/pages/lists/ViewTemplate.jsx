import useSystemBarColor from '../../hooks/useSystemBarColor'
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaFacebookF, FaRedditAlien, FaTelegram, FaWhatsapp, FaXTwitter } from 'react-icons/fa6';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deleteTemplate, getMoreListsByUser, getTemplateById } from '../../lib/listService';
import { getMorePostsByUser } from '../../lib/postService';
import { BADGES_MAP } from '../../lib/badges';
import DefaultAvatar from '../../components/DefaultAvatar';
import { formatRelativeDate } from '../../lib/formatRelativeDate';
import { navigateBackOrHome } from '../../lib/navigation';
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
      {image ? <img src={image} alt="" /> : <DefaultAvatar accent={profile?.theme_color} />}
    </span>
  );
}

function DotsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
}

export default function ViewTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isStandalonePwa = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  const [isExitingPwa, setIsExitingPwa] = useState(false);
  const handleBack = () => { if (!isStandalonePwa) return navigateBackOrHome(navigate); setIsExitingPwa(true); window.setTimeout(() => navigateBackOrHome(navigate), 280); };
  const { user, loading: authLoading } = useAuth();
  const menuRef = useRef(null);
  const [template, setTemplate] = useState(null);
  const systemBarColor = useSystemBarColor(template?.profiles?.theme_color)
  const [moreItems, setMoreItems] = useState([]);
  const [morePostsLoading, setMorePostsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

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
    if (!authLoading && !user && template?.id) {
      navigate('/lists/new?template=' + encodeURIComponent(template.id), { replace: true });
    }
  }, [authLoading, user, template?.id, navigate]);

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
  const shareUrl = template ? new URL(`/lists/new?template=${encodeURIComponent(template.id)}`, window.location.origin).toString() : '';
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareTitle = encodeURIComponent(template?.title || 'Crea tu lista con esta plantilla');
  const sharePreviewImages = (template?.cover_items?.length ? template.cover_items : template?.default_items || [])
    .map(item => typeof item === 'string' ? item : item?.image_url || item?.cover_url || item?.cover?.url)
    .filter(Boolean).slice(0, 3);

  const copyShareLink = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
      else {
        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (copyError) { console.error(copyError); }
  };

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

  if (loading) return isStandalonePwa ? null : <main className="review-detail-page template-detail-page"><article className="review-post template-detail-state">Cargando plantilla…</article></main>;
  if (error || !template) return (
    <main className="review-detail-page template-detail-page">
      <article className="review-post template-detail-state">
        <p>{error || 'No se encontró esta plantilla.'}</p>
        <Link to="/templates" className="review-detail-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12"/></svg>Volver a plantillas</Link>
      </article>
    </main>
  );

  return (
    <main className={`review-detail-page vl-list-page template-detail-page${isStandalonePwa ? ' pwa-detail-screen' : ''}${isExitingPwa ? ' is-exiting' : ''}`} style={{ '--pwa-system-bar-color': systemBarColor, '--review-page-accent': accent, '--vl-more-accent': accent, '--review-backdrop-image': backdrop ? `url("${backdrop}")` : 'none' }}>
      <article className="review-post template-detail-post">
        <div className="vl-topbar">
          <button type="button" className="review-detail-back vl-back-inline" onClick={handleBack}>
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
          <Link to={'/lists/new?template=' + encodeURIComponent(template.id)} className="review-post-action guest-make-list-action"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>{user ? 'Usar plantilla' : 'Hacer la mía'}</Link>
          <button type="button" className="review-post-action review-share-trigger" onClick={() => { setShareCopied(false); setShareOpen(true); }} aria-label="Compartir plantilla" title="Compartir plantilla">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg><span>Compartir</span>
          </button>
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

      {shareOpen && createPortal((
        <div className={`review-share-overlay${isStandalonePwa ? ' pwa-prompt-overlay' : ''}`} onClick={() => setShareOpen(false)}>
          <section className="review-share-dialog" style={{ '--review-page-accent': accent }} role="dialog" aria-modal="true" aria-labelledby="template-share-title" onClick={event => event.stopPropagation()}>
            <header className="review-share-heading">
              <div><span className="review-share-eyebrow">COMPARTIR PLANTILLA</span><h2 id="template-share-title">Que la vean los demás</h2></div>
              <button className="review-share-close" type="button" onClick={() => setShareOpen(false)} aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
            </header>
            <div className="review-share-preview" style={{ '--review-page-accent': accent }}>
              <div className={`review-share-preview-cover${sharePreviewImages.length > 1 ? ' vl-share-cover-fan' : ''}`}>
                {sharePreviewImages.length > 1 ? sharePreviewImages.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" className={`vl-fan-img-${index}`} />)
                  : sharePreviewImages.length === 1 ? <img src={sharePreviewImages[0]} alt="" />
                    : <div className="vl-share-cover-placeholder"><span>GS</span></div>}
              </div>
              <div className="review-share-preview-copy">
                <div className="review-share-preview-author"><Avatar profile={profile} className="small" /><span>{displayName}<small>@{username}</small></span></div>
                <strong>{template.title || 'Plantilla'}</strong><span>{listType} · {template.uses_count || 0} usos</span>
              </div>
            </div>
            <button className="review-share-link" type="button" onClick={copyShareLink} aria-label="Copiar enlace para crear una lista con esta plantilla">
              <span>{shareCopied ? 'ENLACE COPIADO' : 'ENLACE PARA USAR LA PLANTILLA'}</span><strong>{shareUrl}</strong><i>{shareCopied ? '✓' : '↗'}</i>
            </button>
            <div className="review-share-section-label">Compartir directamente</div>
            <div className="review-share-networks">
              <a className="whatsapp" href={`https://wa.me/?text=${encodedShareTitle}%20${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaWhatsapp /></b><span>WhatsApp</span></a>
              <a className="x-twitter" href={`https://twitter.com/intent/tweet?text=${encodedShareTitle}&url=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaXTwitter /></b><span>X</span></a>
              <a className="telegram" href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaTelegram /></b><span>Telegram</span></a>
              <a className="reddit" href={`https://www.reddit.com/submit?url=${encodedShareUrl}&title=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaRedditAlien /></b><span>Reddit</span></a>
              <a className="facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaFacebookF /></b><span>Facebook</span></a>
            </div>
          </section>
        </div>
      ), document.body)}
    </main>
  );
}
