const fs = require('fs');
const cssFile = 'src/pages/spaces/LiveChat.css';
let css = fs.readFileSync(cssFile, 'utf8');

// Restore the block
const correctBlock = `.chat-action-divider {
    width: 1px;
    height: 20px;
    background-color: var(--border-subtle);
    margin: 0 4px;
}

.chat-dropdown {
    position: absolute;
    top: calc(100% + 4px); /* Opens downwards */
    bottom: auto;
    right: 0;
    background-color: #111214; /* Dark Discord style context menu */
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    min-width: 180px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    padding: 8px;
    animation: popUp 0.15s ease;
}`;

css = css.replace(/\.chat-action-divider \{\s*width: 1px;\s*\}\s*@keyframes popUp/g, correctBlock + "\n\n@keyframes popUp");
fs.writeFileSync(cssFile, css);
console.log("Patched dropdown");
