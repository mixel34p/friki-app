import re

with open('src/pages/lists/CreateList.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Update cl-layout to not use grid columns
old_layout = """.cl-layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 24px;
    height: calc(100vh - 140px);
}"""
new_layout = """.cl-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: calc(100vh - 140px);
}"""
css = css.replace(old_layout, new_layout)

# 2. Add Modal CSS
modal_css = """
/* Modal Styles */
.cl-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}
.cl-modal-content {
    background: rgba(18, 18, 20, 0.95);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    width: 400px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
.cl-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
}
.cl-modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-family: var(--font-display);
}
.cl-modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 24px;
    cursor: pointer;
    line-height: 1;
}
.cl-modal-close:hover {
    color: white;
}
.cl-modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}

.cl-grid-drop-wrapper {
    cursor: pointer;
}
.cl-grid-drop-wrapper:hover {
    background: rgba(255, 255, 255, 0.05);
}
"""
css += modal_css

with open('src/pages/lists/CreateList.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("CSS Patch OK")
