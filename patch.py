import re

with open('src/pages/lists/CreateList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add modalTarget state
content = content.replace(
    "const [activeTab, setActiveTab] = useState('search');",
    "const [activeTab, setActiveTab] = useState('search');\n    const [modalTarget, setModalTarget] = useState(null);"
)

# 2. Remove banner
content = re.sub(r'\{\s*template && \(\s*<div className="cl-template-banner">[\s\S]*?</div>\s*\)\s*\}', '', content)

# 3. Update handleAddItemToPool
old_handle_add = """const handleAddItemToPool = useCallback((item) => {
        const itemId = String(item.id);
        if (!pool.find(i => i.id === itemId)) {
            setPool(prev => [...prev, {
                id: itemId,
                name: item.name,
                image_url: item.cover?.url || item.image_url
            }]);
        }
    }, [pool]);"""
new_handle_add = """const handleModalItemSelect = useCallback((item) => {
        const itemId = String(item.id);
        const newItem = {
            id: itemId,
            name: item.name,
            image_url: item.cover?.url || item.image_url
        };
        
        if (modalTarget === 'pool') {
            setPool(prev => {
                if (prev.find(i => i.id === itemId)) return prev;
                return [...prev, newItem];
            });
        } else if (modalTarget && modalTarget.startswith('c')) {
            setContent(prev => ({
                ...prev,
                [modalTarget]: [newItem]
            }));
            setPool(prev => {
                if (prev.find(i => i.id === itemId)) return prev;
                return [...prev, newItem];
            });
        }
        setModalTarget(null);
    }, [modalTarget]);"""
# Wait, JS uses .startsWith, I wrote .startswith in Python... Let me fix it in the string!
new_handle_add = new_handle_add.replace("startswith", "startsWith")
content = content.replace(old_handle_add, new_handle_add)

# 4. Update handleAddCustom
old_custom = re.search(r'const handleAddCustom = \(\) => \{[\s\S]*?setCustomImageUrl\(\'\'\);\s*\};', content).group(0)
new_custom = """const handleAddCustom = () => {
        if (!customName || !customImageUrl) return;
        const newItem = {
            id: custom_,
            name: customName,
            image_url: customImageUrl
        };
        if (modalTarget === 'pool') {
            setPool(prev => [...prev, newItem]);
        } else if (modalTarget && modalTarget.startsWith('c')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
            setPool(prev => [...prev, newItem]);
        }
        setCustomName('');
        setCustomImageUrl('');
        setModalTarget(null);
    };"""
content = content.replace(old_custom, new_custom)

# 5. Update Grid cells onClick
content = content.replace(
    '<div className="cl-grid-drop-wrapper">',
    '<div className="cl-grid-drop-wrapper" onClick={() => {\n                                            setActiveTab(pool.length > 0 ? \'pool\' : \'search\');\n                                            setModalTarget(c);\n                                        }}>'
)

# 6. Update Pool row
old_pool_row = re.search(r'\{\/\* Pool row \*\/\}\s*<div className="cl-tier-row cl-pool-row" style=\{\{ marginTop: \'32px\' \}\}>\s*<div className="cl-tier-label pool-label">Pool</div>\s*<DropZone id="pool" items=\{pool\} />\s*</div>', content).group(0)
new_pool_row = """{listType !== 'grid' && (
                            <div className="cl-tier-row cl-pool-row" style={{ marginTop: '32px' }}>
                                <div className="cl-tier-label pool-label" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                    Pool
                                    <button 
                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'white' }}
                                        onClick={() => {
                                            setActiveTab('search');
                                            setModalTarget('pool');
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                                <DropZone id="pool" items={pool} />
                            </div>
                        )}"""
content = content.replace(old_pool_row, new_pool_row)

# 7. Replace sidebar with Modal
sidebar_match = re.search(r'\{\/\* Sidebar \*\/\}\s*<div className="cl-sidebar">[\s\S]*?</div>\s*</div>\s*</div>', content)
if not sidebar_match:
    print("Could not find sidebar")
old_sidebar = sidebar_match.group(0)

modal_jsx = """</div>
                
                {modalTarget && (
                    <div className="cl-modal-overlay" onClick={() => setModalTarget(null)}>
                        <div className="cl-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="cl-modal-header">
                                <h3>{modalTarget === 'pool' ? 'Añadir a la Pool' : 'Seleccionar elemento'}</h3>
                                <button className="cl-modal-close" onClick={() => setModalTarget(null)}>&times;</button>
                            </div>
                            
                            <div className="cl-sidebar-tabs">
                                {modalTarget !== 'pool' && pool.length > 0 && (
                                    <button className={cl-sidebar-tab } onClick={() => setActiveTab('pool')}>
                                        Pool
                                    </button>
                                )}
                                <button className={cl-sidebar-tab } onClick={() => setActiveTab('search')}>
                                    Buscar
                                </button>
                                <button className={cl-sidebar-tab } onClick={() => setActiveTab('custom')}>
                                    Personalizado
                                </button>
                            </div>

                            <div className="cl-modal-body">
                                {activeTab === 'pool' && (
                                    <div className="cl-results">
                                        {pool.map(item => (
                                            <div key={item.id} className="cl-result-item" onClick={() => handleModalItemSelect(item)}>
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt="" className="cl-result-img" />
                                                ) : (
                                                    <div className="cl-item-fallback">{item.name}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeTab === 'search' && (
                                    <>
                                        <div className="cl-search-wrap">
                                            <span className="cl-search-icon"><IconSearch /></span>
                                            <input
                                                className="cl-search-input"
                                                type="text"
                                                placeholder={Buscar ...}
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <div className="cl-results">
                                            {isSearching && <p className="cl-searching">Buscando...</p>}
                                            {!isSearching && searchQuery.length < 2 && (
                                                <p className="cl-search-hint">Escribe al menos 2 caracteres para buscar.</p>
                                            )}
                                            {!isSearching && searchResults.map(item => {
                                                const imgUrl = item.cover?.url || item.image_url;
                                                return (
                                                <div
                                                    key={item.id}
                                                    className="cl-result-item"
                                                    onClick={() => handleModalItemSelect(item)}
                                                >
                                                    {imgUrl ? (
                                                        <img src={imgUrl} alt="" className="cl-result-img" />
                                                    ) : (
                                                        <div className="cl-item-fallback">{item.name}</div>
                                                    )}
                                                    <div className="item-add-overlay"><IconPlus /></div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                                {activeTab === 'custom' && (
                                    <div className="cl-custom-form">
                                        <label className="cl-custom-label">Nombre</label>
                                        <input
                                            className="input"
                                            type="text"
                                            placeholder="Nombre del item"
                                            value={customName}
                                            onChange={e => setCustomName(e.target.value)}
                                        />
                                        <label className="cl-custom-label" style={{ marginTop: 4 }}>URL de imagen</label>
                                        <input
                                            className="input"
                                            type="text"
                                            placeholder="https://ejemplo.com/imagen.jpg"
                                            value={customImageUrl}
                                            onChange={e => setCustomImageUrl(e.target.value)}
                                        />
                                        <button className="btn btn-primary" onClick={handleAddCustom} style={{ marginTop: 12 }}>
                                            Añadir
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>"""
content = content.replace(old_sidebar, modal_jsx)

with open('src/pages/lists/CreateList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch OK")
