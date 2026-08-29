const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = \                                  <div className={\\\chat-message-row \ \\\\}>\;

const replacementStr = \                                  <div className="chat-message-wrapper-outer">
                                      {(() => {
                                          let replyMsg = msg.reply_to;
                                          if (Array.isArray(replyMsg)) replyMsg = replyMsg[0];
                                          if (!replyMsg || !replyMsg.content) return null;
                                          return (
                                              <div className="chat-reply-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', position: 'relative', marginLeft: '76px' }}>
                                                  <div style={{ position: 'absolute', left: '-38px', top: '50%', width: '34px', height: '16px', borderLeft: '2px solid var(--border-subtle)', borderTop: '2px solid var(--border-subtle)', borderTopLeftRadius: '6px' }} />
                                                  <img src={replyMsg.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="chat-reply-tiny-avatar" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                                                  <span className="chat-reply-user" style={{ fontWeight: 600 }}>@{replyMsg.user?.display_name || replyMsg.user?.username || 'Usuario'}</span>
                                                  <span className="chat-reply-snippet" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px', opacity: 0.8 }}>{replyMsg.content}</span>
                                              </div>
                                          );
                                      })()}
                                      <div className={\\\chat-message-row \\\\}>\;

// Remove the inner one
const innerTarget = \                                      {(() => {
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
                                      })()}\;


const endTargetStr = \                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>\;
                            
const endReplacementStr = \                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                </div>
                            </React.Fragment>\;

if (content.includes(targetStr)) {
    content = content.replace(innerTarget, '');
    content = content.replace(targetStr, replacementStr);
    content = content.replace(endTargetStr, endReplacementStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log('DOM restructured successfully!');
} else {
    console.log('Target not found!');
}
