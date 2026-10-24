import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserSpaces } from '../../lib/spaceService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { getSpaceMessagesReadAt } from '../../lib/spaceUnread';
import './SpacesExplore.css';
import './MySpaces.css';

export default function MySpaces() {
  const [spaces, setSpaces] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('space_favorites') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (user) {
      loadMySpaces();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id || spaces.length === 0) {
      setUnreadCounts({});
      return undefined;
    }

    let isActive = true;
    let messageSubscription;

    const loadUnreadCounts = async () => {
      try {
        const spaceIds = spaces.map(space => space.id);
        const { data: channels, error: channelsError } = await supabase
          .from('space_channels')
          .select('id, space_id')
          .in('space_id', spaceIds);
        if (channelsError) throw channelsError;

        const channelIdsBySpace = new Map(spaceIds.map(id => [String(id), []]));
        const spaceIdByChannel = new Map();
        channels?.forEach(channel => {
          const spaceId = String(channel.space_id);
          channelIdsBySpace.get(spaceId)?.push(channel.id);
          spaceIdByChannel.set(String(channel.id), spaceId);
        });

        const readAtBySpace = new Map(
          spaces.map(space => [String(space.id), getSpaceMessagesReadAt(user.id, space.id)])
        );

        const counts = await Promise.all(spaces.map(async space => {
          const spaceId = String(space.id);
          const channelIds = channelIdsBySpace.get(spaceId) || [];
          if (!channelIds.length) return [spaceId, 0];

          const { count, error } = await supabase
            .from('space_messages')
            .select('id', { count: 'exact', head: true })
            .in('channel_id', channelIds)
            .gt('created_at', readAtBySpace.get(spaceId))
            .neq('user_id', user.id);
          if (error) throw error;
          return [spaceId, count || 0];
        }));

        if (!isActive) return;
        setUnreadCounts(Object.fromEntries(counts));

        if (spaceIdByChannel.size) {
          messageSubscription = supabase
            .channel(`my-spaces-unread-${user.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'space_messages' }, payload => {
              const message = payload.new;
              const spaceId = spaceIdByChannel.get(String(message.channel_id));
              if (!spaceId || message.user_id === user.id) return;
              const readAt = readAtBySpace.get(spaceId);
              if (!readAt || new Date(message.created_at).getTime() <= new Date(readAt).getTime()) return;

              setUnreadCounts(current => ({ ...current, [spaceId]: (current[spaceId] || 0) + 1 }));
            })
            .subscribe();
        }
      } catch (err) {
        console.error('Error loading unread space messages:', err);
      }
    };

    loadUnreadCounts();
    return () => {
      isActive = false;
      if (messageSubscription) supabase.removeChannel(messageSubscription);
    };
  }, [spaces, user?.id]);

  const loadMySpaces = async () => {
    try {
      setLoading(true);
      const data = await getUserSpaces(user.id);
      setSpaces(data);
      setError(null);
    } catch (err) {
      console.error('Error loading my spaces:', err);
      setError(err.message || 'Error al cargar tus espacios');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id];
      localStorage.setItem('space_favorites', JSON.stringify(next));
      return next;
    });
  };

  const filteredSpaces = spaces.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedSpaces = [...filteredSpaces].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <div className="my-spaces-panel" style={{
      maxWidth: '800px',
      margin: '0 auto',
      marginTop: 'calc(var(--space-xl) * -1)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      borderLeft: '1px solid var(--border-subtle)',
      borderRight: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="my-spaces-panel-header" style={{
        padding: '1.5rem 1rem 1rem 1rem',
        borderBottom: '1px solid var(--border-subtle)',
        marginTop: 'var(--space-xl)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 'bold' }}>Tus Espacios</h1>
          <Link to="/spaces/explore" style={{ color: 'var(--text-primary)' }} title="Descubrir">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </Link>
        </div>

        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar en tus espacios..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem 0.6rem 2.5rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <div className="my-spaces-panel-list" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando mensajes...</div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error)' }}>{error}</div>
        ) : spaces.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>No te has unido a ninguna comunidad.</p>
            <Link to="/spaces/explore" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Explorar las comunidades
            </Link>
          </div>
        ) : sortedSpaces.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No se encontraron espacios que coincidan con "{searchTerm}".</p>
          </div>
        ) : (
          <div style={{ padding: '0.5rem 0' }}>
            {sortedSpaces.map(space => {
              const isFav = favorites.includes(space.id);
              return (
                <div
                  key={space.id}
                  className="my-spaces-row"
                  onClick={() => navigate(`/spaces/${space.id}`)}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', marginRight: '1rem', flexShrink: 0, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {space.avatar_url ? (
                      <img src={space.avatar_url} alt={space.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{space.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {space.name}
                      </h3>
                      {space.is_verified && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0" style={{ flexShrink: 0 }}>
                          <path d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6-.86 2.07-3.14 3.47 1.5 3.47-1.5 2.07 3.14 3.6.86-.57 3.65 2.43 2.8zM10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z" />
                        </svg>
                      )}
                    </div>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {space.description || 'Da el primer paso y chatea...'}
                    </p>
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {(unreadCounts[String(space.id)] || 0) > 0 && (
                      <span
                        className="my-spaces-unread-badge"
                        aria-label={`${unreadCounts[String(space.id)]} mensajes sin leer`}
                      >
                        {unreadCounts[String(space.id)] > 99 ? '99+' : unreadCounts[String(space.id)]}
                      </span>
                    )}
                    <button
                      onClick={e => toggleFavorite(e, space.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#fbbf24' : 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill={isFav ? 'currentColor' : 'none'} strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
