const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

const s1 = '<div className={\chat-message-row \ \\}>';

const i1 = content.indexOf(s1);
if (i1 === -1) { console.log('Not found'); process.exit(1); }

const before = content.substring(0, i1);
const afterS1 = content.substring(i1 + s1.length);

const s2 = '                                    <div className="chat-left-col">';
const i2 = afterS1.indexOf(s2);

const replyBannerCode = afterS1.substring(0, i2);

const afterS2 = afterS1.substring(i2);

const s3 = '</React.Fragment>';
const i3 = afterS2.indexOf(s3);

const mainCode = afterS2.substring(0, i3);
const afterS3 = afterS2.substring(i3);

// Construct new structure
const newBlock = \
                                <div className="chat-message-wrapper-outer">
\ + replyBannerCode + \
                                    <div className={\\\chat-message-row \\\\}>
\ + mainCode + \
                                    </div>
                                </div>
\;

fs.writeFileSync(path, before + newBlock + afterS3, 'utf8');
console.log('DOM manually rewritten!');
