const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Delete the bad banner
const badStart = '                                        {msg.hasReply && (() => {';
const badEnd = '                                        })()}';
const i1 = content.indexOf(badStart);
const i2 = content.indexOf(badEnd, i1);
if (i1 !== -1 && i2 !== -1) {
    content = content.substring(0, i1) + content.substring(i2 + badEnd.length);
}

// 2. Find where reactions block ends
const rxStart = content.indexOf('className="chat-reactions-block"');
const searchStart = rxStart !== -1 ? rxStart : content.indexOf('chat-edited-mark');
const insertIndex = content.indexOf(')}', searchStart) + 2;

// 3. Insert new banner
const newBanner = \
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

content = content.substring(0, insertIndex) + newBanner + content.substring(insertIndex);
fs.writeFileSync(path, content, 'utf8');
console.log('Done');
