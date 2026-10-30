import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    DndContext, DragOverlay, pointerWithin,
    PointerSensor, useSensor, useSensors, useDroppable
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, rectSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getTemplateById, createList, updateList, getListById, incrementTemplateUses } from '../../lib/listService';
import { searchGames } from '../../lib/gameService';
import { searchAnime } from '../../lib/animeService';
import { getTierLabelFontSize } from '../../lib/tierLabel';
import './CreateList.css';

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconBack = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
);
const IconSearch = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
);
const IconPlus = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconCheck = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const IconGlobe = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);
const IconLock = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);
const IconSave = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);
const IconEdit = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);
const IconTemplate = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="9" y1="10" x2="9" y2="22" />
    </svg>
);
const IconX = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);
const IconChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const IconChevronLeft = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CreateList() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const templateId = searchParams.get('template');
    const fromListId = searchParams.get('fromList');
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const [template, setTemplate] = useState(null);
    const [listType, setListType] = useState('tierlist');
    const [mediaType, setMediaType] = useState('game');
    const [title, setTitle] = useState('');
    const [typeConfig, setTypeConfig] = useState({});
    const [pool, setPool] = useState([]);
    const [content, setContent] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [customName, setCustomName] = useState('');
    const [customImageUrl, setCustomImageUrl] = useState('');

    const [activeItem, setActiveItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [visibility, setVisibility] = useState('public');
    const [activeTab, setActiveTab] = useState('search');
    const [modalTarget, setModalTarget] = useState(null);
    const [defaultTitleSet, setDefaultTitleSet] = useState(false);

    // Sidebar colapsable y edición de título inline
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    // UI states
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');

    useEffect(() => {
        if (isMobileSearchOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileSearchOpen]);

    useEffect(() => {
        if (id) return;
        if (templateId) {
            if (template && profile && !defaultTitleSet) {
                setTitle(`${template.title} (${profile.display_name || profile.username || 'Usuario'})`);
                setDefaultTitleSet(true);
            }
        } else if (fromListId) {
            // Handled when list loads
        } else {
            if (profile && !defaultTitleSet) {
                setTitle(`Nueva Lista (${profile.display_name || profile.username || 'Usuario'})`);
                setDefaultTitleSet(true);
            }
        }
    }, [id, templateId, fromListId, template, profile, defaultTitleSet]);

    // ── Load template or existing list ──
    useEffect(() => {
        if (templateId) {
            getTemplateById(templateId).then(data => {
                setTemplate(data);
                setListType(data.list_type);
                setMediaType(data.media_type);
                setTypeConfig(data.type_config);
                let initialContent = {};
                if (data.list_type === 'tierlist') {
                    data.type_config.tiers.forEach(t => (initialContent[t.id] = []));
                } else if (data.list_type === 'ranking') {
                    for (let i = 0; i < data.type_config.max_items; i++) initialContent[`r${i}`] = [];
                } else if (data.list_type === 'grid') {
                    data.type_config.cells.forEach((_, i) => (initialContent[`c${i}`] = []));
                }
                setContent(initialContent);
                setPool(data.default_items || []);
            }).catch(err => setError(err.message));
        } else if (fromListId) {
            getListById(fromListId).then(data => {
                if (data.template_id) {
                    getTemplateById(data.template_id).then(t => setTemplate(t));
                }
                setListType(data.list_type);
                setMediaType(data.media_type);
                setTypeConfig(data.type_config);
                let initialContent = {};
                if (data.list_type === 'tierlist') {
                    (data.type_config?.tiers || []).forEach(t => (initialContent[t.id] = []));
                } else if (data.list_type === 'ranking') {
                    const max = data.type_config?.max_items || 10;
                    for (let i = 0; i < max; i++) initialContent[`r${i}`] = [];
                } else if (data.list_type === 'grid') {
                    (data.type_config?.cells || []).forEach((_, i) => (initialContent[`c${i}`] = []));
                }
                setContent(initialContent);

                // Recopilamos todos los ítems de la lista para ponerlos en el pool de la nueva lista
                const allItems = [];
                if (data.content) {
                    if (Array.isArray(data.content)) {
                        allItems.push(...data.content.filter(Boolean));
                    } else if (typeof data.content === 'object') {
                        Object.values(data.content).forEach(val => {
                            if (Array.isArray(val)) allItems.push(...val.filter(Boolean));
                            else if (val) allItems.push(val);
                        });
                    }
                }
                if (Array.isArray(data.pool)) {
                    allItems.push(...data.pool.filter(Boolean));
                }
                const seen = new Set();
                const uniquePool = allItems.filter(item => {
                    const k = item.id || item.name;
                    if (!k || seen.has(k)) return false;
                    seen.add(k);
                    return true;
                });
                setPool(uniquePool);
                if (profile) {
                    setTitle(`${data.title} (${profile.display_name || profile.username || 'Usuario'})`);
                    setDefaultTitleSet(true);
                }
            }).catch(err => setError(err.message));
        } else if (id) {
            getListById(id).then(data => {
                setTitle(data.title);
                setListType(data.list_type);
                setMediaType(data.media_type);
                setTypeConfig(data.type_config);
                let loadedContent = data.content;
                if (data.list_type === 'ranking') {
                    loadedContent = {};
                    data.content.forEach((item, i) => { loadedContent[`r${i}`] = item ? [item] : []; });
                } else if (data.list_type === 'grid') {
                    loadedContent = {};
                    data.type_config.cells.forEach((_, i) => {
                        loadedContent[`c${i}`] = data.content[`c${i}`] ? [data.content[`c${i}`]] : [];
                    });
                }
                setContent(loadedContent);
                setVisibility(data.visibility || 'public');
                setPool(data.pool || []);
                if (data.template_id) {
                    getTemplateById(data.template_id).then(t => setTemplate(t));
                }
            }).catch(err => setError(err.message));
        }
    }, [templateId, fromListId, id, profile]);

    // ── Search ──
    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); return; }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = mediaType === 'game'
                    ? await searchGames(searchQuery)
                    : await searchAnime(searchQuery);
                setSearchResults(results);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery, mediaType]);

    const handleAddToPool = useCallback((item) => {
        const itemId = String(item.id);
        const newItem = { id: itemId, name: item.name, image_url: item.image_url || item.cover_url || item.cover?.url };
        setPool(prev => {
            if (prev.find(i => i.id === itemId)) return prev;
            return [...prev, newItem];
        });
    }, []);

    const handleModalItemSelect = useCallback((item) => {
        const itemId = String(item.id);
        const newItem = { id: itemId, name: item.name, image_url: item.image_url || item.cover_url || item.cover?.url };
        if (modalTarget === 'pool') {
            setPool(prev => {
                if (prev.find(i => i.id === itemId)) return prev;
                return [...prev, newItem];
            });
        } else if (modalTarget && modalTarget.startsWith('c')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
            setPool(prev => {
                if (prev.find(i => i.id === itemId)) return prev;
                return [...prev, newItem];
            });
        }
        setModalTarget(null);
    }, [modalTarget]);

    const handleAddCustom = () => {
        if (!customName || !customImageUrl) return;
        const newItem = { id: `custom_${Date.now()}`, name: customName, image_url: customImageUrl };
        if (modalTarget === 'pool') {
            setPool(prev => [...prev, newItem]);
        } else if (modalTarget && modalTarget.startsWith('c')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
            setPool(prev => [...prev, newItem]);
        }
        setCustomName('');
        setCustomImageUrl('');
        setModalTarget(null);
    };

    // ─── DnD ──────────────────────────────────────────────────────────────────
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragStart = useCallback((event) => {
        const { active } = event;
        const item = pool.find(i => i.id === active.id)
            || Object.values(content).flat().find(i => i?.id === active.id);
        setActiveItem(item || { id: active.id });
    }, [pool, content]);

    const handleDragEnd = useCallback((event) => {
        setActiveItem(null);
        const { active, over } = event;
        if (!over) return;
        const sourceContainer = active.data.current?.sortable?.containerId || 'pool';
        const targetContainer = over.data.current?.sortable?.containerId || over.id;
        if (sourceContainer === targetContainer) return;

        if (listType !== 'tierlist' && targetContainer !== 'pool' && content[targetContainer]?.length >= 1) {
            const existingItem = content[targetContainer][0];
            const draggedItem = sourceContainer === 'pool'
                ? pool.find(i => i.id === active.id)
                : content[sourceContainer]?.find(i => i.id === active.id);
            if (!draggedItem) return;
            setPool(prev => {
                let newPool = prev;
                if (sourceContainer === 'pool') newPool = newPool.filter(i => i.id !== active.id);
                return [...newPool, existingItem];
            });
            setContent(prev => ({
                ...prev,
                ...(sourceContainer !== 'pool' && { [sourceContainer]: prev[sourceContainer].filter(i => i.id !== active.id) }),
                [targetContainer]: [draggedItem]
            }));
            return;
        }

        if (sourceContainer === 'pool') {
            const item = pool.find(i => i.id === active.id);
            if (!item) return;
            setPool(prev => prev.filter(i => i.id !== active.id));
            setContent(prev => ({ ...prev, [targetContainer]: [...(prev[targetContainer] || []), item] }));
        } else if (targetContainer === 'pool') {
            const item = content[sourceContainer]?.find(i => i.id === active.id);
            if (!item) return;
            setContent(prev => ({ ...prev, [sourceContainer]: prev[sourceContainer].filter(i => i.id !== active.id) }));
            setPool(prev => [...prev, item]);
        } else {
            const item = content[sourceContainer]?.find(i => i.id === active.id);
            if (!item) return;
            setContent(prev => ({
                ...prev,
                [sourceContainer]: prev[sourceContainer].filter(i => i.id !== active.id),
                [targetContainer]: [...(prev[targetContainer] || []), item]
            }));
        }
    }, [pool, content, listType]);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!title.trim()) { alert('Ponle un título a la lista'); return; }
        setSaving(true);
        try {
            let dbContent = content;
            if (listType === 'ranking') {
                dbContent = Array.from({ length: typeConfig.max_items }).map((_, i) => (content[`r${i}`] && content[`r${i}`][0]) || null);
            } else if (listType === 'grid') {
                dbContent = {};
                typeConfig.cells.forEach((_, i) => {
                    dbContent[`c${i}`] = (content[`c${i}`] && content[`c${i}`][0]) || null;
                });
            }
            const payload = {
                title: title.trim(),
                list_type: listType,
                media_type: mediaType,
                type_config: typeConfig,
                content: dbContent,
                visibility,
                template_id: template?.id,
                user_id: user?.id
            };
            let savedList;
            if (id) {
                savedList = await updateList(id, payload);
            } else {
                savedList = await createList(payload);
                if (template?.id) await incrementTemplateUses(template.id);
            }
            navigate(`/lists/${savedList.id}`);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const totalItems = pool.length + (content ? Object.values(content).flat().filter(Boolean).length : 0);

    if (error) return <div className="cl-loading">Error: {error}</div>;
    if (!content) return (
        <div className="cl-loading">
            <div className="cl-loading-spinner" />
            <span>Cargando plantilla...</span>
        </div>
    );

    const isGrid = listType === 'grid';

    return (
        <div className="cl-page">

            {/* ══════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════ */}
            <header className="cl-header">
                <div className="cl-header-left">
                    <Link to="/lists" className="cl-back-btn" title="Volver a listas">
                        <IconBack />
                    </Link>

                    <div className="cl-title-area">
                        {editingTitle ? (
                            <input
                                className="cl-title-input"
                                type="text"
                                autoFocus
                                placeholder="Título de la lista..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                onBlur={() => setEditingTitle(false)}
                                onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
                                maxLength={80}
                            />
                        ) : (
                            <button
                                className="cl-title-display"
                                onClick={() => setEditingTitle(true)}
                                title="Editar título"
                            >
                                <span className="cl-title-text">{title || 'Sin título'}</span>
                                <span className="cl-title-pencil"><IconEdit /></span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="cl-header-right">
                    <button className="cl-publish-btn" onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <div className="cl-save-spinner" style={{borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff'}} />
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <span>{id ? 'Guardar cambios' : 'Publicar'}</span>
                        )}
                    </button>
                </div>
            </header>

            {/* ══════════════════════════════════════════
                WORKSPACE
            ══════════════════════════════════════════ */}
            <div className={`cl-workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

                {/* EDITOR */}
                <main className="cl-editor">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {/* TIERLIST */}
                        {listType === 'tierlist' && (
                            <div className="cl-tierlist">
                                {typeConfig.tiers?.map(tier => (
                                    <TierRow key={tier.id} tier={tier} items={content[tier.id] || []} />
                                ))}
                            </div>
                        )}

                        {/* RANKING */}
                        {listType === 'ranking' && (
                            <div className="cl-ranking-stack">
                                {Array.from({ length: typeConfig.max_items || 10 }).map((_, i) => (
                                    <div key={i} className={`cl-ranking-row top-${i}`}>
                                        <div className="cl-ranking-badge">{i + 1}</div>
                                        <div className="cl-ranking-slot">
                                            <DropZone id={`r${i}`} items={content[`r${i}`] || []} isRanking />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* GRID */}
                        {isGrid && (
                            <div 
                                className="cl-grid-cells"
                                style={{ gridTemplateColumns: `repeat(${typeConfig.columns || 2}, minmax(0, 1fr))`, maxWidth: `${(typeConfig.columns || 2) * 120}px` }}
                            >
                                {typeConfig.cells?.map((cell, i) => (
                                    <div key={i} className="cl-grid-cell">
                                        <div className="cl-grid-drop-wrapper">
                                            <DropZone id={`c${i}`} items={content[`c${i}`] || []} />
                                        </div>
                                        <div className="cl-grid-label">{cell.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* POOL */}
                        <div className="cl-pool-section">
                            <div className="cl-pool-separator"></div>
                            <div className="cl-pool-header">
                                <span className="cl-pool-title">Biblioteca</span>
                                <span className="cl-pool-count">{pool.length}</span>
                            </div>
                                <div className="cl-mobile-pool-actions">
                                    <button
                                        className="cl-pool-add-btn"
                                        onClick={() => {
                                            setIsMobileSearchOpen(true);
                                            setSidebarCollapsed(false);
                                        }}
                                    >
                                        <IconPlus />
                                        <span>Añadir a la lista</span>
                                    </button>
                                </div>
                                <DropZone 
                                    id="pool" 
                                    items={pool} 
                                    isPool 
                                    onRemoveItem={(id) => setPool(prev => prev.filter(i => i.id !== id))} 
                                />
                            </div>

                        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                            {activeItem ? (
                                <div className="cl-drag-ghost">
                                    {activeItem.image_url
                                        ? <img src={activeItem.image_url} alt="" onError={e => e.target.style.display = 'none'} />
                                        : <div className="cl-drag-ghost-fallback" />
                                    }
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </main>

                {/* SIDEBAR */}
                <>
                    <div className={`cl-mobile-backdrop ${isMobileSearchOpen ? 'is-open' : ''}`} onClick={() => setIsMobileSearchOpen(false)}></div>
                    <aside className={`cl-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${isMobileSearchOpen ? 'mobile-open' : ''}`}>
                        <div className="cl-sidebar-handle" onClick={() => setIsMobileSearchOpen(false)}></div>

                        {sidebarCollapsed && !isMobileSearchOpen && (
                            <button
                                className="cl-sidebar-rail-btn"
                                onClick={() => setSidebarCollapsed(false)}
                                title="Añadir elementos"
                            >
                                <IconPlus />
                                <span className="cl-sidebar-rail-label">Añadir</span>
                            </button>
                        )}

                        {(!sidebarCollapsed || isMobileSearchOpen) && (
                            <div className="cl-sidebar-inner">
                                <div className="cl-sidebar-header">
                                    <div className="cl-sidebar-title-group">
                                        <h3 className="cl-sidebar-title">Añadir elementos</h3>
                                    </div>
                                    <button
                                        className="cl-sidebar-close-btn"
                                        onClick={() => {
                                            setSidebarCollapsed(true);
                                            setIsMobileSearchOpen(false);
                                        }}
                                        title="Cerrar panel"
                                    >
                                        <span className="cl-sidebar-close-desktop"><IconChevronRight /></span>
                                        <span className="cl-sidebar-close-mobile"><IconX /></span>
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="cl-sidebar-tabs">
                                    <button
                                        className={`cl-sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('search')}
                                    >
                                        <IconSearch />
                                        <span>Buscar</span>
                                    </button>
                                    <button
                                        className={`cl-sidebar-tab ${activeTab === 'custom' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('custom')}
                                    >
                                        <IconPlus />
                                        <span>Personalizado</span>
                                    </button>
                                </div>

                                {/* Search tab */}
                                {activeTab === 'search' && (
                                    <>
                                        <div className="cl-search-wrap">
                                            <span className="cl-search-icon"><IconSearch /></span>
                                            <input
                                                className="cl-search-input"
                                                type="text"
                                                placeholder={mediaType === 'game' ? 'Buscar juegos (Zelda, Elden Ring...)' : 'Buscar anime (One Piece, Naruto...)'}
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                            {searchQuery && (
                                                <button
                                                    className="cl-search-clear"
                                                    onClick={() => setSearchQuery('')}
                                                    type="button"
                                                    title="Limpiar búsqueda"
                                                >
                                                    <IconX />
                                                </button>
                                            )}
                                            {isSearching && <div className="cl-search-spinner" />}
                                        </div>

                                        <div className="cl-results">
                                            {!isSearching && searchQuery.length < 2 && (
                                                <div className="cl-results-empty">
                                                    <div className="cl-results-empty-icon-wrap">
                                                        <IconSearch />
                                                    </div>
                                                    <p>Busca tus favoritos</p>
                                                    <small>Escribe al menos 2 letras para buscar</small>
                                                </div>
                                            )}
                                            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                                                <div className="cl-results-empty">
                                                    <div className="cl-results-empty-icon-wrap">
                                                        <IconX />
                                                    </div>
                                                    <p>Sin resultados</p>
                                                    <small>Prueba con otro título o revisa la ortografía</small>
                                                </div>
                                            )}
                                            {!isSearching && searchResults.map(item => {
                                                const imgUrl = item.image_url || item.cover_url || item.cover?.url;
                                                const isAdded = pool.some(p => p.id === String(item.id));
                                                return (
                                                    <button
                                                        key={item.id}
                                                        className={`cl-result-item ${isAdded ? 'is-added' : ''}`}
                                                        onClick={() => !isAdded && handleAddToPool(item)}
                                                        disabled={isAdded}
                                                        title={item.name}
                                                    >
                                                        <div className="cl-result-thumb">
                                                            {imgUrl
                                                                ? <img src={imgUrl} alt="" onError={e => e.target.style.display = 'none'} />
                                                                : <div className="cl-result-fallback"><IconSearch /></div>
                                                            }
                                                        </div>
                                                        <div className="cl-result-info">
                                                            <span className="cl-result-name">{item.name}</span>
                                                            <div className="cl-result-meta">
                                                                {item.release_date && (
                                                                    <span className="cl-result-year">{item.release_date.substring(0, 4)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={`cl-result-btn ${isAdded ? 'added' : ''}`}>
                                                            {isAdded ? <IconCheck /> : <IconPlus />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* Custom tab */}
                                {activeTab === 'custom' && (
                                    <div className="cl-custom-form">
                                        <div className="cl-custom-field">
                                            <label className="cl-custom-label">Título o Nombre</label>
                                            <input
                                                className="cl-custom-input"
                                                type="text"
                                                placeholder="Ej: Bloodborne, Evangelion..."
                                                value={customName}
                                                onChange={e => setCustomName(e.target.value)}
                                            />
                                        </div>
                                        <div className="cl-custom-field">
                                            <label className="cl-custom-label">URL de la carátula</label>
                                            <input
                                                className="cl-custom-input"
                                                type="url"
                                                placeholder="https://ejemplo.com/portada.jpg"
                                                value={customImageUrl}
                                                onChange={e => setCustomImageUrl(e.target.value)}
                                            />
                                        </div>
                                        {customImageUrl && (
                                            <div className="cl-custom-preview-card">
                                                <div className="cl-custom-preview">
                                                    <img src={customImageUrl} alt="Preview" onError={e => e.target.style.display = 'none'} />
                                                </div>
                                                <span className="cl-custom-preview-name">{customName || 'Vista previa'}</span>
                                            </div>
                                        )}
                                        <button
                                            className="cl-custom-add-btn"
                                            onClick={() => {
                                                if (!customName || !customImageUrl) return;
                                                const newItem = { id: `custom_${Date.now()}`, name: customName, image_url: customImageUrl };
                                                setPool(prev => [...prev, newItem]);
                                                setCustomName('');
                                                setCustomImageUrl('');
                                            }}
                                            disabled={!customName || !customImageUrl}
                                        >
                                            <IconPlus />
                                            <span>Añadir a la biblioteca</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </aside>
                </>
            </div>

            {/* ══════════════════════════════════════════
                MODAL (grid)
            ══════════════════════════════════════════ */}
            {modalTarget && (
                <div className="cl-modal-overlay" onClick={() => setModalTarget(null)}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>{modalTarget === 'pool' ? 'Añadir a la pool' : 'Seleccionar elemento'}</h3>
                            <button className="cl-modal-close" onClick={() => setModalTarget(null)}>
                                <IconX />
                            </button>
                        </div>

                        <div className="cl-modal-tabs">
                            {modalTarget !== 'pool' && pool.length > 0 && (
                                <button className={`cl-modal-tab ${activeTab === 'pool' ? 'active' : ''}`} onClick={() => setActiveTab('pool')}>
                                    Pool
                                </button>
                            )}
                            <button className={`cl-modal-tab ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
                                Buscar
                            </button>
                            <button className={`cl-modal-tab ${activeTab === 'custom' ? 'active' : ''}`} onClick={() => setActiveTab('custom')}>
                                Personalizado
                            </button>
                        </div>

                        <div className="cl-modal-body">
                            {activeTab === 'pool' && (
                                <div className="cl-modal-grid">
                                    {pool.map(item => (
                                        <button key={item.id} className="cl-modal-grid-item" onClick={() => handleModalItemSelect(item)}>
                                            {item.image_url
                                                ? <img src={item.image_url} alt={item.name} onError={e => e.target.style.display = 'none'} />
                                                : <div className="cl-result-fallback">{item.name}</div>
                                            }
                                            <div className="cl-modal-item-overlay">
                                                <span>{item.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'search' && (
                                <>
                                    <div className="cl-search-wrap">
                                        <span className="cl-search-icon"><IconSearch /></span>
                                        <input
                                            className="cl-search-input"
                                            type="text"
                                            placeholder={`Buscar ${mediaType === 'game' ? 'juegos' : 'anime'}...`}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        {isSearching && <div className="cl-search-spinner" />}
                                    </div>
                                    <div className="cl-results modal-results">
                                        {!isSearching && searchQuery.length < 2 && (
                                            <p className="cl-search-hint">Escribe al menos 2 caracteres para buscar.</p>
                                        )}
                                        {!isSearching && searchResults.map(item => {
                                            const imgUrl = item.cover?.url || item.image_url;
                                            return (
                                                <button
                                                    key={item.id}
                                                    className="cl-result-item"
                                                    onClick={() => handleModalItemSelect(item)}
                                                    title={item.name}
                                                >
                                                    <div className="cl-result-thumb">
                                                        {imgUrl ? <img src={imgUrl} alt="" onError={e => e.target.style.display = 'none'} /> : <div className="cl-result-fallback" />}
                                                    </div>
                                                    <div className="cl-result-info">
                                                        <span className="cl-result-name">{item.name}</span>
                                                        {item.release_date && (
                                                            <span className="cl-result-year">{item.release_date.substring(0, 4)}</span>
                                                        )}
                                                    </div>
                                                    <div className="cl-result-btn">
                                                        <IconPlus />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {activeTab === 'custom' && (
                                <div className="cl-custom-form">
                                    <label className="cl-custom-label">Nombre</label>
                                    <input
                                        className="cl-custom-input"
                                        type="text"
                                        placeholder="Nombre del item"
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                    />
                                    <label className="cl-custom-label">URL de imagen</label>
                                    <input
                                        className="cl-custom-input"
                                        type="url"
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                        value={customImageUrl}
                                        onChange={e => setCustomImageUrl(e.target.value)}
                                    />
                                    <button className="cl-custom-add-btn" onClick={handleAddCustom} disabled={!customName || !customImageUrl}>
                                        <IconPlus />
                                        Añadir
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tier Row ─────────────────────────────────────────────────────────────────
function TierRow({ tier, items }) {
    return (
        <div className="cl-tier-row">
            <div className="cl-tier-label" style={{ backgroundColor: tier.color }}>
                <span className="cl-tier-text" style={{ fontSize: getTierLabelFontSize(tier.label) }}>{tier.label}</span>
            </div>
            <DropZone id={tier.id} items={items} />
        </div>
    );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ id, items, isPool, onRemoveItem, isRanking = false }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`cl-tier-drop ${isOver ? 'is-over' : ''} ${isPool ? 'is-pool' : ''} ${isRanking ? 'is-ranking' : ''}`}
        >
            <SortableContext id={id} items={items.map(i => i.id)} strategy={rectSortingStrategy}>
                {items.map(item => (
                    <SortableItem key={item.id} item={item} isRanking={isRanking} onRemove={onRemoveItem ? () => onRemoveItem(item.id) : null} />
                ))}
            </SortableContext>
            {items.length === 0 && isPool && (
                <span className="cl-drop-hint">
                    Los elementos añadidos aparecen aquí
                </span>
            )}
        </div>
    );
}

// ─── Sortable Item ────────────────────────────────────────────────────────────
function SortableItem({ item, onRemove, isRanking = false }) {
    const {
        attributes, listeners, setNodeRef,
        transform, transition, isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`cl-item ${isRanking ? 'cl-item-ranking' : ''}`}
            title={item.name}
        >
            {onRemove && (
                <button 
                    className="cl-item-remove" 
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <IconX />
                </button>
            )}
            {item.image_url
                ? <img src={item.image_url} alt={item.name} onError={e => e.target.style.display = 'none'} />
                : <div className={isRanking ? 'cl-ranking-cover-fallback' : 'cl-item-fallback'}>{isRanking ? item.name?.charAt(0) : item.name}</div>
            }
            {isRanking
                ? <span className="cl-ranking-name-view">{item.name}</span>
                : <div className="cl-item-overlay"><span className="cl-item-name">{item.name}</span></div>
            }
        </div>
    );
}
