import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaFacebookF, FaRedditAlien, FaTelegram, FaWhatsapp, FaXTwitter } from 'react-icons/fa6';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getListById, deleteList, getListLikesCount, checkUserListLike, toggleListLike } from '../../lib/listService';
import { BADGES_MAP } from '../../lib/badges';
import { getTierLabelFontSize } from '../../lib/tierLabel';
import './ViewList.css';
import '../lists/CreateList.css'; // MANTENER ESTILOS IDÉNTICOS AL EDITOR

const TYPE_LABELS  = { tierlist: 'Tierlist', ranking: 'Ranking', grid: 'Grid' };
const MEDIA_LABELS = { game: 'Juegos', anime: 'Anime' };

function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 1) {
        if (diffHours > 0) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
        if (diffMins > 0) return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
        return 'hace unos segundos';
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function collectListPreviewImages(value, images = [], depth = 0) {
    if (!value || depth > 5 || images.length >= 4) return images;
    if (Array.isArray(value)) {
        value.forEach(item => collectListPreviewImages(item, images, depth + 1));
        return images;
    }
    if (typeof value !== 'object') return images;
    const image = value.image_url || value.cover_url || value.cover?.url;
    if (image && !images.includes(image)) images.push(image);
    Object.entries(value).forEach(([key, child]) => {
        if (key !== 'cover' && images.length < 4 && child && typeof child === 'object') collectListPreviewImages(child, images, depth + 1);
    });
    return images;
}

async function imageToDataUrl(url) {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('No se pudo cargar una imagen del preview');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function escapeSvg(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function splitCssArguments(value) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i += 1) {
        if (value[i] === '(') depth += 1;
        else if (value[i] === ')') depth -= 1;
        else if (value[i] === ',' && depth === 0) {
            parts.push(value.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(value.slice(start).trim());
    return parts;
}

function appendLinearGradient(backgroundImage, defs, id) {
    const match = backgroundImage.match(/^linear-gradient\((.*)\)$/i);
    if (!match) return null;

    const parts = splitCssArguments(match[1]);
    let angle = 180;
    if (/^-?\d+(?:\.\d+)?deg$/i.test(parts[0])) {
        angle = parseFloat(parts.shift());
    } else if (/^to\s/i.test(parts[0])) {
        const direction = parts.shift().toLowerCase();
        angle = direction.includes('right') ? 90 : direction.includes('left') ? 270 : 180;
        if (direction.includes('top')) angle = direction.includes('right') ? 45 : direction.includes('left') ? 315 : 0;
        else if (direction.includes('bottom') && (direction.includes('right') || direction.includes('left'))) {
            angle = direction.includes('right') ? 135 : 225;
        }
    }

    const radians = angle * Math.PI / 180;
    const x1 = 50 - Math.sin(radians) * 50;
    const y1 = 50 + Math.cos(radians) * 50;
    const x2 = 50 + Math.sin(radians) * 50;
    const y2 = 50 - Math.cos(radians) * 50;
    const stops = parts.map((part, index) => {
        const stopMatch = part.match(/^(.*?)(?:\s+(-?\d+(?:\.\d+)?%))?$/);
        let color = (stopMatch?.[1] || part).trim();
        const offset = stopMatch?.[2] || `${parts.length <= 1 ? 0 : index / (parts.length - 1) * 100}%`;
        let opacity = '';
        const rgba = color.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
        if (rgba) {
            color = `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
            opacity = ` stop-opacity="${rgba[4]}"`;
        }
        return `<stop offset="${escapeSvg(offset)}" stop-color="${escapeSvg(color)}"${opacity}/>`;
    }).join('');

    defs.push(`<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`);
    return `url(#${id})`;
}

function buildPreviewSvg(preview, imageSources, width, height) {
    const origin = preview.getBoundingClientRect();
    const defs = [];
    const body = [];
    let nextId = 0;
    const measureContext = document.createElement('canvas').getContext('2d');

    const localRect = element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
    };
    const roundedRect = (rect, radius, fill, stroke = 'none', strokeWidth = 0) =>
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="${escapeSvg(fill)}" stroke="${escapeSvg(stroke)}" stroke-width="${strokeWidth}"/>`;

    const drawText = (textNode, parent, style) => {
        const text = textNode.nodeValue.replace(/\s+/g, ' ').trim();
        if (!text || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return '';
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rangeRect = range.getBoundingClientRect();
        const box = localRect(parent);
        if (!rangeRect.width || !rangeRect.height) return '';

        const fontSize = parseFloat(style.fontSize) || 14;
        const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
        const fontFamily = style.fontFamily || 'sans-serif';
        const fontWeight = style.fontWeight || '400';
        const fontStyle = style.fontStyle || 'normal';
        const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        measureContext.font = font;
        const leftPadding = parseFloat(style.paddingLeft) || 0;
        const rightPadding = parseFloat(style.paddingRight) || 0;
        const availableWidth = Math.max(1, box.width - leftPadding - rightPadding);
        const words = text.split(' ');
        const lines = [];
        let line = '';
        words.forEach(word => {
            const candidate = line ? `${line} ${word}` : word;
            if (line && measureContext.measureText(candidate).width > availableWidth) {
                lines.push(line);
                line = word;
            } else line = candidate;
        });
        if (line) lines.push(line);

        const align = style.textAlign || 'start';
        const anchor = align === 'center' ? 'middle' : (align === 'right' || align === 'end') ? 'end' : 'start';
        const x = anchor === 'middle' ? box.x + box.width / 2 : anchor === 'end' ? box.x + box.width - rightPadding : box.x + leftPadding;
        if (parent.classList?.contains('cl-ranking-badge')) {
            const badgeFontSize = 16;
            measureContext.font = `${fontStyle} ${fontWeight} ${badgeFontSize}px ${fontFamily}`;
            const metrics = measureContext.measureText(text);
            const baselineY = box.y + box.height / 2 + ((metrics.actualBoundingBoxAscent || badgeFontSize * 0.75) - (metrics.actualBoundingBoxDescent || 0)) / 2;
            return `<text x="${box.x + box.width / 2}" y="${baselineY}" fill="${escapeSvg(style.color || '#fff')}" font-family="${escapeSvg(fontFamily)}" font-size="${badgeFontSize}" font-weight="${escapeSvg(fontWeight)}" font-style="${escapeSvg(fontStyle)}" text-anchor="middle">${escapeSvg(text)}</text>`;
        }
        const firstTop = rangeRect.top - origin.top;
        const fill = style.color || '#fff';
        const letterSpacing = style.letterSpacing && style.letterSpacing !== 'normal' ? ` letter-spacing="${escapeSvg(style.letterSpacing)}"` : '';
        return lines.map((value, index) => `<text x="${x}" y="${firstTop + fontSize * 0.9 + lineHeight * index}" fill="${escapeSvg(fill)}" font-family="${escapeSvg(fontFamily)}" font-size="${fontSize}" font-weight="${escapeSvg(fontWeight)}" font-style="${escapeSvg(fontStyle)}" text-anchor="${anchor}"${letterSpacing}>${escapeSvg(value)}</text>`).join('');
    };

    const drawElement = element => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return '';
        const rect = localRect(element);
        if (!rect.width || !rect.height) return '';
        const radiusValue = style.borderTopLeftRadius || '0px';
        const radius = radiusValue.endsWith('%')
            ? Math.min(rect.width, rect.height) * parseFloat(radiusValue) / 100
            : parseFloat(radiusValue) || 0;
        const gradientId = `gradient-${nextId++}`;
        const gradientFill = style.backgroundImage && style.backgroundImage !== 'none'
            ? appendLinearGradient(style.backgroundImage, defs, gradientId)
            : null;
        const fill = gradientFill || style.backgroundColor;
        let output = '';
        if (fill && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') output += roundedRect(rect, radius, fill);

        const borderWidth = parseFloat(style.borderTopWidth) || parseFloat(style.borderWidth) || 0;
        const borderColor = style.borderTopColor || style.borderColor;
        if (borderWidth > 0 && style.borderTopStyle !== 'none' && borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
            output += roundedRect(rect, radius, 'none', borderColor, borderWidth);
        }

        if (element instanceof HTMLImageElement) {
            const source = imageSources.get(element.currentSrc || element.src);
            if (source) {
                const fit = style.objectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
                let imageMarkup = `<image x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" preserveAspectRatio="${fit}" href="${escapeSvg(source)}"/>`;
                const clippingElements = [element];
                for (let ancestor = element.parentElement; ancestor && ancestor !== preview.parentElement; ancestor = ancestor.parentElement) {
                    const ancestorStyle = window.getComputedStyle(ancestor);
                    if (ancestorStyle.overflow === 'hidden' || ancestorStyle.overflow === 'clip'
                        || ancestorStyle.overflowX === 'hidden' || ancestorStyle.overflowX === 'clip'
                        || ancestorStyle.overflowY === 'hidden' || ancestorStyle.overflowY === 'clip') {
                        clippingElements.push(ancestor);
                    }
                }
                clippingElements.forEach(clippingElement => {
                    const clipRect = localRect(clippingElement);
                    const clipStyle = window.getComputedStyle(clippingElement);
                    const clipRadiusValue = clipStyle.borderTopLeftRadius || '0px';
                    const clipRadius = clipRadiusValue.endsWith('%')
                        ? Math.min(clipRect.width, clipRect.height) * parseFloat(clipRadiusValue) / 100
                        : parseFloat(clipRadiusValue) || 0;
                    const clipId = `clip-${nextId++}`;
                    defs.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${roundedRect(clipRect, clipRadius, '#fff')}</clipPath>`);
                    imageMarkup = `<g clip-path="url(#${clipId})">${imageMarkup}</g>`;
                });
                output += imageMarkup;
            }
        } else {
            for (const child of element.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) output += drawText(child, element, style);
                else if (child.nodeType === Node.ELEMENT_NODE) output += drawElement(child);
            }
        }
        return output;
    };

    body.push(drawElement(preview));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

async function downloadListImage(preview, listTitle, authorName, authorAvatar, authorThemeColor) {
    if (!preview) throw new Error('No se encontró el preview de la lista');
    await document.fonts?.ready;

    const visualContent = preview.querySelector('.cl-tierlist, .cl-ranking-stack, .cl-grid-cells') || preview;
    const bounds = visualContent.getBoundingClientRect();
    const originalImages = [...preview.querySelectorAll('img')];
    const imageSources = new Map();
    await Promise.all(originalImages.map(async image => {
        const source = image.currentSrc || image.src;
        if (!source) return;
        try {
            imageSources.set(source, await imageToDataUrl(source));
        } catch {
            // Omit inaccessible images so a remote URL cannot taint the export.
        }
    }));

    const svg = buildPreviewSvg(visualContent, imageSources, bounds.width, bounds.height);
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

    try {
        const previewImage = new Image();
        await new Promise((resolve, reject) => {
            previewImage.onload = resolve;
            previewImage.onerror = () => reject(new Error('No se pudo renderizar el preview de la lista'));
            previewImage.src = svgUrl;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1200;
        const hasDynamicHeight = visualContent.matches('.cl-tierlist, .cl-ranking-stack');
        const previewArea = hasDynamicHeight
            ? { x: 24, y: 150, width: canvas.width - 48, height: 920 }
            : { x: 24, y: 150, width: 1152, height: 920 };
        const scale = hasDynamicHeight
            ? previewArea.width / bounds.width
            : Math.min(previewArea.width / bounds.width, previewArea.height / bounds.height);
        const drawWidth = bounds.width * scale;
        const drawHeight = bounds.height * scale;
        canvas.height = hasDynamicHeight
            ? Math.max(320, Math.ceil(previewArea.y + drawHeight + 130))
            : 1200;
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const drawY = hasDynamicHeight
            ? previewArea.y
            : previewArea.y + (previewArea.height - drawHeight) / 2;
        const drawX = previewArea.x + (previewArea.width - drawWidth) / 2;
        ctx.drawImage(previewImage, drawX, drawY, drawWidth, drawHeight);

        const brandElement = document.querySelector('.sidebar-brand-name');
        const brandFont = brandElement ? window.getComputedStyle(brandElement).fontFamily : 'sans-serif';
        const headerLeft = hasDynamicHeight ? previewArea.x : 48;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.font = `750 34px ${brandFont}`;
        ctx.fillText(listTitle || 'Lista', headerLeft, 58, 920);

        const avatarSize = 44;
        const avatarGap = 12;
        ctx.font = `650 24px ${brandFont}`;
        const displayName = authorName || 'Usuario';
        const avatarX = headerLeft;
        const avatarY = 82;
        let avatarDataUrl = '';
        try {
            avatarDataUrl = await imageToDataUrl(authorAvatar || '/default-avatar.png');
        } catch {
            // La tarjeta conserva el nombre aunque el avatar no se pueda incrustar.
        }
        if (avatarDataUrl) {
            const avatarImage = new Image();
            await new Promise(resolve => {
                avatarImage.onload = resolve;
                avatarImage.onerror = resolve;
                avatarImage.src = avatarDataUrl;
            });
            if (avatarImage.naturalWidth) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
            }
        }
        const avatarBorder = document.querySelector('.vl-post-avatar');
        const accentColor = avatarBorder ? window.getComputedStyle(avatarBorder).borderTopColor : authorThemeColor;
        ctx.strokeStyle = accentColor || '#14b8a6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(displayName, avatarX + avatarSize + avatarGap, avatarY + avatarSize / 2, 620);

        const markSize = 42;
        const footerRight = canvas.width - 24;
        const markY = canvas.height - 100;
        const logo = new Image();
        await new Promise(resolve => {
            logo.onload = resolve;
            logo.onerror = resolve;
            logo.src = '/icons/logo.png';
        });

        ctx.fillStyle = '#ffffff';
        ctx.font = `750 29px ${brandFont}`;
        ctx.textBaseline = 'middle';
        const brandName = 'GeekSphere';
        const nameWidth = ctx.measureText(brandName).width;
        const nameX = footerRight - nameWidth;
        const logoX = nameX - 12 - markSize;
        if (logo.naturalWidth) ctx.drawImage(logo, logoX, markY, markSize, markSize);
        ctx.fillText(brandName, nameX, markY + markSize / 2);

        const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!png) throw new Error('No se pudo crear el PNG');
        const pngUrl = URL.createObjectURL(png);
        const link = document.createElement('a');
        link.download = `${(listTitle || 'lista').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;
        link.href = pngUrl;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

export default function ViewList() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, profile, updateProfile } = useAuth();

    const [list, setList]       = useState(null);
    const [likes, setLikes]     = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);

    useEffect(() => {
        getListById(id)
            .then(data => { setList(data); setLoading(false); })
            .catch(err  => { setError(err.message); setLoading(false); });

        getListLikesCount(id).then(setLikes).catch(console.error);
        if (user) {
            checkUserListLike(id, user.id).then(setIsLiked).catch(console.error);
        }
    }, [id, user]);

    useEffect(() => {
        if (!shareOpen) return undefined;
        const closeOnEscape = event => {
            if (event.key === 'Escape') setShareOpen(false);
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [shareOpen]);

    const handleLike = async () => {
        if (!user) { alert('Inicia sesión para dar me gusta'); return; }
        try {
            const nowLiked = !isLiked;
            setIsLiked(nowLiked);
            setLikes(l => nowLiked ? l + 1 : l - 1);
            await toggleListLike(id, user.id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Estás seguro de eliminar esta lista?')) return;
        try {
            await deleteList(id);
            navigate('/profile');
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return (
        <div className="vl-loading">
            <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 8 }} />
        </div>
    );

    if (error) return (
        <div className="vl-error-state">
            <h2>Algo salió mal</h2>
            <p>{error}</p>
            <Link to="/" className="btn btn-secondary btn-sm">Volver al inicio</Link>
        </div>
    );

    if (!list) return (
        <div className="vl-error-state">
            <h2>Lista no encontrada</h2>
            <Link to="/" className="btn btn-secondary btn-sm">Volver al inicio</Link>
        </div>
    );

    const isAuthorCheck = user && list.user_id === user.id;
    const timeDisplay = getRelativeTime(list.created_at);

    const authorUsername = list.author?.username || 'Usuario';
    const authorDisplayName = list.author?.display_name || authorUsername;
    const authorAvatar = list.author?.avatar_url || '/default-avatar.png';
    const authorBadge = list.author?.featured_badge;
    const authorThemeColor = list.author?.theme_color || 'var(--brand-primary)';
    const shareUrl = window.location.href;
    const encodedShareUrl = encodeURIComponent(shareUrl);
    const encodedShareTitle = encodeURIComponent(list.title || 'Mira esta lista');
    const sharePreviewImages = collectListPreviewImages(list.content);

    const copyShareLink = async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
            } else {
                const input = document.createElement('textarea');
                input.value = shareUrl;
                input.style.position = 'fixed';
                input.style.opacity = '0';
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                input.remove();
            }
            setShareCopied(true);
            window.setTimeout(() => setShareCopied(false), 1800);
        } catch (err) {
            console.error('No se pudo copiar el enlace', err);
        }
    };

    return (
        <div className="vl-page">
            <div className="vl-nav-top">
                <button onClick={() => navigate(-1)} className="vl-back-btn">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    <span>Volver atrás</span>
                </button>
            </div>

            <div className="vl-post-card">
                
                {/* Header (Author & Meta) */}
                <div className="vl-post-header">
                    <Link to={`/profile/${authorUsername}`} className="vl-post-author">
                        <img src={authorAvatar} alt={authorUsername} className="vl-post-avatar" style={{ borderColor: authorThemeColor }} />
                        <div className="vl-post-author-info">
                            <div className="vl-post-author-name-row">
                                <span className="vl-post-displayname">{authorDisplayName}</span>
                                {authorBadge && BADGES_MAP[authorBadge] && (
                                    <span style={{ color: BADGES_MAP[authorBadge].color, display: 'inline-flex', alignItems: 'center', width: '16px', height: '16px' }} title={BADGES_MAP[authorBadge].title}>
                                        {BADGES_MAP[authorBadge].icon}
                                    </span>
                                )}
                            </div>
                            <div className="vl-post-author-handle-row">
                                <span className="vl-post-username">@{authorUsername}</span>
                                <span className="vl-post-dot">•</span>
                                <span className="vl-post-date">{timeDisplay}</span>
                            </div>
                        </div>
                    </Link>
                    
                    <div className="vl-post-actions-top">
                        {isAuthorCheck && (
                            <>
                                <Link to={`/lists/${list.id}/edit`} className="vl-icon-btn" title="Editar">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </Link>
                                <button onClick={() => setShareOpen(true)} className="vl-icon-btn" title="Compartir" aria-label="Compartir lista">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>
                                </button>
                                <button onClick={handleDelete} className="vl-icon-btn vl-icon-btn-danger" title="Eliminar">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                </button>
                            </>
                        )}
                        {!isAuthorCheck && <button onClick={() => setShareOpen(true)} className="vl-icon-btn" title="Compartir" aria-label="Compartir lista">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>
                        </button>}
                    </div>
                </div>

                {/* Content Info */}
                <div className="vl-post-body">
                    <div className="vl-post-title-row">
                        <h1 className="vl-post-title">{list.title}</h1>
                        <div className="vl-post-engagement-top">
                            <button className={`vl-like-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span>{likes}</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="vl-post-tags-row">
                        <div className="vl-post-tags">
                            {list.list_type && (
                                <span className={'vl-tag type-' + list.list_type}>
                                    {list.list_type === 'tierlist' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                                    {list.list_type === 'ranking' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                                    {list.list_type === 'grid' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                    {TYPE_LABELS[list.list_type] || list.list_type}
                                </span>
                            )}
                            {list.media_type && (
                                <span className={'vl-tag media-' + list.media_type}>
                                    {list.media_type === 'game' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>}
                                    {list.media_type === 'anime' && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>}
                                    {MEDIA_LABELS[list.media_type] || list.media_type}
                                </span>
                            )}
                        </div>
                        {list.template_id && (
                            <div className="vl-post-template-ref">
                                <Link to={`/templates/${list.template_id}`}>Ver plantilla</Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Visual */}
                <div className="vl-post-visual-wrapper">
                    <div className="vl-post-visual">
                        {list.list_type === 'tierlist' && <TierlistView list={list} />}
                        {list.list_type === 'ranking' && <RankingView list={list} />}
                        {list.list_type === 'grid' && <GridView list={list} />}
                    </div>
                </div>

            </div>
            {shareOpen && createPortal((
                <div className="vl-share-overlay" onClick={() => setShareOpen(false)}>
                    <section className="vl-share-dialog" role="dialog" aria-modal="true" aria-labelledby="vl-share-title" onClick={event => event.stopPropagation()}>
                        <header className="vl-share-heading">
                            <div><span className="vl-share-eyebrow">COMPARTIR LISTA</span><h2 id="vl-share-title">Que la vean los demás</h2><p>Una selección tuya, lista para pasarla.</p></div>
                            <button className="vl-icon-btn" onClick={() => setShareOpen(false)} aria-label="Cerrar menú de compartir">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m18 6-12 12M6 6l12 12"/></svg>
                            </button>
                        </header>
                        <div className="vl-share-preview" style={{ '--share-author-accent': authorThemeColor }}>
                            <div className="vl-share-preview-copy">
                                <span className="vl-share-preview-author"><img src={authorAvatar} alt="" />{authorDisplayName}<small>@{authorUsername}</small></span>
                                <strong>{list.title}</strong>
                                <span>{TYPE_LABELS[list.list_type] || 'Lista'}{list.media_type ? ` · ${MEDIA_LABELS[list.media_type] || list.media_type}` : ''}</span>
                            </div>
                            <div className="vl-share-preview-art" aria-hidden="true">{sharePreviewImages.slice(0, 3).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" loading="lazy" />)}{sharePreviewImages.length === 0 && <span>GS</span>}</div>
                        </div>
                        <button className="vl-share-link" onClick={copyShareLink} aria-label="Copiar enlace de la lista">
                            <span className="vl-share-link-label">{shareCopied ? 'ENLACE COPIADO' : 'ENLACE DE LA LISTA'}</span>
                            <span className="vl-share-link-value">{shareUrl}</span>
                        </button>
                        <div className="vl-share-section-label">Compartir directamente</div>
                        <div className="vl-share-networks">
                            <a className="vl-share-network whatsapp" href={`https://wa.me/?text=${encodedShareTitle}%20${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaWhatsapp /></b><span>WhatsApp</span></a>
                            <a className="vl-share-network x-twitter" href={`https://twitter.com/intent/tweet?text=${encodedShareTitle}&url=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaXTwitter /></b><span>X</span></a>
                            <a className="vl-share-network telegram" href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaTelegram /></b><span>Telegram</span></a>
                            <a className="vl-share-network reddit" href={`https://www.reddit.com/submit?url=${encodedShareUrl}&title=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaRedditAlien /></b><span>Reddit</span></a>
                            <a className="vl-share-network facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaFacebookF /></b><span>Facebook</span></a>
                        </div>
                        <div className="vl-share-divider" />
                        <button className="vl-share-download" onClick={async () => {
                            try {
                                await downloadListImage(
                                    document.querySelector('.vl-post-visual-wrapper'),
                                    list.title,
                                    authorDisplayName,
                                    authorAvatar,
                                    authorThemeColor
                                );
                            } catch (error) {
                                console.error('No se pudo generar la imagen de la lista', error);
                                alert('No se pudo generar la imagen de la lista. Inténtalo de nuevo.');
                            }
                        }}>
                            <span className="vl-share-download-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg></span>
                            <span><strong>Descargar imagen</strong><small>Guarda una tarjeta con el contenido de la lista</small></span>
                            <svg className="vl-share-download-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </section>
                </div>
            ), document.body)}
        </div>
    );
}

// ─── Tierlist View ───────────────────────────────────────────────────────────
function TierlistView({ list }) {
    const tiers = list.type_config?.tiers || [];
    
    // Exact match of CreateList tier structure
    return (
        <div className="cl-tierlist">
            {tiers.map(tier => {
                const items = list.content[tier.id] || [];
                return (
                    <div key={tier.id} className="cl-tier-row">
                        <div className="cl-tier-label" style={{ backgroundColor: tier.color, color: '#000' }}>
                            <span className="cl-tier-text" style={{ fontSize: getTierLabelFontSize(tier.label) }}>{tier.label}</span>
                        </div>
                        <div className="cl-tier-drop" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
                            {items.map((item, idx) => (
                                <ItemCard key={item.id || idx} item={item} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Ranking View ────────────────────────────────────────────────────────────
function RankingView({ list }) {
    const items = list.content || [];
    const maxItems = list.type_config?.max_items || 10;
    
    // Fill array up to maxItems
    const fullSlots = Array.from({ length: maxItems }).map((_, i) => ({
        item: items['r' + i] || (Array.isArray(items) ? items[i] : null), 
        rank: i + 1 
    }));
    
    // Exact match of CreateList ranking structure
    return (
        <div className="cl-ranking-stack">
            {fullSlots.map(({ item, rank }, i) => (
                <div key={rank} className={`cl-ranking-row top-${i}`}>
                    <div className="cl-ranking-badge">{rank}</div>
                    <div className="cl-ranking-slot">
                        {item ? (
                            <div className="cl-ranking-item">
                                <ItemCard item={item} hideName={true} />
                                <span className="cl-ranking-name-view">{item.name}</span>
                            </div>
                        ) : (
                            <div className="cl-ranking-item cl-ranking-item-placeholder">
                                <span className="cl-ranking-cover-placeholder" aria-hidden="true" />
                                <span className="cl-ranking-name-view">Posición {rank}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Grid View ───────────────────────────────────────────────────────────────
function GridView({ list }) {
    const cells = list.type_config?.cells || [];
    const columns = list.type_config?.columns || 2;
    
    // Exact match of CreateList grid structure
    return (
        <div className="cl-grid-cells" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: `${columns * 120}px`, margin: '0 auto', justifyContent: 'center' }}>
            {cells.map((cell, i) => {
                const item = list.content['c' + i];
                return (
                    <div key={i} className="cl-grid-cell">
                        <div className="cl-grid-drop-wrapper">
                            {item && <ItemCard item={item} hideName={true} />}
                        </div>
                        <div className="cl-grid-label">{cell.label}</div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Helper Item Card ────────────────────────────────────────────────────────
function ItemCard({ item, hideName }) {
    const imgUrl = item.image_url || item.cover_url || item.cover?.url;
    return (
        <div className="cl-item">
            {imgUrl && <img src={imgUrl} alt={item.name} />}
            {!imgUrl && hideName && <span className="cl-ranking-cover-fallback">{item.name?.charAt(0)}</span>}
            {!hideName && (
                <div className="cl-item-overlay">
                    <span className="cl-item-name">{item.name}</span>
                </div>
            )}
        </div>
    );
}
