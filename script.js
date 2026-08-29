const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const searchRegex = /\{msg\.hasReply \? 'has-reply' : ''\}"\}>\s*\{\(\(\) => \{\s*let replyMsg = msg\.reply_to;\s*if \(Array\.isArray\(replyMsg\)\) replyMsg = replyMsg\[0\];\s*if \(\!replyMsg \|\| \!replyMsg\.content\) return null;\s*return \(\s*<div className="chat-reply-banner">\s*<img src=\{replyMsg\.user\?\.avatar_url \|\| '\/default-avatar\.png'\} alt="avatar" className="chat-reply-tiny-avatar" \/>\s*<span className="chat-reply-user">@\{replyMsg\.user\?\.display_name \|\| replyMsg\.user\?\.username \|\| 'Usuario'\}<\/span>\s*<span className="chat-reply-snippet">\{replyMsg\.content\}<\/span>\s*<\/div>\s*\);\s*\}\)\(\)\}\s*<div className="chat-left-col">\s*\{\!msg\.isConsecutive \? \(\s*<img src=\{msg\.user\?\.avatar_url \|\| '\/default-avatar\.png'\} alt="avatar" className="chat-avatar" \/>\s*\) : \(\s*<div className="chat-timestamp-hover">\{timeString\}<\/div>\s*\)\}\s*<\/div>\s*<div className="chat-message-content">/s;

const replacement = {msg.hasReply ? 'has-reply' : ''}"}>
                                        {(() => {
                                            let replyMsg = msg.reply_to;
                                            if (Array.isArray(replyMsg)) replyMsg = replyMsg[0];
                                            if (!replyMsg || !replyMsg.content) return null;
                                            return (
                                                <div className="chat-reply-banner">
                                                    <img src={replyMsg.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="chat-reply-tiny-avatar" />
                                                    <span className="chat-reply-user">@{replyMsg.user?.display_name || replyMsg.user?.username || 'Usuario'}</span>
                                                    <span className="chat-reply-snippet">{replyMsg.content}</span>
                                                </div>
                                            );
                                        })()}
                                        <div className="chat-message-main-content">
                                            <div className="chat-left-col">
                                                {!msg.isConsecutive ? (
                                                    <img src={msg.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="chat-avatar" />
                                                ) : (
                                                    <div className="chat-timestamp-hover">{timeString}</div>
                                                )}
                                            </div>
                                            <div className="chat-message-content">;

if (content.match(searchRegex)) {
    content = content.replace(searchRegex, replacement);
    // Also we need to close chat-message-main-content. Where?
    // After activeDropdown ... </div></div></React.Fragment>
    // We can just replace </React.Fragment> with </div></React.Fragment> for the extra wrapper, BUT we need to be precise.
} else {
    console.log('Not matched!');
}
