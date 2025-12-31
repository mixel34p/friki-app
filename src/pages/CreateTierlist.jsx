import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
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
        opacity: isDragging ? 0.5 : 1,
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
                <img src={game.image_url || game.cover_url} alt={game.name} className="tier-item-img" />
            ) : (
                <span className="tier-item-emoji"><img src="/icons/videogame.png" alt="🎮" style={{ width: '32px', height: '32px' }} /></span>
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
    const [mediaType, setMediaType] = useState('game') // 'game' | 'anime'

    // Dynamic Tiers State
    const [tiers, setTiers] = useState({ pool: [] })

    // Load existing tierlist if editing
    useEffect(() => {
        if (id) {
            fetchTierlist(id)
        }
    }, [id])

    const fetchTierlist = async (tierlistId) => {
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

            setTitle(data.title)
            setDescription(data.description || '')
            setVisibility(data.visibility)
            setActiveTemplate(data.list_type || 'tierlist')
            setMediaType(data.media_type || 'game')

            if (data.content && Object.keys(data.content).length > 0) {
                // Load from JSON content (New format)
                setTiers(data.content)
            } else {
                // Legacy: Reconstruct from relational items
                // Reconstruct tiers
                const loadedTiers = { pool: [] }
                // Initialize empty rows based on template
                const templateRows = TEMPLATES[data.list_type || 'tierlist'].rows
                templateRows.forEach(row => { loadedTiers[row] = [] })

                // Sort items by position
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
        } catch (error) {
            console.error('Error loading tierlist:', error)
            setError('Error al cargar la tierlist')
        }
    }

    // Initialize tiers based on template
    useEffect(() => {
        if (!id) {
            const initialTiers = { pool: tiers.pool || [] }
            TEMPLATES[activeTemplate].rows.forEach(row => {
                initialTiers[row] = tiers[row] || []
            })
            setTiers(initialTiers)
        }
    }, [activeTemplate])

    // Clear search when changing media type
    useEffect(() => {
        setSearchQuery('')
        setSearchResults([])
        setIsSearching(false)
    }, [mediaType])

    // Search State
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    )

    // Debounced search effect
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
        // Check if already exists in any tier
        const exists = Object.values(tiers).flat().some(g => g.id === game.id)
        if (exists) return

        setTiers(prev => ({
            ...prev,
            pool: [...prev.pool, game]
        }))
        // setSearchQuery('') // Keep search active
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

    const handleDragEnd = (event) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id.toString()
        const overId = over.id.toString()
        const currentRows = [...TEMPLATES[activeTemplate].rows, 'pool']

        // Find active item
        let activeTier = null
        let activeGame = null
        for (const [tier, games] of Object.entries(tiers)) {
            const game = games.find(g => g.id.toString() === activeId)
            if (game) {
                activeTier = tier
                activeGame = game
                break
            }
        }

        if (!activeGame || !activeTier) return

        // Dropping on Tier Label
        if (currentRows.includes(overId)) {
            if (activeTier !== overId) {
                setTiers(prev => ({
                    ...prev,
                    [activeTier]: prev[activeTier].filter(g => g.id.toString() !== activeId),
                    [overId]: [...prev[overId], activeGame]
                }))
            }
            return
        }

        // Dropping on another Item
        let overTier = null
        for (const [tier, games] of Object.entries(tiers)) {
            if (games.find(g => g.id.toString() === overId)) {
                overTier = tier
                break
            }
        }

        if (overTier) {
            if (activeTier === overTier) {
                // Reorder
                const oldIndex = tiers[overTier].findIndex(g => g.id.toString() === activeId)
                const newIndex = tiers[overTier].findIndex(g => g.id.toString() === overId)

                setTiers(prev => ({
                    ...prev,
                    [overTier]: arrayMove(prev[overTier], oldIndex, newIndex)
                }))
            } else {
                // Move to different tier
                setTiers(prev => ({
                    ...prev,
                    [activeTier]: prev[activeTier].filter(g => g.id.toString() !== activeId),
                    [overTier]: [...prev[overTier], activeGame]
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
            // Prepare tiers content for JSON storage
            // Ensure we clean up any non-serializable stuff if needed, but tiers object should be clean
            const content = { ...tiers }

            let tierlistId = id

            if (id) {
                // Update existing tierlist
                const { error: updateError } = await supabase
                    .from('tierlists')
                    .update({
                        title,
                        description,
                        list_type: activeTemplate,
                        visibility,
                        content, // Save JSON content
                        updated_at: new Date()
                    })
                    .eq('id', id)

                if (updateError) throw updateError
            } else {
                // Create new tierlist
                const { data: newTierlist, error: createError } = await supabase
                    .from('tierlists')
                    .insert({
                        user_id: user.id,
                        title,
                        description,

                        list_type: activeTemplate,
                        media_type: mediaType,
                        visibility,
                        content // Save JSON content
                    })
                    .select()
                    .single()

                if (createError) throw createError
                tierlistId = newTierlist.id
            }

            // No need to save items individually anymore!

            navigate(`/tierlist/${tierlistId}`)
        } catch (err) {
            console.error('Error saving tierlist:', err)
            // Show more specific error message from Supabase/Postgres
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

    return (
        <div className="create-tierlist">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">{id ? 'Editar Lista' : 'Crear Nueva Lista'}</h1>

                    {/* Media Type Selector */}
                    {!id && (
                        <div className="media-selector">
                            <button
                                className={`media-btn ${mediaType === 'game' ? 'active' : ''}`}
                                onClick={() => {
                                    if (Object.values(tiers).flat().length > 0) {
                                        if (window.confirm('Cambiar el tipo vaciará la lista actual. ¿Seguro?')) {
                                            setMediaType('game')
                                            setTiers({ pool: [] })
                                        }
                                    } else {
                                        setMediaType('game')
                                    }
                                }}
                            >
                                <img src="/icons/videogame.png" alt="🎮" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Videojuegos
                            </button>
                            <button
                                className={`media-btn ${mediaType === 'anime' ? 'active' : ''}`}
                                onClick={() => {
                                    if (Object.values(tiers).flat().length > 0) {
                                        if (window.confirm('Cambiar el tipo vaciará la lista actual. ¿Seguro?')) {
                                            setMediaType('anime')
                                            setTiers({ pool: [] })
                                        }
                                    } else {
                                        setMediaType('anime')
                                    }
                                }}
                            >
                                <img src="/icons/anime.png" alt="📺" style={{ width: '16px', height: '16px', marginRight: '6px' }} /> Anime
                            </button>
                        </div>
                    )}

                    <div className="template-selector">
                        {Object.values(TEMPLATES).map(template => (
                            <button
                                key={template.id}
                                className={`template-btn ${activeTemplate === template.id ? 'active' : ''}`}
                                onClick={() => setActiveTemplate(template.id)}
                            >
                                {template.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="create-layout">
                    {/* Tierlist Builder */}
                    <div className="tierlist-builder">
                        <div className="tierlist-meta-form">
                            <input
                                type="text"
                                className="input tierlist-title-input"
                                placeholder={`Título de ${TEMPLATES[activeTemplate].label.toLowerCase()}...`}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={100}
                            />
                            <input
                                type="text"
                                className="input"
                                placeholder="Descripción breve (opcional)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={200}
                            />
                            <div className="visibility-toggle">
                                <button
                                    type="button"
                                    className={`visibility-btn ${visibility === 'public' ? 'active' : ''}`}
                                    onClick={() => setVisibility('public')}
                                >
                                    🌍 Pública
                                </button>
                                <button
                                    type="button"
                                    className={`visibility-btn ${visibility === 'private' ? 'active' : ''}`}
                                    onClick={() => setVisibility('private')}
                                >
                                    🔒 Privada
                                </button>
                            </div>
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="tierlist">
                                {TEMPLATES[activeTemplate].rows.map(tier => (
                                    <div key={tier} className="tier-row">
                                        <div
                                            className="tier-label"
                                            id={tier}
                                            style={{
                                                backgroundColor: TEMPLATES[activeTemplate].colors[tier],
                                                color: 'white',
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
                                                    <div className="tier-placeholder">
                                                        Arrastra juegos aquí
                                                    </div>
                                                )}
                                            </DroppableTier>
                                        </SortableContext>
                                    </div>
                                ))}

                                <div className="tier-row pool-row">
                                    <div className="tier-label tier-pool">📦</div>
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
                                                    Juegos añadidos aparecerán aquí
                                                </div>
                                            )}
                                        </DroppableTier>
                                    </SortableContext>
                                </div>
                            </div>
                        </DndContext>
                    </div>

                    {/* Game Search Panel */}
                    <div className="game-search-panel">
                        <h3>Añadir {mediaType === 'anime' ? 'Anime' : 'Juegos'}</h3>
                        <p className="input-hint">Busca y pulsa + para añadir a la Tierlist</p>

                        <div className="search-input-wrapper">
                            <input
                                type="text"
                                className="input"
                                placeholder={mediaType === 'anime' ? "Ej: Naruto, One Piece..." : "Ej: Elden Ring..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isSearching && <div className="search-spinner"></div>}
                        </div>

                        <div className="game-list">
                            {searchResults.map(game => {
                                const isAdded = Object.values(tiers).flat().some(g => g.id === game.id)
                                return (
                                    <button
                                        key={game.id}
                                        className={`game-item ${isAdded ? 'disabled' : ''}`}
                                        onClick={() => !isAdded && addToPool(game)}
                                        disabled={isAdded}
                                        title={game.name}
                                    >
                                        {game.image_url || game.cover_url ? (
                                            <img
                                                src={getHighResImage(game.image_url || game.cover_url)}
                                                alt={game.name}
                                                className="game-thumb"
                                            />
                                        ) : (
                                            <span className="game-emoji">{mediaType === 'game' ? <img src="/icons/videogame.png" alt="🎮" style={{ width: '32px', height: '32px' }} /> : <img src="/icons/anime.png" alt="📺" style={{ width: '32px', height: '32px' }} />}</span>
                                        )}

                                        <div className="game-item-overlay">
                                            <span className="game-add-icon">{isAdded ? '✓' : '+'}</span>
                                        </div>

                                        <div className="game-info">
                                            <span className="game-title">{game.name}</span>
                                            <span className="game-year">{game.release_date?.substring(0, 4)}</span>
                                        </div>
                                    </button>
                                )
                            })}

                            {!isSearching && searchQuery.length >= 3 && searchResults.length === 0 && (
                                <div className="no-results">
                                    <p>No encontrado</p>
                                    <small>Prueba con otro nombre</small>
                                </div>
                            )}

                            {!searchQuery && (
                                <div className="search-empty-state">
                                    {mediaType === 'anime' ? '🎬 Empieza a escribir para buscar animes' : '👾 Empieza a escribir para buscar juegos'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="create-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate(-1)}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Guardando...' : '💾 Guardar Lista'}
                    </button>
                </div>
            </div>
        </div>
    )
}
