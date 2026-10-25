import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getTemplateById,
    updateTemplate,
    DEFAULT_TIER_CONFIG,
    TIER_COLORS_PALETTE
} from '../../lib/listService';
import { searchGames } from '../../lib/gameService';
import { searchAnime } from '../../lib/animeService';
import { getTierLabelFontSize } from '../../lib/tierLabel';
import './TemplateBuilder.css';

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconPlus = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconMinus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>;
const IconX = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function TemplateBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Config State
    const [tiers, setTiers] = useState([]);
    const [maxItems, setMaxItems] = useState(10);
    const [gridCells, setGridCells] = useState([]);
    const [gridColumns, setGridColumns] = useState(2);

    // Items Pool
    const [itemsPool, setItemsPool] = useState([]);
    const [coverItems, setCoverItems] = useState([]);
    const [showCoverPrompt, setShowCoverPrompt] = useState(false);
    const [coverPromptResolved, setCoverPromptResolved] = useState(false);

    // Search Modal State
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchMode, setSearchMode] = useState('items'); // 'items' | 'covers'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Custom Item State
    const [itemTab, setItemTab] = useState('search'); // 'search' | 'custom'
    const [customItemName, setCustomItemName] = useState('');
    const [customItemUrl, setCustomItemUrl] = useState('');

    const handleAddCustomItem = () => {
        if (!customItemName.trim()) return;
        const newItem = {
            id: 'custom-' + Date.now(),
            name: customItemName,
            image_url: customItemUrl,
            cover_url: customItemUrl
        };
        handleAddItem(newItem);
        setCustomItemName('');
        setCustomItemUrl('');
    };

    // Popover for inline tier editing
    const [activePopover, setActivePopover] = useState(null); // tier.id
    const [popoverLabel, setPopoverLabel] = useState('');
    const [popoverColor, setPopoverColor] = useState('');

    useEffect(() => {
        getTemplateById(id).then(tpl => {
            if (!tpl) { navigate('/templates'); return; }
            setTemplate(tpl);
            setItemsPool(tpl.default_items || []);
            setCoverItems(tpl.cover_items || []);
            
            if (tpl.list_type === 'tierlist') {
                setTiers(tpl.type_config?.tiers || DEFAULT_TIER_CONFIG.tierlist.tiers);
            } else if (tpl.list_type === 'ranking') {
                setMaxItems(tpl.type_config?.max_items || DEFAULT_TIER_CONFIG.ranking.max_items);
            } else if (tpl.list_type === 'grid') {
                setGridCells(tpl.type_config?.cells || DEFAULT_TIER_CONFIG.grid.cells);
                setGridColumns(tpl.type_config?.columns || DEFAULT_TIER_CONFIG.grid.columns);
            }
            setLoading(false);
        }).catch(err => {
            console.error('Error fetching template for builder:', err);
            alert('No se pudo cargar la plantilla: ' + err.message);
            navigate('/templates');
        });
    }, [id, navigate]);

    // Search effect
    useEffect(() => {
        if (!template || !showSearchModal) return;
        if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        const t = setTimeout(async () => {
            try {
                const fn = template.media_type === 'game' ? searchGames : searchAnime;
                const results = await fn(searchQuery);
                setSearchResults(results || []);
            } catch {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 400);
        return () => clearTimeout(t);
    }, [searchQuery, template, showSearchModal]);

    const handleAddItem = (item) => {
        if (itemsPool.find(x => x.id === item.id)) return;
        setItemsPool([...itemsPool, item]);
    };
    const handleRemoveItem = (itemId) => {
        setItemsPool(itemsPool.filter(x => x.id !== itemId));
    };

    const openItemSearch = () => {
        setSearchMode('items');
        setItemTab('search');
        setSearchQuery('');
        setShowSearchModal(true);
    };

    const openCoverSearch = () => {
        if (itemsPool.length > 0) return;
        setSearchMode('covers');
        setItemTab('search');
        setSearchQuery('');
        setShowSearchModal(true);
    };

    const handleToggleCover = (item) => {
        const image = item.image_url || item.cover_url || item.cover_image;
        if (!image) return;
        const cover = { id: item.id, name: item.name || item.title || 'Portada', image_url: image, cover_url: image };
        setCoverItems(current => current.some(existing => String(existing.id) === String(cover.id))
            ? current.filter(existing => String(existing.id) !== String(cover.id))
            : current.length < 4 ? [...current, cover] : current);
    };

    const handleRemoveCover = (coverId) => {
        setCoverItems(current => current.filter(cover => String(cover.id) !== String(coverId)));
    };

    const handleAddGridCell = () => {
        setGridCells([...gridCells, { id: 'c_' + Date.now(), label: `Grid ${gridCells.length + 1}` }]);
    };
    const handleRemoveGridCell = (cellId) => {
        setGridCells(gridCells.filter(c => c.id !== cellId));
    };
    const handleUpdateGridCell = (cellId, newLabel) => {
        setGridCells(gridCells.map(c => c.id === cellId ? { ...c, label: newLabel } : c));
    };

    const persistTemplate = async () => {
        try {
            setSaving(true);
            let type_config = {};
            if (template.list_type === 'tierlist') type_config.tiers = tiers;
            if (template.list_type === 'ranking') type_config.max_items = maxItems;
            if (template.list_type === 'grid') { type_config.cells = gridCells; type_config.columns = gridColumns; }

            await updateTemplate(id, { type_config, default_items: itemsPool, cover_items: coverItems });
            navigate(`/templates/${id}`);
        } catch (err) {
            console.error(err);
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        if (!itemsPool.length && !coverItems.length && !coverPromptResolved) {
            setShowCoverPrompt(true);
            return;
        }
        persistTemplate();
    };

    if (loading) return <div className="tb-loading">Cargando constructor...</div>;

    return (
        <div className="tb-container">
            {/* ── Top bar ── */}
            <header className="tb-top-area">
                <div className="tb-top-area-info">
                    <button className="tb-back-btn" onClick={() => navigate(`/templates/${id}`)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    </button>
                    <div className="tb-top-title-block">
                        <span className="tb-top-eyebrow">Editando plantilla</span>
                        <h2>{template.title}</h2>
                    </div>
                    <span className="tb-badge">{template.list_type}</span>
                </div>
                <div className="tb-top-area-actions">
                    <button className="tb-header-btn-secondary" onClick={() => navigate(`/templates/${id}`)}>
                        Cancelar
                    </button>
                    <button type="button" className="tb-header-btn-secondary tb-cover-header-btn" onClick={openCoverSearch} disabled={itemsPool.length > 0} aria-label={itemsPool.length ? 'No se pueden editar las portadas mientras haya elementos predefinidos' : 'Elegir portadas'} title={itemsPool.length ? 'Quita los elementos predefinidos para editar las portadas' : 'Elegir portadas'}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/></svg>
                    </button>
                    <button className="tb-header-btn-primary tb-save-template-btn" onClick={handleSave} disabled={saving} aria-label={saving ? 'Guardando plantilla' : 'Guardar plantilla'} title={saving ? 'Guardando plantilla' : 'Guardar plantilla'}>
                        {saving
                            ? <svg className="tb-save-spinner" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
                        <span className="tb-save-button-label">{saving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                </div>
            </header>

            {/* ── Body: 2-column layout ── */}
            <div className="tb-body">

                {/* LEFT — Editor */}
                <div className="tb-editor-col">

                    {/* TIERLIST */}
                    {template.list_type === 'tierlist' && (
                        <section className="tb-section">
                            <div className="tb-section-header">
                                <span className="tb-section-eyebrow">Estructura</span>
                                <h3 className="tb-section-title">Filas de la tierlist</h3>
                                <p className="tb-section-desc">Haz clic en una fila para editar su nombre y color.</p>
                            </div>
                            <div className="tb-live-tiers">
                                {tiers.map((tier) => (
                                    <div
                                        key={tier.id}
                                        className="tb-tier-edit-wrap"
                                        style={{ position: 'relative', zIndex: activePopover === tier.id ? 20000 : 1 }}
                                    >
                                        <div className="tb-live-tier-row">
                                            <div
                                                className="tb-live-tier-label"
                                                style={{ backgroundColor: tier.color }}
                                                onClick={() => {
                                                    setActivePopover(activePopover === tier.id ? null : tier.id);
                                                    setPopoverLabel(tier.label);
                                                    setPopoverColor(tier.color);
                                                }}
                                            >
                                                <span
                                                    className="tb-tier-text"
                                                    style={{ fontSize: getTierLabelFontSize(tier.label, {
                                                        availableWidth: window.matchMedia('(max-width: 600px)').matches ? 56 : 80,
                                                        availableHeight: window.matchMedia('(max-width: 600px)').matches ? 56 : 72,
                                                        maxSize: window.matchMedia('(max-width: 600px)').matches ? 17.6 : 22.4
                                                    }) }}
                                                >
                                                    {tier.label}
                                                </span>
                                                <span className="tb-tier-edit-hint"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
                                            </div>
                                            <div className="tb-live-tier-drop" />
                                        </div>
                                        {activePopover === tier.id && (
                                            <div className="tb-tier-popover" onClick={e => e.stopPropagation()}>
                                                <p className="tb-popover-label">Nombre del tier</p>
                                                <input
                                                    value={popoverLabel}
                                                    onChange={e => {
                                                        setPopoverLabel(e.target.value);
                                                        setTiers(tiers.map(t => t.id === tier.id ? { ...t, label: e.target.value } : t));
                                                    }}
                                                    placeholder="Ej: S, A, B..."
                                                />
                                                <p className="tb-popover-label">Color</p>
                                                <div className="tb-popover-colors">
                                                    {TIER_COLORS_PALETTE.map(c => (
                                                        <div
                                                            key={c}
                                                            className={`tb-color-dot ${popoverColor === c ? 'active' : ''}`}
                                                            style={{ background: c }}
                                                            onClick={() => {
                                                                setPopoverColor(c);
                                                                setTiers(tiers.map(t => t.id === tier.id ? { ...t, color: c } : t));
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <button
                                                    className="tb-remove-tier-btn"
                                                    disabled={tiers.length <= 2}
                                                    onClick={() => {
                                                        if (tiers.length <= 2) return;
                                                        setTiers(tiers.filter(t => t.id !== tier.id));
                                                        setActivePopover(null);
                                                    }}
                                                >
                                                    Eliminar esta fila
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button className="tb-live-add-tier" onClick={() => {
                                    setTiers([...tiers, { id: 'tier_' + Date.now(), label: 'NUEVO', color: '#6b7280' }]);
                                }}>
                                    <IconPlus /> Añadir nueva fila
                                </button>
                            </div>
                        </section>
                    )}

                    {/* RANKING */}
                    {template.list_type === 'ranking' && (
                        <section className="tb-section">
                            <div className="tb-section-header">
                                <span className="tb-section-eyebrow">Estructura</span>
                                <h3 className="tb-section-title">Tamaño del ranking</h3>
                                <p className="tb-section-desc">Define cuántas posiciones tendrá el top.</p>
                            </div>
                            <div className="tb-ranking-size-card">
                                <span className="tb-ranking-size-label">Posiciones</span>
                                <div className="tb-ranking-controls">
                                    <button className="btn-icon" onClick={() => setMaxItems(Math.max(3, maxItems - 1))} disabled={maxItems <= 3}><IconMinus /></button>
                                    <span className="tb-ranking-val">{maxItems}</span>
                                    <button className="btn-icon" onClick={() => setMaxItems(Math.min(20, maxItems + 1))} disabled={maxItems >= 20}><IconPlus /></button>
                                </div>
                            </div>
                            <div className="tb-ranking-list-stack">
                                {Array.from({ length: maxItems }).map((_, i) => {
                                    return (
                                        <div key={i} className={`tb-ranking-list-row top-${i}`}>
                                            <div className="tb-ranking-badge">{i + 1}</div>
                                            <div className="tb-ranking-row-ph">Espacio para ítem</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* GRID */}
                    {template.list_type === 'grid' && (
                        <section className="tb-section">
                            <div className="tb-section-header">
                                <span className="tb-section-eyebrow">Estructura</span>
                                <h3 className="tb-section-title">Cuadrícula</h3>
                                <p className="tb-section-desc">Ajusta columnas y etiquetas de cada celda.</p>
                            </div>
                            <div className="tb-grid-controls-card">
                                <span className="tb-grid-controls-label">Columnas</span>
                                <div className="tb-grid-controls">
                                    <button className="btn-icon" onClick={() => setGridColumns(Math.max(2, gridColumns - 1))} disabled={gridColumns <= 2}><IconMinus /></button>
                                    <span className="tb-grid-col-label">{gridColumns}</span>
                                    <button className="btn-icon" onClick={() => setGridColumns(Math.min(6, gridColumns + 1))} disabled={gridColumns >= 6}><IconPlus /></button>
                                </div>
                            </div>
                            <div className="tb-live-grid-cells" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, maxWidth: `${gridColumns * 120}px` }}>
                                {gridCells.map(cell => (
                                    <div key={cell.id} className="tb-grid-cell">
                                        <div className="tb-grid-cell-img-ph">Add Item</div>
                                        <button className="tb-grid-del" onClick={() => handleRemoveGridCell(cell.id)} title="Eliminar celda"><IconX /></button>
                                        <div className="tb-grid-label-bar">
                                            <textarea
                                                value={cell.label}
                                                onChange={(e) => handleUpdateGridCell(cell.id, e.target.value)}
                                                className="tb-grid-input"
                                                placeholder="Etiqueta..."
                                                rows={2}
                                                style={{ resize: 'none', overflow: 'hidden' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button className="tb-grid-add" onClick={handleAddGridCell}><IconPlus /> Añadir celda</button>
                            </div>
                        </section>
                    )}

                    {/* ITEMS PREDEFINIDOS */}
                    <section className="tb-section">
                        <div className="tb-section-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 className="tb-section-title">Ítems predefinidos</h3>
                                <span className="tb-items-count">{itemsPool.length}</span>
                            </div>
                            <p className="tb-section-desc">
                                Estos ítems aparecerán por defecto cuando alguien use la plantilla.
                            </p>
                        </div>

                        <div className="tb-items-card">
                            {itemsPool.length > 0 ? (
                                <div className="tb-tray-grid">
                                    {itemsPool.map(item => (
                                        <div key={item.id} className="tb-tray-item">
                                            <img src={item.image_url || item.cover_url} alt={item.name} />
                                            <div className="tb-tray-item-overlay">
                                                <button className="tb-tray-item-del" onClick={() => handleRemoveItem(item.id)}>
                                                    <IconX />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="tb-tray-add-more" onClick={openItemSearch}>
                                        <IconPlus />
                                        <span>Añadir</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="tb-tray-empty-state">
                                    <div className="tb-tray-empty-icon">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                    </div>
                                    <h4>Sin ítems predefinidos</h4>
                                    <p>El usuario final usará el buscador para añadir los que quiera libremente. Si quieres, puedes dejar algunos ya puestos.</p>
                                    <button className="tb-add-items-btn" onClick={openItemSearch}>
                                        <IconPlus /> Buscar y añadir ítems
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                </div>
            </div>

            {showCoverPrompt && (
                <div className="tb-modal-overlay tb-cover-prompt-overlay" onClick={() => setShowCoverPrompt(false)}>
                    <div className="tb-modal tb-cover-prompt" role="dialog" aria-modal="true" aria-labelledby="tb-cover-prompt-title" onClick={e => e.stopPropagation()}>
                        <div className="tb-modal-header">
                            <h3 id="tb-cover-prompt-title">Esta plantilla no tiene elementos predefinidos</h3>
                            <button className="tb-modal-close" onClick={() => setShowCoverPrompt(false)} aria-label="Cerrar"><IconX /></button>
                        </div>
                        <p>¿Quieres poner portadas por defecto?</p>
                        <div className="tb-cover-prompt-actions">
                            <button className="tb-header-btn-secondary" onClick={() => { setCoverPromptResolved(true); setShowCoverPrompt(false); persistTemplate(); }}>Guardar sin portadas</button>
                            <button className="tb-header-btn-primary" onClick={() => { setCoverPromptResolved(true); setShowCoverPrompt(false); openCoverSearch(); }}>Elegir portadas</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Search Modal ── */}
            {showSearchModal && (
                <div className="tb-modal-overlay" onClick={() => setShowSearchModal(false)}>
                    <div className={`tb-modal${searchMode === 'covers' ? ' tb-cover-selection-mode' : ''}`} onClick={e => e.stopPropagation()}>
                        <div className="tb-modal-header">
                            <h3>{searchMode === 'covers' ? 'Elegir portadas' : 'Añadir ítems'}</h3>
                            <button className="tb-modal-close" onClick={() => setShowSearchModal(false)}><IconX /></button>
                        </div>

                        {searchMode === 'items' && <div className="tb-modal-tabs">
                            <button className={`tb-modal-tab ${itemTab === 'search' ? 'active' : ''}`} onClick={() => setItemTab('search')}>Buscar</button>
                            <button className={`tb-modal-tab ${itemTab === 'custom' ? 'active' : ''}`} onClick={() => setItemTab('custom')}>Ítem Custom</button>
                        </div>}

                        {searchMode === 'covers' && <p className="tb-cover-picker-hint">Elige hasta 4 portadas. No se añadirán a los elementos predefinidos.</p>}
                        {searchMode === 'covers' && <div className="tb-cover-selected">
                            <div className="tb-cover-selected-heading"><span>Portadas elegidas</span><small>{coverItems.length}/4</small></div>
                            {coverItems.length ? <div className="tb-cover-selected-grid">
                                {coverItems.map(cover => <div className="tb-cover-selected-item" key={cover.id}>
                                    <img src={cover.image_url || cover.cover_url} alt={cover.name || 'Portada elegida'} />
                                    <button type="button" onClick={() => handleRemoveCover(cover.id)} aria-label={`Quitar ${cover.name || 'portada'}`} title="Quitar portada"><IconX /></button>
                                </div>)}
                            </div> : <p className="tb-cover-selected-empty">Aún no has elegido portadas.</p>}
                        </div>}

                        {searchMode === 'covers' || itemTab === 'search' ? (
                            <>
                                <div className="tb-search-wrap">
                                    <span className="tb-search-icon"><IconSearch /></span>
                                    <input
                                        type="text"
                                        className="tb-search-input"
                                        placeholder={`Buscar ${template.media_type === 'game' ? 'videojuego' : 'anime'}...`}
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="tb-modal-results">
                                    {isSearching ? (
                                        <div className="tb-hint">Buscando...</div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map(item => {
                                            const isAdded = searchMode === 'covers'
                                                ? coverItems.some(cover => String(cover.id) === String(item.id))
                                                : itemsPool.some(x => String(x.id) === String(item.id));
                                            const coverLimitReached = searchMode === 'covers' && coverItems.length >= 4 && !isAdded;
                                            return (
                                                <div key={item.id} className={`tb-result-item ${isAdded ? 'added' : ''} ${coverLimitReached ? 'disabled' : ''}`} onClick={() => {
                                                    if (searchMode === 'covers') {
                                                        if (!coverLimitReached) handleToggleCover(item);
                                                    } else if (!isAdded) handleAddItem(item);
                                                }}>
                                                    <img src={item.image_url || item.cover_url} alt={item.name} className="tb-result-img" />
                                                    <span className="tb-result-name">{item.name}</span>
                                                    <button className="tb-add-btn" type="button" disabled={coverLimitReached} aria-label={isAdded ? 'Quitar selección' : 'Seleccionar'}>
                                                        {isAdded ? <IconCheck /> : <IconPlus />}
                                                    </button>
                                                </div>
                                            );
                                        })
                                    ) : searchQuery.length >= 2 ? (
                                        <div className="tb-hint">No se encontraron resultados.</div>
                                    ) : (
                                        <div className="tb-hint">Escribe al menos 2 letras para buscar.</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="tb-custom-item-form">
                                <div className="tb-custom-field">
                                    <label>Nombre del ítem</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej: Personaje Misterioso" 
                                        value={customItemName}
                                        onChange={e => setCustomItemName(e.target.value)}
                                    />
                                </div>
                                <div className="tb-custom-field">
                                    <label>URL de la imagen</label>
                                    <input 
                                        type="url" 
                                        placeholder="https://ejemplo.com/imagen.jpg" 
                                        value={customItemUrl}
                                        onChange={e => setCustomItemUrl(e.target.value)}
                                    />
                                </div>
                                {customItemUrl && (
                                    <div className="tb-custom-preview">
                                        <img 
                                            src={customItemUrl} 
                                            alt="Vista previa" 
                                            onError={(e) => e.target.style.display='none'} 
                                            onLoad={(e) => e.target.style.display='block'}
                                        />
                                    </div>
                                )}
                                <button 
                                    className="tb-add-custom-btn" 
                                    onClick={handleAddCustomItem}
                                    disabled={!customItemName.trim() || !customItemUrl.trim()}
                                >
                                    <IconPlus /> Añadir Ítem Custom
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
