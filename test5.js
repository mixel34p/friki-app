const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = \<div className={\\\chat-message-row \ \\\\} style={msg.hasReply ? { display: 'flex', flexDirection: 'column', padding: '0.25rem 2rem' } : {}}>
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
                                    
                                    <div style={msg.hasReply ? { display: 'flex', gap: '1rem' } : { display: 'contents' }}>\;

const replacementStr = \<div className={\\\chat-message-row \ \\\\} style={msg.hasReply ? { display: 'flex', flexDirection: 'column-reverse', padding: '0.25rem 2rem' } : {}}>
                                    <div style={msg.hasReply ? { display: 'flex', gap: '1rem' } : { display: 'contents' }}>\;

const targetEndStr = \                                            {msg.reactions && msg.reactions.length > 0 && (
                                                <div className="chat-reactions-block">\;
                                                
const replacementEndStr = \                                            {msg.hasReply && (() => {
                                                let replyMsg = msg.reply_to;
                                                if (Array.isArray(replyMsg)) replyMsg = replyMsg[0];
                                                if (!replyMsg || !replyMsg.content) return null;
                                                return (
                                                    <div className="chat-reply-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '0' }}>
                                                        <img src={replyMsg.user?.avatar_url || '/default-avatar.png'} alt="avatar" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                                        <span style={{ fontWeight: 600 }}>@{replyMsg.user?.display_name || replyMsg.user?.username || 'Usuario'}</span>
                                                        <span style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{replyMsg.content}</span>
                                                    </div>
                                                );
                                            })()}
                                            {msg.reactions && msg.reactions.length > 0 && (
                                                <div className="chat-reactions-block">\;

content = content.replace(targetStr, replacementStr);
content = content.replace(targetEndStr, replacementEndStr);

fs.writeFileSync(path, content, 'utf8');
