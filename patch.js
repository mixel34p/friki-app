const fs = require('fs');
let content = fs.readFileSync('src/pages/lists/CreateList.jsx', 'utf8');

// 1. Add modalTarget state
content = content.replace(
    "const [activeTab, setActiveTab] = useState('search');",
    "const [activeTab, setActiveTab] = useState('search');\n    const [modalTarget, setModalTarget] = useState(null);"
);

// 2. Remove banner
content = content.replace(/\{\s*template && \(\s*<div className="cl-template-banner">[\s\S]*?<\/div>\s*\)\s*\}/, '');

// 3. Update handleAddItemToPool logic -> handleModalItemSelect
const oldHandleAdd = const handleAddItemToPool = useCallback((item) => {
        const itemId = String(item.id);
        if (!pool.find(i => i.id === itemId)) {
            setPool(prev => [...prev, {
                id: itemId,
                name: item.name,
                image_url: item.cover?.url || item.image_url
            }]);
        }
    }, [pool]);;
const newHandleAdd = const handleModalItemSelect = useCallback((item) => {
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
        } else if (modalTarget?.startsWith('c')) {
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
    }, [modalTarget]);;
content = content.replace(oldHandleAdd, newHandleAdd);

// 4. Update handleAddCustom
content = content.replace(
    /const handleAddCustom = \(\) => \{[\s\S]*?setCustomImageUrl\(''\);\s*\};/,
    const handleAddCustom = () => {
        if (!customName || !customImageUrl) return;
        const newItem = {
            id: \custom_\\,
            name: customName,
            image_url: customImageUrl
        };
        if (modalTarget === 'pool') {
            setPool(prev => [...prev, newItem]);
        } else if (modalTarget?.startsWith('c')) {
            setContent(prev => ({ ...prev, [modalTarget]: [newItem] }));
            setPool(prev => [...prev, newItem]);
        }
        setCustomName('');
        setCustomImageUrl('');
        setModalTarget(null);
    };
);

// 5. Update Grid cells onClick
content = content.replace(
    /<div className="cl-grid-drop-wrapper">/g,
    <div className="cl-grid-drop-wrapper" onClick={() => {
                                            setActiveTab(pool.length > 0 ? 'pool' : 'search');
                                            setModalTarget(\c\\);
                                        }}>
);

// 6. Update Pool row
content = content.replace(
    /\{\/\* Pool row \*\/\}\s*<div className="cl-tier-row cl-pool-row" style=\{\{ marginTop: '32px' \}\}>\s*<div className="cl-tier-label pool-label">Pool<\/div>\s*<DropZone id="pool" items=\{pool\} \/>\s*<\/div>/,
    {listType !== 'grid' && (
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
                        )}
);

// 7. Remove sidebar and add modal at the end of cl-layout
// We'll just replace the entire cl-sidebar block
const sidebarRegex = /\{\/\* Sidebar \*\/\}\s*<div className="cl-sidebar">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const modalJSX = </div>
                
                {modalTarget && (
                    <div className="cl-modal-overlay" onClick={() => setModalTarget(null)}>
                        <div className="cl-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="cl-modal-header">
                                <h3>{modalTarget === 'pool' ? 'Añadir a la Pool' : 'Seleccionar elemento'}</h3>
                                <button className="cl-modal-close" onClick={() => setModalTarget(null)}>&times;</button>
                            </div>
                            
                            <div className="cl-sidebar-tabs">
                                {modalTarget !== 'pool' && pool.length > 0 && (
                                    <button className={\cl-sidebar-tab \\} onClick={() => setActiveTab('pool')}>
                                        Pool
                                    </button>
                                )}
                                <button className={\cl-sidebar-tab \\} onClick={() => setActiveTab('search')}>
                                    Buscar
                                </button>
                                <button className={\cl-sidebar-tab \\} onClick={() => setActiveTab('custom')}>
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
                                                placeholder={\Buscar \...\}
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
        </div>;
content = content.replace(sidebarRegex, modalJSX);

fs.writeFileSync('src/pages/lists/CreateList.jsx', content);
console.log('Done replacement');
