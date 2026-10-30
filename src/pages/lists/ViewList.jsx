import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaFacebookF, FaRedditAlien, FaTelegram, FaWhatsapp, FaXTwitter } from 'react-icons/fa6';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getVisibleAccentColor } from '../../lib/colorContrast';
import { useAuth } from '../../context/AuthContext';
import {
    getListById, deleteList,
    getListComments, addListComment, updateListComment, deleteListComment,
} from '../../lib/listService';
import { BADGES_MAP } from '../../lib/badges';
import { getTierLabelFontSize } from '../../lib/tierLabel';
import { formatRelativeDate } from '../../lib/formatRelativeDate';
import ListLikeButton from '../../components/ListLikeButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../ReviewDetail.css';
import './ViewList.css';
import '../lists/CreateList.css';

// ─── Avatar ──────────────────────────────────────────────────────────────────
function ProfileAvatar({ profile, size = 'normal' }) {
    const name = profile?.display_name || profile?.username || 'U';
    return (
        <span
            className={`review-detail-avatar ${size}`}
            style={{ '--review-author-theme': profile?.theme_color || 'var(--brand-primary)' }}
        >
            {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" />
                : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
        </span>
    );
}

// ─── Helpers para exportar imagen e info de preview ──────────────────────────
function collectListPreviewImages(content, max = 3) {
    if (!content) return [];
    const images = [];
    const extract = item => {
        if (!item || typeof item !== 'object') return;
        const img = item.image_url || item.cover_url || item.cover?.url;
        if (img && typeof img === 'string' && !images.includes(img)) {
            images.push(img);
        }
    };
    if (Array.isArray(content)) {
        for (const item of content) {
            extract(item);
            if (images.length >= max) break;
        }
    } else if (typeof content === 'object') {
        for (const val of Object.values(content)) {
            if (Array.isArray(val)) {
                for (const sub of val) {
                    extract(sub);
                    if (images.length >= max) break;
                }
            } else {
                extract(val);
            }
            if (images.length >= max) break;
        }
    }
    return images;
}

async function imageToDataUrl(url) {
    if (!url) return '';
    try {
        const normalized = new URL(url, window.location.href).href;
        let blob = null;
        try {
            const { data, error, response } = await supabase.functions.invoke('igdb-proxy', { body: { imageUrl: normalized } });
            if (!error && data) {
                const imageType = response?.headers?.get('x-image-content-type') || 'image/jpeg';
                blob = data instanceof Blob ? new Blob([data], { type: imageType }) : new Blob([data], { type: imageType });
            }
        } catch { /* fallback to direct fetch */ }

        if (!blob) {
            const resp = await fetch(normalized, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (resp.ok) blob = await resp.blob();
        }

        if (blob) {
            return new Promise((res, rej) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result);
                reader.onerror = rej;
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn('No se pudo convertir la imagen a dataUrl:', url, e);
    }
    return '';
}

function escapeSvg(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

function splitCssArgs(value) {
    const parts = []; let depth = 0; let start = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') depth--;
        else if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
    }
    parts.push(value.slice(start).trim());
    return parts;
}

function appendLinearGradient(bg, defs, id) {
    const m = bg.match(/^linear-gradient\((.*)\)$/i);
    if (!m) return null;
    const parts = splitCssArgs(m[1]);
    let angle = 180;
    if (/^-?\d+(?:\.\d+)?deg$/i.test(parts[0])) angle = parseFloat(parts.shift());
    else if (/^to\s/i.test(parts[0])) {
        const d = parts.shift().toLowerCase();
        angle = d.includes('right') ? 90 : d.includes('left') ? 270 : 180;
        if (d.includes('top')) angle = d.includes('right') ? 45 : d.includes('left') ? 315 : 0;
        else if (d.includes('bottom') && (d.includes('right') || d.includes('left'))) angle = d.includes('right') ? 135 : 225;
    }
    const rad = angle * Math.PI / 180;
    const x1 = 50 - Math.sin(rad) * 50, y1 = 50 + Math.cos(rad) * 50;
    const x2 = 50 + Math.sin(rad) * 50, y2 = 50 - Math.cos(rad) * 50;
    const stops = parts.map((part, i) => {
        const sm = part.match(/^(.*?)(?:\s+(-?\d+(?:\.\d+)?%))?$/);
        let color = (sm?.[1] || part).trim();
        const offset = sm?.[2] || `${parts.length <= 1 ? 0 : i / (parts.length - 1) * 100}%`;
        let op = '';
        const rgba = color.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
        if (rgba) { color = `rgb(${rgba[1]},${rgba[2]},${rgba[3]})`; op = ` stop-opacity="${rgba[4]}"`; }
        return `<stop offset="${escapeSvg(offset)}" stop-color="${escapeSvg(color)}"${op}/>`;
    }).join('');
    defs.push(`<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`);
    return `url(#${id})`;
}

function buildPreviewSvg(preview, imageSources, w, h) {
    const origin = preview.getBoundingClientRect();
    const defs = [], body = [];
    let nextId = 0;
    const mc = document.createElement('canvas').getContext('2d');
    const lr = el => { const r = el.getBoundingClientRect(); return { x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height }; };
    const rr = (rect, r, fill, stroke = 'none', sw = 0) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${r}" fill="${escapeSvg(fill)}" stroke="${escapeSvg(stroke)}" stroke-width="${sw}"/>`;

    const drawText = (tn, parent, style) => {
        const text = tn.nodeValue.replace(/\s+/g, ' ').trim();
        if (!text || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return '';
        const range = document.createRange(); range.selectNodeContents(tn);
        const rr2 = range.getBoundingClientRect();
        const box = lr(parent);
        if (!rr2.width || !rr2.height) return '';
        const fs = parseFloat(style.fontSize) || 14, lh = parseFloat(style.lineHeight) || fs * 1.2;
        const ff = style.fontFamily || 'sans-serif', fw = style.fontWeight || '400', fi = style.fontStyle || 'normal';
        mc.font = `${fi} ${fw} ${fs}px ${ff}`;
        const lp = parseFloat(style.paddingLeft) || 0, rp = parseFloat(style.paddingRight) || 0;
        const avail = Math.max(1, box.width - lp - rp);
        const words = text.split(' '); const lines = []; let line = '';
        words.forEach(word => { const c = line ? `${line} ${word}` : word; if (line && mc.measureText(c).width > avail) { lines.push(line); line = word; } else line = c; });
        if (line) lines.push(line);
        const align = style.textAlign || 'start';
        const anchor = align === 'center' ? 'middle' : (align === 'right' || align === 'end') ? 'end' : 'start';
        const x = anchor === 'middle' ? box.x + box.width / 2 : anchor === 'end' ? box.x + box.width - rp : box.x + lp;
        if (parent.classList?.contains('cl-ranking-badge') || parent.classList?.contains('vl-rank-num')) {
            const bfs = 16; mc.font = `${fi} ${fw} ${bfs}px ${ff}`;
            const met = mc.measureText(text);
            const by = box.y + box.height / 2 + ((met.actualBoundingBoxAscent || bfs * 0.75) - (met.actualBoundingBoxDescent || 0)) / 2;
            return `<text x="${box.x + box.width / 2}" y="${by}" fill="${escapeSvg(style.color || '#fff')}" font-family="${escapeSvg(ff)}" font-size="${bfs}" font-weight="${escapeSvg(fw)}" font-style="${escapeSvg(fi)}" text-anchor="middle">${escapeSvg(text)}</text>`;
        }
        const firstTop = rr2.top - origin.top;
        const fill = style.color || '#fff';
        const ls = style.letterSpacing && style.letterSpacing !== 'normal' ? ` letter-spacing="${escapeSvg(style.letterSpacing)}"` : '';
        return lines.map((v, i) => `<text x="${x}" y="${firstTop + fs * 0.9 + lh * i}" fill="${escapeSvg(fill)}" font-family="${escapeSvg(ff)}" font-size="${fs}" font-weight="${escapeSvg(fw)}" font-style="${escapeSvg(fi)}" text-anchor="${anchor}"${ls}>${escapeSvg(v)}</text>`).join('');
    };

    const drawElement = el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return '';
        const rect = lr(el);
        if (!rect.width || !rect.height) return '';
        const rv = style.borderTopLeftRadius || '0px';
        const radius = rv.endsWith('%') ? Math.min(rect.width, rect.height) * parseFloat(rv) / 100 : parseFloat(rv) || 0;
        const gid = `g-${nextId++}`;
        const gf = style.backgroundImage && style.backgroundImage !== 'none' ? appendLinearGradient(style.backgroundImage, defs, gid) : null;
        const fill = gf || style.backgroundColor;
        let out = '';
        if (fill && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') out += rr(rect, radius, fill);
        const bw = parseFloat(style.borderTopWidth) || parseFloat(style.borderWidth) || 0;
        const bc = style.borderTopColor || style.borderColor;
        if (bw > 0 && style.borderTopStyle !== 'none' && bc && bc !== 'rgba(0, 0, 0, 0)') out += rr(rect, radius, 'none', bc, bw);
        if (el instanceof HTMLImageElement) {
            const src = imageSources.get(el.currentSrc || el.src);
            if (src) {
                const fit = style.objectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
                let im = `<image x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" preserveAspectRatio="${fit}" href="${escapeSvg(src)}"/>`;
                const clips = [el];
                for (let a = el.parentElement; a && a !== preview.parentElement; a = a.parentElement) {
                    const as = window.getComputedStyle(a);
                    if (['hidden', 'clip'].includes(as.overflow) || ['hidden', 'clip'].includes(as.overflowX) || ['hidden', 'clip'].includes(as.overflowY)) clips.push(a);
                }
                clips.forEach(c => {
                    const cr = lr(c); const cs = window.getComputedStyle(c);
                    const crv = cs.borderTopLeftRadius || '0px';
                    const cr2 = crv.endsWith('%') ? Math.min(cr.width, cr.height) * parseFloat(crv) / 100 : parseFloat(crv) || 0;
                    const cid = `clip-${nextId++}`;
                    defs.push(`<clipPath id="${cid}" clipPathUnits="userSpaceOnUse">${rr(cr, cr2, '#fff')}</clipPath>`);
                    im = `<g clip-path="url(#${cid})">${im}</g>`;
                });
                out += im;
            }
        } else {
            for (const child of el.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) out += drawText(child, el, style);
                else if (child.nodeType === Node.ELEMENT_NODE) out += drawElement(child);
            }
        }
        return out;
    };

    body.push(drawElement(preview));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

async function downloadListImage(preview, listTitle, authorName, authorAvatar, authorThemeColor, authorUsername, bgCoverUrl, listType) {
    if (!preview) throw new Error('No se encontró el preview');
    await document.fonts?.ready;
    const vc = preview.querySelector('.cl-tierlist, .vl-ranking-stack, .cl-grid-cells') || preview;
    const bounds = vc.getBoundingClientRect();
    const imgs = [...preview.querySelectorAll('img')];
    const imageSources = new Map();
    await Promise.all(imgs.map(async img => {
        const src = img.currentSrc || img.src;
        if (!src) return;
        try { imageSources.set(src, await imageToDataUrl(src)); } catch { /* skip */ }
    }));
    const svg = buildPreviewSvg(vc, imageSources, bounds.width, bounds.height);
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const pi = new Image();
        await new Promise((res, rej) => { pi.onload = res; pi.onerror = () => rej(new Error('No se pudo renderizar')); pi.src = svgUrl; });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1200;
        const dynamic = vc.matches('.cl-tierlist, .vl-ranking-stack');
        const pa = dynamic ? { x: 24, y: 180, width: canvas.width - 48, height: 920 } : { x: 24, y: 180, width: 1152, height: 920 };
        const scale = dynamic ? pa.width / bounds.width : Math.min(pa.width / bounds.width, pa.height / bounds.height);
        const dw = bounds.width * scale, dh = bounds.height * scale;
        canvas.height = dynamic ? Math.max(340, Math.ceil(pa.y + dh + 130)) : 1200;

        // ── 1. Fondo visual tipo review (base oscura + blur de portada + halo de acento) ──
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (bgCoverUrl) {
            try {
                const bgData = await imageToDataUrl(bgCoverUrl);
                if (bgData) {
                    const bgImg = new Image();
                    await new Promise(r => { bgImg.onload = r; bgImg.onerror = r; bgImg.src = bgData; });
                    if (bgImg.naturalWidth) {
                        ctx.save();
                        ctx.filter = 'blur(74px)';
                        ctx.globalAlpha = 0.32;
                        ctx.drawImage(bgImg, -80, -80, canvas.width + 160, canvas.height + 160);
                        ctx.restore();
                        ctx.fillStyle = 'rgba(5, 6, 9, 0.84)';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                }
            } catch { /* skip bg */ }
        }

        const glow = ctx.createRadialGradient(canvas.width * 0.65, 110, 0, canvas.width * 0.65, 110, 700);
        glow.addColorStop(0, authorThemeColor || '#14b8a6');
        glow.addColorStop(1, 'rgba(10, 10, 10, 0)');
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;

        // ── 2. Renderizado de la lista (sistema de escala y posicionamiento preservado) ──
        const dy = dynamic ? pa.y : pa.y + (pa.height - dh) / 2;
        const dx = pa.x + (pa.width - dw) / 2;
        ctx.drawImage(pi, dx, dy, dw, dh);

        const bf = document.querySelector('.sidebar-brand-name');
        const font = bf ? window.getComputedStyle(bf).fontFamily : 'sans-serif';
        const hl = dynamic ? pa.x : 48;

        // ── 3. Usuario (encima del título, con avatar + acento + username) ──
        const avatarX = hl;
        const avatarY = 32;
        const avatarSize = 54;
        let adu = '';
        try { adu = await imageToDataUrl(authorAvatar || '/default-avatar.png'); } catch { /* skip */ }
        if (adu) {
            const ai = new Image();
            await new Promise(res => { ai.onload = res; ai.onerror = res; ai.src = adu; });
            if (ai.naturalWidth) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(ai, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
            }
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = authorThemeColor || '#14b8a6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 - 1.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f4f4f5';
        ctx.font = `700 24px ${font}`;
        ctx.fillText(authorName || 'Usuario', avatarX + avatarSize + 16, avatarY + 24, canvas.width - avatarX - avatarSize - 40);

        ctx.fillStyle = '#a1a1aa';
        ctx.font = `400 17px ${font}`;
        ctx.fillText(`@${authorUsername || 'usuario'}`, avatarX + avatarSize + 16, avatarY + 47, canvas.width - avatarX - avatarSize - 40);

        // Línea divisoria bajo el autor (idéntica a las reviews)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(hl, 102, canvas.width - hl * 2, 1);

        // ── 4. Título de la lista (debajo del autor) ──
        ctx.fillStyle = '#f5f5f5';
        ctx.font = `750 34px ${font}`;
        ctx.fillText(listTitle || 'Lista', hl, 148, canvas.width - hl * 2);

        // ── 5. Footer con separador y GeekSphere branding (idéntico a las reviews) ──
        const footerY = canvas.height - 62;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(hl, footerY - 32, canvas.width - hl * 2, 1);

        const logo = new Image();
        await new Promise(res => { logo.onload = res; logo.onerror = res; logo.src = '/icons/logo.png'; });
        const brand = 'GeekSphere';
        ctx.font = `750 25px ${font}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        const brandX = canvas.width - hl;
        const brandWidth = ctx.measureText(brand).width;
        ctx.fillText(brand, brandX, footerY);
        if (logo.naturalWidth) ctx.drawImage(logo, brandX - brandWidth - 46, footerY - 20, 40, 40);

        const png = await new Promise(res => canvas.toBlob(res, 'image/png'));
        if (!png) throw new Error('No se pudo crear el PNG');
        const pu = URL.createObjectURL(png);
        const link = document.createElement('a');
        link.download = `${(listTitle || 'lista').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;
        link.href = pu; link.click();
        window.setTimeout(() => URL.revokeObjectURL(pu), 1000);
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ViewList() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, profile: currentProfile } = useAuth();

    const [list, setList] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [shareOpen, setShareOpen] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    const sharePreviewImages = collectListPreviewImages(list?.content, 3);

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [commentsError, setCommentsError] = useState('');
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [savingCommentEdit, setSavingCommentEdit] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const deleteTimerRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

    const loadComments = useCallback(async () => {
        setCommentsLoading(true); setCommentsError('');
        try { setComments(await getListComments(id)); }
        catch (err) { console.error(err); setCommentsError('No se pudieron cargar los comentarios.'); }
        finally { setCommentsLoading(false); }
    }, [id]);

    useEffect(() => {
        getListById(id)
            .then(data => { setList(data); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, [id]);

    useEffect(() => { loadComments(); }, [loadComments]);

    // Cerrar share y lightbox con Escape
    useEffect(() => {
        if (!shareOpen && !lightboxOpen) return;
        const fn = e => {
            if (e.key === 'Escape') {
                setShareOpen(false);
                setLightboxOpen(false);
            }
        };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [shareOpen, lightboxOpen]);

    // Bloquear scroll de body cuando el lightbox está abierto
    useEffect(() => {
        if (!lightboxOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [lightboxOpen]);

    // Cerrar menú 3 puntos al hacer clic fuera
    useEffect(() => {
        if (!menuOpen) return;
        const fn = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [menuOpen]);

    const handleDelete = async () => {
        setMenuOpen(false);
        if (!window.confirm('¿Estás seguro de eliminar esta lista?')) return;
        try { await deleteList(id); navigate('/profile'); }
        catch (err) { alert(err.message); }
    };

    const handleSubmitComment = async e => {
        e.preventDefault();
        if (!user || !commentText.trim() || submitting) return;
        setSubmitting(true); setCommentsError('');
        try {
            const comment = await addListComment(id, user.id, commentText, replyTo?.id || null);
            setComments(c => [...c, comment].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
            setCommentText(''); setReplyTo(null);
        } catch (err) { console.error(err); setCommentsError(err.message || 'No se pudo publicar el comentario.'); }
        finally { setSubmitting(false); }
    };

    const handleDeleteComment = async comment => {
        if (!user || comment.user_id !== user.id || pendingDelete) return;
        setComments(c => c.filter(i => i.id !== comment.id));
        setPendingDelete(comment);
        deleteTimerRef.current = setTimeout(async () => {
            if (mountedRef.current) setPendingDelete(c => c?.id === comment.id ? null : c);
            try {
                await deleteListComment(comment.id, user.id);
                if (mountedRef.current) setComments(c => c.map(i => i.parent_comment_id === comment.id ? { ...i, parent_comment_id: null } : i));
            } catch (err) {
                console.error(err);
                if (mountedRef.current) { setComments(c => [...c, comment].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))); setCommentsError('No se pudo eliminar el comentario.'); }
            } finally { deleteTimerRef.current = null; }
        }, 4000);
    };

    const handleUndoDelete = () => {
        if (!pendingDelete) return;
        clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null;
        setComments(c => [...c, pendingDelete].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
        setPendingDelete(null);
    };

    const handleUpdateComment = async (e, comment) => {
        e.preventDefault();
        if (!user || savingCommentEdit) return;
        setSavingCommentEdit(true); setCommentsError('');
        try {
            const updated = await updateListComment(comment.id, user.id, editingText);
            setComments(c => c.map(i => i.id === updated.id ? updated : i));
            setEditingCommentId(null); setEditingText('');
        } catch (err) { console.error(err); setCommentsError(err.message || 'No se pudo editar el comentario.'); }
        finally { setSavingCommentEdit(false); }
    };

    if (loading) return <LoadingSpinner />;

    if (error || !list) return (
        <main className="review-detail-page">
            <div className="review-detail-state">
                <h1>{error ? 'Error al cargar la lista' : 'Lista no encontrada'}</h1>
                <Link to="/search">Volver a descubrir</Link>
            </div>
        </main>
    );

    const isAuthor = user && list.user_id === user.id;
    const templateUseUrl = list.template_id
        ? `/lists/new?template=${list.template_id}`
        : `/lists/new?fromList=${list.id}`;

    const authorUsername   = list.author?.username    || 'usuario';
    const authorName       = list.author?.display_name || list.author?.username || 'Usuario';
    const authorThemeColor = list.author?.theme_color  || 'var(--brand-primary)';
    const pageAccent       = getVisibleAccentColor(authorThemeColor);

    const authorProfile = {
        display_name: authorName,
        username:     authorUsername,
        avatar_url:   list.author?.avatar_url || null,
        theme_color:  authorThemeColor,
    };

    const shareUrl           = window.location.href;
    const encodedShareUrl    = encodeURIComponent(shareUrl);
    const encodedShareTitle  = encodeURIComponent(list.title || 'Mira esta lista');

    const copyShareLink = async () => {
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
            else {
                const ta = document.createElement('textarea');
                ta.value = shareUrl; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            }
            setShareCopied(true); window.setTimeout(() => setShareCopied(false), 1800);
        } catch (err) { console.error(err); }
    };

    return (
        <main
            className="review-detail-page vl-list-page"
            style={{ '--review-page-accent': pageAccent }}
        >
            <article className="review-post">

                {/* ── Topbar: volver + 3 puntos — dentro del contenedor ── */}
                <div className="vl-topbar">
                    <button className="review-detail-back vl-back-inline" type="button" onClick={() => navigate(-1)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div className="vl-menu-wrap" ref={menuRef}>
                        <button className="vl-dots-btn" type="button" aria-label="Más opciones" onClick={() => setMenuOpen(o => !o)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                                <circle cx="5"  cy="12" r="1.5"/>
                                <circle cx="12" cy="12" r="1.5"/>
                                <circle cx="19" cy="12" r="1.5"/>
                            </svg>
                        </button>
                        {menuOpen && (
                            <div className="vl-dropdown">
                                <Link to={templateUseUrl} className="vl-dropdown-item" onClick={() => setMenuOpen(false)}>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <path d="M3 9h18M9 21V9" />
                                    </svg>
                                    Usar plantilla
                                </Link>
                                {isAuthor && (
                                    <Link to={`/lists/${list.id}/edit`} className="vl-dropdown-item" onClick={() => setMenuOpen(false)}>
                                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        Editar lista
                                    </Link>
                                )}
                                {isAuthor && (
                                    <button className="vl-dropdown-item danger" type="button" onClick={handleDelete}>
                                        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        Eliminar lista
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Autor ── */}
                <header className="review-post-header vl-author-header">
                    <Link to={`/profile/${authorUsername}`} className="review-post-author">
                        <ProfileAvatar profile={authorProfile} />
                        <span className="review-post-author-copy">
                            <strong>
                                {authorName}
                                {list.author?.featured_badge && BADGES_MAP[list.author.featured_badge] && (
                                    <span style={{ color: BADGES_MAP[list.author.featured_badge].color, display: 'inline-flex', alignItems: 'center', width: 14, height: 14, marginLeft: 4, verticalAlign: 'middle' }} title={BADGES_MAP[list.author.featured_badge].title}>
                                        {BADGES_MAP[list.author.featured_badge].icon}
                                    </span>
                                )}
                            </strong>
                            <span>@{authorUsername} · {formatRelativeDate(list.created_at)}</span>
                        </span>
                    </Link>
                </header>

                {/* ── Preview: bloque negro con título + visual fusionados (comportamiento tipo imagen) ── */}
                <div
                    className="vl-preview-block is-preview-card"
                    onClick={() => setLightboxOpen(true)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver lista completa: ${list.title}`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true); } }}
                >
                    <div className="vl-locked-preview">
                        <div className="vl-preview-titlebar">
                            <h1 className="vl-preview-title">{list.title}</h1>
                        </div>
                        <div className="vl-post-visual-wrapper">
                            <div className="vl-post-visual">
                                {list.list_type === 'tierlist' && <TierlistView list={list} />}
                                {list.list_type === 'ranking'  && <RankingView  list={list} />}
                                {list.list_type === 'grid'     && <GridView     list={list} />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Acciones ── */}
                <div className="review-post-actions">
                    <ListLikeButton listId={id} />
                    <span className="review-post-action-spacer" />
                    <button type="button" className="review-post-action upcoming" disabled title="Guardar listas estará disponible próximamente">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4z"/></svg>
                        Guardar
                    </button>
                    <button type="button" className="review-post-action upcoming" disabled title="Repostear estará disponible próximamente">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>
                        Repostear
                    </button>
                    <button type="button" className="review-post-action review-share-trigger" onClick={() => setShareOpen(true)} aria-label="Compartir lista">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>
                        Compartir
                    </button>
                </div>

                {/* ── Comentarios ── */}
                <section className="review-comments" aria-labelledby="list-comments-title">
                    <div className="review-comments-heading"><h2 id="list-comments-title">Comentarios</h2></div>
                    {commentsError && (
                        <div className="review-comments-error" role="alert">
                            {commentsError}
                            {commentsError.includes('cargar') && <button type="button" onClick={loadComments}>Reintentar</button>}
                        </div>
                    )}
                    {commentsLoading
                        ? <div className="review-comments-loading">Cargando comentarios…</div>
                        : comments.length === 0
                            ? <div className="review-comments-empty">No hay comentarios aún.</div>
                            : (
                                <div className="review-comments-list">
                                    {comments.map(comment => {
                                        const name = comment.profile?.display_name || comment.profile?.username || 'Usuario';
                                        const isOwnComment = user?.id === comment.user_id;
                                        const isEditing = editingCommentId === comment.id;
                                        const hasReplies = comments.some(i => i.parent_comment_id === comment.id);
                                        return (
                                            <article className={`review-comment${comment.parent_comment_id ? ' is-reply' : ''}${hasReplies ? ' has-replies' : ''}`} key={comment.id}>
                                                <Link to={comment.profile?.username ? `/profile/${comment.profile.username}` : '/profile'} className="review-comment-avatar-link">
                                                    <ProfileAvatar profile={comment.profile} size="small" />
                                                </Link>
                                                <div className="review-comment-body">
                                                    <div className="review-comment-topline">
                                                        <Link to={comment.profile?.username ? `/profile/${comment.profile.username}` : '/profile'}>{name}</Link>
                                                        <time dateTime={comment.created_at}>{formatRelativeDate(comment.created_at)}</time>
                                                    </div>
                                                    {isEditing ? (
                                                        <form className="review-comment-edit-form" onSubmit={e => handleUpdateComment(e, comment)}>
                                                            <textarea aria-label="Editar comentario" value={editingText} onChange={e => setEditingText(e.target.value)} maxLength={2000} rows={2} />
                                                            <div>
                                                                <button type="button" onClick={() => { setEditingCommentId(null); setEditingText(''); }}>Cancelar</button>
                                                                <button type="submit" disabled={!editingText.trim() || savingCommentEdit}>{savingCommentEdit ? 'Guardando…' : 'Guardar'}</button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <p>{comment.content}</p>
                                                            <div className="review-comment-actions">
                                                                {user && <button type="button" onClick={() => { setReplyTo(comment); setCommentText(''); }}>Responder</button>}
                                                                {isOwnComment && (
                                                                    <>
                                                                        <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingText(comment.content); }}>Editar</button>
                                                                        <button type="button" onClick={() => handleDeleteComment(comment)} disabled={Boolean(pendingDelete)}>Eliminar</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )
                    }
                    {user ? (
                        <>
                            {replyTo && (
                                <div className="review-comment-reply-context">
                                    Respondiendo a {replyTo.profile?.display_name || replyTo.profile?.username || 'Usuario'}
                                    <button type="button" onClick={() => setReplyTo(null)}>Cancelar</button>
                                </div>
                            )}
                            <form className="review-comment-form" onSubmit={handleSubmitComment}>
                                <ProfileAvatar profile={currentProfile} size="small" />
                                <label className="review-comment-input-wrap">
                                    <textarea aria-label="Escribe un comentario" value={commentText} onChange={e => setCommentText(e.target.value)} maxLength={2000} rows={1} placeholder="Escribe un comentario…" />
                                </label>
                                <button type="submit" disabled={!commentText.trim() || submitting}>{submitting ? 'Enviando…' : 'Comentar'}</button>
                            </form>
                        </>
                    ) : (
                        <p className="review-comments-signin"><Link to="/login">Inicia sesión</Link> para comentar.</p>
                    )}
                </section>

                {pendingDelete && (
                    <div className="review-comment-undo-toast" role="status">
                        <span>Comentario borrado</span>
                        <button type="button" onClick={handleUndoDelete}>Deshacer</button>
                    </div>
                )}
            </article>

            {/* ── Share dialog ── */}
            {shareOpen && createPortal((
                <div className="review-share-overlay" onClick={() => setShareOpen(false)}>
                    <section className="review-share-dialog" style={{ '--review-page-accent': pageAccent }} role="dialog" aria-modal="true" aria-labelledby="vl-share-title" onClick={e => e.stopPropagation()}>
                        <header className="review-share-heading">
                            <div>
                                <span className="review-share-eyebrow">COMPARTIR LISTA</span>
                                <h2 id="vl-share-title">Que la vean los demás</h2>
                            </div>
                            <button className="review-share-close" type="button" onClick={() => setShareOpen(false)} aria-label="Cerrar">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
                            </button>
                        </header>
                        <div className="review-share-preview" style={{ '--review-page-accent': pageAccent }}>
                            <div className={`review-share-preview-cover${sharePreviewImages.length > 1 ? ' vl-share-cover-fan' : ''}`}>
                                {sharePreviewImages.length > 1 ? (
                                    sharePreviewImages.map((img, i) => (
                                        <img key={i} src={img} alt="" className={`vl-fan-img-${i}`} />
                                    ))
                                ) : sharePreviewImages.length === 1 ? (
                                    <img src={sharePreviewImages[0]} alt="" />
                                ) : (
                                    <div className="vl-share-cover-placeholder"><span>GS</span></div>
                                )}
                            </div>
                            <div className="review-share-preview-copy">
                                <div className="review-share-preview-author">
                                    <ProfileAvatar profile={authorProfile} size="small" />
                                    <span>{authorName}<small>@{authorUsername}</small></span>
                                </div>
                                <strong>{list.title || 'Lista'}</strong>
                                <span>{list.list_type ? list.list_type.charAt(0).toUpperCase() + list.list_type.slice(1) : 'Lista'}</span>
                            </div>
                        </div>
                        <button className="review-share-link" type="button" onClick={copyShareLink} aria-label="Copiar enlace">
                            <span>{shareCopied ? 'ENLACE COPIADO' : 'ENLACE DE LA LISTA'}</span>
                            <strong>{shareUrl}</strong>
                            <i>{shareCopied ? '✓' : '↗'}</i>
                        </button>
                        <div className="review-share-section-label">Compartir directamente</div>
                        <div className="review-share-networks">
                            <a className="whatsapp"  href={`https://wa.me/?text=${encodedShareTitle}%20${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaWhatsapp /></b><span>WhatsApp</span></a>
                            <a className="x-twitter" href={`https://twitter.com/intent/tweet?text=${encodedShareTitle}&url=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaXTwitter /></b><span>X</span></a>
                            <a className="telegram"  href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaTelegram /></b><span>Telegram</span></a>
                            <a className="reddit"    href={`https://www.reddit.com/submit?url=${encodedShareUrl}&title=${encodedShareTitle}`} target="_blank" rel="noreferrer"><b><FaRedditAlien /></b><span>Reddit</span></a>
                            <a className="facebook"  href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noreferrer"><b><FaFacebookF /></b><span>Facebook</span></a>
                        </div>
                        <div className="review-share-divider" />
                        <button className="review-share-download" type="button" onClick={async () => {
                            try {
                                await downloadListImage(
                                    document.querySelector('.vl-post-visual-wrapper'),
                                    list.title,
                                    authorName,
                                    list.author?.avatar_url || null,
                                    authorThemeColor,
                                    authorUsername,
                                    sharePreviewImages[0],
                                    list.list_type
                                );
                            }
                            catch (err) { console.error(err); alert('No se pudo generar la imagen. Inténtalo de nuevo.'); }
                        }}>
                            <span className="review-share-download-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></span>
                            <span><strong>Descargar imagen</strong><small>Guarda una tarjeta con el contenido de la lista</small></span>
                            <svg className="review-share-download-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </section>
                </div>
            ), document.body)}
            {/* ── Vista ampliada / Lightbox (lista + título, cerrar fuera) ── */}
            {lightboxOpen && createPortal((
                <div className="vl-lightbox-overlay" onClick={() => setLightboxOpen(false)}>
                    <button
                        className="vl-lightbox-close"
                        type="button"
                        onClick={() => setLightboxOpen(false)}
                        aria-label="Cerrar vista"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
                    </button>
                    <div className="vl-lightbox-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Vista ampliada: ${list.title}`}>
                        <div className="vl-lightbox-body">
                            <div className="vl-lightbox-titlebar">
                                <h2 className="vl-lightbox-title">{list.title}</h2>
                            </div>
                            <div className="vl-post-visual vl-interactive-view">
                                {list.list_type === 'tierlist' && <TierlistView list={list} />}
                                {list.list_type === 'ranking'  && <RankingView  list={list} />}
                                {list.list_type === 'grid'     && <GridView     list={list} />}
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}
        </main>
    );
}

// ─── Vistas de lista ──────────────────────────────────────────────────────────
function TierlistView({ list }) {
    const tiers = list.type_config?.tiers || [];
    return (
        <div className="cl-tierlist">
            {tiers.map(tier => {
                const items = list.content[tier.id] || [];
                return (
                    <div key={tier.id} className="cl-tier-row">
                        <div className="cl-tier-label" style={{ background: tier.color, fontSize: getTierLabelFontSize(tier.label) }}>
                            {tier.label}
                        </div>
                        <div className="cl-tier-items">
                            {items.map((item, i) => <ItemCard key={i} item={item} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function RankingView({ list }) {
    const slots = list.type_config?.max_items || (Array.isArray(list.content) ? list.content.length : 10);
    return (
        <div className="vl-ranking-stack">
            {Array.from({ length: slots }, (_, i) => {
                const item = Array.isArray(list.content) ? list.content[i] : list.content['r' + i];
                const imgUrl = item ? (item.image_url || item.cover_url || item.cover?.url) : null;
                if (!item) {
                    return (
                        <div key={i} className="vl-rank-empty-row">
                            <span className="vl-rank-num">{i + 1}</span>
                            <div className="vl-rank-cover"><div className="vl-rank-cover-empty">—</div></div>
                            <div className="vl-rank-info"><span className="vl-rank-name" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span></div>
                        </div>
                    );
                }
                return (
                    <div key={i} className={`vl-ranking-row${i < 3 ? ` top-${i}` : ''}`}>
                        <span className="vl-rank-num">{i + 1}</span>
                        <div className="vl-rank-cover">
                            {imgUrl
                                ? <img src={imgUrl} alt={item.name} />
                                : <div className="vl-rank-cover-empty">{item.name?.charAt(0)}</div>
                            }
                        </div>
                        <div className="vl-rank-info">
                            <div className="vl-rank-name">{item.name}</div>
                            {item.year && <div className="vl-rank-year">{item.year}</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function GridView({ list }) {
    const cells   = list.type_config?.cells   || [];
    const columns = list.type_config?.columns || 2;
    return (
        <div className="cl-grid-cells" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: `${columns * 120}px`, margin: '0 auto' }}>
            {cells.map((cell, i) => {
                const item = list.content['c' + i];
                return (
                    <div key={i} className="cl-grid-cell">
                        <div className="cl-grid-drop-wrapper">{item && <ItemCard item={item} hideName />}</div>
                        <div className="cl-grid-label">{cell.label}</div>
                    </div>
                );
            })}
        </div>
    );
}

function ItemCard({ item, hideName }) {
    const imgUrl = item.image_url || item.cover_url || item.cover?.url;
    return (
        <div className="cl-item">
            {imgUrl && <img src={imgUrl} alt={item.name} />}
            {!imgUrl && hideName && <span className="cl-ranking-cover-fallback">{item.name?.charAt(0)}</span>}
            {!hideName && <div className="cl-item-overlay"><span className="cl-item-name">{item.name}</span></div>}
        </div>
    );
}
