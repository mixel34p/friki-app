const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const anchor = \                                            {msg.reactions && msg.reactions.length > 0 && (
                                                <div className="chat-reactions-block">
                                                    {Object.entries(
                                                        msg.reactions.reduce((acc, r) => {
                                                            if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [] };
                                                            acc[r.emoji].count += 1;
                                                            acc[r.emoji].users.push(r.user_id);
                                                            return acc;
                                                        }, {})
                                                    ).map(([emoji, data]) => (
                                                        <button 
                                                            key={emoji} 
                                                            className={\\\chat-reaction-pill \\\\}
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                            title={data.users.includes(user?.id) ? 'Quitar reacción' : 'Añadir reacción'}
                                                        >
                                                            <span className="emoji">{emoji}</span>
                                                            <span className="count">{data.count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}\;

const banner = \
                                            {msg.hasReply && (() => {
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
\;

content = content.replace(anchor, anchor + banner);
fs.writeFileSync(path, content, 'utf8');
