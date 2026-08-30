const fs = require('fs');
const cssFile = 'src/pages/spaces/LiveChat.css';
let css = fs.readFileSync(cssFile, 'utf8');

const badRegex = /\.chat-message-row:hover \{\s*background-color: var\(--bg-hover\);\s*gap: 0\.75rem;\s*margin-bottom: 0\.25rem;\s*\}/g;
const correctBlock = `.chat-message-row:hover {
    background-color: var(--bg-hover);
}

.chat-message-row:not(.consecutive) {
    margin-top: 0.5rem;
}

.chat-left-col {
    grid-column: 1;
    display: flex;
    justify-content: center;
    position: relative;
}

.chat-avatar {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    object-fit: cover;
    background-color: var(--bg-tertiary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: 1px solid var(--border-subtle);
}

.chat-message-content {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.chat-message-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
}`;

css = css.replace(badRegex, correctBlock);
fs.writeFileSync(cssFile, css);
console.log("Patched LiveChat.css");
