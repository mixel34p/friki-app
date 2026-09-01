import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useOutletContext } from 'react-router-dom';
import { getChannelMessages, sendMessage, updateMessage, toggleReaction } from '../../lib/spaceService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Twemoji from 'react-twemoji';
import './LiveChat.css';
import { BADGES_MAP } from '../../lib/badges';

export default function LiveChat() {
    const { channelId } = useParams();
    const { user } = useAuth();
    const { channels, space } = useOutletContext();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [dropdownCoords, setDropdownCoords] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [translations, setTranslations] = useState({});
    const endRef = useRef(null);
    const scrollRef = useRef(null);
    const textareaRef = useRef(null);
    const maxChars = 3000;
    const isOverLimit = text.length > maxChars;
    const overage = text.length - maxChars;

    const channel = channels?.find(c => c.id === channelId);

    const getLanguageName = (code) => {
        if (!code || code === 'auto') return 'idioma detectado';
        try {
            const displayNames = new Intl.DisplayNames(['es'], { type: 'language' });
            return displayNames.of(code).toLowerCase();
        } catch (e) {
            return code;
        }
    };

    const handleTranslate = async (msgId, text) => {
        setTranslations(prev => ({ ...prev, [msgId]: { isLoading: true } }));
        setActiveDropdown(null);
        try {
            // Using MyMemory API (free, no CORS issues, no auth needed for basic usage)
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=Autodetect|es`);
            const data = await response.json();
            
            if (data.responseStatus !== 200 && data.responseStatus !== '200') {
                throw new Error(data.responseDetails || 'Error en la API de traducción');
            }
            
            const translatedText = data.responseData.translatedText;
            
            let sourceLang = 'auto';
            if (data.responseData?.detectedLanguage) {
                // detectedLanguage can be "en" or "en-GB"
                sourceLang = data.responseData.detectedLanguage.split('-')[0];
            } else if (data.matches && data.matches.length > 0 && typeof data.matches[0].source === 'string') {
                sourceLang = data.matches[0].source.split('-')[0];
            }
            
            setTranslations(prev => ({ 
                ...prev, 
                [msgId]: { isLoading: false, text: translatedText, sourceLang } 
            }));
        } catch (error) {
            console.error("Translation error", error);
            setTranslations(prev => ({ 
                ...prev, 
                [msgId]: { isLoading: false, text: "Error al traducir el mensaje.", sourceLang: 'error' } 
            }));
        }
    };

    const dismissTranslation = (msgId) => {
        setTranslations(prev => {
            const newTrans = { ...prev };
            delete newTrans[msgId];
            return newTrans;
        });
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.chat-dropdown') && !e.target.closest('.chat-action-btn')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeleteMessage = async (msgId) => {
        try {
            const { error } = await supabase.from('space_messages').delete().eq('id', msgId).eq('user_id', user.id);
            if (error) throw error;
            setMessages(prev => prev
                .filter(m => m.id !== msgId)
                .map(m => m.reply_to_id === msgId ? { ...m, reply_to: null } : m)
            );
        } catch (error) {
            console.error('Error deleting message:', error);
            alert("No se pudo borrar el mensaje. Refresca la página y vuelve a intentarlo.");
        }
    };

    const startEditing = (msg) => {
        setEditingMessageId(msg.id);
        setEditingText(msg.content);
        setActiveDropdown(null);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingText('');
    };

    const handleSaveEdit = async () => {
        if (!editingText.trim()) return;
        try {
            await updateMessage(editingMessageId, user.id, editingText);
            setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editingText, updated_at: new Date().toISOString() } : m));
            cancelEditing();
        } catch (e) {
            console.error("Error editing", e);
        }
    };

    const startReplying = (msg) => {
        setReplyingTo(msg);
        setActiveDropdown(null);
        textareaRef.current?.focus();
    };

    const cancelReplying = () => {
        setReplyingTo(null);
    };

    const handleToggleReaction = async (msgId, emoji) => {
        try {
            const res = await toggleReaction(msgId, user.id, emoji);
            setMessages(prev => prev.map(msg => {
                if (msg.id === msgId) {
                    let newReactions = [...(msg.reactions || [])];
                    if (res.action === 'added') {
                        newReactions.push(res.reaction);
                    } else {
                        newReactions = newReactions.filter(r => !(r.user_id === user.id && r.emoji === emoji));
                    }
                    return { ...msg, reactions: newReactions };
                }
                return msg;
            }));
            setActiveDropdown(null);
        } catch (e) {
            console.error("Error toggling reaction", e);
        }
    };

    useEffect(() => {
        if (!channel?.id) return;

        const loadMessages = async () => {
            try {
                const data = await getChannelMessages(channel.id);
                setMessages(data);
                scrollToBottom();
            } catch (error) {
                console.error("Error cargando mensajes", error);
            }
        };

        loadMessages();

        const subscription = supabase
            .channel(`channel_${channel.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'space_messages', filter: `channel_id=eq.${channel.id}` }, async payload => {
                const { data: fullMsg } = await supabase
                    .from('space_messages')
                    .select(`
                        *,
                        user:profiles (username, display_name, avatar_url, featured_badge),
                        reactions:space_message_reactions (
                            id, emoji, user_id,
                            user:profiles (username, display_name, avatar_url, featured_badge)
                        ),
                        reply_to:space_messages (
                            id, content,
                            user:profiles (username, display_name, avatar_url, featured_badge)
                        )
                    `)
                    .eq('id', payload.new.id)
                    .single();

                if (fullMsg) {
                    setMessages(prev => {
                        const exists = prev.find(m => m.id === fullMsg.id);
                        if (exists) {
                            return prev.map(m => {
                                if (m.id === fullMsg.id) {
                                    if (fullMsg.reply_to_id && (!fullMsg.reply_to || (Array.isArray(fullMsg.reply_to) && fullMsg.reply_to.length === 0)) && m.reply_to) {
                                        fullMsg.reply_to = m.reply_to;
                                    }
                                    return fullMsg;
                                }
                                return m;
                            });
                        }
                        return [...prev, fullMsg];
                    });
                    setTimeout(scrollToBottom, 100);
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'space_messages', filter: `channel_id=eq.${channel.id}` }, payload => {
                setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, content: payload.new.content, updated_at: payload.new.updated_at } : m));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'space_messages' }, payload => {
                setMessages(prev => {
                    const deletedId = payload.old.id;
                    return prev
                        .filter(m => m.id !== deletedId)
                        .map(m => m.reply_to_id === deletedId ? { ...m, reply_to: null } : m);
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_message_reactions' }, async payload => {
                if (payload.eventType === 'INSERT') {
                    const { data: reaction } = await supabase
                        .from('space_message_reactions')
                        .select('id, emoji, user_id, user:profiles(username, display_name, avatar_url, featured_badge)')
                        .eq('id', payload.new.id)
                        .single();
                    if (reaction) {
                        setMessages(prev => prev.map(m => {
                            if (m.id === payload.new.message_id) {
                                const exists = m.reactions?.find(r => r.id === reaction.id);
                                if (exists) return m;
                                return { ...m, reactions: [...(m.reactions || []), reaction] };
                            }
                            return m;
                        }));
                    }
                } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.map(m => ({
                        ...m,
                        reactions: m.reactions ? m.reactions.filter(r => r.id !== payload.old.id) : []
                    })));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [channel?.id]);

    const scrollToBottom = () => {
        setTimeout(() => {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [text]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || !user || isOverLimit) return;
        try {
            const newMsg = await sendMessage(channel?.id, user.id, text, replyingTo?.id);
            if (replyingTo && (!newMsg.reply_to || (Array.isArray(newMsg.reply_to) && newMsg.reply_to.length === 0))) {
                newMsg.reply_to = replyingTo; // Polyfill the relation locally before Supabase Realtime/reload
            }
            setText('');
            setReplyingTo(null);
            setMessages(prev => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            setTimeout(scrollToBottom, 100);
        } catch (error) {
            console.error('Error sending message', error);
        }
    };

    const handleInput = (e) => {
        setText(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    let lastUserId = null;
    let lastTime = null;
    let lastDateString = null;
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDateHeader = (date) => {
        const dateStr = date.toDateString();
        if (dateStr === today.toDateString()) return "Hoy";
        if (dateStr === yesterday.toDateString()) return "Ayer";
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const groupedMessages = messages.map(msg => {
        const msgDate = new Date(msg.created_at);
        const currentDateString = msgDate.toDateString();
        const msgTime = msgDate.getTime();
        
        let showDateSeparator = false;
        let dateSeparatorText = "";
        
        if (currentDateString !== lastDateString) {
            showDateSeparator = true;
            dateSeparatorText = formatDateHeader(msgDate);
            lastDateString = currentDateString;
            lastUserId = null; // Reset consecutive avatar grouping on a new day
        }

        const hasReply = !!msg.reply_to_id;
        const isConsecutive = !hasReply && lastUserId === msg.user_id && lastTime && (msgTime - lastTime) < 300000;
        
        lastUserId = msg.user_id;
        lastTime = msgTime;
        return { ...msg, isConsecutive, showDateSeparator, dateSeparatorText, hasReply };
    });

    const scrollToMessage = (msgId) => {
        if (!msgId) return;
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.remove('message-highlight');
            void el.offsetWidth; // trigger reflow
            el.classList.add('message-highlight');
            
            if (el.highlightTimeout) clearTimeout(el.highlightTimeout);
            el.highlightTimeout = setTimeout(() => {
                el.classList.remove('message-highlight');
                el.highlightTimeout = null;
            }, 2000);
        }
    };

    return (
        <Twemoji className="live-chat-container" options={{ className: 'chat-emoji', folder: 'svg', ext: '.svg' }}>
            <div className="chat-top-bar">
                <svg className="chat-top-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span className="chat-top-title">{channel?.name || 'general'}</span>
            </div>

            <div className="chat-messages-area">
                <div className="chat-messages-scroll" ref={scrollRef}>
                    <div className="chat-welcome">
                        <div className="chat-welcome-icon">
                            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </div>
                        <h2>¡Te damos la bienvenida a #{channel?.name || 'general'}!</h2>
                        <p>Este es el comienzo del canal. Di hola a la comunidad.</p>
                    </div>

                    {groupedMessages.map(msg => {
                        const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const dateString = new Date(msg.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
                        
                        let replyMsg = null;
                        let isReplyToMe = false;
                        if (msg.hasReply) {
                            replyMsg = msg.reply_to;
                            if (Array.isArray(replyMsg)) replyMsg = replyMsg[0];
                            if (!replyMsg && msg.reply_to_id) {
                                replyMsg = messages.find(m => m.id === msg.reply_to_id);
                            }
                            if (replyMsg && (replyMsg.user_id === user?.id || replyMsg.user?.id === user?.id)) {
                                isReplyToMe = true;
                            }
                        }

                        return (
                            <React.Fragment key={msg.id}>
                                {msg.showDateSeparator && (
                                    <div className="chat-date-separator">
                                        <span className="chat-date-separator-text">{msg.dateSeparatorText}</span>
                                    </div>
                                )}
                                <div id={`msg-${msg.id}`} className={`chat-message-row ${msg.isConsecutive ? 'consecutive' : ''} ${msg.hasReply ? 'has-reply' : ''} ${isReplyToMe ? 'mentioned' : ''}`}>
                                    {msg.hasReply && (
                                        <div className="chat-reply-banner" onClick={() => scrollToMessage(msg.reply_to_id)}>
                                            {replyMsg ? (
                                                <>
                                                    <img src={replyMsg.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="chat-reply-tiny-avatar" />
                                                    <span className="chat-reply-user">@{replyMsg.user?.display_name || replyMsg.user?.username || 'Usuario'}</span>
                                                    <span className="chat-reply-snippet">{replyMsg.content || 'Mensaje sin texto'}</span>
                                                </>
                                            ) : (
                                                <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                    Mensaje original eliminado o no disponible
                                                </span>
                                            )}
                                        </div>
                                    )}
                                        <div className="chat-left-col">
                                            {!msg.isConsecutive ? (
                                                <img src={msg.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="chat-avatar" />
                                            ) : (
                                                <div className="chat-timestamp-hover">{timeString}</div>
                                            )}
                                        </div>
                                        <div className="chat-message-content">
                                            {!msg.isConsecutive && (
                                                <div className="chat-message-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span className="chat-username">{msg.user?.display_name || msg.user?.username || 'Usuario'}</span>
                                                        {msg.user?.featured_badge && BADGES_MAP[msg.user.featured_badge] && (
                                                            <span style={{ color: BADGES_MAP[msg.user.featured_badge].color, display: 'inline-flex', alignItems: 'center' }} title={BADGES_MAP[msg.user.featured_badge].title}>
                                                                <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {BADGES_MAP[msg.user.featured_badge].icon}
                                                                </div>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="chat-timestamp">{timeString}</span>
                                                </div>
                                            )}
                                            {editingMessageId === msg.id ? (
                                                <div className="chat-edit-container">
                                                    <textarea 
                                                        className="chat-edit-input" 
                                                    value={editingText}
                                                    onChange={e => setEditingText(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="chat-edit-help">
                                                    escape para <span onClick={cancelEditing}>cancelar</span> • enter para <span onClick={handleSaveEdit}>guardar</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="chat-text">
                                                {msg.content}
                                                {msg.updated_at && <span className="chat-edited-mark">(editado)</span>}
                                            </div>
                                        )}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className="chat-reactions-block">
                                                {Object.entries(
                                                    msg.reactions.reduce((acc, r) => {
                                                        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [] };
                                                        acc[r.emoji].count += 1;
                                                        if (r.user) acc[r.emoji].users.push(r.user);
                                                        return acc;
                                                    }, {})
                                                ).map(([emoji, data]) => {
                                                    const hasReacted = data.users.some(u => u?.id === user?.id || (msg.reactions.some(r => r.emoji === emoji && r.user_id === user?.id)));
                                                    const displayUsers = data.users.slice(0, 3);
                                                    const extraUsers = data.users.length - 3;
                                                    
                                                    return (
                                                        <button 
                                                            key={emoji} 
                                                            className={`chat-reaction-pill ${hasReacted ? 'active' : ''}`}
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                            title={data.users.map(u => u.display_name || u.username).join(', ')}
                                                        >
                                                            <span className="chat-reaction-emoji">{emoji}</span>
                                                            <span className="chat-reaction-count">{data.count}</span>
                                                            
                                                            {displayUsers.length > 0 && (
                                                                <div className="chat-reaction-avatars">
                                                                    {displayUsers.map((u, i) => (
                                                                        <img 
                                                                            key={i} 
                                                                            src={u.avatar_url || '/default-avatar.png'} 
                                                                            alt="avatar"
                                                                            className="chat-reaction-mini-avatar"
                                                                        />
                                                                    ))}
                                                                    {extraUsers > 0 && (
                                                                        <span className="chat-reaction-extra-users">+{extraUsers}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {translations[msg.id] && (
                                            <div className="chat-translation-block">
                                                <svg className="chat-translation-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                                                {translations[msg.id].isLoading ? (
                                                    <span className="chat-translation-loading">Traduciendo...</span>
                                                ) : (
                                                    <div className="chat-translation-content">
                                                        <span className="chat-translation-text">{translations[msg.id].text}</span>
                                                        <div className="chat-translation-footer">
                                                            (traducido del {getLanguageName(translations[msg.id].sourceLang)} - <span onClick={() => dismissTranslation(msg.id)}>Ocultar</span>)
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Action Menu (Hover) */}
                                    <div className={`chat-message-actions ${activeDropdown === msg.id ? 'active' : ''}`}>
                                        <button className="chat-action-btn emoji-btn" title="Reaccionar con 🔥" onClick={() => handleToggleReaction(msg.id, '🔥')}>🔥</button>
                                        <button className="chat-action-btn emoji-btn" title="Reaccionar con ❤️" onClick={() => handleToggleReaction(msg.id, '❤️')}>❤️</button>
                                        <button className="chat-action-btn emoji-btn" title="Reaccionar con 👍" onClick={() => handleToggleReaction(msg.id, '👍')}>👍</button>
                                        
                                        <div className="chat-action-divider" />
                                        
                                        <button className="chat-action-btn" title="Añadir reacción">
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                                        </button>
                                        
                                        {msg.user_id === user?.id && (
                                            <button className="chat-action-btn" title="Editar" onClick={() => startEditing(msg)}>
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            </button>
                                        )}
                                        <button className="chat-action-btn" title="Responder" onClick={() => startReplying(msg)}>
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                        </button>
                                        
                                        <button className="chat-action-btn" title="Traducir" onClick={() => handleTranslate(msg.id, msg.content)}>
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                                        </button>
                                        
                                        <div style={{ position: 'relative' }}>
                                            <button className="chat-action-btn" title="Más opciones" onClick={(e) => {
                                                if (activeDropdown === msg.id) {
                                                    setActiveDropdown(null);
                                                    setDropdownCoords(null);
                                                } else {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setDropdownCoords({
                                                        bottom: window.innerHeight - rect.top + 4,
                                                        right: window.innerWidth - rect.right
                                                    });
                                                    setActiveDropdown(msg.id);
                                                }
                                            }}>
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                                            </button>
                                            
                                            {activeDropdown === msg.id && createPortal(
                                                <div className="chat-dropdown" style={{ position: 'fixed', bottom: dropdownCoords?.bottom, right: dropdownCoords?.right, zIndex: 99999 }}>
                                                    <div className="chat-dropdown-reactions">
                                                        <button className="chat-dropdown-reaction-btn" onClick={() => handleToggleReaction(msg.id, '🔥')}>🔥</button>
                                                        <button className="chat-dropdown-reaction-btn" onClick={() => handleToggleReaction(msg.id, '❤️')}>❤️</button>
                                                        <button className="chat-dropdown-reaction-btn" onClick={() => handleToggleReaction(msg.id, '👍')}>👍</button>
                                                    </div>
                                                    
                                                    <button className="chat-dropdown-item">
                                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                                                        Añadir reacción
                                                    </button>
                                                    
                                                    <div className="chat-dropdown-divider" />
                                                    
                                                    {msg.user_id === user?.id && (
                                                        <button className="chat-dropdown-item" onClick={() => startEditing(msg)}>
                                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                            Editar
                                                        </button>
                                                    )}
                                                    
                                                    <button className="chat-dropdown-item" onClick={() => startReplying(msg)}>
                                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                                        Responder
                                                    </button>
                                                    
                                                    <button className="chat-dropdown-item" onClick={() => handleTranslate(msg.id, msg.content)}>
                                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                                                        Traducir
                                                    </button>
                                                    
                                                    <button className="chat-dropdown-item" onClick={() => { navigator.clipboard.writeText(msg.content); setActiveDropdown(null); }}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                                        Copiar texto
                                                    </button>
                                                    
                                                    {msg.user_id === user?.id && (
                                                        <>
                                                            <div className="chat-dropdown-divider" />
                                                            <button className="chat-dropdown-item danger" onClick={() => { handleDeleteMessage(msg.id); setActiveDropdown(null); }}>
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                                                Eliminar mensaje
                                                            </button>
                                                        </>
                                                    )}
                                                </div>,
                                                document.body
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                    <div ref={endRef} />
                </div>
            </div>

            <div className="chat-input-wrapper">
                {replyingTo && (
                    <div className="chat-replying-to-bar">
                        <span>Respondiendo a <strong>@{replyingTo.user?.display_name || replyingTo.user?.username || 'Usuario'}</strong></span>
                        <button onClick={cancelReplying} className="chat-reply-cancel">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                )}
                <form className={`chat-input-form ${replyingTo ? 'is-replying' : ''}`} onSubmit={handleSend} style={{ borderColor: isOverLimit ? 'var(--status-dropped)' : undefined, boxShadow: isOverLimit ? '0 0 0 1px var(--status-dropped)' : undefined }}>
                    <button type="button" className="chat-attach-btn" title="Adjuntar archivo">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </button>
                    <textarea 
                        ref={textareaRef}
                        className="chat-input-field"
                        placeholder={`Enviar mensaje a #${channel?.name || 'general'}`}
                        value={text}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    {isOverLimit && (
                        <div className="chat-limit-inline-warning">
                            -{overage}
                        </div>
                    )}
                    <button type="button" className="chat-emoji-btn" title="Añadir emoji">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    <button type="submit" style={{ display: 'none' }}>Send</button>
                </form>
            </div>
        </Twemoji>
    );
}



