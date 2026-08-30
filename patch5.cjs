const fs = require('fs');
const cssFile = 'src/pages/spaces/LiveChat.css';
let css = fs.readFileSync(cssFile, 'utf8');

css = css.replace(/\.chat-dropdown \{\s*position: absolute !important;[\s\S]*?\}\s*$/g, '');

css += `
.chat-dropdown {
    position: absolute !important;
    top: calc(100% + 4px) !important;
    bottom: auto !important;
    right: 0 !important;
    z-index: 100 !important;
    background-color: #111214 !important;
    border: 1px solid var(--border-subtle) !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6) !important;
    min-width: 180px !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 8px !important;
    animation: popUp 0.15s ease !important;
}
`;
fs.writeFileSync(cssFile, css);
console.log("Fixed dropdown styles");
