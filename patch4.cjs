const fs = require('fs');
const cssFile = 'src/pages/spaces/LiveChat.css';
let css = fs.readFileSync(cssFile, 'utf8');

// I will just append `.chat-dropdown { ... }` at the end with `!important` to override, or just find it if it exists.
// Wait, I can just do a regex replace if it exists, or append it if not.
css += `
.chat-dropdown {
    position: absolute !important;
    top: calc(100% + 4px) !important;
    bottom: auto !important;
    right: 0 !important;
    z-index: 100 !important;
    display: flex !important;
    flex-direction: column !important;
}
`;
fs.writeFileSync(cssFile, css);
console.log("Appended chat-dropdown override");
