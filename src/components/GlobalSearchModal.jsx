import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { searchWorks } from '../lib/workAdapters'
import { workKey, workType } from '../lib/workTypes'
import MangaAvailability from './MangaAvailability'
import { getWorkLog } from '../lib/libraryService'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import LogModal from './LogModal'
import './GlobalSearchModal.css'

const ResultGrid = memo(({ results, type, pendingSelection, onSelect, onResultClick }) => {
    return (
        <div className="spotlight-grid">
            {results.map(item => {
                const title = type === 'game' ? item.name : item.title
                const image = type === 'game' ? item.cover_url : item.image_url
                const year = type === 'game' ? (item.first_release_date ? new Date(item.first_release_date * 1000).getFullYear() : '') : item.year
                const isSelected = onSelect && pendingSelection.some(w => workKey(w.type, w.id) === workKey(type, item.id));
                
                return (
                    <div key={item.id} className={`spotlight-card ${isSelected ? 'selected' : ''}`} onClick={() => onResultClick(item)}>
                        <div className="spotlight-card-img">
                            {image ? (
                                <img src={image} alt={title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span className="no-img-text">{title.substring(0, 2)}</span>
                            )}
                            <div className="spotlight-card-overlay">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </div>
                        </div>
                        <div className="spotlight-card-info">
                            <h4>{title}</h4>
                            {year && <span>{year}</span>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
})

export default function GlobalSearchModal({ isOpen, onClose, onSelect }) {
    const { user, profile } = useAuth()
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [type, setType] = useState('game') // 'game' | 'anime'
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ key: '', offset: 0, next: null })
    const [searchError, setSearchError] = useState('')
    const searchKey = `${type}:${debouncedQuery}`
    const offset = pagination.key === searchKey ? pagination.offset : 0
    const [isClosing, setIsClosing] = useState(false)
    
    // Log Modal State
    const [selectedWork, setSelectedWork] = useState(null)
    const [existingLog, setExistingLog] = useState(null)
    const [logModalOpen, setLogModalOpen] = useState(false)
    
    // Multi-select state
    const [pendingSelection, setPendingSelection] = useState([])
    
    const inputRef = useRef(null)

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setResults([])
            setSelectedWork(null)
            setLogModalOpen(false)
            setPendingSelection([])
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query)
        }, 400)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        const controller = new AbortController()
        const fetchResults = async () => {
            if (!debouncedQuery || debouncedQuery.length < 2) {
                setResults([])
                return
            }
            
            setLoading(true)
            setSearchError('')
            try {
                const data = await searchWorks(type, debouncedQuery, 20, { signal: controller.signal, offset })
                if (!controller.signal.aborted) {
                    setResults(previous => offset ? [...previous, ...data.filter(item => !previous.some(row => String(row.id) === String(item.id)))] : data || [])
                    setPagination({ key: searchKey, offset, next: data.nextOffset ?? null })
                }
            } catch (err) {
                console.error("Search error:", err)
                if (!controller.signal.aborted) { setResults([]); setSearchError(type === 'manga' ? err.message : 'No se pudo buscar. Inténtalo de nuevo.') }
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        
        fetchResults()
        return () => controller.abort()
    }, [debouncedQuery, type, offset, searchKey])

    const handleResultClick = useCallback(async (item) => {
        const work = {
            id: item.id,
            type: type,
            title: type === 'game' ? item.name : item.title,
            image: type === 'game' ? item.cover_url : item.image_url,
            banner_url: item.banner_url || null
        }
        
        if (onSelect) {
            setPendingSelection(prev => {
                const exists = prev.find(w => workKey(w.type, w.id) === workKey(work.type, work.id));
                if (exists) return prev.filter(w => workKey(w.type, w.id) !== workKey(work.type, work.id));
                return [...prev, work];
            });
            return;
        }

        if (!user) {
            onClose()
            navigate('/register')
            return
        }

        if (!profile) {
            onClose()
            navigate('/onboarding')
            return
        }
        
        setSelectedWork(work)
        
        if (user) {
            const log = await getWorkLog(user.id, work.id, work.type)
            setExistingLog(log)
        }
        
        setLogModalOpen(true)
    }, [type, onSelect, user, profile, onClose, navigate]);

    const handleClose = () => {
        setIsClosing(true)
        setTimeout(() => {
            onClose()
            setIsClosing(false)
        }, 300)
    }

    if (!isOpen && !isClosing) return null

    return createPortal((
        <>
            <div className={`spotlight-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
                <button className="spotlight-close" onClick={handleClose}>&times;</button>
                
                <div className={`spotlight-container ${logModalOpen ? 'hidden-left' : ''}`} onClick={e => e.stopPropagation()}>
                    <div className="spotlight-header">
                        <div className="spotlight-tabs">
                            <button className={type === 'game' ? 'active' : ''} onClick={() => { setType('game'); setResults([]); setQuery(''); }}>Videojuegos</button>
                            <button className={type === 'anime' ? 'active' : ''} onClick={() => { setType('anime'); setResults([]); setQuery(''); }}>Anime</button><button className={type === 'manga' ? 'active' : ''} onClick={() => { setType('manga'); setResults([]); setQuery(''); }}>Manga</button>
                        </div>
                        <div className="spotlight-input-wrapper">
                            <svg className="spotlight-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21L16.65 16.65"/></svg>
                            <input 
                                ref={inputRef}
                                type="text" 
                                className="spotlight-input" 
                                placeholder={onSelect ? `¿Qué ${workType(type).plural.toLowerCase()} quieres buscar?` : `¿Qué ${workType(type).label.toLowerCase()} quieres registrar?`}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="spotlight-results">{type === 'manga' && <MangaAvailability />}
                        {searchError && <p role="alert">{searchError}</p>}
                        {loading && <div className="spotlight-loading"><LoadingSpinner size="lg" /></div>}
                        {!loading && query.length > 0 && query.length < 2 && (
                            <div className="spotlight-empty">Sigue escribiendo...</div>
                        )}
                        {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
                            <div className="spotlight-empty">No se han encontrado resultados.</div>
                        )}
                        
                        {!loading && results.length > 0 && (
                            <ResultGrid 
                                results={results} 
                                type={type} 
                                pendingSelection={pendingSelection} 
                                onSelect={onSelect} 
                                onResultClick={handleResultClick} 
                            />
                        )}
                        {type === 'manga' && pagination.key === searchKey && pagination.next != null && !loading && <button type="button" onClick={() => setPagination(previous => ({ ...previous, offset: previous.next }))}>Cargar más manga</button>}
                    </div>
                </div>

                {onSelect && pendingSelection.length > 0 && (
                    <div className="spotlight-footer-external" onClick={e => e.stopPropagation()} style={{ marginTop: '2rem', animation: 'fadeInSpotlight 0.3s ease forwards' }}>
                        <button 
                            className="spotlight-save-btn" 
                            onClick={() => {
                                onSelect(pendingSelection);
                                handleClose();
                            }}
                        >
                            Guardar {pendingSelection.length} {pendingSelection.length === 1 ? 'obra' : 'obras'}
                        </button>
                    </div>
                )}
            </div>
            
            {logModalOpen && selectedWork && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10005, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogModal 
                        isOpen={true} 
                        onClose={() => setLogModalOpen(false)}
                        work={selectedWork}
                        existingLog={existingLog}
                        onSaveComplete={() => {
                            setLogModalOpen(false)
                            handleClose()
                        }}
                    />
                </div>
            )}
        </>
    ), document.body)
}
