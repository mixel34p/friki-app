import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Twemoji from 'react-twemoji';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { EMOJI_CATEGORIES } from '../lib/standardEmojis';
import './EmojiPicker.css';

// --- SVG icons for emoji categories ---
const CATEGORY_ICONS = {
    recents: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
    ),
    smileys: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
    ),
    nature: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
    ),
    food: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
    ),
    activities: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
        </svg>
    ),
    travel: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
    ),
    objects: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8.56" y1="2.75" x2="7.56" y2="7.75"/><line x1="3.44" y1="4.56" x2="6.71" y2="7.03"/><line x1="2" y1="10" x2="7" y2="10"/><path d="M12 22V16"/><path d="M12 16C8.13 16 5 12.87 5 9A7 7 0 0 1 19 9c0 3.87-3.13 7-7 7z"/>
        </svg>
    ),
    symbols: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
    ),
    flags: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
    ),
};

// Module-level cache — survives re-mounts, cleared on user change
let _customEmojiCache = null;
let _customEmojiCacheUserId = null;

// ─────────────────────────────────────────────────────────────────────────────
// StandardEmojiGrid — memoized so it NEVER re-renders after first mount.
// Callbacks are accessed via refs to avoid breaking memo equality.
// ─────────────────────────────────────────────────────────────────────────────
const StandardEmojiGrid = memo(function StandardEmojiGrid({ emojis, onSelectRef, onHoverRef }) {
    return (
        <div className="emoji-grid-picker">
            {emojis.map(emoji => (
                <div
                    key={emoji.name}
                    className="emoji-item"
                    title={`:${emoji.name}:`}
                    onClick={() => onSelectRef.current({ ...emoji, isStandard: true })}
                    onMouseEnter={() => onHoverRef.current({ ...emoji, isStandard: true })}
                    onMouseLeave={() => onHoverRef.current(null)}
                >
                    <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}>
                        {emoji.char}
                    </Twemoji>
                </div>
            ))}
        </div>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main EmojiPicker
// ─────────────────────────────────────────────────────────────────────────────
export default function EmojiPicker({ onSelect, onSelectGif, onClose, style, disableMediaTabs = false, isOpen = true }) {
    const { user } = useAuth();
    const [customEmojisGrouped, setCustomEmojisGrouped] = useState([]);
    const [recentEmojis, setRecentEmojis] = useState(() => {
        try { return JSON.parse(localStorage.getItem('friki_recent_emojis') || '[]'); } catch { return []; }
    });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [hoveredEmoji, setHoveredEmoji] = useState(null);
    const [activeTab, setActiveTab] = useState('recents');
    const [mainTab, setMainTab] = useState('emoji');
    const [gifs, setGifs] = useState([]);
    const [loadingGifs, setLoadingGifs] = useState(false);
    const [recentGifs, setRecentGifs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('friki_recent_gifs') || '[]'); } catch { return []; }
    });
    const pickerRef = useRef(null);
    const contentRef = useRef(null);
    const searchRef = useRef(null);

    // ── Reset state when closed ──
    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setMainTab('emoji');
            setActiveTab('recents');
        }
    }, [isOpen]);

    // Stable refs for callbacks — lets StandardEmojiGrid stay memo'd
    // even though handleSelect/setHoveredEmoji update over time
    const onSelectRef = useRef(null);
    const onHoverRef = useRef(setHoveredEmoji);

    // ── Click outside ──
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pickerRef.current && (pickerRef.current.offsetWidth === 0 && pickerRef.current.offsetHeight === 0)) return; // Ignorar si está oculto
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                if (!e.target.closest?.('.chat-emoji-btn') && !e.target.closest?.('.chat-action-btn') && !e.target.closest?.('.chat-dropdown-item')) {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // ── Load custom emojis (module-level cache) ──
    useEffect(() => {
        if (!user) return;
        if (_customEmojiCache && _customEmojiCacheUserId === user.id) {
            setCustomEmojisGrouped(_customEmojiCache);
            return;
        }
        setLoading(true);
        (async () => {
            try {
                const { data: memberSpaces } = await supabase
                    .from('space_members').select('space_id').eq('user_id', user.id);
                const spaceIds = memberSpaces?.map(m => m.space_id) ?? [];
                if (!spaceIds.length) {
                    _customEmojiCache = [];
                    _customEmojiCacheUserId = user.id;
                    setCustomEmojisGrouped([]);
                    return;
                }
                const { data } = await supabase
                    .from('custom_emojis')
                    .select('id, name, image_url, space_id, space:spaces(name, avatar_url)')
                    .in('space_id', spaceIds);
                const grouped = {};
                (data || []).forEach(e => {
                    const key = e.space?.name || 'Global';
                    if (!grouped[key]) grouped[key] = { name: key, avatar: e.space?.avatar_url ?? null, emojis: [] };
                    grouped[key].emojis.push(e);
                });
                const result = Object.values(grouped);
                _customEmojiCache = result;
                _customEmojiCacheUserId = user.id;
                setCustomEmojisGrouped(result);
            } catch (err) {
                console.error('EmojiPicker:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [user]);

    const [gifError, setGifError] = useState(false);

    // ── Fetch GIFs ──
    useEffect(() => {
        if (mainTab !== 'gif') return;
        
        const q = search.trim();
        if (!q) {
            setGifs(recentGifs);
            setLoadingGifs(false);
            setGifError(false);
            return;
        }

        let active = true;
        setLoadingGifs(true);
        setGifError(false);

        const fetchGifs = async () => {
            try {
                // Se leerá desde el archivo .env
                const apiKey = import.meta.env.VITE_GIPHY_API_KEY || 'GlVGYHqc3SyCEGqme3ZqONHq9W12C7sD';
                const endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=30`;
                
                const res = await fetch(endpoint);
                if (res.status === 401 || res.status === 403 || res.status === 429) {
                    if (active) setGifError(true);
                    throw new Error('API Key unauthorized or rate limited');
                }
                const data = await res.json();
                if (active && data.data) {
                    setGifs(data.data.map(g => ({
                        id: g.id,
                        preview: g.images.fixed_height_small.url,
                        url: g.images.downsized_medium?.url || g.images.downsized?.url || g.images.fixed_height.url
                    })));
                }
            } catch (e) {
                console.error('Error fetching GIFs:', e);
                if (active) setGifs([]);
            } finally {
                if (active) setLoadingGifs(false);
            }
        };
        
        const timeoutId = setTimeout(fetchGifs, 500);
        return () => {
            active = false;
            clearTimeout(timeoutId);
        };
    }, [mainTab, search, recentGifs]);

    // ── Select handler ──
    const handleSelect = useCallback((emojiObj) => {
        try {
            const currentSaved = JSON.parse(localStorage.getItem('friki_recent_emojis') || '[]');
            const next = [emojiObj, ...currentSaved.filter(e => !(e.name === emojiObj.name && e.isStandard === emojiObj.isStandard))].slice(0, 24);
            localStorage.setItem('friki_recent_emojis', JSON.stringify(next));
            setRecentEmojis(next); // This might be aborted by unmount, but localstorage is already saved
        } catch (err) {
            console.error('Error saving recent emojis', err);
        }
        
        onSelect(emojiObj.isStandard ? emojiObj.char : `:${emojiObj.name}:`);
        onClose();
    }, [onSelect, onClose]);

    // Keep refs in sync
    onSelectRef.current = handleSelect;
    onHoverRef.current = setHoveredEmoji;

    // ── Scroll to group ──
    const scrollToGroup = useCallback((id) => {
        const el = contentRef.current?.querySelector(`#ep-group-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const handleTabClick = useCallback((tabId) => {
        setActiveTab(tabId);
        setSearch('');
        setTimeout(() => scrollToGroup(tabId), 30);
    }, [scrollToGroup]);

    // ── Memoized search results ──
    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return null;
        const custom = customEmojisGrouped
            .map(g => ({ ...g, emojis: g.emojis.filter(e => e.name.toLowerCase().includes(q)) }))
            .filter(g => g.emojis.length > 0);
        const standard = EMOJI_CATEGORIES
            .map(cat => ({ ...cat, emojis: cat.emojis.filter(e => e.name.toLowerCase().includes(q)) }))
            .filter(cat => cat.emojis.length > 0);
        return { custom, standard, empty: !custom.length && !standard.length };
    }, [search, customEmojisGrouped]);

    return (
        <>
            <div className="mobile-emoji-overlay" onClick={onClose} style={{ display: style?.display === 'none' ? 'none' : '' }} />
            <div className="emoji-picker-container" ref={pickerRef} onClick={e => e.stopPropagation()} style={style}>

            {/* ── TOP TABS: Emoji / GIF / Sticker ── */}
            {!disableMediaTabs && (
                <div className="ep-main-tabs">
                    <button type="button" className={`ep-main-tab ${mainTab === 'emoji' ? 'active' : ''}`} onClick={() => setMainTab('emoji')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                        </svg>
                        Emoji
                    </button>
                    <button type="button" className={`ep-main-tab ${mainTab === 'gif' ? 'active' : ''}`} onClick={() => setMainTab('gif')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
                        </svg>
                        GIF
                    </button>
                    <button type="button" className={`ep-main-tab ${mainTab === 'sticker' ? 'active' : ''}`} onClick={() => setMainTab('sticker')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        Sticker
                    </button>
                </div>
            )}

            {/* ── SEARCH BAR ── */}
            <div className="emoji-picker-header">
                <div className="emoji-picker-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={mainTab === 'gif' ? 'Buscar GIF...' : mainTab === 'sticker' ? 'Buscar sticker...' : 'Buscar emoji...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button className="ep-search-clear" type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div className="emoji-picker-content" ref={contentRef}>

                {mainTab === 'emoji' && (
                    <>
                        {loading ? (
                            <div className="ep-loading">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ep-spinner">
                                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                                </svg>
                            </div>
                        ) : searchResults ? (
                            <>
                                {searchResults.empty && <div className="ep-no-results">Sin resultados para "{search}"</div>}

                                {searchResults.custom.map((g, i) => (
                                    <div key={i} className="emoji-group">
                                        <h4 className="emoji-group-title">{g.name}</h4>
                                        <div className="emoji-grid-picker">
                                            {g.emojis.map(e => (
                                                <div key={e.id} className="emoji-item" title={`:${e.name}:`}
                                                    onClick={() => handleSelect(e)}
                                                    onMouseEnter={() => setHoveredEmoji(e)}
                                                    onMouseLeave={() => setHoveredEmoji(null)}>
                                                    <img src={e.image_url} alt={e.name} loading="lazy" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {searchResults.standard.map(cat => (
                                    <div key={cat.id} className="emoji-group">
                                        <h4 className="emoji-group-title">{cat.name}</h4>
                                        <StandardEmojiGrid emojis={cat.emojis} onSelectRef={onSelectRef} onHoverRef={onHoverRef} />
                                    </div>
                                ))}
                            </>
                        ) : (
                            <>
                                {/* Recents */}
                                {recentEmojis.length > 0 && (
                                    <div id="ep-group-recents" className="emoji-group">
                                        <h4 className="emoji-group-title">Recientes</h4>
                                        <div className="emoji-grid-picker">
                                            {recentEmojis.map((e, i) => (
                                                <div key={i} className="emoji-item" title={`:${e.name}:`}
                                                    onClick={() => handleSelect(e)}
                                                    onMouseEnter={() => setHoveredEmoji(e)}
                                                    onMouseLeave={() => setHoveredEmoji(null)}>
                                                    {e.isStandard
                                                        ? <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }}>{e.char}</Twemoji>
                                                        : <img src={e.image_url} alt={e.name} loading="lazy" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Custom space emojis */}
                                {customEmojisGrouped.map((group, idx) => (
                                    <div key={idx} id={`ep-group-custom-${idx}`} className="emoji-group">
                                        <h4 className="emoji-group-title">
                                            {group.avatar && <img src={group.avatar} alt="" style={{ width: '12px', height: '12px', borderRadius: '50%', objectFit: 'cover' }} />}
                                            {group.name}
                                        </h4>
                                        <div className="emoji-grid-picker">
                                            {group.emojis.map(e => (
                                                <div key={e.id} className="emoji-item" title={`:${e.name}:`}
                                                    onClick={() => handleSelect(e)}
                                                    onMouseEnter={() => setHoveredEmoji(e)}
                                                    onMouseLeave={() => setHoveredEmoji(null)}>
                                                    <img src={e.image_url} alt={e.name} loading="lazy" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {/* Standard categories — each grid is memoized, renders once */}
                                {EMOJI_CATEGORIES.map(cat => (
                                    <div key={cat.id} id={`ep-group-${cat.id}`} className="emoji-group">
                                        <h4 className="emoji-group-title">
                                            <span className="ep-cat-title-icon">{CATEGORY_ICONS[cat.id]}</span>
                                            {cat.name}
                                        </h4>
                                        <StandardEmojiGrid
                                            emojis={cat.emojis}
                                            onSelectRef={onSelectRef}
                                            onHoverRef={onHoverRef}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}

                {mainTab === 'gif' && (
                    <div className="ep-gifs-container" style={{ padding: '8px' }}>
                        {loadingGifs ? (
                            <div className="ep-loading">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ep-spinner">
                                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                                </svg>
                            </div>
                        ) : gifs.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {gifs.map(gif => (
                                    <img 
                                        key={gif.id} 
                                        src={gif.preview} 
                                        alt="gif" 
                                        style={{ width: '100%', borderRadius: '4px', cursor: 'pointer', objectFit: 'cover', minHeight: '80px', backgroundColor: 'var(--bg-modifier-hover)' }}
                                        onClick={() => {
                                            try {
                                                const currentSaved = JSON.parse(localStorage.getItem('friki_recent_gifs') || '[]');
                                                const next = [gif, ...currentSaved.filter(g => g.id !== gif.id)].slice(0, 24);
                                                localStorage.setItem('friki_recent_gifs', JSON.stringify(next));
                                                setRecentGifs(next);
                                            } catch (err) {
                                                console.error('Error saving recent gifs', err);
                                            }
                                            if (onSelectGif) onSelectGif(gif.url);
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="ep-no-results" style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                                {gifError 
                                    ? "⚠️ Error conectando con Giphy. Si acabas de poner la API Key, reinicia el servidor (npm run dev)."
                                    : (!search.trim() ? "No tienes GIFs recientes" : `Sin resultados para "${search}"`)
                                }
                            </div>
                        )}
                    </div>
                )}

                {mainTab === 'sticker' && (
                    <div className="ep-coming-soon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        <span>Stickers próximamente</span>
                    </div>
                )}
            </div>

            {/* ── FOOTER (emoji tab only) ── */}
            {mainTab === 'emoji' && (
                <div className="emoji-picker-footer">
                    <div className="ep-footer-tabs-wrapper">
                        <div className="ep-footer-tabs">
                            <button type="button" className={`ep-footer-tab ${activeTab === 'recents' ? 'active' : ''}`} title="Recientes" onClick={() => handleTabClick('recents')}>
                                {CATEGORY_ICONS.recents}
                            </button>

                            {customEmojisGrouped.length > 0 && (
                                <>
                                    <div className="ep-footer-tab-divider" />
                                    {customEmojisGrouped.map((g, i) => (
                                        <button key={i} type="button" className={`ep-footer-tab ${activeTab === `custom-${i}` ? 'active' : ''}`} title={g.name} onClick={() => handleTabClick(`custom-${i}`)}>
                                            {g.avatar
                                                ? <img src={g.avatar} alt={g.name} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                                                : <span style={{ fontSize: '0.55rem', fontWeight: 700 }}>{g.name.substring(0, 2).toUpperCase()}</span>
                                            }
                                        </button>
                                    ))}
                                </>
                            )}

                            <div className="ep-footer-tab-divider" />

                            {EMOJI_CATEGORIES.map(cat => (
                                <button key={cat.id} type="button" className={`ep-footer-tab ${activeTab === cat.id ? 'active' : ''}`} title={cat.name} onClick={() => handleTabClick(cat.id)}>
                                    {CATEGORY_ICONS[cat.id]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ep-footer-preview">
                        {hoveredEmoji ? (
                            <div className="ep-footer-info">
                                {hoveredEmoji.isStandard
                                    ? <Twemoji options={{ className: 'twemoji ep-footer-img', folder: 'svg', ext: '.svg' }}>{hoveredEmoji.char}</Twemoji>
                                    : <img src={hoveredEmoji.image_url} alt="preview" className="ep-footer-img" />
                                }
                                <strong className="ep-footer-name">:{hoveredEmoji.name}:</strong>
                            </div>
                        ) : (
                            <div className="ep-footer-hint">Selecciona un emoji</div>
                        )}
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
