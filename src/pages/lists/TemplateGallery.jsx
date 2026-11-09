import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getTemplates } from '../../lib/listService';
import { navigatePwaRoute } from '../../lib/pwaRouteTransition';
import { useAuth } from '../../context/AuthContext';
import CreateTemplateModal from './CreateTemplateModal';
import SEO from '../../components/SEO';
import DefaultAvatar from '../../components/DefaultAvatar';
import '../DiscoverWorks.css';
import '../Search.css';
import '../DiscoverLists.css';

const TYPE_LABELS = { tierlist: 'Tierlist', grid: 'Grid' };
const MEDIA_LABELS = { game: 'Juegos', anime: 'Anime' };

function templateImages(template) {
    const source = template.cover_items?.length ? template.cover_items : template.default_items || [];
    return source
        .map(item => typeof item === 'string' ? item : item?.image_url || item?.cover_url || item?.cover?.url)
        .filter(Boolean)
        .slice(0, 4);
}

function TemplateIcon({ type }) {
    if (type === 'grid') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
}

function TemplateCard({ template }) {
    const artwork = templateImages(template);
    const profile = template.profiles;
    const username = profile?.username;
    const typeLabel = TYPE_LABELS[template.list_type] || 'Tierlist';
    const mediaLabel = MEDIA_LABELS[template.media_type];

    return <article className="discover-list-card">
        <Link to={`/templates/${template.id}`} className="discover-list-card-link">
            <span className={`search-list-poster discover-list-poster${artwork.length === 3 ? ' count-three' : artwork.length === 2 ? ' count-two' : ''}`} aria-hidden="true">
                {artwork.length ? artwork.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" loading="lazy"/>) : <span className="discover-list-poster-fallback"><TemplateIcon type={template.list_type}/></span>}
            </span>
            <span className="discover-list-card-copy">
                <strong>{template.title || 'Plantilla sin título'}</strong>
                <span className="discover-list-author">
                    <span className="discover-list-author-avatar">
                        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy"/> : <DefaultAvatar accent={profile?.theme_color} />}
                    </span>
                    <span>{username ? `@${username}` : 'Anónimo'}</span>
                </span>
                <span className="search-list-tags">
                    <span className={`search-list-tag type-${template.list_type || 'tierlist'}`}>{typeLabel}</span>
                    {mediaLabel && <span className={`search-list-tag media-${template.media_type}`}>{mediaLabel}</span>}
                </span>
                <small className="discover-list-uses">{template.uses_count || 0} usos</small>
            </span>
        </Link>
    </article>;
}

function TemplateSkeletons() {
    return <div className="discover-list-grid" aria-label="Cargando plantillas">
        {Array.from({ length: 8 }, (_, index) => <div className="discover-list-skeleton" key={index}><span/><i/><b/><em/></div>)}
    </div>;
}

export default function TemplateGallery() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState(null);
    const [filterMedia, setFilterMedia] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(searchParams.get('new') === '1');

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTemplates({ type: filterType, mediaType: filterMedia, query: searchQuery });
            setTemplates(data);
        } catch (error) {
            console.error('Error fetching templates:', error);
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, [filterType, filterMedia, searchQuery]);

    useEffect(() => {
        const id = setTimeout(fetchTemplates, 260);
        return () => clearTimeout(id);
    }, [fetchTemplates]);

    const handleModalSuccess = result => {
        setShowModal(false);
        if (result?.id) navigatePwaRoute(navigate, `/templates/${result.id}`);
        else fetchTemplates();
    };

    return <main className="discover-works-page discover-lists-page template-gallery-page">
        <SEO title="Explorar plantillas" description="Descubre y usa plantillas creadas por la comunidad."/>
        <header className="discover-works-header discover-lists-header">
            <div className="discover-title-group"><h1>Plantillas</h1></div>
            <button type="button" className="discover-list-create" onClick={() => user ? setShowModal(true) : navigate('/register')} aria-label="Crear plantilla" title={user ? 'Crear plantilla' : 'Inicia sesión para crear una plantilla'}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
        </header>

        <div className="discover-list-controls template-gallery-controls">
            <div className="discover-list-filter-row">
                <div className="discover-genre-list" role="group" aria-label="Filtrar por formato">
                    {[null, 'tierlist', 'grid'].map(type => <button key={type || 'all'} type="button" className={`discover-chip${filterType === type ? ' active' : ''}`} aria-pressed={filterType === type} onClick={() => setFilterType(type)}>{type ? TYPE_LABELS[type] : 'Todos'}</button>)}
                </div>
                <div className="discover-genre-list media" role="group" aria-label="Filtrar por tipo de obra">
                    {[null, 'anime', 'game'].map(media => <button key={media || 'all'} type="button" className={`discover-chip${filterMedia === media ? ' active' : ''}`} aria-pressed={filterMedia === media} onClick={() => setFilterMedia(media)}>{media ? MEDIA_LABELS[media] : 'Cualquiera'}</button>)}
                </div>
                <div className="discover-list-filter-actions">
                    <label className="discover-list-search">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>
                        <input type="search" value={searchQuery} placeholder="Buscar plantillas..." aria-label="Buscar plantillas" onChange={event => setSearchQuery(event.target.value)}/>
                        {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Borrar búsqueda">×</button>}
                    </label>
                </div>
            </div>
        </div>

        <section className="discover-list-results" aria-live="polite">
            <div className="discover-grid-toolbar"><p>Plantillas de la comunidad</p></div>
            {loading ? <TemplateSkeletons/> : templates.length ? <div className="discover-list-grid">{templates.map(template => <TemplateCard key={template.id} template={template}/>)}</div> : <div className="discover-empty discover-list-no-results"><p>No hay plantillas que coincidan con tu búsqueda.</p></div>}
        </section>

        {showModal && <CreateTemplateModal onClose={() => setShowModal(false)} onSuccess={handleModalSuccess}/>}
    </main>;
}
