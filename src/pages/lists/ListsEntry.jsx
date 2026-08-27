import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ListsEntry.css';

const IconArrow = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
);

const IconTemplate = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
);

const IconEdit = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// ─── Modal component (reutilizable) ──────────────────────────────────────────
export function ListsEntryModal({ onClose, onCreateTemplate }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const overlayRef = useRef(null);

    // Close on overlay click
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onClose?.();
    };

    // Close on Escape
    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    const goTemplates = () => {
        onClose?.();
        navigate('/templates');
    };

    const handleCreate = () => {
        onClose?.();
        if (onCreateTemplate) {
            onCreateTemplate();
        } else if (user) {
            navigate('/templates?new=1');
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="le-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="le-modal">
                {/* Close */}
                <button className="le-close" onClick={onClose} aria-label="Cerrar">
                    &times;
                </button>

                {/* Header (Clean LogModal style without poster) */}
                <div className="le-header-compact">
                    <div className="le-header-bg" />
                    <div className="le-header-content-clean">
                        <div className="le-header-info">
                            <span className="le-badge-top">NUEVA LISTA</span>
                            <h2 className="le-title-compact">Empieza tu lista</h2>
                            <p className="le-subtitle-clean">Elige cómo quieres empezar a crear.</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="le-body">
                    {/* Option 1 — usar plantilla */}
                    <div className="le-option-wrap">
                        <span className="le-badge">Recomendado</span>
                        <button className="le-option primary" onClick={goTemplates}>
                            <div className="le-option-icon">
                                <IconTemplate />
                            </div>
                            <div className="le-option-text">
                                <div className="le-option-title">Usar una plantilla</div>
                                <div className="le-option-desc">
                                    Elige entre las plantillas de la comunidad y rellena tu lista en segundos.
                                </div>
                            </div>
                            <span className="le-option-arrow">
                                <IconArrow />
                            </span>
                        </button>
                    </div>

                    <div className="le-divider">o</div>

                    {/* Option 2 — crear plantilla */}
                    <div className="le-option-wrap">
                        <button className="le-option" onClick={handleCreate}>
                            <div className="le-option-icon">
                                <IconEdit />
                            </div>
                            <div className="le-option-text">
                                <div className="le-option-title">Crear plantilla nueva</div>
                                <div className="le-option-desc">
                                    Diseña tu propia estructura con tiers, rankings o grids personalizados.
                                </div>
                            </div>
                            <span className="le-option-arrow">
                                <IconArrow />
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Page wrapper (para la ruta /lists/new) ───────────────────────────────────
export default function ListsEntry() {
    const navigate = useNavigate();

    return (
        <ListsEntryModal
            onClose={() => navigate(-1)}
        />
    );
}
