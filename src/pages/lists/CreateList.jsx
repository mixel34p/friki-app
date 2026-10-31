import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { IoSettingsSharp } from 'react-icons/io5';
import { getTemplateById, createList, updateList, getListById, incrementTemplateUses, DEFAULT_TIER_CONFIG, TIER_COLORS_PALETTE } from '../../lib/listService';
import { searchGames } from '../../lib/gameService';
import { searchAnime } from '../../lib/animeService';
import { getDiscoverWorks } from '../../lib/discoverWorksService';
import { getTierLabelFontSize } from '../../lib/tierLabel';
import TierLabelEditor from './TierLabelEditor';
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
const IconSettings = () => <IoSettingsSharp aria-hidden="true" />;
const IconChevronUp = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6" /></svg>;
const IconChevronDown = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 6 6 6-6" /></svg>;
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
    const publishDraftKey = searchParams.get('publishDraft');
    const standaloneType = searchParams.get('type');
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
    const defaultResultsCache = useRef({});

    const [customName, setCustomName] = useState('');
    const [customImageUrl, setCustomImageUrl] = useState('');

    const [activeItem, setActiveItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [visibility, setVisibility] = useState('public');
    const [activeTab, setActiveTab] = useState('search');
    const [modalTarget, setModalTarget] = useState(null);
    const [rankingSlotTarget, setRankingSlotTarget] = useState(null);
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
        } else if (standaloneType === 'ranking') {
            if (profile && !defaultTitleSet) {
                setTitle(`Nuevo ranking (${profile.display_name || profile.username || 'Usuario'})`);
                setDefaultTitleSet(true);
            }
        } else {
            navigate('/share?openList=1', { replace: true });
        }
    }, [id, templateId, fromListId, standaloneType, template, profile, defaultTitleSet, navigate]);

    // ── Load template or existing list ──
    useEffect(() => {
        if (publishDraftKey) {
            try {
                const stored = sessionStorage.getItem(`share-list-draft:${publishDraftKey}`);
                if (!stored) throw new Error('No se encontró el borrador de la lista.');
                const draft = JSON.parse(stored);
                const editor = draft.editor;
                if (!editor?.content || !editor?.typeConfig) throw new Error('El borrador de la lista está incompleto.');
                setTitle(editor.title || '');
                setListType(editor.listType || 'tierlist');
                setMediaType(editor.mediaType || 'game');
                setTypeConfig(editor.typeConfig);
                setContent(editor.content);
                setPool(editor.pool || []);
                setVisibility(editor.visibility || 'public');
                setDefaultTitleSet(true);
                if (editor.templateId) getTemplateById(editor.templateId).then(setTemplate).catch(err => console.error('No se pudo volver a cargar la plantilla:', err));
            } catch (err) {
                setError(err.message || 'No se pudo recuperar el borrador de la lista.');
            }
        } else if (standaloneType === 'ranking' && !templateId) {
            const config = { ...DEFAULT_TIER_CONFIG.ranking, max_items: 3 };
            setTemplate(null);
            setListType('ranking');
            setMediaType('game');
            setTypeConfig(config);
            setContent(Object.fromEntries(Array.from({ length: config.max_items }, (_, index) => [`r${index}`, []])));
            setPool([]);
            setDefaultTitleSet(false);
        } else if (templateId) {
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
    }, [templateId, fromListId, id, profile, standaloneType]);

    // ── Search ──
    useEffect(() => {
        const query = searchQuery.trim();
        const controller = new AbortController();
        if (!query) {
            const cachedResults = defaultResultsCache.current[mediaType];
            if (cachedResults) {
                setSearchResults(cachedResults);
                setIsSearching(false);
                return () => controller.abort();
            }
            setIsSearching(true);
            getDiscoverWorks(mediaType).then(works => {
                const popular = [...works]
                    .sort((a, b) => b.registrations - a.registrations || b.databasePopularity - a.databasePopularity || (b.databaseRating || 0) - (a.databaseRating || 0) || a.title.localeCompare(b.title, 'es'))
                    .slice(0, 24)
                    .map(work => ({ ...work, name: work.title, image_url: work.image, release_date: work.release_date || work.first_release_date || work.start_date }));
                defaultResultsCache.current[mediaType] = popular;
                if (!controller.signal.aborted) setSearchResults(popular);
            }).catch(error => {
                if (!controller.signal.aborted) {
                    console.error('No se pudieron cargar las obras populares:', error);
                    setSearchResults([]);
                }
            }).finally(() => {
                if (!controller.signal.aborted) setIsSearching(false);
            });
            return () => controller.abort();
        }
        if (query.length < 2) return () => controller.abort();
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = mediaType === 'game'
                    ? await searchGames(query, 24, { signal: controller.signal })
                    : await searchAnime(query, 24, { signal: controller.signal });
                if (!controller.signal.aborted) setSearchResults(results);
            } catch (err) {
                if (!controller.signal.aborted) console.error(err);
            } finally {
                if (!controller.signal.aborted) setIsSearching(false);
            }
        }, 350);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [searchQuery, mediaType]);

    const handleAddToPool = useCallback((item) => {
        const itemId = String(item.id);
        const newItem = {
            id: itemId,
            name: item.name,
            image_url: item.image_url || item.cover_url || item.cover?.url,
            ...(listType === 'ranking' && !template ? { media_type: item.media_type || mediaType } : {}),
        };
        if (listType === 'ranking' && !template) {
            const alreadySelected = Object.values(content || {}).flat().some(existing => String(existing?.id) === itemId)
                || pool.some(existing => String(existing?.id) === itemId);
            if (alreadySelected) return;
            const positions = Array.from({ length: Number(typeConfig.max_items) || 3 }, (_, index) => `r${index}`);
            const openPosition = rankingSlotTarget && !(content?.[rankingSlotTarget] || []).length
                ? rankingSlotTarget
                : positions.find(position => !(content?.[position] || []).length);
            if (openPosition) {
                setContent(previous => ({ ...previous, [openPosition]: [newItem] }));
                setRankingSlotTarget(null);
                return;
            }
        }
        setPool(prev => {
            if (prev.find(i => i.id === itemId)) return prev;
            return [...prev, newItem];
        });
    }, [listType, template, content, pool, typeConfig.max_items, mediaType, rankingSlotTarget]);

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
        } else if (modalTarget && modalTarget.startsWith('r')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
            setPool(prev => prev.filter(existing => String(existing.id) !== itemId));
        }
        setModalTarget(null);
    }, [modalTarget]);

    const handleAddCustom = () => {
        if (!customName || !customImageUrl) return;
        const newItem = { id: `custom_${Date.now()}`, name: customName, image_url: customImageUrl, ...(listType === 'ranking' && !template ? { media_type: mediaType } : {}) };
        if (modalTarget === 'pool') {
            setPool(prev => [...prev, newItem]);
        } else if (modalTarget && modalTarget.startsWith('c')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
            setPool(prev => [...prev, newItem]);
        } else if (modalTarget && modalTarget.startsWith('r')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
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

    const changeRankingSize = delta => {
        const current = Number(typeConfig.max_items) || DEFAULT_TIER_CONFIG.ranking.max_items;
        const next = Math.max(1, Math.min(30, current + delta));
        if (next === current) return;
        if (next < current) {
            const removed = Array.from({ length: current - next }, (_, offset) => content[`r${next + offset}`]?.[0]).filter(Boolean);
            setPool(items => [...items, ...removed]);
            setContent(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !/^r\d+$/.test(key) || Number(key.slice(1)) < next)));
        } else {
            setContent(previous => ({
                ...previous,
                ...Object.fromEntries(Array.from({ length: next - current }, (_, offset) => [`r${current + offset}`, []])),
            }));
        }
        setTypeConfig(previous => ({ ...previous, max_items: next }));
    };

    const isEditableTemplateTierlist = Boolean(!id && template?.id && listType === 'tierlist');

    const updateTier = (tierId, updates) => {
        setTypeConfig(previous => ({
            ...previous,
            tiers: (previous.tiers || []).map(tier => tier.id === tierId ? { ...tier, ...updates } : tier),
        }));
    };

    const moveTier = (tierId, direction) => {
        setTypeConfig(previous => {
            const tiers = [...(previous.tiers || [])];
            const currentIndex = tiers.findIndex(tier => tier.id === tierId);
            const nextIndex = currentIndex + direction;
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= tiers.length) return previous;
            [tiers[currentIndex], tiers[nextIndex]] = [tiers[nextIndex], tiers[currentIndex]];
            return { ...previous, tiers };
        });
    };

    const addTier = () => {
        if ((typeConfig.tiers || []).length >= 10) return;
        const tier = { id: `tier_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, label: 'Nuevo', color: '#6b7280' };
        setTypeConfig(previous => (previous.tiers || []).length >= 10 ? previous : ({ ...previous, tiers: [...(previous.tiers || []), tier] }));
        setContent(previous => ({ ...previous, [tier.id]: [] }));
    };

    const removeTier = tierId => {
        if ((typeConfig.tiers || []).length <= 1) return;
        const items = content?.[tierId] || [];
        setPool(previous => [...previous, ...items.filter(item => !previous.some(existing => existing.id === item.id))]);
        setContent(previous => {
            const next = { ...previous };
            delete next[tierId];
            return next;
        });
        setTypeConfig(previous => ({ ...previous, tiers: (previous.tiers || []).filter(tier => tier.id !== tierId) }));
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!title.trim()) { alert('Ponle un título a la lista'); return; }
        if (listType === 'tierlist' && (typeConfig.tiers || []).length > 10) {
            alert('Las tierlists pueden tener un máximo de 10 niveles. Elimina algunos para continuar.');
            return;
        }
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
            const rankingMediaType = listType === 'ranking' && !template
                ? dbContent.find(item => item?.media_type === 'game' || item?.media_type === 'anime')?.media_type || mediaType
                : mediaType;
            const payload = {
                title: title.trim(),
                list_type: listType,
                media_type: rankingMediaType,
                type_config: typeConfig,
                content: dbContent,
                visibility,
                template_id: template?.id || null,
                user_id: user?.id
            };
            if (!id && (template?.id || listType === 'ranking')) {
                const draftKey = publishDraftKey || (typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
                const draft = {
                    templateTitle: template?.title || '',
                    editor: {
                        title: title.trim(), listType, mediaType, typeConfig, content,
                        pool, visibility, templateId: template?.id || null,
                    },
                    payload,
                };
                sessionStorage.setItem(`share-list-draft:${draftKey}`, JSON.stringify(draft));
                navigate(`/share?listDraft=${encodeURIComponent(draftKey)}`);
                return;
            }
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
                            <span>{id ? 'Guardar cambios' : template?.id || listType === 'ranking' ? 'Continuar' : 'Publicar'}</span>
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
                                {typeConfig.tiers?.map((tier, index) => (
                                    <TierRow
                                        key={tier.id}
                                        tier={tier}
                                        items={content[tier.id] || []}
                                        editable={isEditableTemplateTierlist}
                                        onLabelChange={label => updateTier(tier.id, { label })}
                                        onColorChange={color => updateTier(tier.id, { color })}
                                        onRemove={() => removeTier(tier.id)}
                                        onMove={direction => moveTier(tier.id, direction)}
                                        canMoveUp={index > 0}
                                        canMoveDown={index < typeConfig.tiers.length - 1}
                                        canRemove={(typeConfig.tiers || []).length > 1}
                                    />
                                ))}
                                {isEditableTemplateTierlist && <button type="button" className="cl-add-tier-btn" onClick={addTier} disabled={(typeConfig.tiers || []).length >= 10}>
                                    {(typeConfig.tiers || []).length < 10 && <IconPlus />} {(typeConfig.tiers || []).length >= 10 ? 'Máximo de 10 tiers' : 'Añadir fila'}
                                </button>}
                            </div>
                        )}

                        {/* RANKING */}
                        {listType === 'ranking' && (
                            <>
                            {!template && <div className="cl-ranking-count-control" aria-label="Cantidad de puestos">
                                <span>Puestos</span>
                                <button type="button" onClick={() => changeRankingSize(-1)} disabled={(typeConfig.max_items || 10) <= 1} aria-label="Quitar un puesto">−</button>
                                <strong>{typeConfig.max_items || 10}</strong>
                                <button type="button" onClick={() => changeRankingSize(1)} disabled={(typeConfig.max_items || 10) >= 30} aria-label="Añadir un puesto">+</button>
                            </div>}
                            <div className="cl-ranking-stack">
                                {Array.from({ length: typeConfig.max_items || 10 }).map((_, i) => (
                                    <div key={i} className={`cl-ranking-row top-${i}`}>
                                        <div className="cl-ranking-badge">{i + 1}</div>
                                        <div className="cl-ranking-slot">
                                        <DropZone
                                            id={`r${i}`}
                                            items={content[`r${i}`] || []}
                                            isRanking
                                            onEmptyClick={() => {
                                                setRankingSlotTarget(`r${i}`);
                                                setActiveTab('search');
                                                setSearchQuery('');
                                                setSidebarCollapsed(false);
                                                setIsMobileSearchOpen(window.matchMedia('(max-width: 900px)').matches);
                                            }}
                                        />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </>
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
                                        {listType === 'ranking' && !template && <div className="cl-ranking-media-control in-search" role="group" aria-label="Filtrar la búsqueda por categoría">
                                            <button type="button" className={mediaType === 'game' ? 'active' : ''} aria-pressed={mediaType === 'game'} onClick={() => { setMediaType('game'); setSearchQuery(''); }}>Juegos</button>
                                            <button type="button" className={mediaType === 'anime' ? 'active' : ''} aria-pressed={mediaType === 'anime'} onClick={() => { setMediaType('anime'); setSearchQuery(''); }}>Anime</button>
                                        </div>}
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
                                        </div>

                                        <div className="cl-results">
                                            {searchQuery.trim().length === 0 && !isSearching && searchResults.length > 0 && <div className="cl-results-heading">Más registradas</div>}
                                            <div className="cl-results-grid">
                                            {isSearching && Array.from({ length: 9 }, (_, index) => <div className="cl-result-skeleton" key={`result-skeleton-${index}`}><span/><i/><b/></div>)}
                                            {!isSearching && searchQuery.length < 2 && searchResults.length === 0 && (
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
                                                const isAdded = pool.some(p => p.id === String(item.id))
                                                    || Object.values(content || {}).flat().some(placed => String(placed?.id) === String(item.id));
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
                                                handleAddToPool(newItem);
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
function TierRow({ tier, items, editable = false, onLabelChange, onColorChange, onRemove, onMove, canMoveUp = true, canMoveDown = true, canRemove = false }) {
    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
    const tierRowRef = useRef(null);
    useEffect(() => {
        if (!isColorMenuOpen) return;
        const closeOnOutsideClick = event => {
            if (!tierRowRef.current?.contains(event.target)) setIsColorMenuOpen(false);
        };
        const closeOnEscape = event => {
            if (event.key === 'Escape') setIsColorMenuOpen(false);
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isColorMenuOpen]);
    return (
        <div className="cl-tier-row" ref={tierRowRef}>
            <div className="cl-tier-label" style={{ backgroundColor: tier.color }}>
                {editable
                    ? <TierLabelEditor className="cl-tier-label-input" aria-label={`Nombre del nivel ${tier.label}`} label={tier.label} style={{ fontSize: getTierLabelFontSize(tier.label) }} onChange={label => onLabelChange?.(label)} />
                    : <span className="cl-tier-text" style={{ fontSize: getTierLabelFontSize(tier.label) }}>{tier.label}</span>}
            </div>
            <DropZone id={tier.id} items={items} />
            {editable && <div className="cl-tier-controls" aria-label={`Controles del nivel ${tier.label}`}>
                <button type="button" className="cl-tier-control-btn" aria-label={`Editar color de ${tier.label}`} title="Color" onClick={() => setIsColorMenuOpen(open => !open)}><IconSettings /></button>
                <button type="button" className="cl-tier-control-btn" aria-label={`Subir ${tier.label}`} title="Subir nivel" disabled={!canMoveUp} onClick={() => onMove?.(-1)}><IconChevronUp /></button>
                <button type="button" className="cl-tier-control-btn" aria-label={`Bajar ${tier.label}`} title="Bajar nivel" disabled={!canMoveDown} onClick={() => onMove?.(1)}><IconChevronDown /></button>
            </div>}
            {editable && isColorMenuOpen && <div className="cl-tier-color-menu" onClick={event => event.stopPropagation()}>
                <div className="cl-tier-color-grid">{TIER_COLORS_PALETTE.map(color => <button key={color} type="button" className={`cl-tier-color-swatch${tier.color === color ? ' is-active' : ''}`} aria-label={`Elegir color ${color}`} title={color} style={{ backgroundColor: color }} onClick={() => onColorChange?.(color)} />)}</div>
                <label className="cl-tier-custom-color">Personalizado<input type="color" value={tier.color || '#6b7280'} aria-label="Color personalizado" onChange={event => onColorChange?.(event.target.value)} /></label>
                {canRemove && <button type="button" className="cl-tier-delete-action" onClick={() => { onRemove?.(); setIsColorMenuOpen(false); }}>Eliminar tier</button>}
            </div>}
        </div>
    );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ id, items, isPool, onRemoveItem, isRanking = false, onEmptyClick }) {
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
            {items.length === 0 && isRanking && onEmptyClick && (
                <button type="button" className="cl-ranking-empty-select" onClick={onEmptyClick}>
                    <IconPlus />
                    <span>Elegir obra</span>
                </button>
            )}
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
