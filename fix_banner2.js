const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const badBannerStart = '                                        {msg.hasReply && (() => {';
const badBannerEnd = '                                        })()}';

const iStart = content.indexOf(badBannerStart);
const iEnd = content.indexOf(badBannerEnd, iStart) + badBannerEnd.length;

if (iStart !== -1) {
    content = content.substring(0, iStart) + content.substring(iEnd + 1); // +1 for newline
}

const correctAnchor = '                                            )}';
const newBannerCode = \                                            )}
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
                                            })()}\;

// Find the ONE that closes chat-reactions-block. Wait, just find chat-reactions-block and find the closing bracket
const rxBlockIndex = content.indexOf('className="chat-reactions-block"');
const searchStartIndex = rxBlockIndex !== -1 ? rxBlockIndex : content.indexOf('chat-edited-mark');
// find the first closing )} after reactions
const insertIndex = content.indexOf(')}', searchStartIndex) + 2;

content = content.substring(0, insertIndex) + \
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
                                            })()}\ + content.substring(insertIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed banner position manually!');
