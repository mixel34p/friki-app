import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    createTemplate,
    updateTemplate,
    getTemplateById,
    DEFAULT_TIER_CONFIG,
} from '../../lib/listService';
import './CreateTemplateModal.css';

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconGlobe = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
);
const IconLock = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
);
const IconTierlist = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
);
const IconRanking = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
    </svg>
);
const IconGrid = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
);
const IconGamepad = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" ry="2"/>
        <line x1="6" y1="12" x2="10" y2="12"/>
        <line x1="8" y1="10" x2="8" y2="14"/>
        <line x1="15" y1="13" x2="15.01" y2="13"/>
        <line x1="18" y1="11" x2="18.01" y2="11"/>
    </svg>
);
const IconTv = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
        <polyline points="17 2 12 7 7 2"/>
    </svg>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CreateTemplateModal({ templateId, onClose, onSuccess }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const overlayRef = useRef(null);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [listType, setListType] = useState('tierlist');
    const [mediaType, setMediaType] = useState('game');
    const [visibility, setVisibility] = useState('public');

    // For edits, we load existing data but keep structure untouched
    const [existingConfig, setExistingConfig] = useState(null);
    const [existingItems, setExistingItems] = useState([]);

    // Load for edit
    useEffect(() => {
        if (!templateId) return;
        getTemplateById(templateId).then(tpl => {
            if (!tpl) return;
            setTitle(tpl.title || '');
            setDescription(tpl.description || '');
            setListType(tpl.list_type || 'tierlist');
            setMediaType(tpl.media_type || 'game');
            setVisibility(tpl.visibility || 'public');
            setExistingConfig(tpl.type_config);
            setExistingItems(tpl.default_items);
        }).catch(console.error);
    }, [templateId]);

    // Escape / overlay click
    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    const handleOverlay = (e) => { if (e.target === overlayRef.current) onClose?.(); };

    // ── Publish ──
    const handlePublish = async () => {
        if (!user) { setError('Debes iniciar sesión.'); return; }
        if (!title.trim()) { setError('El título es obligatorio.'); return; }
        setError(null);

        let type_config = existingConfig || {};
        if (!existingConfig) {
            // Give defaults if creating new
            if (listType === 'tierlist') type_config.tiers = DEFAULT_TIER_CONFIG.tierlist.tiers;
            if (listType === 'ranking')  type_config.max_items = DEFAULT_TIER_CONFIG.ranking.max_items;
            if (listType === 'grid')     { type_config.cells = DEFAULT_TIER_CONFIG.grid.cells; type_config.columns = DEFAULT_TIER_CONFIG.grid.columns; }
        }

        const payload = {
            user_id: user.id,
            title: title.trim(),
            description: description.trim() || null,
            list_type: listType,
            media_type: mediaType,
            visibility,
            type_config,
            default_items: existingItems || [],
        };

        try {
            setSaving(true);
            let result;
            if (templateId) {
                // Update metadata only
                const { user_id, ...updatePayload } = payload;
                result = await updateTemplate(templateId, updatePayload);
                if (onSuccess) onSuccess(result);
                else onClose?.();
            } else {
                // Create new and navigate to builder
                result = await createTemplate(payload);
                onClose?.();
                navigate(`/templates/${result.id}/edit`);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al guardar la plantilla');
        } finally {
            setSaving(false);
        }
    };

    return createPortal((
        <div className="ctm-overlay" ref={overlayRef} onClick={handleOverlay}>
            <div className="ctm-panel">
                <button className="ctm-close" onClick={onClose} aria-label="Cerrar">&times;</button>

                <div className="ctm-header">
                    <div className="ctm-header-inner">
                        <span className="ctm-eyebrow">
                            {templateId ? 'Ajustes' : 'Nueva plantilla'}
                        </span>
                        <h2 className="ctm-title">Información</h2>
                    </div>
                </div>

                <div className="ctm-body">
                    <div className="ctm-field">
                        <label className="ctm-label">Título <span className="ctm-required">*</span></label>
                        <input
                            className="ctm-input"
                            type="text"
                            placeholder="Ej: Top JRPGs de PS2..."
                            value={title}
                            onChange={e => { setTitle(e.target.value); setError(null); }}
                            maxLength={80}
                            autoFocus
                        />
                    </div>

                    <div className="ctm-field">
                        <label className="ctm-label">Descripción</label>
                        <textarea
                            className="ctm-textarea"
                            placeholder="Describe de qué trata esta lista..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            maxLength={300}
                        />
                        <span className="ctm-char-count">{description.length} / 300</span>
                    </div>

                    <div className="ctm-divider" />

                    <div className="ctm-field">
                        <label className="ctm-label">Tipo de lista</label>
                        <div className="ctm-type-cards">
                            {[
                                { key: 'tierlist', Icon: IconTierlist, name: 'Tierlist', desc: 'Niveles S/A/B/C/D' },
                                { key: 'ranking',  Icon: IconRanking,  name: 'Ranking',  desc: 'Top del 1 al N' },
                                { key: 'grid',     Icon: IconGrid,     name: 'Grid',     desc: 'Celdas etiquetadas' },
                            ].map(({ key, Icon, name, desc }) => (
                                <div
                                    key={key}
                                    className={`ctm-type-card ${listType === key ? 'active' : ''} ${templateId ? 'disabled' : ''}`}
                                    onClick={() => !templateId && setListType(key)}
                                    title={templateId ? "No se puede cambiar el tipo una vez creado" : ""}
                                >
                                    <div className="ctm-type-icon"><Icon /></div>
                                    <div className="ctm-type-name">{name}</div>
                                    <div className="ctm-type-desc">{desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="ctm-field" style={{ alignItems: 'center' }}>
                        <label className="ctm-label" style={{ alignSelf: 'flex-start' }}>Media</label>
                        <div className="ctm-segment" style={{ width: '100%', display: 'flex' }}>
                            {[
                                { key: 'game', label: 'Videojuegos', Icon: IconGamepad },
                                { key: 'anime', label: 'Anime', Icon: IconTv }
                            ].map(({ key, label, Icon }) => (
                                <button 
                                    key={key} 
                                    className={`ctm-seg-btn ${mediaType === key ? 'active' : ''}`} 
                                    onClick={() => setMediaType(key)}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Icon /> {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ctm-field">
                        <label className="ctm-label">Visibilidad</label>
                        <div className="ctm-visibility">
                            <button className={`ctm-vis-btn ${visibility === 'public' ? 'active' : ''}`} onClick={() => setVisibility('public')}>
                                <IconGlobe /> Pública
                            </button>
                            <button className={`ctm-vis-btn ${visibility === 'private' ? 'active' : ''}`} onClick={() => setVisibility('private')}>
                                <IconLock /> Privada
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.6rem 1rem',
                            color: '#f87171',
                            fontSize: '0.85rem',
                            marginTop: '1rem'
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                <div className="ctm-footer">
                    <button className="ctm-footer-back" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="ctm-footer-next" onClick={handlePublish} disabled={saving}>
                        {saving ? 'Guardando...' : (templateId ? 'Guardar' : 'Continuar al Builder')}
                    </button>
                </div>
            </div>
        </div>
    ), document.body);
}
