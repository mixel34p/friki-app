const fs = require('fs');

const jsxPath = 'src/pages/lists/CreateList.jsx';
const cssPath = 'src/pages/lists/CreateList.css';

let jsx = fs.readFileSync(jsxPath, 'utf8');

// 1. Update initialization
jsx = jsx.replace(
    /let initialContent = \{\};\s+if \(data\.list_type === 'tierlist'\) \{\s+data\.type_config\.tiers\.forEach\(t => \(initialContent\[t\.id\] = \[\]\)\);\s+\} else if \(data\.list_type === 'ranking'\) \{\s+initialContent = Array\(data\.type_config\.max_items\)\.fill\(null\);\s+\} else if \(data\.list_type === 'grid'\) \{\s+data\.type_config\.cells\.forEach\(\(_, i\) => \(initialContent\[\c\$\{i\}\\] = null\)\);\s+\}/g,
    \let initialContent = {};
                if (data.list_type === 'tierlist') {
                    data.type_config.tiers.forEach(t => (initialContent[t.id] = []));
                } else if (data.list_type === 'ranking') {
                    for(let i=0; i<data.type_config.max_items; i++) initialContent[\\\] = [];
                } else if (data.list_type === 'grid') {
                    data.type_config.cells.forEach((_, i) => (initialContent[\c\\] = []));
                }\
);

jsx = jsx.replace(
    /setContent\(data\.content\);/g,
    \let loadedContent = data.content;
                if (data.list_type === 'ranking') {
                    loadedContent = {};
                    data.content.forEach((item, i) => { loadedContent[\\\] = item ? [item] : []; });
                } else if (data.list_type === 'grid') {
                    loadedContent = {};
                    data.type_config.cells.forEach((_, i) => {
                         loadedContent[\c\\] = data.content[\c\\] ? [data.content[\c\\]] : [];
                    });
                }
                setContent(loadedContent);\
);

// 2. Update handleDragStart
jsx = jsx.replace(
    /const item = pool\.find\(i => i\.id === active\.id\)\s+\|\|\s+\(listType === 'tierlist'\s+\?\s+Object\.values\(content\)\.flat\(\)\.find\(i => i\?\.id === active\.id\)\s+:\s+null\);/g,
    \const item = pool.find(i => i.id === active.id)
            || Object.values(content).flat().find(i => i?.id === active.id);\
);

// 3. Update handleDragEnd (remove 'if (listType === tierlist)')
jsx = jsx.replace(
    /if \(listType === 'tierlist'\) \{\s+const sourceContainer = active\.data\.current\?\.sortable\?\.containerId \|\| 'pool';([\s\S]*?)\}\s+\}, \[pool, content, listType\]\);/g,
    \const sourceContainer = active.data.current?.sortable?.containerId || 'pool';
        const targetContainer = over.data.current?.sortable?.containerId || over.id;

        if (sourceContainer === targetContainer) return;

        // Ensure 1 item max for ranking/grid slots
        if (listType !== 'tierlist' && targetContainer !== 'pool' && content[targetContainer]?.length >= 1) {
            // Swap logic: put existing item back to pool, put new item in slot
            const existingItem = content[targetContainer][0];
            const draggedItem = sourceContainer === 'pool'
                ? pool.find(i => i.id === active.id)
                : content[sourceContainer]?.find(i => i.id === active.id);
            
            if (!draggedItem) return;

            setPool(prev => {
                let newPool = prev;
                if (sourceContainer === 'pool') newPool = newPool.filter(i => i.id !== active.id);
                return [...newPool, existingItem];
            });

            setContent(prev => ({
                ...prev,
                ...(sourceContainer !== 'pool' && { [sourceContainer]: prev[sourceContainer].filter(i => i.id !== active.id) }),
                [targetContainer]: [draggedItem]
            }));
            return;
        }

        if (sourceContainer === 'pool') {
            const item = pool.find(i => i.id === active.id);
            if (!item) return;
            setPool(prev => prev.filter(i => i.id !== active.id));
            setContent(prev => ({
                ...prev,
                [targetContainer]: [...(prev[targetContainer] || []), item]
            }));
        } else if (targetContainer === 'pool') {
            const item = content[sourceContainer]?.find(i => i.id === active.id);
            if (!item) return;
            setContent(prev => ({
                ...prev,
                [sourceContainer]: prev[sourceContainer].filter(i => i.id !== active.id)
            }));
            setPool(prev => [...prev, item]);
        } else {
            const item = content[sourceContainer]?.find(i => i.id === active.id);
            if (!item) return;
            setContent(prev => ({
                ...prev,
                [sourceContainer]: prev[sourceContainer].filter(i => i.id !== active.id),
                [targetContainer]: [...(prev[targetContainer] || []), item]
            }));
        }
    }, [pool, content, listType]);\
);

