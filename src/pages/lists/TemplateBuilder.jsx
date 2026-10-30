import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
const IconMinus = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconCheck = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const IconX = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);
const IconChevronLeft = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);
const IconChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const IconEdit = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TemplateBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [template, setTemplate]   = useState(null);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);

    // Structure state
    const [tiers, setTiers]               = useState([]);
    const [maxItems, setMaxItems]         = useState(10);
    const [gridCells, setGridCells]       = useState([]);
    const [gridColumns, setGridColumns]   = useState(2);

    // Items & covers
    const [itemsPool, setItemsPool]       = useState([]);
    const [coverItems, setCoverItems]     = useState([]);
    const [showCoverPrompt, setShowCoverPrompt]   = useState(false);
    const [coverPromptResolved, setCoverPromptResolved] = useState(false);

    // Covers dropdown (a la izquierda de Guardar)
    const [isCoversOpen, setIsCoversOpen]         = useState(false);
    const coversDropdownRef                       = useRef(null);
    const coversDropdownContentRef                = useRef(null);
    const [coverSearchQuery, setCoverSearchQuery] = useState('');
    const [coverSearchResults, setCoverSearchResults] = useState([]);
    const [isSearchingCovers, setIsSearchingCovers]   = useState(false);

    // Mobile view detection
    const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 640 : false);
    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth <= 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sidebar state (RIGHT - Añadir elementos)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen]         = useState(false);

    // Search / Custom items
    const [searchTab, setSearchTab]       = useState('search'); // 'search' | 'custom'
    const [searchQuery, setSearchQuery]   = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching]   = useState(false);

    // Custom item
    const [customName, setCustomName]     = useState('');
    const [customUrl, setCustomUrl]       = useState('');

    // Tier popover
    const [activePopover, setActivePopover] = useState(null);
    const [popoverLabel, setPopoverLabel] = useState('');
    const [popoverColor, setPopoverColor] = useState('');

    // Inline title editing
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft]     = useState('');

    // Lock body scroll on mobile
    useEffect(() => {
        const isMobile = window.innerWidth <= 900;
        document.body.style.overflow = (isMobile && (isMobileOpen || isCoversOpen)) ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isMobileOpen, isCoversOpen]);

    // Load template
    useEffect(() => {
        getTemplateById(id).then(tpl => {
            if (!tpl) { navigate('/templates'); return; }
            setTemplate(tpl);
            setTitleDraft(tpl.title);
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
            console.error(err);
            alert('No se pudo cargar la plantilla: ' + err.message);
            navigate('/templates');
        });
    }, [id, navigate]);

    // Search
    useEffect(() => {
        if (!template) return;
        if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        const t = setTimeout(async () => {
            try {
                const fn = template.media_type === 'game' ? searchGames : searchAnime;
                setSearchResults(await fn(searchQuery) || []);
            } catch { setSearchResults([]); }
            finally { setIsSearching(false); }
        }, 350);
        return () => clearTimeout(t);
    }, [searchQuery, template]);

    // Búsqueda de carátulas para el dropdown
    useEffect(() => {
        if (!coverSearchQuery || coverSearchQuery.trim().length < 2 || !template) {
            setCoverSearchResults([]);
            setIsSearchingCovers(false);
            return;
        }
        setIsSearchingCovers(true);
        const t = setTimeout(async () => {
            try {
                const fn = template.media_type === 'game' ? searchGames : searchAnime;
                setCoverSearchResults(await fn(coverSearchQuery) || []);
            } catch { setCoverSearchResults([]); }
            finally { setIsSearchingCovers(false); }
        }, 320);
        return () => clearTimeout(t);
    }, [coverSearchQuery, template]);

    // Click outside y escape para el desplegable de portadas
    useEffect(() => {
        if (!isCoversOpen) return;
        const handleClickOutside = (e) => {
            if (
                coversDropdownRef.current &&
                !coversDropdownRef.current.contains(e.target) &&
                (!coversDropdownContentRef.current || !coversDropdownContentRef.current.contains(e.target))
            ) {
                setIsCoversOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsCoversOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCoversOpen]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const addItem = (item) => {
        if (itemsPool.find(x => String(x.id) === String(item.id))) return;
        setItemsPool(p => [...p, item]);
    };
    const removeItem = (itemId) => setItemsPool(p => p.filter(x => String(x.id) !== String(itemId)));

    const toggleCover = (item) => {
        const url = item.image_url || item.cover_url || item.cover_image;
        if (!url) return;
        const cover = { id: item.id, name: item.name || 'Portada', image_url: url, cover_url: url };
        setCoverItems(prev =>
            prev.some(e => String(e.id) === String(cover.id))
                ? prev.filter(e => String(e.id) !== String(cover.id))
                : prev.length < 4 ? [...prev, cover] : prev
        );
    };
    const removeCover = (coverId) => setCoverItems(p => p.filter(c => String(c.id) !== String(coverId)));

    const addCustom = () => {
        if (!customName.trim()) return;
        const item = { id: 'custom-' + Date.now(), name: customName, image_url: customUrl, cover_url: customUrl };
        addItem(item);
        setCustomName(''); setCustomUrl('');
    };

    const addGridCell = () => setGridCells(p => [...p, { id: 'c_' + Date.now(), label: `Grid ${p.length + 1}` }]);
    const removeGridCell = (cid) => setGridCells(p => p.filter(c => c.id !== cid));
    const updateGridCell = (cid, label) => setGridCells(p => p.map(c => c.id === cid ? { ...c, label } : c));

    const persist = async () => {
        try {
            setSaving(true);
            let type_config = {};
            if (template.list_type === 'tierlist') type_config.tiers = tiers;
            if (template.list_type === 'ranking')  type_config.max_items = maxItems;
            if (template.list_type === 'grid')     { type_config.cells = gridCells; type_config.columns = gridColumns; }
            const title = titleDraft.trim() || template.title;
            await updateTemplate(id, { title, type_config, default_items: itemsPool, cover_items: coverItems });
            navigate(`/templates/${id}`);
        } catch (err) {
            console.error(err);
            alert('Error al guardar: ' + err.message);
        } finally { setSaving(false); }
    };

    const handleSave = () => {
        if (!itemsPool.length && !coverItems.length && !coverPromptResolved) {
            setShowCoverPrompt(true);
            return;
        }
        persist();
    };

    if (loading) return (
        <div className="tb-loading">
            <div className="tb-loading-spinner" />
            <span>Cargando constructor...</span>
        </div>
    );

    // JSX para el desplegable de portadas (compartido entre desktop y portal móvil)
    const coversDropdownJSX = isCoversOpen ? (
        <>
            <div className="tb-covers-backdrop" onClick={() => setIsCoversOpen(false)} />
            <div
                className="tb-covers-dropdown"
                ref={coversDropdownContentRef}
                onClick={e => e.stopPropagation()}
            >
                <div className="tb-covers-dd-handle" onClick={() => setIsCoversOpen(false)} />
                <div className="tb-covers-dd-head">
                    <div className="tb-covers-dd-title-group">
                        <span className="tb-covers-dd-title">Portadas de plantilla</span>
                        <span className="tb-covers-dd-badge">
                            {itemsPool.length > 0 ? 'Automáticas' : `${coverItems.length}/4`}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="tb-covers-dd-close"
                        onClick={() => setIsCoversOpen(false)}
                        aria-label="Cerrar"
                    >
                        <IconX />
                    </button>
                </div>

                {itemsPool.length > 0 ? (
                    <div className="tb-covers-dd-body">
                        <p className="tb-covers-dd-note">
                            ✨ Las portadas de la tarjeta se toman automáticamente de los primeros elementos predefinidos.
                        </p>
                        <div className="tb-covers-dd-slots">
                            {itemsPool.slice(0, 4).map((item, idx) => (
                                <div key={item.id || idx} className="tb-covers-dd-slot is-filled">
                                    <img src={item.image_url || item.cover_url} alt={item.name} />
                                    <span className="tb-covers-dd-slot-label">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="tb-covers-dd-body">
                        <p className="tb-covers-dd-note">
                            Elige hasta 4 carátulas para la vista previa de la tarjeta en la galería.
                        </p>

                        {/* 4 Slots de carátulas */}
                        <div className="tb-covers-dd-slots">
                            {[0, 1, 2, 3].map(idx => {
                                const cover = coverItems[idx];
                                return cover ? (
                                    <div key={cover.id} className="tb-covers-dd-slot is-filled">
                                        <img src={cover.image_url || cover.cover_url} alt={cover.name} />
                                        <button
                                            type="button"
                                            className="tb-covers-dd-remove"
                                            onClick={() => removeCover(cover.id)}
                                            title={`Quitar ${cover.name}`}
                                        >
                                            <IconX />
                                        </button>
                                    </div>
                                ) : (
                                    <div key={idx} className="tb-covers-dd-slot is-empty">
                                        <IconPlus />
                                        <span>#{idx + 1}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Buscador de carátulas */}
                        <div className="tb-covers-dd-search">
                            <div className="tb-search-wrap">
                                <span className="tb-search-icon"><IconSearch /></span>
                                <input
                                    className="tb-search-input"
                                    type="text"
                                    placeholder={`Buscar carátula (${template.media_type === 'game' ? 'juegos' : 'anime'})...`}
                                    value={coverSearchQuery}
                                    onChange={e => setCoverSearchQuery(e.target.value)}
                                    autoFocus
                                />
                                {coverSearchQuery && (
                                    <button
                                        className="tb-search-clear"
                                        onClick={() => setCoverSearchQuery('')}
                                        type="button"
                                    >
                                        <IconX />
                                    </button>
                                )}
                                {isSearchingCovers && <div className="tb-search-spinner" />}
                            </div>

                            {coverSearchResults.length > 0 && (
                                <div className="tb-covers-dd-results">
                                    {coverSearchResults.slice(0, 12).map(item => {
                                        const img = item.image_url || item.cover_url;
                                        const isAdded = coverItems.some(c => String(c.id) === String(item.id));
                                        const disabled = coverItems.length >= 4 && !isAdded;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`tb-covers-dd-thumb ${isAdded ? 'is-added' : ''}`}
                                                disabled={disabled}
                                                onClick={() => toggleCover(item)}
                                                title={item.name}
                                            >
                                                <img src={img} alt={item.name} />
                                                {isAdded && (
                                                    <div className="tb-covers-dd-check">
                                                        <IconCheck />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    ) : null;

    return (
        <div className="tb-page">

            {/* ══ HEADER ══════════════════════════════════════════════════════ */}
            <header className="tb-header">
                <div className="tb-header-left">
                    <button className="tb-back-btn" onClick={() => navigate(`/templates/${id}`)} title="Volver">
                        <IconBack />
                    </button>

                    {editingTitle ? (
                        <input
                            className="tb-title-input"
                            autoFocus
                            value={titleDraft}
                            onChange={e => setTitleDraft(e.target.value)}
                            onBlur={() => setEditingTitle(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
                            maxLength={80}
                        />
                    ) : (
                        <button className="tb-title-btn" onClick={() => setEditingTitle(true)} title="Editar título">
                            <span className="tb-title-text">{titleDraft || template.title}</span>
                            <span className="tb-title-pencil"><IconEdit /></span>
                        </button>
                    )}
                </div>

                <div className="tb-header-right">
                    {/* Botón SVG para desplegable de Portadas */}
                    <div className="tb-covers-popover-wrap" ref={coversDropdownRef}>
                        <button
                            type="button"
                            className={`tb-header-covers-btn ${isCoversOpen ? 'is-active' : ''}`}
                            onClick={() => {
                                setIsCoversOpen(prev => {
                                    const next = !prev;
                                    if (next) setIsMobileOpen(false);
                                    return next;
                                });
                            }}
                            title={itemsPool.length > 0 ? 'Portadas automáticas (basadas en elementos)' : 'Elegir portadas de plantilla'}
                            aria-label="Portadas de la plantilla"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="14" height="14" rx="2"/>
                                <path d="M7 21h12a2 2 0 0 0 2-2V7"/>
                                <polyline points="3 14 7 10 11 14"/>
                            </svg>
                            {coverItems.length > 0 && itemsPool.length === 0 && (
                                <span className="tb-header-covers-badge">{coverItems.length}</span>
                            )}
                        </button>

                        {/* Desplegable en Desktop (inline bajo el botón) */}
                        {!isMobileView && coversDropdownJSX}
                    </div>

                    {/* Desplegable en Móvil (portal a document.body para no ser atrapado por el blur de tb-header) */}
                    {isMobileView && typeof document !== 'undefined' && coversDropdownJSX && createPortal(coversDropdownJSX, document.body)}

                    <button className="tb-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <><div className="tb-spinner" /> <span>Guardando...</span></>
                        ) : (
                            <span>Guardar</span>
                        )}
                    </button>
                </div>
            </header>

            {/* ══ WORKSPACE ════════════════════════════════════════════════════ */}
            <div className={`tb-workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

                {/* ── LEFT / CENTER: Editor de la estructura y secciones ── */}
                <main className="tb-editor">
                    <div className="tb-editor-content">
                        {/* TIERLIST */}
                        {template.list_type === 'tierlist' && (
                            <section className="tb-section">
                                <div className="tb-tiers">
                                    {tiers.map(tier => (
                                        <div
                                            key={tier.id}
                                            className="tb-tier-wrap"
                                            style={{ zIndex: activePopover === tier.id ? 10 : 1 }}
                                        >
                                            <div className="tb-tier-row">
                                                <button
                                                    className="tb-tier-label"
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
                                                            availableHeight: 72,
                                                            maxSize: 22.4
                                                        }) }}
                                                    >
                                                        {tier.label}
                                                    </span>
                                                    <span className="tb-tier-edit-hint">
                                                        <IconEdit />
                                                    </span>
                                                </button>
                                                <div className="tb-tier-drop-zone" />
                                            </div>

                                            {activePopover === tier.id && (
                                                <div className="tb-popover" onClick={e => e.stopPropagation()}>
                                                    <label className="tb-popover-label">Nombre</label>
                                                    <input
                                                        className="tb-popover-input"
                                                        value={popoverLabel}
                                                        onChange={e => {
                                                            setPopoverLabel(e.target.value);
                                                            setTiers(p => p.map(t => t.id === tier.id ? { ...t, label: e.target.value } : t));
                                                        }}
                                                        placeholder="S, A, B..."
                                                    />
                                                    <label className="tb-popover-label">Color</label>
                                                    <div className="tb-color-grid">
                                                        {TIER_COLORS_PALETTE.map(c => (
                                                            <button
                                                                key={c}
                                                                className={`tb-color-dot ${popoverColor === c ? 'is-active' : ''}`}
                                                                style={{ background: c }}
                                                                onClick={() => {
                                                                    setPopoverColor(c);
                                                                    setTiers(p => p.map(t => t.id === tier.id ? { ...t, color: c } : t));
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <button
                                                        className="tb-remove-tier-btn"
                                                        disabled={tiers.length <= 2}
                                                        onClick={() => {
                                                            setTiers(p => p.filter(t => t.id !== tier.id));
                                                            setActivePopover(null);
                                                        }}
                                                    >
                                                        Eliminar fila
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    <button
                                        className="tb-add-tier-btn"
                                        onClick={() => setTiers(p => [...p, { id: 'tier_' + Date.now(), label: 'NUEVO', color: '#6b7280' }])}
                                    >
                                        <IconPlus /> Añadir fila
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* RANKING */}
                        {template.list_type === 'ranking' && (
                            <section className="tb-section">
                                <div className="tb-counter-card">
                                    <span className="tb-counter-label">Posiciones</span>
                                    <div className="tb-counter-controls">
                                        <button className="tb-counter-btn" onClick={() => setMaxItems(n => Math.max(3, n - 1))} disabled={maxItems <= 3}><IconMinus /></button>
                                        <span className="tb-counter-val">{maxItems}</span>
                                        <button className="tb-counter-btn" onClick={() => setMaxItems(n => Math.min(20, n + 1))} disabled={maxItems >= 20}><IconPlus /></button>
                                    </div>
                                </div>

                                <div className="tb-ranking-stack">
                                    {Array.from({ length: maxItems }).map((_, i) => (
                                        <div key={i} className={`tb-ranking-row top-${i}`}>
                                            <span className="tb-ranking-num">{i + 1}</span>
                                            <div className="tb-ranking-slot">
                                                <div className="tb-ranking-cover-ph" />
                                                <span className="tb-ranking-slot-name">Espacio para ítem</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* GRID */}
                        {template.list_type === 'grid' && (
                            <section className="tb-section">
                                <div className="tb-counter-card">
                                    <span className="tb-counter-label">Columnas</span>
                                    <div className="tb-counter-controls">
                                        <button className="tb-counter-btn" onClick={() => setGridColumns(n => Math.max(2, n - 1))} disabled={gridColumns <= 2}><IconMinus /></button>
                                        <span className="tb-counter-val">{gridColumns}</span>
                                        <button className="tb-counter-btn" onClick={() => setGridColumns(n => Math.min(6, n + 1))} disabled={gridColumns >= 6}><IconPlus /></button>
                                    </div>
                                </div>

                                <div
                                    className="tb-grid-preview"
                                    style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
                                >
                                    {gridCells.map(cell => (
                                        <div key={cell.id} className="tb-grid-cell">
                                            <div className="tb-grid-img-ph" />
                                            <button className="tb-grid-del" onClick={() => removeGridCell(cell.id)}><IconX /></button>
                                            <div className="tb-grid-label-bar">
                                                <textarea
                                                    className="tb-grid-input"
                                                    value={cell.label}
                                                    onChange={e => updateGridCell(cell.id, e.target.value)}
                                                    placeholder="Etiqueta..."
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button className="tb-grid-add-cell" onClick={addGridCell}>
                                        <IconPlus />
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* ── SECCIÓN 1: Elementos predefinidos (Sección limpia y abierta, como en listas) ── */}
                        <section className="tb-content-section">
                            <div className="tb-content-section-header">
                                <div className="tb-content-section-title-group">
                                    <h3 className="tb-content-section-title">Elementos predefinidos</h3>
                                    <span className="tb-content-section-count">{itemsPool.length}</span>
                                </div>
                                <button
                                    type="button"
                                    className="tb-section-action-btn"
                                    onClick={() => {
                                        setSidebarCollapsed(false);
                                        setIsMobileOpen(true);
                                    }}
                                >
                                    <IconPlus />
                                    <span>Añadir elementos</span>
                                </button>
                            </div>

                            {itemsPool.length > 0 ? (
                                <div className="tb-items-grid">
                                    {itemsPool.map(item => (
                                        <div key={item.id} className="tb-item-thumb-card" title={item.name}>
                                            <img src={item.image_url || item.cover_url} alt={item.name} />
                                            <button
                                                type="button"
                                                className="tb-item-thumb-del"
                                                onClick={() => removeItem(item.id)}
                                                title={`Quitar ${item.name}`}
                                            >
                                                <IconX />
                                            </button>
                                            <div className="tb-item-thumb-label">{item.name}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="tb-empty-section-box">
                                    <p className="tb-empty-title">Sin elementos predefinidos</p>
                                    <p className="tb-empty-desc">
                                        Quien use tu plantilla comenzará con la lista vacía o puedes añadirle elementos predeterminados para clasificar.
                                    </p>
                                    <button
                                        type="button"
                                        className="tb-section-action-btn tb-empty-add-btn"
                                        onClick={() => {
                                            setSidebarCollapsed(false);
                                            setIsMobileOpen(true);
                                        }}
                                    >
                                        <IconPlus />
                                        <span>Añadir elementos</span>
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                </main>

                {/* ── RIGHT SIDEBAR: Desplegable a la derecha para búsqueda y adición ── */}
                <div className={`tb-mobile-backdrop ${isMobileOpen ? 'is-open' : ''}`} onClick={() => setIsMobileOpen(false)} />
                <aside className={`tb-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                    <div className="tb-sidebar-handle" onClick={() => setIsMobileOpen(false)} />

                    {/* Rail button when collapsed in desktop */}
                    {sidebarCollapsed && !isMobileOpen ? (
                        <button
                            className="tb-sidebar-rail-btn"
                            onClick={() => setSidebarCollapsed(false)}
                            title="Añadir elementos"
                        >
                            <IconPlus />
                            <span className="tb-sidebar-rail-label">Añadir</span>
                        </button>
                    ) : (
                        <div className="tb-sidebar-inner">
                            {/* Header del sidebar */}
                            <div className="tb-sidebar-header">
                                <div className="tb-sidebar-title-group">
                                    <h3 className="tb-sidebar-title">Añadir elementos</h3>
                                </div>
                                <button
                                    className="tb-sidebar-close-btn"
                                    onClick={() => {
                                        setSidebarCollapsed(true);
                                        setIsMobileOpen(false);
                                    }}
                                    title="Plegar panel"
                                >
                                    <span className="tb-close-desktop"><IconChevronRight /></span>
                                    <span className="tb-close-mobile"><IconX /></span>
                                </button>
                            </div>

                            {/* Sub-tabs: Buscar / Personalizado */}
                            <div className="tb-sidebar-tabs">
                                <button
                                    className={`tb-sidebar-tab ${searchTab === 'search' ? 'active' : ''}`}
                                    onClick={() => setSearchTab('search')}
                                >
                                    <IconSearch />
                                    <span>Buscar</span>
                                </button>
                                <button
                                    className={`tb-sidebar-tab ${searchTab === 'custom' ? 'active' : ''}`}
                                    onClick={() => setSearchTab('custom')}
                                >
                                    <IconPlus />
                                    <span>Personalizado</span>
                                </button>
                            </div>

                            {/* Tab: Buscar */}
                            {searchTab === 'search' && (
                                <>
                                    <div className="tb-search-wrap">
                                        <span className="tb-search-icon"><IconSearch /></span>
                                        <input
                                            className="tb-search-input"
                                            type="text"
                                            placeholder={`Buscar ${template.media_type === 'game' ? 'videojuego' : 'anime'}...`}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                        {searchQuery && (
                                            <button
                                                className="tb-search-clear"
                                                onClick={() => setSearchQuery('')}
                                                type="button"
                                            >
                                                <IconX />
                                            </button>
                                        )}
                                        {isSearching && <div className="tb-search-spinner" />}
                                    </div>

                                    <div className="tb-results">
                                        {!isSearching && searchQuery.length < 2 && (
                                            <div className="tb-results-empty">
                                                <div className="tb-results-empty-icon"><IconSearch /></div>
                                                <p>Busca tus favoritos</p>
                                                <small>Escribe al menos 2 letras para buscar</small>
                                            </div>
                                        )}
                                        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                                            <div className="tb-results-empty">
                                                <div className="tb-results-empty-icon"><IconX /></div>
                                                <p>Sin resultados</p>
                                                <small>Prueba con otro título</small>
                                            </div>
                                        )}
                                        {!isSearching && searchResults.map(item => {
                                            const imgUrl = item.image_url || item.cover_url;
                                            const isAdded = itemsPool.some(x => String(x.id) === String(item.id));

                                            return (
                                                <button
                                                    key={item.id}
                                                    className={`tb-result-item ${isAdded ? 'is-added' : ''}`}
                                                    onClick={() => !isAdded && addItem(item)}
                                                    title={item.name}
                                                >
                                                    <div className="tb-result-thumb">
                                                        {imgUrl ? (
                                                            <img src={imgUrl} alt="" onError={e => e.target.style.display='none'} />
                                                        ) : (
                                                            <div className="tb-result-fallback"><IconSearch /></div>
                                                        )}
                                                    </div>
                                                    <div className="tb-result-info">
                                                        <span className="tb-result-name">{item.name}</span>
                                                        {item.release_date && (
                                                            <span className="tb-result-year">{item.release_date.substring(0, 4)}</span>
                                                        )}
                                                    </div>
                                                    <div className={`tb-result-btn ${isAdded ? 'added' : ''}`}>
                                                        {isAdded ? <IconCheck /> : <IconPlus />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* Tab: Personalizado */}
                            {searchTab === 'custom' && (
                                <div className="tb-custom-form">
                                    <div className="tb-custom-field">
                                        <label className="tb-custom-label">Título o Nombre</label>
                                        <input
                                            className="tb-custom-input"
                                            type="text"
                                            placeholder="Ej: Personaje Misterioso"
                                            value={customName}
                                            onChange={e => setCustomName(e.target.value)}
                                        />
                                    </div>
                                    <div className="tb-custom-field">
                                        <label className="tb-custom-label">URL de la carátula</label>
                                        <input
                                            className="tb-custom-input"
                                            type="url"
                                            placeholder="https://ejemplo.com/portada.jpg"
                                            value={customUrl}
                                            onChange={e => setCustomUrl(e.target.value)}
                                        />
                                    </div>
                                    {customUrl && (
                                        <div className="tb-custom-preview-card">
                                            <div className="tb-custom-preview">
                                                <img src={customUrl} alt="Preview" onError={e => e.target.style.display='none'} />
                                            </div>
                                            <span className="tb-custom-preview-name">{customName || 'Vista previa'}</span>
                                        </div>
                                    )}
                                    <button
                                        className="tb-custom-add-btn"
                                        onClick={addCustom}
                                        disabled={!customName.trim()}
                                    >
                                        <IconPlus />
                                        <span>Añadir a la plantilla</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* Mobile FAB para abrir el panel en móvil */}
                <button
                    className="tb-mobile-fab"
                    onClick={() => setIsMobileOpen(true)}
                    title="Añadir elementos"
                >
                    <IconPlus />
                    {itemsPool.length > 0 && (
                        <span className="tb-fab-badge">{itemsPool.length}</span>
                    )}
                </button>
            </div>

            {/* ══ Cover prompt modal ════════════════════════════════════════ */}
            {showCoverPrompt && (
                <div className="tb-modal-overlay" onClick={() => setShowCoverPrompt(false)}>
                    <div className="tb-modal" onClick={e => e.stopPropagation()}>
                        <div className="tb-modal-header">
                            <h3>Sin contenido predefinido</h3>
                            <button className="tb-modal-close" onClick={() => setShowCoverPrompt(false)}><IconX /></button>
                        </div>
                        <p className="tb-modal-desc">¿Quieres añadir portadas para la tarjeta de la plantilla?</p>
                        <div className="tb-modal-actions">
                            <button className="tb-btn-ghost" onClick={() => { setCoverPromptResolved(true); setShowCoverPrompt(false); persist(); }}>
                                Guardar sin portadas
                            </button>
                            <button className="tb-btn-primary" onClick={() => { setCoverPromptResolved(true); setShowCoverPrompt(false); setIsCoversOpen(true); }}>
                                Añadir portadas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
