import re

with open('src/pages/lists/CreateList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace sidebar and append modal overlay
sidebar_regex = r'\{\/\* Sidebar \*\/\}\s*<div className="cl-sidebar">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>'

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
                                        type="url"
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

# Safely replace using regular expressions
content = re.sub(sidebar_regex, modal_jsx, content)

with open('src/pages/lists/CreateList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Modal Patch Applied Successfully")
