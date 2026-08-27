const fs = require('fs');
let css = fs.readFileSync('src/pages/lists/CreateList.css', 'utf8');
css = css.replace(/\.cl-sidebar \{[\s\S]*?background: var\(--bg-secondary\);\s*\}/, 
\.cl-sidebar {
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(15, 15, 15, 0.6);
    backdrop-filter: blur(20px);
}\);
fs.writeFileSync('src/pages/lists/CreateList.css', css);
