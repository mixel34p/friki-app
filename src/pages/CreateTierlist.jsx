import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { searchGames } from '../lib/gameService'
import { searchAnime } from '../lib/animeService'
import './CreateTierlist.css'

const TEMPLATES = {
    tierlist: {
        id: 'tierlist',
        label: 'Tierlist',
        rows: ['S', 'A', 'B', 'C', 'D'],
        colors: {
            'S': 'var(--tier-s)', 'A': 'var(--tier-a)', 'B': 'var(--tier-b)',
            'C': 'var(--tier-c)', 'D': 'var(--tier-d)'
        }
    },
    ranking: {
        id: 'ranking',
        label: 'Top Ranking',
        rows: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'],
        colors: {
            '#1': '#fbbf24', '#2': '#94a3b8', '#3': '#b45309',
            '#4': '#6366f1', '#5': '#6366f1', '#6': '#6366f1',
            '#7': '#6366f1', '#8': '#6366f1', '#9': '#6366f1', '#10': '#6366f1'
        }
    }
}

function SortableItem({ game, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: game.id.toString()
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
        userSelect: 'none',
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="tier-item"
            title={game.name}
        >
            {(game.image_url || game.cover_url) ? (
                <img
                    src={game.image_url || game.cover_url}
                    alt={game.name}
                    className="tier-item-img"
                    draggable={false}
                />
            ) : (
                <span className="tier-item-emoji">
                    <img src="/icons/videogame.png" alt="🎮" style={{ width: '32px', height: '32px' }} draggable={false} />
                </span>
            )}
            <div className="tier-item-overlay">
                <span className="tier-item-title">{game.name}</span>
                <button
                    className="tier-item-remove"
                    onClick={(e) => { e.stopPropagation(); onRemove(game.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    ×
                </button>
            </div>
        </div>
    )
}

function DroppableTier({ id, children }) {
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
        <div
            ref={setNodeRef}
            className={`tier-items ${isOver ? 'tier-items-over' : ''}`}
        >
            {children}
        </div>
    )
}

export default function CreateTierlist() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { id } = useParams()

    const [activeTemplate, setActiveTemplate] = useState('tierlist')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [visibility, setVisibility] = useState('public')
    const [mediaType, setMediaType] = useState('game')
    const [parentId, setParentId] = useState(null)
    const [activeItem, setActiveItem] = useState(null)

    const [tiers, setTiers] = useState({ pool: [] })

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const forkId = searchParams.get('fork')

        if (id) {
            fetchTierlist(id, false)
        } else if (forkId) {
            fetchTierlist(forkId, true)
        }
    }, [id])

    const fetchTierlist = async (tierlistId, isFork = false) => {
        try {
            const { data, error } = await supabase
                .from('tierlists')
                .select(`
                    *,
                    tierlist_items (*)
                `)
                .eq('id', tierlistId)
                .single()

            if (error) throw error

            if (isFork) {
                setTitle(`Mi versión de ${data.title}`)
                setDescription('')
                setVisibility('public')
                setActiveTemplate(data.list_type || 'tierlist')
                setMediaType(data.media_type || 'game')
                setParentId(tierlistId)

                const poolItems = []

                if (data.content && Object.keys(data.content).length > 0) {
                    Object.values(data.content).flat().forEach(item => {
                        if (!poolItems.some(i => i.id === item.id)) {
                            poolItems.push({ ...item })
                        }
                    })
                } else {
                    (data.tierlist_items || []).forEach(item => {
                        const game = {
                            id: item.media_id,
                            name: item.title,
                            image_url: item.image_url,
                            genres: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '')
                        }
                        if (!poolItems.some(i => i.id === game.id)) {
                            poolItems.push(game)
                        }
                    })
                }

                const initialTiers = { pool: poolItems }
                TEMPLATES[data.list_type || 'tierlist'].rows.forEach(row => {
                    initialTiers[row] = []
                })
                setTiers(initialTiers)

            } else {
                setTitle(data.title)
                setDescription(data.description || '')
                setVisibility(data.visibility)
                setActiveTemplate(data.list_type || 'tierlist')
                setMediaType(data.media_type || 'game')
                setParentId(data.parent_id)

                if (data.content && Object.keys(data.content).length > 0) {
                    setTiers(data.content)
                } else {
                    const loadedTiers = { pool: [] }
                    TEMPLATES[data.list_type || 'tierlist'].rows.forEach(row => { loadedTiers[row] = [] })
                    const sortedItems = (data.tierlist_items || []).sort((a, b) => a.position - b.position)

                    sortedItems.forEach(item => {
                        const game = {
                            id: item.media_id,
                            name: item.title,
                            image_url: item.image_url,
                            genres: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '')
                        }

                        if (loadedTiers[item.tier]) {
                            loadedTiers[item.tier].push(game)
                        } else {
                            loadedTiers.pool.push(game)
                        }
                    })
                    setTiers(loadedTiers)
                }
            }
        } catch (error) {
            console.error('Error loading tierlist:', error)
            setError('Error al cargar la tierlist')
        }
    }

    useEffect(() => {
        if (!id && !tiers.pool?.length && !window.location.search.includes('fork')) {
            const initialTiers = { pool: tiers.pool || [] }
            TEMPLATES[activeTemplate].rows.forEach(row => {
                initialTiers[row] = tiers[row] || []
            })
            setTiers(initialTiers)
        } else if (!id && !window.location.search.includes('fork')) {
            setTiers(prev => {
                const newTiers = { pool: prev.pool }
                TEMPLATES[activeTemplate].rows.forEach(r => newTiers[r] = prev[r] || [])
                return newTiers
            })
        }
    }, [activeTemplate])

    useEffect(() => {
        setSearchQuery('')
        setSearchResults([])
        setIsSearching(false)
    }, [mediaType])

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3,
            },
        })
    )

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (searchQuery.trim().length >= 3) {
                setIsSearching(true)
                let results = []
                if (mediaType === 'game') {
                    results = await searchGames(searchQuery)
                } else {
                    results = await searchAnime(searchQuery)
                }
                setSearchResults(results)
                setIsSearching(false)
            } else {
                setSearchResults([])
            }
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [searchQuery])

    const addToPool = (game) => {
        const exists = Object.values(tiers).flat().some(g => g.id === game.id)
        if (exists) return

        setTiers(prev => ({
            ...prev,
            pool: [...prev.pool, game]
        }))
    }

    const removeFromTier = (gameId) => {
        setTiers(prev => {
            const newTiers = { ...prev }
            const currentRows = [...TEMPLATES[activeTemplate].rows, 'pool']

            for (const row of currentRows) {
                if (prev[row]) {
                    newTiers[row] = prev[row].filter(g => g.id !== gameId)
                }
            }
            return newTiers
        })
    }

    const findContainer = (id) => {
        if (id in tiers) {
            return id
        }
        return Object.keys(tiers).find((key) => tiers[key]?.some(g => g.id.toString() === id.toString()))
    }

    const handleDragOver = (event) => {
        const { active, over } = event
        const overId = over?.id
        const activeId = active.id.toString()

        if (!overId || active.id === overId) return

        const activeContainer = findContainer(activeId)
        const overContainer = findContainer(overId)

        if (!activeContainer || !overContainer) return

        if (activeContainer !== overContainer) {
            setTiers((prev) => {
                const activeItems = prev[activeContainer]
                const overItems = prev[overContainer]
                const activeIndex = activeItems.findIndex(g => g.id.toString() === activeId)
                const overIndex = prev[overContainer].some(g => g.id.toString() === overId.toString())
                    ? overItems.findIndex(g => g.id.toString() === overId.toString())
                    : overItems.length + 1

                let newIndex
                if (tiers[overContainer].find(g => g.id.toString() === overId.toString())) {
                    const overItemIndex = overItems.findIndex(g => g.id.toString() === overId.toString())
                    const isBelowOverItem =
                        over &&
                        active.rect.current.translated &&
                        active.rect.current.translated.top > over.rect.top + over.rect.height;

                    const modifier = isBelowOverItem ? 1 : 0;
                    newIndex = overItemIndex >= 0 ? overItemIndex + modifier : overItems.length + 1;
                } else {
                    newIndex = overItems.length + 1
                }

                return {
                    ...prev,
                    [activeContainer]: [
                        ...prev[activeContainer].filter((item) => item.id.toString() !== active.id.toString())
                    ],
                    [overContainer]: [
                        ...prev[overContainer].slice(0, newIndex),
                        activeItems[activeIndex],
                        ...prev[overContainer].slice(newIndex, prev[overContainer].length)
                    ]
                }
            })
        }
    }

    const handleDragEnd = (event) => {
        const { active, over } = event

        setActiveItem(null)

        if (!over) return

        const activeId = active.id.toString()
        const overId = over.id.toString()
        const currentRows = [...TEMPLATES[activeTemplate].rows, 'pool']

        let activeTier = null
        let activeGame = null
        for (const [tier, games] of Object.entries(tiers)) {
            if (!games) continue
            const game = games.find(g => g.id.toString() === activeId)
            if (game) {
                activeTier = tier
                activeGame = game
                break
            }
        }

        if (!activeGame || !activeTier) return

        if (currentRows.includes(overId)) {
            if (activeTier !== overId) {
                setTiers(prev => ({
                    ...prev,
                    [activeTier]: prev[activeTier].filter(g => g.id.toString() !== activeId),
                    [overId]: [...(prev[overId] || []), activeGame]
                }))
            }
            return
        }

        let overTier = null
        for (const [tier, games] of Object.entries(tiers)) {
            if (!games) continue
            if (games.find(g => g.id.toString() === overId)) {
                overTier = tier
                break
            }
        }

        if (overTier) {
            if (activeTier === overTier) {
                const oldIndex = tiers[overTier].findIndex(g => g.id.toString() === activeId)
                const newIndex = tiers[overTier].findIndex(g => g.id.toString() === overId)

                setTiers(prev => ({
                    ...prev,
                    [overTier]: arrayMove(prev[overTier], oldIndex, newIndex)
                }))
            } else {
                setTiers(prev => ({
                    ...prev,
                    [activeTier]: prev[activeTier].filter(g => g.id.toString() !== activeId),
                    [overTier]: [...(prev[overTier] || []), activeGame]
                }))
            }
        }
    }

    const handleSave = async () => {
        if (!title.trim()) {
            setError('El título es obligatorio')
            return
        }

        const totalItems = Object.values(tiers).flat().length
        if (totalItems === 0) {
            setError('Añade al menos un juego a la tierlist')
            return
        }

        setSaving(true)
        setError('')

        try {
            const content = { ...tiers }

            let tierlistId = id

            if (id) {
                const { error: updateError } = await supabase
                    .from('tierlists')
                    .update({
                        title,
                        description,
                        list_type: activeTemplate,
                        visibility,
                        content,
                        updated_at: new Date()
                    })
                    .eq('id', id)

                if (updateError) throw updateError
            } else {
                const { data: newTierlist, error: createError } = await supabase
                    .from('tierlists')
                    .insert({
                        user_id: user.id,
                        title,
                        description,
                        list_type: activeTemplate,
                        media_type: mediaType,
                        visibility,
                        parent_id: parentId,
                        content
                    })
                    .select()
                    .single()

                if (createError) throw createError
                tierlistId = newTierlist.id
            }

            navigate(`/tierlist/${tierlistId}`)
        } catch (err) {
            console.error('Error saving tierlist:', err)
            const errorMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))
            setError(`Error al guardar: ${errorMessage}`)
        } finally {
            setSaving(false)
        }
    }

    const getHighResImage = (url) => {
        if (!url) return null
        let finalUrl = url.startsWith('//') ? `https:${url}` : url
        return finalUrl.replace(/t_[a-z0-9_]+/, 't_cover_big')
    }

    const totalItems = Object.values(tiers).flat().length

    return (
        <div className="ctl-page">

            {/* ═══════════════════════════════
                STICKY EDITOR BAR
            ═══════════════════════════════ */}
            <div className="ctl-editor-bar">
                <div className="ctl-editor-inner">

                    {/* Back */}
                    <button className="ctl-back-btn" onClick={() => navigate(-1)} title="Volver">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                    </button>

                    {/* Title input */}
                    <input
                        type="text"
                        className="ctl-title-input"
                        placeholder={`Título de ${TEMPLATES[activeTemplate].label.toLowerCase()}...`}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                    />

                    {/* Controls */}
                    <div className="ctl-bar-controls">
                        {/* Media type */}
                        {!id && (
                            <div className="ctl-toggle">
                                <button
                                    className={`ctl-toggle-opt ${mediaType === 'game' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (Object.values(tiers).flat().length > 0) {
                                            if (window.confirm('Cambiar el tipo vaciará la lista. ¿Seguro?')) {
                                                setMediaType('game')
                                                setTiers({ pool: [] })
                                            }
                                        } else {
                                            setMediaType('game')
                                        }
                                    }}
                                >
                                    <img src="/icons/videogame.png" alt="" style={{ width: '13px', height: '13px' }} />
                                    <span>Juegos</span>
                                </button>
                                <button
                                    className={`ctl-toggle-opt ${mediaType === 'anime' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (Object.values(tiers).flat().length > 0) {
                                            if (window.confirm('Cambiar el tipo vaciará la lista. ¿Seguro?')) {
                                                setMediaType('anime')
                                                setTiers({ pool: [] })
                                            }
                                        } else {
                                            setMediaType('anime')
                                        }
                                    }}
                                >
                                    <img src="/icons/anime.png" alt="" style={{ width: '13px', height: '13px' }} />
                                    <span>Anime</span>
                                </button>
                            </div>
                        )}

                        {/* Template */}
                        <div className="ctl-toggle">
                            {Object.values(TEMPLATES).map(template => (
                                <button
                                    key={template.id}
                                    className={`ctl-toggle-opt ${activeTemplate === template.id ? 'active' : ''}`}
                                    onClick={() => setActiveTemplate(template.id)}
                                >
                                    {template.label}
                                </button>
                            ))}
                        </div>

                        {/* Save */}
                        <button className="ctl-save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <div className="ctl-save-spinner" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    <span>Guardar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════
                DESCRIPTION BAR
            ═══════════════════════════════ */}
            <div className="ctl-desc-bar">
                <div className="ctl-desc-inner">
                    <input
                        type="text"
                        className="ctl-desc-input"
                        placeholder="Añade una descripción breve (opcional)..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={200}
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="ctl-error-bar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            {/* ═══════════════════════════════
                MAIN CONTENT
            ═══════════════════════════════ */}
            <div className="ctl-content">
                <div className="ctl-layout">

                    {/* ── LEFT: Tierlist Builder ── */}
                    <div className="ctl-builder">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={pointerWithin}
                            onDragStart={(event) => {
                                const { active } = event
                                const activeId = active.id.toString()
                                const allItems = Object.values(tiers).flat()
                                const item = allItems.find(g => g.id.toString() === activeId)
                                setActiveItem(item)
                            }}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDragCancel={() => setActiveItem(null)}
                        >
                            {/* Tier rows */}
                            <div className="ctl-tierlist">
                                {TEMPLATES[activeTemplate].rows.map(tier => (
                                    <div key={tier} className="tier-row">
                                        <div
                                            className="tier-label"
                                            id={tier}
                                            style={{
                                                backgroundColor: TEMPLATES[activeTemplate].colors[tier],
                                                fontSize: activeTemplate === 'ranking' ? '1.2rem' : undefined
                                            }}
                                        >
                                            {tier}
                                        </div>
                                        <SortableContext
                                            items={tiers[tier]?.map(g => g.id.toString()) || []}
                                            strategy={rectSortingStrategy}
                                        >
                                            <DroppableTier id={tier}>
                                                {tiers[tier]?.map(game => (
                                                    <SortableItem
                                                        key={game.id}
                                                        game={game}
                                                        onRemove={removeFromTier}
                                                    />
                                                ))}
                                                {(!tiers[tier] || tiers[tier].length === 0) && (
                                                    <div className="tier-placeholder">Arrastra aquí</div>
                                                )}
                                            </DroppableTier>
                                        </SortableContext>
                                    </div>
                                ))}
                            </div>

                            {/* Pool — separated */}
                            <div className="ctl-pool">
                                <div className="ctl-pool-header">
                                    <span className="ctl-pool-label">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
                                        </svg>
                                        Sin clasificar
                                    </span>
                                    {tiers.pool?.length > 0 && (
                                        <span className="ctl-pool-count">{tiers.pool.length}</span>
                                    )}
                                </div>
                                <SortableContext
                                    items={tiers.pool?.map(g => g.id.toString()) || []}
                                    strategy={rectSortingStrategy}
                                >
                                    <DroppableTier id="pool">
                                        {tiers.pool?.map(game => (
                                            <SortableItem
                                                key={game.id}
                                                game={game}
                                                onRemove={removeFromTier}
                                            />
                                        ))}
                                        {(!tiers.pool || tiers.pool.length === 0) && (
                                            <div className="tier-placeholder">
                                                Busca y añade elementos — luego arrástralos a los tiers
                                            </div>
                                        )}
                                    </DroppableTier>
                                </SortableContext>
                            </div>

                            <DragOverlay>
                                {activeItem ? (
                                    <div className="tier-item dragging-preview">
                                        {(activeItem.image_url || activeItem.cover_url) ? (
                                            <img
                                                src={activeItem.image_url || activeItem.cover_url}
                                                alt={activeItem.name}
                                                className="tier-item-img"
                                                draggable={false}
                                            />
                                        ) : (
                                            <span className="tier-item-emoji">
                                                <img src="/icons/videogame.png" alt="🎮" style={{ width: '32px', height: '32px' }} draggable={false} />
                                            </span>
                                        )}
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>

                    {/* ── RIGHT: Search Panel ── */}
                    <div className="ctl-search-panel">
                        <div className="ctl-panel-header">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>Añadir {mediaType === 'anime' ? 'Anime' : 'Juegos'}</span>
                            {totalItems > 0 && (
                                <span className="ctl-panel-count">{totalItems} añadidos</span>
                            )}
                        </div>

                        <div className="ctl-search-wrap">
                            <svg className="ctl-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                type="text"
                                className="ctl-search-input"
                                placeholder={mediaType === 'anime' ? 'Naruto, One Piece...' : 'Elden Ring, Zelda...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isSearching && <div className="ctl-spinner" />}
                        </div>

                        <div className="ctl-results">
                            {searchResults.map(game => {
                                const isAdded = Object.values(tiers).flat().some(g => g.id === game.id)
                                return (
                                    <button
                                        key={game.id}
                                        className={`ctl-result-item ${isAdded ? 'is-added' : ''}`}
                                        onClick={() => !isAdded && addToPool(game)}
                                        disabled={isAdded}
                                        title={game.name}
                                    >
                                        <div className="ctl-result-thumb">
                                            {(game.image_url || game.cover_url) ? (
                                                <img
                                                    src={getHighResImage(game.image_url || game.cover_url)}
                                                    alt={game.name}
                                                />
                                            ) : (
                                                <div className="ctl-result-fallback">
                                                    {mediaType === 'game'
                                                        ? <img src="/icons/videogame.png" alt="" style={{ width: '22px', height: '22px' }} />
                                                        : <img src="/icons/anime.png" alt="" style={{ width: '22px', height: '22px' }} />
                                                    }
                                                </div>
                                            )}
                                        </div>
                                        <div className="ctl-result-info">
                                            <span className="ctl-result-name">{game.name}</span>
                                            {game.release_date && (
                                                <span className="ctl-result-year">{game.release_date.substring(0, 4)}</span>
                                            )}
                                        </div>
                                        <div className={`ctl-result-btn ${isAdded ? 'added' : ''}`}>
                                            {isAdded ? (
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}

                            {!isSearching && searchQuery.length >= 3 && searchResults.length === 0 && (
                                <div className="ctl-empty">
                                    <span className="ctl-empty-icon">🔍</span>
                                    <p>Sin resultados</p>
                                    <small>Prueba con otro nombre</small>
                                </div>
                            )}

                            {!searchQuery && (
                                <div className="ctl-empty">
                                    <span className="ctl-empty-icon">{mediaType === 'anime' ? '🎬' : '👾'}</span>
                                    <p>Busca para añadir</p>
                                    <small>Escribe al menos 3 caracteres</small>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
