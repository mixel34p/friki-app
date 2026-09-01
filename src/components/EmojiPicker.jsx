import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { STANDARD_EMOJIS } from '../lib/standardEmojis';
import Twemoji from 'react-twemoji';
import './EmojiPicker.css';

export default function EmojiPicker({ onSelect, onClose }) {
    const { user } = useAuth();
    const [emojisGrouped, setEmojisGrouped] = useState([]);
    const [recentEmojis, setRecentEmojis] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [hoveredEmoji, setHoveredEmoji] = useState(null);
    const pickerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                if (!event.target.closest('.chat-emoji-btn')) {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        loadEmojis();
        
        // Load recents
        try {
            const saved = localStorage.getItem('friki_recent_emojis');
            if (saved) setRecentEmojis(JSON.parse(saved));
        } catch(e){}
    }, [user]);

    const loadEmojis = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Get user spaces
            const { data: memberSpaces } = await supabase
                .from('space_members')
                .select('space_id')
                .eq('user_id', user.id);
                
            const spaceIds = memberSpaces ? memberSpaces.map(m => m.space_id) : [];
            
            // Get emojis
            let query = supabase.from('custom_emojis').select('*, space:spaces(name, avatar_url)');
            if (spaceIds.length > 0) {
                query = query.in('space_id', spaceIds);
            } else {
                setEmojisGrouped([]);
                setLoading(false);
                return;
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            const grouped = {};
            (data || []).forEach(emoji => {
                const spaceName = emoji.space?.name || 'Global';
                const spaceAvatar = emoji.space?.avatar_url || null;
                if (!grouped[spaceName]) {
                    grouped[spaceName] = { name: spaceName, avatar: spaceAvatar, emojis: [] };
                }
                grouped[spaceName].emojis.push(emoji);
            });
            
            setEmojisGrouped(Object.values(grouped));
        } catch (err) {
            console.error('Error loading emojis:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (emojiObj) => {
        // Save to recents
        let recents = [...recentEmojis];
        const existingIdx = recents.findIndex(e => e.name === emojiObj.name && (e.isStandard === emojiObj.isStandard));
        if (existingIdx !== -1) {
            recents.splice(existingIdx, 1);
        }
        recents.unshift(emojiObj);
        if (recents.length > 20) recents = recents.slice(0, 20);
        setRecentEmojis(recents);
        try { localStorage.setItem('friki_recent_emojis', JSON.stringify(recents)); } catch(e){}
        
        if (emojiObj.isStandard) {
            onSelect(emojiObj.char);
        } else {
            onSelect(`:${emojiObj.name}:`);
        }
        onClose();
    };

    const scrollToGroup = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="emoji-picker-container" ref={pickerRef} onClick={e => e.stopPropagation()}>
            <div className="emoji-picker-header">
                <div className="emoji-picker-tabs">
                    <button className="ep-tab active">Emojis</button>
                    <button className="ep-tab">Stickers</button>
                    <button className="ep-tab">GIF</button>
                </div>
                <div className="emoji-picker-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input 
                        type="text" 
                        placeholder="Encuentra el emoji perfecto" 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="emoji-picker-body">
                <div className="emoji-picker-sidebar">
                    <div className="ep-cat-icon active" title="Recientes" onClick={() => scrollToGroup('group-recents')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    {emojisGrouped.map((group, idx) => (
                        <div key={idx} className="ep-cat-icon" title={group.name} onClick={() => scrollToGroup('group-space-' + idx)}>
                            {group.avatar ? (
                                <img src={group.avatar} alt={group.name} />
                            ) : (
                                <div className="ep-cat-placeholder">{group.name.substring(0, 2).toUpperCase()}</div>
                            )}
                        </div>
                    ))}
                    <div className="ep-cat-icon" title="Emojis estándar" onClick={() => scrollToGroup('group-standard')}>
                        <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }} style={{width: '18px', height: '18px', display: 'flex'}}>😀</Twemoji>
                    </div>
                </div>
                
                <div className="emoji-picker-content">
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
                    ) : (
                        <>
                            {recentEmojis.length > 0 && !search && (
                                <div id="group-recents" className="emoji-group">
                                    <h4 className="emoji-group-title">Recientes</h4>
                                    <div className="emoji-grid-picker">
                                        {recentEmojis.map((emoji, i) => (
                                            <div 
                                                key={'r'+i} 
                                                className="emoji-item"
                                                onClick={() => handleSelect(emoji)}
                                                onMouseEnter={() => setHoveredEmoji(emoji)}
                                                onMouseLeave={() => setHoveredEmoji(null)}
                                            >
                                                {emoji.isStandard ? <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }} style={{width: '24px', height: '24px', display: 'flex'}}>{emoji.char}</Twemoji> : <img src={emoji.image_url} alt={emoji.name} />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {emojisGrouped.map((group, idx) => {
                                const filteredEmojis = group.emojis.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
                                if (filteredEmojis.length === 0) return null;
                                
                                return (
                                    <div key={idx} id={'group-space-' + idx} className="emoji-group">
                                        <h4 className="emoji-group-title">
                                            Emojis en {group.name}
                                        </h4>
                                        <div className="emoji-grid-picker">
                                            {filteredEmojis.map(emoji => (
                                                <div 
                                                    key={emoji.id} 
                                                    className="emoji-item"
                                                    onClick={() => handleSelect(emoji)}
                                                    onMouseEnter={() => setHoveredEmoji(emoji)}
                                                    onMouseLeave={() => setHoveredEmoji(null)}
                                                >
                                                    <img src={emoji.image_url} alt={emoji.name} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Standard Emojis */}
                            {(() => {
                                const filteredStandard = STANDARD_EMOJIS.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
                                if (filteredStandard.length === 0) return null;
                                return (
                                    <div id="group-standard" className="emoji-group">
                                        <h4 className="emoji-group-title">Emojis estándar</h4>
                                        <div className="emoji-grid-picker">
                                            {filteredStandard.map(emoji => (
                                                <div 
                                                    key={emoji.name} 
                                                    className="emoji-item"
                                                    onClick={() => handleSelect({...emoji, isStandard: true})}
                                                    onMouseEnter={() => setHoveredEmoji({...emoji, isStandard: true})}
                                                    onMouseLeave={() => setHoveredEmoji(null)}
                                                >
                                                    <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }} style={{width: '24px', height: '24px', display: 'flex'}}>{emoji.char}</Twemoji>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            </div>
            
            <div className="emoji-picker-footer">
                {hoveredEmoji ? (
                    <div className="ep-footer-info">
                        {hoveredEmoji.isStandard ? (
                            <Twemoji options={{ className: 'twemoji', folder: 'svg', ext: '.svg' }} className="ep-footer-img" style={{display:'flex',alignItems:'center',justifyContent:'center',width:'24px',height:'24px'}}>
                                {hoveredEmoji.char}
                            </Twemoji>
                        ) : (
                            <img src={hoveredEmoji.image_url} alt="preview" className="ep-footer-img" />
                        )}
                        <div className="ep-footer-text">
                            <strong>:{hoveredEmoji.name}:</strong>
                            <span>{hoveredEmoji.isStandard ? 'Estándar' : 'de ' + (hoveredEmoji.space?.name || 'Global')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="ep-footer-info">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                        <div className="ep-footer-text">
                            <span style={{ color: 'var(--text-muted)' }}>Selecciona un emoji</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
