import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useOutletContext } from 'react-router-dom';
import { getChannelMessages, sendMessage, updateMessage, toggleReaction } from '../../lib/spaceService';
import { uploadChatImage } from '../../lib/socialDiscoveryService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Twemoji from 'react-twemoji';
import EmojiPicker from '../../components/EmojiPicker';
import './LiveChat.css';
import './LiveChatGrid.css';
import { BADGES_MAP } from '../../lib/badges';

function toCodePoint(unicodeSurrogates, sep) {
  let r = [], c = 0, p = 0, i = 0;
  
  // Twemoji strips FE0F unless there's a ZWJ
  if (unicodeSurrogates.indexOf(String.fromCharCode(0x200D)) < 0) {
      unicodeSurrogates = unicodeSurrogates.replace(/\uFE0F/g, '');
  }
  
  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++);
    if (p) {
      r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
      p = 0;
    } else if (0xD800 <= c && c <= 0xDBFF) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  return r.join(sep || '-');
}

const localImageCache = {};

const YouTubeEmbed = ({ url }) => {
    const getYouTubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    
    const videoId = getYouTubeId(url);
    if (!videoId) return null;
    
    return (
        <div style={{ marginTop: '8px', maxWidth: '400px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000' }}>
            <iframe 
                width="100%" 
                height="225" 
                src={`https://www.youtube.com/embed/${videoId}`} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                style={{ display: 'block' }}
            ></iframe>
        </div>
    );
};

const LinkEmbed = ({ url }) => {
    // Basic placeholder. Link is already rendered as an <a> tag in text.
    return null;
};

const htmlToText = (html) => {
    if (!html) return '';
    let t = html.replace(/<img[^>]*alt="([^"]+)"[^>]*>/g, '$1');
    t = t.replace(/<br\s*[\/]?>/gi, '\n');
    t = t.replace(/<div>/gi, '\n');
    t = t.replace(/<\/div>/gi, '');
    t = t.replace(/<[^>]+>/g, '');
    const temp = document.createElement('div');
    temp.innerHTML = t;
    return temp.textContent || temp.innerText || '';
};