// 4. Update handleSave
jsx = jsx.replace(
    /const payload = \{\s+title: title\.trim\(\),\s+list_type: listType,\s+media_type: mediaType,\s+type_config: typeConfig,\s+content,\s+pool,\s+visibility,\s+template_id: template\?\.id\s+\};/g,
    \let dbContent = content;
            if (listType === 'ranking') {
                dbContent = Array.from({ length: typeConfig.max_items }).map((_, i) => (content[\\\] && content[\\\][0]) || null);
            } else if (listType === 'grid') {
                dbContent = {};
                typeConfig.cells.forEach((_, i) => {
                    dbContent[\c\\] = (content[\c\\] && content[\c\\][0]) || null;
                });
            }

            const payload = {
                title: title.trim(),
                list_type: listType,
                media_type: mediaType,
                type_config: typeConfig,
                content: dbContent,
                pool,
                visibility,
                template_id: template?.id
            };\
);

// 5. Update JSX Rendering
// Replace the tierlist editor block with a block that renders tierlist, ranking, or grid
const editorBlockRegex = /\{\/\* Tierlist editor \*\/\}\s+\{listType === 'tierlist' && \([\s\S]*?\}\s+<\/div>\s+\)\s+:\s+null\}\s+<\/DragOverlay>\s+<\/DndContext>\s+\)\}/g;

const newEditorBlock = \{/* Editors */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {listType === 'tierlist' && (
                            <div className="cl-tier-editor">
                                {typeConfig.tiers?.map(tier => (
                                    <TierRow
                                        key={tier.id}
                                        tier={tier}
                                        items={content[tier.id] || []}
                                    />
                                ))}
                            </div>
                        )}

                        {listType === 'ranking' && (
                            <div className="cl-ranking-list-stack">
                                {Array.from({ length: typeConfig.max_items || 10 }).map((_, i) => (
                                    <div key={i} className={\cl-ranking-list-row top-\\}>
                                        <div className="cl-ranking-badge">{i + 1}</div>
                                        <div className="cl-ranking-drop-wrapper">
                                            <DropZone id={\\\} items={content[\\\] || []} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {listType === 'grid' && (
                            <div className="cl-live-grid-cells" style={{ gridTemplateColumns: \epeat(\, minmax(0, 1fr))\ }}>
                                {typeConfig.cells?.map((cell, i) => (
                                    <div key={i} className="cl-grid-cell">
                                        <div className="cl-grid-drop-wrapper">
                                            <DropZone id={\c\\} items={content[\c\\] || []} />
                                        </div>
                                        <div className="cl-grid-label-bar">
                                            <div className="cl-grid-input">{cell.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pool row */}
                        <div className="cl-tier-row cl-pool-row" style={{ marginTop: '32px' }}>
                            <div className="cl-tier-label pool-label">Pool</div>
                            <DropZone id="pool" items={pool} />
                        </div>

                        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                            {activeItem ? (
                                <div className="cl-drag-ghost">
                                    {activeItem.image_url
                                        ? <img src={activeItem.image_url} alt="" />
                                        : <div style={{ width: 58, aspectRatio: '3/4', background: 'var(--bg-tertiary)' }} />
                                    }
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>\;

jsx = jsx.replace(editorBlockRegex, newEditorBlock);

fs.writeFileSync(jsxPath, jsx);

console.log("JSX updated!");
