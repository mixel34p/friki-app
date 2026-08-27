const fs = require('fs');
let css = fs.readFileSync('src/pages/lists/CreateList.css', 'utf8');
css = css.replace('.cl-grid-drop-wrapper {\n    flex: 1;', '.cl-grid-drop-wrapper {\n    flex: 1;\n    min-height: 0;');
fs.writeFileSync('src/pages/lists/CreateList.css', css);
