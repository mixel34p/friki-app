const fs = require('fs');
const cssFile = 'src/pages/spaces/LiveChat.css';
let css = fs.readFileSync(cssFile, 'utf8');

css = css.replace(/\.chat-reply-tiny-avatar \{\s*width: 16px;\s*height: 16px;\s*border-radius: 50%;/g, `.chat-reply-tiny-avatar {\n    width: 16px;\n    height: 16px;\n    border-radius: 4px;`);

css = css.replace(/\.chat-reaction-mini-avatar \{\s*width: 14px;\s*height: 14px;\s*border-radius: 50%;/g, `.chat-reaction-mini-avatar {\n    width: 14px;\n    height: 14px;\n    border-radius: 4px;`);

fs.writeFileSync(cssFile, css);
console.log("Patched other avatars");
