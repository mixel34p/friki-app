const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const s1 = \<div className={\\\chat-message-row \ \\\\} style={msg.hasReply ? { display: 'flex', flexDirection: 'column', padding: '0.25rem 2rem' } : {}}>
                                    {msg.hasReply && (() => {
                                        let replyMsg = msg.reply_to;
                                        if (Array.isArray(replyMsg)) replyMsg = replyMsg[0];
                                        if (!replyMsg || !replyMsg.content) return null;
                                        return (
                                            <div className="chat-reply-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '52px' }}>
                                                <img src={replyMsg.user?.avatar_url || '/default-avatar.png'} alt="avatar" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                                <span style={{ fontWeight: 600 }}>@{replyMsg.user?.display_name || replyMsg.user?.username || 'Usuario'}</span>
                                                <span style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{replyMsg.content}</span>
                                            </div>
                                        );
                                    })()}
                                    
                                    <div style={msg.hasReply ? { display: 'flex', gap: '1rem' } : { display: 'contents' }}>
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
                                                    <span className="chat-username">{msg.user?.display_name || msg.user?.username || 'Usuario'}</span>
                                                    <span className="chat-timestamp">{timeString}</span>
                                                </div>
                                            )}
                                            {editingMessageId === msg.id ? (
                                                <div className="chat-edit-container">
                                                    <textarea \;

const toReplace = \<div className={\\\chat-message-row \ \\\\} style={msg.hasReply ? { display: 'flex', flexDirection: 'column', padding: '0.25rem 2rem' } : {}}>
                                    {msg.hasReply && (() => {
                                        let replyMsg = msg.reply_to;
                                        if (Array.isArray(replyMsg)) replyMsg = replyMsg[0];
                                        if (!replyMsg || !replyMsg.content) return null;
                                        return (
                                            <div className="chat-reply-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '52px' }}>
                                                <img src={replyMsg.user?.avatar_url || '/default-avatar.png'} alt="avatar" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                                <span style={{ fontWeight: 600 }}>@{replyMsg.user?.display_name || replyMsg.user?.username || 'Usuario'}</span>
                                                <span style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{replyMsg.content}</span>
                                            </div>
                                        );
                                    })()}
                                    
                                    <div style={msg.hasReply ? { display: 'flex', gap: '1rem' } : { display: 'contents' }}>
                                        <div className="chat-left-col">
                                            {!msg.isConsecutive ? (
                                                <img src={msg.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="chat-avatar" />
                                            ) : (
                                                <div className="chat-timestamp-hover">{timeString}</div>
                                            )}
                                        </div>
                                        
                                                    className="chat-edit-input"\;
                                                    
content = content.replace(toReplace, s1);
fs.writeFileSync(path, content, 'utf8');