export default function LiveChat() {
    const { channelId } = useParams();
    const { user, profile } = useAuth();
    const { channels, space } = useOutletContext();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [hasOpenedMainPicker, setHasOpenedMainPicker] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [dropdownCoords, setDropdownCoords] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
    const [hasOpenedReactionPicker, setHasOpenedReactionPicker] = useState(false);
    const [reactionPickerStyle, setReactionPickerStyle] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [imageFiles, setImageFiles] = useState([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [lightboxZoom, setLightboxZoom] = useState(false);
    const [isClosingLightbox, setIsClosingLightbox] = useState(false);
    const [savedRange, setSavedRange] = useState(null);

    const [globalEmojisMap, setGlobalEmojisMap] = useState({});

    useEffect(() => {
        const loadEmojis = async () => {
            try {
                const { data } = await supabase.from('custom_emojis').select('name, image_url');
                const map = {};
                data?.forEach(e => map[e.name] = e.image_url);
                setGlobalEmojisMap(map);
            } catch (err) { console.error('Error loading emojis', err); }
        };
        loadEmojis();
    }, []);

    const [quickReactions, setQuickReactions] = useState(['🔥', '❤️', '👍']);

    const updateQuickReactions = useCallback(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('friki_recent_emojis') || '[]');
            if (saved.length > 0) {
                const topSaved = saved.map(e => e.isStandard ? e.char : `:${e.name}:`);
                const defaults = ['🔥', '❤️', '👍'];
                const mixed = [...new Set([...topSaved, ...defaults])].slice(0, 3);
                setQuickReactions(mixed);
            }
        } catch(e){}
    }, []);

    useEffect(() => {
        updateQuickReactions();
    }, [updateQuickReactions]);

    const [showMaxUploadsModal, setShowMaxUploadsModal] = useState(false);
    const [isClosingMaxUploadsModal, setIsClosingMaxUploadsModal] = useState(false);
    const closeLightbox = () => {
        setIsClosingLightbox(true);
        setTimeout(() => {
            setZoomedImage(null);
            setLightboxZoom(false);
            setIsClosingLightbox(false);
        }, 150);
    };
    const fileInputRef = useRef(null);
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

    const renderMessageContent = (content, msg) => {
        if (!content) return null;
        
        const imageRegex = /!\[image\]\((.*?)\)/g;
        const images = [];
        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            images.push(match[1]);
        }
        
        let textOnly = content.replace(/!\[image\]\(.*?\)/g, '').trim();
        let textContent = null;
        
        if (textOnly) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const textTokens = textOnly.split(urlRegex);
            const urls = [];
            let hasFoundFirstImageText = false;
            
            const renderedText = [];
            for (let j = 0; j < textTokens.length; j++) {
                let token = textTokens[j];
                
                if (token.match(urlRegex)) {
                    urls.push(token);
                    
                    let shouldHide = false;
                    if (token.includes('youtube.com/') || token.includes('youtu.be/')) {
                        shouldHide = true;
                    } else {
                        const isImageUrl = token.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i);
                        if (isImageUrl && !hasFoundFirstImageText) {
                            hasFoundFirstImageText = true;
                            shouldHide = true;
                        }
                    }
                    
                    if (shouldHide) {
                        if (j > 0 && j < textTokens.length - 1) {
                            const prev = textTokens[j - 1];
                            const next = textTokens[j + 1];
                            
                            if (prev.match(/(^|\n)[ \t]*$/) && next.match(/^[ \t]*(\n|$)/)) {
                                textTokens[j + 1] = next.replace(/^[ \t]*\n?/, '');
                            } else if (prev.match(/[ \t]+$/) && next.match(/^[ \t]+/)) {
                                textTokens[j + 1] = next.replace(/^[ \t]+/, '');
                            }
                        }
                        continue;
                    }
                    
                    renderedText.push(<a key={j} href={token} target="_blank" rel="noopener noreferrer" style={{ color: '#1e90ff', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>{token}</a>);
                } else {
                    const parts = token.split(/(:\w+:)/g);
                    const parsedToken = parts.map((part, i) => {
                        if (part.startsWith(':') && part.endsWith(':')) {
                            const emojiName = part.slice(1, -1);
                            if (globalEmojisMap[emojiName]) {
                                return <img key={i} src={globalEmojisMap[emojiName]} alt={part} title={part} className="inline-emoji" style={{ width: '22px', height: '22px', objectFit: 'contain', verticalAlign: 'middle', margin: '-3px 2px 0 2px', display: 'inline-block' }} />;
                            }
                        }
                        return part;
                    });
                    renderedText.push(<React.Fragment key={j}>{parsedToken}</React.Fragment>);
                }
            }
            
            let hasRenderedFirstImageEmbed = false;
            
            textContent = (
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', marginBottom: images.length > 0 ? '8px' : '0' }}>
                    {renderedText}
                    {urls.map((url, j) => {
                        if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
                            return <YouTubeEmbed key={`yt-${j}`} url={url} />;
                        }
                        
                        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i);
                        if (isImage) {
                            if (!hasRenderedFirstImageEmbed) {
                                hasRenderedFirstImageEmbed = true;
                                return (
                                    <img 
                                        key={`img-${j}`} 
                                        src={url} 
                                        alt="enlace" 
                                        style={{ maxWidth: '300px', maxHeight: '400px', borderRadius: '8px', marginTop: '8px', display: 'block', objectFit: 'contain', cursor: 'pointer' }} 
                                        onClick={(e) => { e.stopPropagation(); setZoomedImage({ src: url, user: msg?.user }); }} 
                                    />
                                );
                            }
                            return null;
                        }
                        
                        return <LinkEmbed key={`link-${j}`} url={url} />;
                    })}
                </span>
            );
        }

        let imageGrid = null;
        if (images.length > 0) {
            imageGrid = (
                <div className={`chat-image-grid chat-image-grid-${images.length}`}>
                    {images.map((imgUrl, i) => {
                        const src = localImageCache[imgUrl] || imgUrl;
                        return (
                            <img 
                                key={i} 
                                src={src} 
                                alt="adjunto" 
                                className={`chat-grid-img chat-grid-img-${images.length}-${i}`}
                                onClick={() => setZoomedImage({ src, user: msg?.user })} 
                            />
                        );
                    })}
                </div>
            );
        }

        return (
            <>
                <Twemoji options={{ className: 'twemoji chat-emoji', folder: 'svg', ext: '.svg' }}>
                    {textContent}
                </Twemoji>
                {imageGrid}
            </>
        );
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
        const textWithoutImages = msg.content.replace(/!\[image\]\(.*?\)/g, '').trim();
        setEditingText(textWithoutImages);
        setActiveDropdown(null);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingText('');
    };

    const handleSaveEdit = async () => {
        if (!editingText.trim()) return;
        try {
            const originalMsg = messages.find(m => m.id === editingMessageId);
            let finalContent = editingText;
            
            if (originalMsg) {
                const imageMatches = originalMsg.content.match(/!\[image\]\(.*?\)/g);
                if (imageMatches) {
                    finalContent = editingText + '\n\n' + imageMatches.join('\n\n');
                }
            }
            
            await updateMessage(editingMessageId, user.id, finalContent);
            setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: finalContent, updated_at: new Date().toISOString() } : m));
            cancelEditing();
        } catch (e) {
            console.error("Error editing", e);
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setImageFiles(prev => {
                const newTotal = prev.length + files.length;
                if (newTotal > 3) {
                    setShowMaxUploadsModal(true);
                }
                return [...prev, ...files].slice(0, 3);
            });
        }
        e.target.value = null;
    };

    const removeImage = (idx) => {
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
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

    const openReactionPicker = (e, msgId) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pickerHeight = 460;
        const pickerWidth = 360;
        const padding = 10;
        
        // Base smart position
        let style = { 
            position: 'fixed',
            bottom: 'auto',
            top: 'auto',
            left: 'auto',
            right: 'auto'
        };
        
        // Vertical: If not enough space below, open above
        if (rect.bottom + padding + pickerHeight > window.innerHeight) {
            style.bottom = window.innerHeight - rect.top + padding;
        } else {
            style.top = rect.bottom + padding;
        }

        // Horizontal: If not enough space to the right, align to right edge
        if (rect.left + pickerWidth > window.innerWidth) {
            style.right = window.innerWidth - rect.right;
        } else {
            style.left = rect.left;
        }
        
        setReactionPickerStyle(style);
        setReactionPickerMsgId(msgId);
        setHasOpenedReactionPicker(true);
        setActiveDropdown(null);
        setIsEmojiPickerOpen(false);
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

    const handlePaste = (e) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            const pastedFiles = [];
            let hasImage = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    hasImage = true;
                    const file = items[i].getAsFile();
                    if (file) {
                        pastedFiles.push(file);
                    }
                }
            }
            if (pastedFiles.length > 0) {
                e.preventDefault();
                setImageFiles(prev => {
                    const newTotal = prev.length + pastedFiles.length;
                    if (newTotal > 3) {
                        setShowMaxUploadsModal(true);
                    }
                    return [...prev, ...pastedFiles].slice(0, 3);
                });
                return;
            }
        }
        
        // Prevent default HTML pasting (e.g. from Word/Webpages)
        e.preventDefault();
        const plainText = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, plainText);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if ((!text.trim() && imageFiles.length === 0) || !user || isOverLimit || uploadingImage) return;
        
        const currentText = text.trim();
        const currentReplyingTo = replyingTo;
        const pendingFile = imageFiles.length > 0 ? imageFiles[0] : null;
        
        if (!pendingFile) {
            // Optimistic UI for text-only messages
            const tempId = 'temp-' + Date.now();
            const optimisticMsg = {
                id: tempId,
                user_id: user.id,
                user: profile || user,
                content: currentText,
                created_at: new Date().toISOString(),
                reply_to_id: replyingTo?.id,
                hasReply: !!replyingTo?.id,
                reply_to: replyingTo ? [replyingTo] : null,
                _optimistic: true
            };
            setText('');
            if (textareaRef.current) textareaRef.current.innerHTML = '';
            setReplyingTo(null);
            setMessages(prev => [...prev, optimisticMsg]);
            setTimeout(scrollToBottom, 100);
            
            try {
                const newMsg = await sendMessage(channel?.id, user.id, currentText, currentReplyingTo?.id);
                if (currentReplyingTo && (!newMsg.reply_to || (Array.isArray(newMsg.reply_to) && newMsg.reply_to.length === 0))) {
                    newMsg.reply_to = currentReplyingTo;
                }
                setMessages(prev => prev.map(m => m.id === tempId ? newMsg : m));
            } catch (error) {
                console.error('Error sending message', error);
                setMessages(prev => prev.filter(m => m.id !== tempId));
                setText(currentText);
                if (textareaRef.current) textareaRef.current.innerHTML = currentText;
            }
            return;
        }

        // Si hay imagenes, no hacemos actualización optimista. 
        // Esperamos a que se suban y luego enviamos y limpiamos el form.
        setUploadingImage(true);
        try {
            let finalContent = currentText;
            
            // Subimos a ImgBB
            const uploadedUrls = await Promise.all(imageFiles.map(file => uploadChatImage(file)));
            
            // Guardamos los objetos URL local en la caché global asociado a la URL de ImgBB.
            // Así, cuando el chat reciba las URLs de ImgBB, renderizará instantáneamente las imagenes locales sin tener que descargarlas de ImgBB!
            uploadedUrls.forEach((imageUrl, index) => {
                const localUrl = URL.createObjectURL(imageFiles[index]);
                localImageCache[imageUrl] = localUrl; 
                finalContent += (finalContent.length > 0 ? '\n\n' : '') + `![image](${imageUrl})`;
            });
            
            const newMsg = await sendMessage(channel?.id, user.id, finalContent, currentReplyingTo?.id);
            if (currentReplyingTo && (!newMsg.reply_to || (Array.isArray(newMsg.reply_to) && newMsg.reply_to.length === 0))) {
                newMsg.reply_to = currentReplyingTo;
            }
            
            setText('');
            if (textareaRef.current) textareaRef.current.innerHTML = '';
            setReplyingTo(null);
            setImageFiles([]);
            setUploadingImage(false);
            
            setMessages(prev => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            setTimeout(scrollToBottom, 100);
        } catch (error) {
            console.error('Error sending message', error);
            setUploadingImage(false);
        }
    };

    const handleInput = (e) => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const textContent = range.startContainer.textContent;
                const offset = range.startOffset;
                const textBeforeCaret = textContent.slice(0, offset);
                
                const match = textBeforeCaret.match(/:([a-zA-Z0-9_]+):$/);
                if (match) {
                    const emojiName = match[1];
                    const emojiUrl = globalEmojisMap[emojiName];
                    if (emojiUrl) {
                        range.setStart(range.startContainer, offset - match[0].length);
                        range.setEnd(range.startContainer, offset);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        document.execCommand('insertHTML', false, `<img src="${emojiUrl}" alt="${match[0]}" class="inline-emoji" style="width: 22px; height: 22px; object-fit: contain; vertical-align: middle; margin: -3px 2px 0 2px; display: inline-block;" />&nbsp;`);
                    }
                }
            }
        }
        setText(htmlToText(e.currentTarget.innerHTML));
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
    
    // (This absorbs old code so we can easily edit handlePaste above it)
    
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
        <div className="live-chat-container">
            <div className="chat-top-bar">
                <svg className="chat-top-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span className="chat-top-title">{channel?.name || 'general'}</span>
            </div>

            <div className="chat-messages-area">
                <div className="chat-messages-scroll" ref={scrollRef}>
                    {groupedMessages.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.5 }}>
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Aún no hay mensajes</h3>
                            <p style={{ fontSize: '0.9rem', margin: 0, maxWidth: '300px' }}>¡Rompe el hielo y sé el primero en saludar en #{channel?.name || 'general'}!</p>
                        </div>
                    )}

                    {groupedMessages.map(msg => {
                        const msgDate = new Date(msg.created_at);
                        const timeOnlyString = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        let fullTimeString = timeOnlyString;
                        const dateStr = msgDate.toDateString();
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        
                        if (dateStr === today.toDateString()) {
                            fullTimeString = `Hoy a las ${timeOnlyString}`;
                        } else if (dateStr === yesterday.toDateString()) {
                            fullTimeString = `Ayer a las ${timeOnlyString}`;
                        } else {
                            fullTimeString = `${msgDate.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${timeOnlyString}`;
                        }
                        
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
                                                <div className="chat-timestamp-hover">{timeOnlyString}</div>
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
                                                    <span className="chat-timestamp">{fullTimeString}</span>
                                                </div>
                                            )}
                                            {editingMessageId === msg.id ? (
                                                <div className="chat-edit-container">
                                                    <textarea 
                                                        rows={1}
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
                                                {msg.content.match(/!\[image\]\(.*?\)/g) && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        {msg.content.match(/!\[image\]\(.*?\)/g).map((imgMd, idx) => {
                                                            const match = imgMd.match(/!\[image\]\((.*?)\)/);
                                                            if (match) {
                                                                const src = localImageCache[match[1]] || match[1];
                                                                return <img key={idx} src={src} alt="adjunto" style={{ maxWidth: '300px', maxHeight: '400px', borderRadius: '8px', marginTop: '4px', display: 'block', objectFit: 'contain', opacity: 0.8 }} />;
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="chat-text">
                                                {renderMessageContent(msg.content, msg)}
                                                {msg.updated_at && <span className="chat-edited-mark">(editado)</span>}
                                                {msg._optimistic && <span className="chat-edited-mark" style={{ opacity: 0.6, fontStyle: 'italic', marginLeft: '6px' }}>(enviando...)</span>}
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
                                                    
                                                    const isCustom = emoji.startsWith(':') && emoji.endsWith(':');
                                                    const customEmojiName = isCustom ? emoji.slice(1, -1) : null;
                                                    const customEmojiUrl = isCustom ? globalEmojisMap[customEmojiName] : null;

                                                    return (
                                                        <button 
                                                            key={emoji} 
                                                            className={`chat-reaction-pill ${hasReacted ? 'active' : ''}`}
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                            title={data.users.map(u => u.display_name || u.username).join(', ')}
                                                        >
                                                            {isCustom ? (
                                                                customEmojiUrl ? (
                                                                    <img src={customEmojiUrl} alt={emoji} className="chat-reaction-emoji-img" style={{width: '16px', height: '16px', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain'}} />
                                                                ) : (
                                                                    <span style={{marginRight: '4px', fontSize: '12px', fontWeight: 'bold'}}>{customEmojiName.substring(0, 2).toUpperCase()}</span>
                                                                )
                                                            ) : (
                                                                <img src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${toCodePoint(emoji)}.svg`} alt={emoji} className="chat-reaction-emoji-img" style={{width: '16px', height: '16px', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle'}} />
                                                            )}
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
                                        {quickReactions.map(emoji => {
                                            const isCustom = emoji.startsWith(':') && emoji.endsWith(':');
                                            const customEmojiName = isCustom ? emoji.slice(1, -1) : null;
                                            const customEmojiUrl = isCustom ? globalEmojisMap[customEmojiName] : null;
                                            
                                            return (
                                                <button key={emoji} className="chat-action-btn emoji-btn" title={`Reaccionar con ${emoji}`} onClick={() => handleToggleReaction(msg.id, emoji)}>
                                                    {isCustom ? (
                                                        customEmojiUrl ? (
                                                            <img src={customEmojiUrl} alt={emoji} style={{width: '20px', height: '20px', display: 'flex', objectFit: 'contain'}} />
                                                        ) : (
                                                            <span style={{fontSize: '11px', fontWeight: 'bold'}}>{customEmojiName.substring(0, 2).toUpperCase()}</span>
                                                        )
                                                    ) : (
                                                        <img src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${toCodePoint(emoji)}.svg`} alt={emoji} style={{width: '20px', height: '20px', display: 'flex'}} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                        
                                        <div className="chat-action-divider" />
                                        
                                        <button className="chat-action-btn" title="Añadir reacción" onClick={(e) => openReactionPicker(e, msg.id)}>
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
                                                        {quickReactions.map(emoji => {
                                                            const isCustom = emoji.startsWith(':') && emoji.endsWith(':');
                                                            const customEmojiName = isCustom ? emoji.slice(1, -1) : null;
                                                            const customEmojiUrl = isCustom ? globalEmojisMap[customEmojiName] : null;

                                                            return (
                                                                <button key={emoji} className="chat-dropdown-reaction-btn" onClick={() => handleToggleReaction(msg.id, emoji)} title={`Reaccionar con ${emoji}`}>
                                                                    {isCustom ? (
                                                                        customEmojiUrl ? (
                                                                            <img src={customEmojiUrl} alt={emoji} style={{width: '20px', height: '20px', display: 'inline-block', objectFit: 'contain'}} />
                                                                        ) : (
                                                                            <span style={{fontSize: '11px', fontWeight: 'bold'}}>{customEmojiName.substring(0, 2).toUpperCase()}</span>
                                                                        )
                                                                    ) : (
                                                                        emoji
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    <button className="chat-dropdown-item" onClick={(e) => openReactionPicker(e, msg.id)}>
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
                <form className={`chat-input-form ${replyingTo ? 'is-replying' : ''}`} onSubmit={handleSend} style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0', borderColor: isOverLimit ? 'var(--status-dropped)' : undefined, boxShadow: isOverLimit ? '0 0 0 1px var(--status-dropped)' : undefined }}>
                    {imageFiles.length > 0 && (
                        <div onMouseDown={(e) => e.preventDefault()} style={{ padding: '20px 20px 20px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
                            {imageFiles.map((file, idx) => (
                                <div key={idx} style={{ position: 'relative', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '8px', width: '220px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '150px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--bg-card)', borderRadius: '4px', display: 'flex', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                            <button type="button" onClick={() => removeImage(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--status-dropped)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-normal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                                        {file.name}
                                    </div>
                                </div>
                            ))}
                            
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 20px', minHeight: '48px', width: '100%' }}>
                        <input type="file" ref={fileInputRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageChange} />
                        <button type="button" className="chat-attach-btn" title="Adjuntar archivo" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </button>
                        <div 
                            contentEditable
                            ref={textareaRef}
                            className="chat-input-field rich-text-input"
                            data-placeholder={`Enviar mensaje a #${channel?.name || 'general'}`}
                            onInput={(e) => {
                                handleInput(e);
                                const sel = window.getSelection();
                                if (sel.rangeCount > 0) setSavedRange(sel.getRangeAt(0));
                            }}
                            onKeyUp={() => {
                                const sel = window.getSelection();
                                if (sel.rangeCount > 0) setSavedRange(sel.getRangeAt(0));
                            }}
                            onMouseUp={() => {
                                const sel = window.getSelection();
                                if (sel.rangeCount > 0) setSavedRange(sel.getRangeAt(0));
                            }}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            suppressContentEditableWarning={true}
                        />
                        {isOverLimit && (
                            <div className="chat-limit-inline-warning">
                                -{overage}
                            </div>
                        )}
                        <div style={{ position: 'relative' }}>
                            <button type="button" className="chat-emoji-btn" title="Añadir emoji" onClick={() => {
                                setHasOpenedMainPicker(true);
                                setIsEmojiPickerOpen(prev => !prev);
                                setReactionPickerMsgId(null);
                            }}>
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                            </button>
                            {hasOpenedMainPicker && createPortal(
                                <EmojiPicker 
                                    style={{ display: isEmojiPickerOpen ? 'flex' : 'none' }}
                                    isOpen={isEmojiPickerOpen}
                                    onSelectGif={async (url) => {
                                        setIsEmojiPickerOpen(false);
                                        if (!channel?.id || !user) return;
                                        
                                        const gifContent = `![image](${url})`;
                                        const tempId = 'temp-' + Date.now();
                                        const optimisticMsg = {
                                            id: tempId,
                                            user_id: user.id,
                                            user: profile || user,
                                            content: gifContent,
                                            created_at: new Date().toISOString(),
                                            _optimistic: true
                                        };
                                        
                                        setMessages(prev => [...prev, optimisticMsg]);
                                        setTimeout(() => {
                                            endRef.current?.scrollIntoView({ behavior: 'smooth' });
                                        }, 50);

                                        try {
                                            const newMsg = await sendMessage(channel.id, user.id, gifContent);
                                            setMessages(prev => prev.map(m => m.id === tempId ? newMsg : m));
                                        } catch (e) {
                                            console.error("Error sending gif", e);
                                            setMessages(prev => prev.filter(m => m.id !== tempId));
                                        }
                                    }}
                                    onSelect={(emoji) => {
                                        if (textareaRef.current) {
                                            textareaRef.current.focus();
                                            if (savedRange) {
                                                const sel = window.getSelection();
                                                sel.removeAllRanges();
                                                sel.addRange(savedRange);
                                            }
                                        }

                                        // Is it a custom emoji?
                                        if (emoji.startsWith(':') && emoji.endsWith(':')) {
                                            const emojiName = emoji.slice(1, -1);
                                            const emojiUrl = globalEmojisMap[emojiName];
                                            if (emojiUrl && textareaRef.current) {
                                                document.execCommand('insertHTML', false, `<img src="${emojiUrl}" alt="${emoji}" class="inline-emoji" style="width: 22px; height: 22px; object-fit: contain; vertical-align: middle; margin: -3px 2px 0 2px; display: inline-block;" />&nbsp;`);
                                            } else if (textareaRef.current) {
                                                document.execCommand('insertText', false, emoji);
                                            } else {
                                                setText(prev => prev + emoji);
                                            }
                                        } else {
                                            // Standard Emoji
                                            const code = toCodePoint(emoji);
                                            const twemojiUrl = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`;
                                            if (textareaRef.current) {
                                                document.execCommand('insertHTML', false, `<img src="${twemojiUrl}" alt="${emoji}" class="inline-emoji twemoji-input" style="width: 22px; height: 22px; object-fit: contain; vertical-align: middle; margin: -3px 2px 0 2px; display: inline-block;" />&nbsp;`);
                                            } else {
                                                setText(prev => prev + emoji);
                                            }
                                        }
                                        
                                        if (textareaRef.current) {
                                            setText(htmlToText(textareaRef.current.innerHTML));
                                        }
                                        setIsEmojiPickerOpen(false);
                                        updateQuickReactions();
                                    }} 
                                    onClose={() => setIsEmojiPickerOpen(false)} 
                                />,
                                document.body
                            )}
                        </div>
                    </div>
                    <button type="submit" style={{ display: 'none' }}>Send</button>
                </form>
            </div>

            {zoomedImage && (
                <div className={`lightbox-overlay ${isClosingLightbox ? 'closing' : ''}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', overflow: lightboxZoom ? 'auto' : 'hidden' }} onClick={closeLightbox}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: lightboxZoom ? 'flex-start' : 'center', justifyContent: lightboxZoom ? 'flex-start' : 'center', minWidth: '100%', minHeight: '100%' }}>
                        <img className={`lightbox-content ${isClosingLightbox ? 'closing' : ''}`} src={zoomedImage.src} alt="ampliada" style={{ margin: 'auto', maxWidth: lightboxZoom ? 'none' : '90vw', maxHeight: lightboxZoom ? 'none' : '90vh', zoom: lightboxZoom ? 1.5 : 1, objectFit: 'contain', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', cursor: lightboxZoom ? 'zoom-out' : 'zoom-in', transition: 'max-width 0.2s ease, max-height 0.2s ease' }} onClick={(e) => { e.stopPropagation(); setLightboxZoom(!lightboxZoom); }} />
                    </div>
                    
                    {zoomedImage.user && (() => {
                        const msgDate = new Date(zoomedImage.created_at || Date.now());
                        const timeOnlyString = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        let fullTimeString = timeOnlyString;
                        const dateStr = msgDate.toDateString();
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        
                        if (dateStr === today.toDateString()) {
                            fullTimeString = `Hoy a las ${timeOnlyString}`;
                        } else if (dateStr === yesterday.toDateString()) {
                            fullTimeString = `Ayer a las ${timeOnlyString}`;
                        } else {
                            fullTimeString = `${msgDate.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${timeOnlyString}`;
                        }

                        return (
                            <div className={`lightbox-overlay ${isClosingLightbox ? 'closing' : ''}`} style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.5)', padding: '8px 16px 8px 8px', borderRadius: '30px', zIndex: 100000 }} onClick={(e) => e.stopPropagation()}>
                                <img src={zoomedImage.user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + zoomedImage.user.username} alt={zoomedImage.user.username} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{zoomedImage.user.display_name || zoomedImage.user.username || 'Usuario'}</span>
                                        {zoomedImage.user.featured_badge && BADGES_MAP[zoomedImage.user.featured_badge] && (
                                            <span style={{ color: BADGES_MAP[zoomedImage.user.featured_badge].color, display: 'inline-flex', alignItems: 'center', marginLeft: '6px' }} title={BADGES_MAP[zoomedImage.user.featured_badge].title}>
                                                <div style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {BADGES_MAP[zoomedImage.user.featured_badge].icon}
                                                </div>
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '2px', textAlign: 'left' }}>{fullTimeString}</span>
                                </div>
                            </div>
                        );
                    })()}

                    <div className={`lightbox-overlay ${isClosingLightbox ? 'closing' : ''}`} style={{ position: 'fixed', top: '20px', right: '20px', display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '8px', zIndex: 100000 }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setLightboxZoom(!lightboxZoom)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} title={lightboxZoom ? "Alejar" : "Acercar"}>
                            {lightboxZoom ? (
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            )}
                        </button>
                        <button onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                                const response = await fetch(zoomedImage.src);
                                const blob = await response.blob();
                                const objectUrl = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = objectUrl;
                                a.download = `imagen_${Date.now()}.jpg`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(objectUrl);
                            } catch (error) {
                                window.open(zoomedImage.src, '_blank');
                            }
                        }} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} title="Descargar">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        <a href={zoomedImage.src} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title="Abrir original">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                        <button onClick={closeLightbox} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} title="Cerrar">
                            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Reaction Emoji Picker */}
            {hasOpenedReactionPicker && createPortal(
                <EmojiPicker 
                    style={{ ...reactionPickerStyle, zIndex: 100000, display: reactionPickerMsgId ? 'flex' : 'none' }}
                    disableMediaTabs={true}
                    isOpen={!!reactionPickerMsgId}
                    onSelect={(emoji) => {
                        if (reactionPickerMsgId) {
                            handleToggleReaction(reactionPickerMsgId, emoji);
                            setReactionPickerMsgId(null);
                            updateQuickReactions();
                        }
                    }} 
                    onClose={() => setReactionPickerMsgId(null)} 
                />,
                document.body
            )}

            {showMaxUploadsModal && (
                <div className={`lightbox-overlay ${isClosingMaxUploadsModal ? 'closing' : ''}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className={`lightbox-content ${isClosingMaxUploadsModal ? 'closing' : ''}`} style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', position: 'relative' }}>
                        <button onClick={() => {
                            setIsClosingMaxUploadsModal(true);
                            setTimeout(() => {
                                setShowMaxUploadsModal(false);
                                setIsClosingMaxUploadsModal(false);
                            }, 200);
                        }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <h2 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>¡Demasiadas subidas!</h2>
                        <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>¡Solo puedes subir 3 archivos a la vez!</p>
                        <button onClick={() => {
                            setIsClosingMaxUploadsModal(true);
                            setTimeout(() => {
                                setShowMaxUploadsModal(false);
                                setIsClosingMaxUploadsModal(false);
                            }, 200);
                        }} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
