import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getTemplates, getRandomTemplatePreviewCovers } from '../../lib/listService';
import { useAuth } from '../../context/AuthContext';
import CreateTemplateModal from './CreateTemplateModal';
import './TemplateGallery.css';

const TYPE_LABELS = { tierlist: 'Tierlist', ranking: 'Ranking', grid: 'Grid' };
const MEDIA_LABELS = { game: 'Videojuegos', anime: 'Anime' };

export default function TemplateGallery() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState(null);
    const [filterMedia, setFilterMedia] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(searchParams.get('new') === '1');

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await getTemplates({ type: filterType, mediaType: filterMedia, query: searchQuery });
            const missingByMedia = data.reduce((counts, template) => {
                if (!template.default_items?.length && ['game', 'anime'].includes(template.media_type)) {
                    counts[template.media_type] = (counts[template.media_type] || 0) + 1;
                }
                return counts;
            }, {});
            const sampledCovers = Object.fromEntries(await Promise.all(
                Object.entries(missingByMedia).map(async ([mediaType, count]) => [
                    mediaType,
                    await getRandomTemplatePreviewCovers(mediaType, count * 5)
                ])
            ));
            const coverIndexes = { game: 0, anime: 0 };
            const templatesWithPreviews = data.map(template => {
                if (template.default_items?.length || !sampledCovers[template.media_type]?.length) return template;
                const covers = sampledCovers[template.media_type];
                const start = coverIndexes[template.media_type] || 0;
                const preview_covers = Array.from({ length: 5 }, (_, index) => covers[(start + index) % covers.length]);
                coverIndexes[template.media_type] = start + 5;
                return { ...template, preview_covers };
            });
            setTemplates(templatesWithPreviews);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const id = setTimeout(fetchTemplates, 300);
        return () => clearTimeout(id);
    }, [filterType, filterMedia, searchQuery]);

    const handleModalSuccess = (result) => {
        setShowModal(false);
        if (result?.id) navigate(`/templates/${result.id}`);
        else fetchTemplates();
    };

    return (
        <div className="tg-page">
            {/* Hero Header */}
            <div className="tg-hero">
                <div className="tg-hero-content">
                    <h1 className="tg-hero-title">Explora la Comunidad</h1>
                    <p className="tg-hero-desc">Descubre, usa y comparte las mejores plantillas creadas por la comunidad de Friki.</p>
                    {user ? (
                        <button className="tg-hero-btn" onClick={() => setShowModal(true)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            Crear Nueva Plantilla
                        </button>
                    ) : (
                        <p className="tg-hero-login-hint">Inicia sesión para crear tus propias plantillas</p>
                    )}
                </div>
                <div className="tg-hero-bg-glow"></div>
            </div>

            <div className="tg-container">
                {/* Controls Bar */}
                <div className="tg-controls-bar">
                    <div className="tg-search-box">
                        <svg className="tg-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        <input
                            type="text"
                            placeholder="Buscar por título o autor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="tg-filters">
                        <div className="tg-filter-group">
                            {[null, 'tierlist', 'ranking', 'grid'].map(t => (
                                <button key={String(t)} className={`tg-filter-btn ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
                                    {t === null ? 'Todos' : TYPE_LABELS[t]}
                                </button>
                            ))}
                        </div>
                        <div className="tg-filter-divider"></div>
                        <div className="tg-filter-group">
                            {[null, 'game', 'anime'].map(m => (
                                <button key={String(m)} className={`tg-filter-btn ${filterMedia === m ? 'active' : ''}`} onClick={() => setFilterMedia(m)}>
                                    {m === null ? 'Cualquiera' : MEDIA_LABELS[m]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="tg-grid">
                    {loading ? (
                        <div className="tg-state-box">
                            <div className="tg-spinner"></div>
                            <p>Cargando plantillas...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="tg-state-box">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                            <p>No hay plantillas que coincidan con tu búsqueda.</p>
                        </div>
                    ) : (
                        templates.map((tpl, i) => <TemplateCard key={tpl.id} tpl={tpl} index={i} />)
                    )}
                </div>
            </div>

            {showModal && <CreateTemplateModal onClose={() => setShowModal(false)} onSuccess={handleModalSuccess} />}
        </div>
    );
}

function TemplateCard({ tpl, index }) {
    const isAnonymous = !tpl.profiles?.username;
    
    // Determine which items to show
    let previewItems = [];
    if (tpl.default_items && tpl.default_items.length > 0) {
        previewItems = tpl.default_items.slice(0, 5).map(i => i.image_url || i.cover_url).filter(Boolean);
    } else {
        previewItems = tpl.preview_covers || [];
    }
    
    return (
        <div className="tg-card" style={{ animationDelay: `${index * 0.05}s` }}>
            <Link to={`/templates/${tpl.id}`} className="tg-card-link-overlay" aria-label="Ver plantilla"></Link>
            
            <div className={`tg-card-banner type-${tpl.list_type}`}>
                <div className="tg-card-tags">
                    <span className="tg-tag primary">{TYPE_LABELS[tpl.list_type]}</span>
                    {tpl.media_type && <span className="tg-tag">{MEDIA_LABELS[tpl.media_type]}</span>}
                </div>
                
                <div className="tg-card-preview-items">
                    {previewItems.map((url, idx) => (
                        <img key={idx} src={url} alt="Cover" className="tg-preview-img" loading="lazy" />
                    ))}
                </div>
            </div>

            <div className="tg-card-body">
                <h3 className="tg-card-title">{tpl.title}</h3>
                
                <div className="tg-card-footer">
                    <div className="tg-author-info">
                        {tpl.profiles?.avatar_url ? (
                            <img src={tpl.profiles.avatar_url} alt="" className="tg-author-avatar" />
                        ) : (
                            <div className="tg-author-avatar-fallback">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                        )}
                        <span className="tg-author-name">{isAnonymous ? 'Anónimo' : `@${tpl.profiles.username}`}</span>
                    </div>
                    
                    <div className="tg-uses-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
                        {tpl.uses_count || 0}
                    </div>
                </div>
            </div>
            
            <div className="tg-card-hover-actions">
                <Link to={`/templates/${tpl.id}`} className="tg-btn-quick-use">
                    Ver Detalles
                </Link>
            </div>
        </div>
    );
}
