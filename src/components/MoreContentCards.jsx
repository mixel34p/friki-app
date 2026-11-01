import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './MoreContentCards.css';

function readableAccentText(color) {
  const match = String(color || '').match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return '#fff';
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map(char => char + char).join('');
  const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const luminance = channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > .42 ? '#111' : '#fff';
}

function listImages(value, result = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value) || result.length >= 4) return result;
  seen.add(value);
  const url = value.image_url || value.cover_url || value.cover?.url;
  if (typeof url === 'string' && url && !result.includes(url)) result.push(url);
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    listImages(child, result, seen);
    if (result.length >= 4) break;
  }
  return result;
}

function MorePostCard({ post, accent }) {
  const [imageFailed, setImageFailed] = useState(false);
  const sensitiveOnly = post.is_sensitive && !post.contains_spoiler;
  const image = !post.is_sensitive && !post.contains_spoiler && Array.isArray(post.media)
    ? post.media.find(media => media?.url)?.url
    : null;
  const preview = post.contains_spoiler
    ? `Spoiler${post.spoiler_work_title ? ` de ${post.spoiler_work_title}` : ''}`
    : post.is_sensitive ? 'Contenido sensible' : post.body || 'Publicación';

  return <Link
    to={`/posts/${post.id}`}
    className={`more-author-post-card${image && !imageFailed ? ' has-image' : ''}${imageFailed ? ' is-image-error' : ''}${sensitiveOnly ? ' is-sensitive' : ''}`}
    style={{ '--more-author-accent': accent || 'var(--brand-primary)', '--more-author-text': readableAccentText(accent) }}
    aria-label={imageFailed ? 'No se pudo cargar la imagen' : preview}
  >
    {image && !imageFailed && <img src={image} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
    {imageFailed ? <span className="more-author-post-error">No se pudo cargar la imagen</span>
      : sensitiveOnly
        ? <svg className="more-author-post-sensitive" viewBox="0 0 24 24" role="img" aria-label="Contenido sensible"><path d="M3 3 21 21"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11.3 11.3 0 0 1 12 5c5.5 0 9.5 4.5 10 7-.2 1.1-1.2 2.6-2.6 3.9"/><path d="M6.6 6.6C3.9 8.2 2.2 10.6 2 12c.5 2.5 4.5 7 10 7 1.2 0 2.3-.2 3.3-.6"/></svg>
        : !image && <span className="more-author-post-copy">{preview}</span>}
  </Link>;
}

function MoreListCard({ list, accent }) {
  const images = listImages(list.content);
  return <Link to={`/lists/${list.id}`} className={`more-author-list-card${images.length ? ' has-artwork' : ''}`} style={{ '--more-author-accent': accent || 'var(--brand-primary)' }} aria-label={`Lista: ${list.title || 'Lista'}`}>
    <div className={`more-author-list-cover${images.length ? '' : ' is-empty'}`}>
      {images.length ? <div className={`more-author-list-art art-count-${images.length}`}>
        {images.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" loading="lazy" />)}
      </div> : <div className={`more-author-list-abstract type-${list.list_type || 'tierlist'}`} aria-hidden="true">
        {[0, 1, 2].map((row, index) => <i key={row} style={{ '--cover-row-accent': `color-mix(in srgb, var(--more-author-accent) ${28 + index * 12}%, #303038)` }} />)}
      </div>}
    </div>
  </Link>;
}

export function normalizeMoreContent({ posts = [], lists = [], limit = 3 } = {}) {
  const items = [
    ...posts.map(post => ({ type: 'post', data: post, created_at: post.created_at, key: `post:${post.id}` })),
    ...lists.map(list => ({ type: 'list', data: list, created_at: list.created_at, key: `list:${list.id}` })),
  ].sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0));
  const selected = [];
  const selectedTypes = new Set();
  for (const item of items) {
    if (!selectedTypes.has(item.type)) {
      selected.push(item);
      selectedTypes.add(item.type);
      if (selected.length === limit) return selected;
    }
  }
  const selectedKeys = new Set(selected.map(item => item.key));
  return [...selected, ...items.filter(item => !selectedKeys.has(item.key))].slice(0, limit);
}

export default function MoreContentCards({ items = [], accent, className = 'more-author-post-grid' }) {
  return <div className={className}>
    {items.map(item => item.type === 'list'
      ? <MoreListCard key={item.key} list={item.data} accent={accent} />
      : <MorePostCard key={item.key} post={item.data} accent={accent} />)}
  </div>;
}
