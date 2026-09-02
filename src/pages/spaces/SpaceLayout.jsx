import React, { useState, useEffect } from 'react';
import { Outlet, useParams, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { getSpaceChannels, createSpaceChannel, getSpaceById, updateSpaceChannel, deleteSpaceChannel, leaveSpace, updateSpace, checkMembership, joinSpace, getSpaceEmojis, createCustomEmoji, deleteCustomEmoji, updateCustomEmoji } from '../../lib/spaceService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import GlobalSearchModal from '../../components/GlobalSearchModal';
import './SpaceLayout.css';
import '../EditProfile.css';

const THEME_COLORS = [
    '#14b8a6', '#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#6366f1', '#ec4899'
];

export default function SpaceLayout() {
  const { id: spaceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [space, setSpace] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState('info');
  const [settingsSpace, setSettingsSpace] = useState({ name: '', description: '', theme_color: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const avatarInputRef = React.useRef(null);
  const bannerInputRef = React.useRef(null);
  const [isLeavingModalOpen, setIsLeavingModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [emojis, setEmojis] = useState([]);
  const [newEmojiName, setNewEmojiName] = useState('');
  const [newEmojiUrl, setNewEmojiUrl] = useState('');
  const [isAddingEmoji, setIsAddingEmoji] = useState(false);
  const [editingEmojiId, setEditingEmojiId] = useState(null);
  const [editingEmojiName, setEditingEmojiName] = useState('');
  const [showAddEmojiModal, setShowAddEmojiModal] = useState(false);
  
  useEffect(() => {
      if (activeSettingsSection === 'emojis') {
          loadEmojis();
      }
  }, [activeSettingsSection]);

  const loadEmojis = async () => {
      try {
          const data = await getSpaceEmojis(spaceId);
          setEmojis(data);
      } catch (err) {
          console.error(err);
      }
  };

  const handleAddEmoji = async (e) => {
      e.preventDefault();
      if (!newEmojiName || !newEmojiUrl) return;
      if (emojis.length >= 50) {
          alert('Límite de 50 emojis alcanzado.');
          return;
      }
      setIsAddingEmoji(true);
      try {
          await createCustomEmoji(spaceId, newEmojiName, newEmojiUrl);
          setNewEmojiName('');
          setNewEmojiUrl('');
          loadEmojis();
      } catch (err) {
          console.error(err);
          alert('Error al añadir emoji. Asegúrate de que el nombre no exista ya.');
      } finally {
          setIsAddingEmoji(false);
      }
  };

  const handleDeleteEmoji = async (id) => {
      if (!window.confirm('¿Seguro que quieres borrar este emoji?')) return;
      try {
          await deleteCustomEmoji(id);
          loadEmojis();
      } catch (err) {
          console.error(err);
          alert('Error al borrar emoji');
      }
  };

  const handleEditEmojiSubmit = async (id) => {
      if (!editingEmojiName.trim()) {
          setEditingEmojiId(null);
          return;
      }
      try {
          await updateCustomEmoji(id, editingEmojiName);
          setEditingEmojiId(null);
          loadEmojis();
      } catch (err) {
          console.error(err);
          alert('Error al actualizar el nombre del emoji. Quizás ya exista.');
      }
  };
  
  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === 'avatar') {
        setAvatarFile(file);
        setAvatarPreview(previewUrl);
    } else {
        setBannerFile(file);
        setBannerPreview(previewUrl);
    }
  };

  
  const isAdmin = space && user && space.owner_id === user.id;

  const SETTINGS_TABS = [
    { id: 'info', label: 'General', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> },
    { id: 'appearance', label: 'Apariencia', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg> },
    { id: 'works', label: 'Obras', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg> },
    ...(space?.is_verified ? [{ id: 'emojis', label: 'Emojis', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg> }] : []),
    { id: 'danger', label: 'Peligro', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> }
  ];

  useEffect(() => {
    loadSpaceData();

    const subscription = supabase.channel(`space_channels_${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_channels', filter: `space_id=eq.${spaceId}` }, () => {
        loadSpaceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [spaceId]);

  const loadSpaceData = async () => {
    try {
      setIsCheckingMembership(true);
      const spaceData = await getSpaceById(spaceId).catch(e => {
        console.error('Error space:', e);
        return null;
      });
      setSpace(spaceData);

      let memberCheck = false;
      if (user && spaceId) {
        memberCheck = await checkMembership(spaceId, user.id);
      }
      setIsMember(memberCheck);
      setIsCheckingMembership(false);

      if (!memberCheck) return; // Stop loading channels if not a member

      const channelsData = await getSpaceChannels(spaceId).catch(e => {
        console.error('Error channels:', e);
        window.alert("Error fetching channels: " + e.message);
        return [];
      });
      setChannels(channelsData);
      
      // Auto-redirect to the first text channel if on the root space URL
      if (location.pathname === `/spaces/${spaceId}`) {
        const safeChan = Array.isArray(channelsData) ? channelsData : [];
        const textChans = safeChan.filter(c => c.type !== 'foro' && c.type !== 'forum' && c.type !== 'debates');
        
        if (textChans.length > 0) {
            navigate(`/spaces/${spaceId}/chat/${textChans[0].id}`, { replace: true });
        } else {
            navigate(`/spaces/${spaceId}/debates`, { replace: true });
        }
      }
    } catch (error) {
      console.error('Error loading space data', error);
      setIsCheckingMembership(false);
    }
  };

  const handleJoinSpace = async () => {
    if (!user) return navigate('/login');
    try {
      setIsJoining(true);
      await joinSpace(spaceId, user.id);
      setIsMember(true);
      loadSpaceData(); // reload channels and redirect
    } catch (e) {
      console.error('Error joining space:', e);
    } finally {
      setIsJoining(false);
    }
  };

  const handleEditChannelSubmit = async (e) => {
    e.preventDefault();
    if (editingChannel && editingChannel.name) {
      try {
        await updateSpaceChannel(editingChannel.id, { name: editingChannel.name });
        loadSpaceData();
        setEditingChannel(null);
      } catch (error) {
        console.error(error);
        alert('Error editing channel');
      }
    }
  };

  const handleDeleteChannel = async () => {
    try {
      await deleteSpaceChannel(channelToDelete.id);
      if (location.pathname.includes(`/chat/${channelToDelete.id}`)) {
        navigate(`/spaces/${spaceId}`);
      } else {
        loadSpaceData();
      }
      setChannelToDelete(null);
    } catch (error) {
      console.error(error);
      alert('Error al borrar el canal');
    }
  };


  const handleLeaveSpace = async () => {
    if (!user) return;
    try {
      await leaveSpace(spaceId, user.id);
      navigate('/spaces');
    } catch (err) {
      console.error(err);
      alert('Error al abandonar el servidor.');
    }
  };

    const openSettings = () => {
    setSettingsSpace({
      name: space?.name || '',
      description: space?.description || '',
      theme_color: space?.theme_color || '#14b8a6',
      related_works: space?.related_works || []
    });
    setAvatarPreview(space?.avatar_url || null);
    setAvatarFile(null);
    setBannerPreview(space?.banner_url || null);
    setBannerFile(null);
    setIsSettingsModalOpen(true);
    setIsHeaderMenuOpen(false);
  };

    const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      let finalAvatarUrl = space?.avatar_url;
      let finalBannerUrl = space?.banner_url;

      if (avatarFile) {
          const ext = avatarFile.name.split('.').pop();
          const path = `spaces/avatars/${spaceId}-${Date.now()}.${ext}`;
          const { error: err } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
          if (err) throw err;
          finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
      
      if (bannerFile && space?.is_verified) {
          const ext = bannerFile.name.split('.').pop();
          const path = `spaces/banners/${spaceId}-${Date.now()}.${ext}`;
          const { error: err } = await supabase.storage.from('avatars').upload(path, bannerFile, { upsert: true });
          if (err) throw err;
          finalBannerUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      await updateSpace(spaceId, { 
          ...settingsSpace, 
          avatar_url: finalAvatarUrl,
          banner_url: space?.is_verified ? finalBannerUrl : finalBannerUrl // Keep same logic
      });
      await loadSpaceData();
      setIsSettingsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la configuración');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateChannelSubmit = async (e) => {
    e.preventDefault();
    if (newChannelName.trim()) {
      try {
        await createSpaceChannel({ space_id: spaceId, name: newChannelName.trim(), type: 'chat' });
        setNewChannelName('');
        setIsCreatingChannel(false);
      } catch (error) {
        console.error('Error creating channel:', error);
        alert('Error creando el canal');
      }
    }
  };

  const safeChannels = Array.isArray(channels) ? channels : [];
  const defaultChannel = safeChannels.find(c => c.type === 'foro' || c.type === 'forum' || c.type === 'debates');
  const chatChannels = safeChannels.filter(c => c.id !== defaultChannel?.id && c.type === 'chat');

  const customStyles = space?.theme_color ? { 
    '--brand-primary': space.theme_color,
    '--brand-primary-hover': space.theme_color + 'cc' 
  } : {};

  if (isCheckingMembership) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)', marginTop: 'calc(-1 * var(--space-xl))', width: '100%', background: 'var(--bg-primary)' }}>
        <div className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Comprobando acceso...</div>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="space-welcome-gate" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', marginTop: 'calc(-1 * var(--space-xl))', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        
        {/* BIG BANNER BACKGROUND */}
        {space?.banner_url && (
          <div style={{ 
            position: 'absolute', 
            top: 0, left: 0, width: '100%', height: '55%', 
            backgroundImage: `url(${space.banner_url})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            zIndex: 0
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, var(--bg-primary) 100%)' }} />
          </div>
        )}

        {/* CONTENT */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem', width: '100%', maxWidth: '650px' }}>
          
          <img 
            src={space?.avatar_url || '/default-avatar.png'} 
            alt={space?.name} 
            style={{ 
              width: '140px', height: '140px', 
              borderRadius: '50%', 
              marginBottom: '1.5rem', 
              objectFit: 'cover', 
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)', 
              border: `4px solid ${space?.theme_color || 'var(--bg-modifier-hover)'}`,
              background: 'var(--bg-secondary)'
            }} 
          />
          
          <h1 style={{ fontSize: '3.2rem', marginBottom: '1rem', color: 'var(--text-primary)', textShadow: space?.banner_url ? '0 2px 16px rgba(0,0,0,0.8)' : 'none', fontWeight: 800, letterSpacing: '-1px' }}>
            Estás invitado a {space?.name}
          </h1>
          
          <p style={{ fontSize: '1.2rem', color: space?.banner_url ? '#ffffff' : 'var(--text-secondary)', marginBottom: '3rem', lineHeight: '1.6', textShadow: space?.banner_url ? '0 2px 8px rgba(0,0,0,0.9)' : 'none', opacity: 0.9 }}>
            {space?.description}
          </p>
          
          <button 
             className="btn-primary" 
             style={{ 
               padding: '1.2rem 4rem', 
               fontSize: '1.2rem', 
               borderRadius: '40px', 
               fontWeight: 'bold', 
               boxShadow: `0 8px 24px ${space?.theme_color ? space.theme_color + '66' : 'rgba(20, 184, 166, 0.4)'}`,
               background: space?.theme_color || 'var(--brand-primary)',
               color: '#fff',
               border: 'none',
               cursor: 'pointer',
               transition: 'transform 0.2s, box-shadow 0.2s'
             }}
             onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
             onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
             onClick={handleJoinSpace}
             disabled={isJoining}
          >
             {isJoining ? 'Uniéndose...' : 'Aceptar invitación'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-layout" style={customStyles}>
      <div className="space-sidebar">
        <div className={`space-header-container ${space?.banner_url ? 'has-banner' : ''}`}>
          {space?.banner_url && (
            <div 
              className="space-banner-bg" 
              style={{ backgroundImage: `url(${space.banner_url})` }}
            />
          )}
          
          <div className="space-header" onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}>
            <div className="space-header-content">
              {space?.is_verified && (
                <svg className="space-verified-badge" title="Comunidad Verificada" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#1d9bf0" d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6-.86 2.07-3.14 3.47 1.5 3.47-1.5 2.07 3.14 3.6.86-.57 3.65 2.43 2.8z" />
                  <path fill="#ffffff" d="M10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z" />
                </svg>
              )}
              <h2>{space?.name || 'Espacio'}</h2>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="space-header-icon">
                {isHeaderMenuOpen ? <polyline points="18 15 12 9 6 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
              </svg>
            </div>
            
            {isHeaderMenuOpen && (
              <>
                <div className="space-dropdown-overlay" onClick={(e) => { e.stopPropagation(); setIsHeaderMenuOpen(false); }} />
                <div className="space-header-dropdown" onClick={e => e.stopPropagation()}>
                {isAdmin ? (
                  <div className="space-header-dropdown-item" onClick={(e) => { e.stopPropagation(); openSettings(); setIsHeaderMenuOpen(false); }} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', transition: 'background-color var(--transition-fast)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Configuración
                  </div>
                ) : (
                  <div className="space-header-dropdown-item danger" onClick={(e) => { e.stopPropagation(); setIsLeavingModalOpen(true); setIsHeaderMenuOpen(false); }} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 500, color: '#ef4444', transition: 'background-color var(--transition-fast)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Abandonar servidor
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="space-channels">
          {defaultChannel && (
            <NavLink to={`/spaces/${spaceId}/debates`} className={({isActive}) => `channel-link ${isActive ? 'active' : ''}`}>
              <svg className="channel-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              <span className="channel-name">{defaultChannel.name}</span>
            </NavLink>
          )}
          
          <div className="channel-category" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ lineHeight: 1 }}>CANALES DE TEXTO</span>
            {isAdmin && (
              <button 
                onClick={(e) => { e.preventDefault(); setIsCreatingChannel(true); }}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.7, padding: '0', lineHeight: 1 }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                title="Crear Canal"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            )}
          </div>
          
          {chatChannels.map(channel => (
            <NavLink key={channel.id} to={`/spaces/${spaceId}/chat/${channel.id}`} className={({isActive}) => `channel-link ${isActive ? 'active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <svg className="channel-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span className="channel-name">{channel.name}</span>
              </div>
              
              {isAdmin && (
                <div 
                  className="channel-settings-container" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    setEditingChannel({ id: channel.id, name: channel.name }); 
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="channel-settings-icon">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="space-main">
        <Outlet context={{ channels, space }} />
      </div>

      {editingChannel && (
        <div className="modal-overlay" onClick={() => setEditingChannel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2>Ajustes del Canal</h2>
              <button className="modal-close" onClick={() => setEditingChannel(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditChannelSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)'}}>Nombre del canal</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={editingChannel.name} 
                    onChange={e => setEditingChannel({...editingChannel, name: e.target.value})}
                    autoFocus
                  />
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px'}}>
                  <button type="button" className="btn btn-ghost" style={{color: '#ef4444'}} onClick={() => { setChannelToDelete(editingChannel); setEditingChannel(null); }}>
                    Borrar canal
                  </button>
                  <button type="submit" className="btn btn-primary" style={{padding: '0.4rem 1rem', fontSize: '0.85rem', height: 'fit-content'}}>
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="ep-overlay">
            {showAddEmojiModal && (
                <div className="ep-modal" style={{ position: 'absolute', zIndex: 100, maxWidth: '400px', width: '90%' }}>
                    <div className="ep-modal-header">
                        <h2 className="ep-modal-title">Añadir Emoji</h2>
                        <button className="ep-close-btn" onClick={() => setShowAddEmojiModal(false)} type="button">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="ep-modal-body" style={{ padding: '20px' }}>
                        <div className="ep-field">
                            <label className="ep-label">URL de la imagen</label>
                            <input 
                                type="text" 
                                placeholder="https://..." 
                                className="ep-input" 
                                value={newEmojiUrl} 
                                onChange={e => setNewEmojiUrl(e.target.value)} 
                            />
                        </div>
                        <div className="ep-field" style={{ marginTop: '16px' }}>
                            <label className="ep-label">Nombre</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>:</span>
                                <input 
                                    type="text" 
                                    placeholder="nombre" 
                                    className="ep-input" 
                                    value={newEmojiName} 
                                    onChange={e => setNewEmojiName(e.target.value)} 
                                    pattern="[a-zA-Z0-9_]+" 
                                />
                                <span style={{ color: 'var(--text-muted)' }}>:</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={async (e) => {
                                    await handleAddEmoji(e);
                                    if (newEmojiName && newEmojiUrl) setShowAddEmojiModal(false);
                                }}
                                disabled={isAddingEmoji || !newEmojiName || !newEmojiUrl}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="ep-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', display: showAddEmojiModal ? 'none' : 'flex' }}>
                <div className="ep-modal-header">
                    <h1 className="ep-modal-title">Ajustes de la Comunidad</h1>
                    <button className="ep-close-btn" onClick={() => setIsSettingsModalOpen(false)} type="button">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div className="ep-section-tabs">
                    {SETTINGS_TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`ep-section-tab ${activeSettingsSection === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveSettingsSection(tab.id)}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
                
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={e => handleFileChange(e, 'avatar')} style={{ display: 'none' }} />
                <input ref={bannerInputRef} type="file" accept="image/*" onChange={e => handleFileChange(e, 'banner')} style={{ display: 'none' }} />

                <form onSubmit={handleSaveSettings} style={{ display: 'contents' }}>
                    <div className="ep-modal-body ep-animate-in" key={activeSettingsSection}>
                        
                        {activeSettingsSection === 'info' && (
                            <>
                                <div className="ep-field">
                                    <label className="ep-label">Logo de la comunidad</label>
                                    <button type="button" onClick={() => avatarInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>Subir imagen</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Recomendado: 256x256px</div>
                                        </div>
                                    </button>
                                </div>

                                {space?.is_verified && (
                                    <div className="ep-field" style={{ marginTop: '24px' }}>
                                        <label className="ep-label">Banner</label>
                                        <button type="button" onClick={() => bannerInputRef.current?.click()} style={{ width: '100%', aspectRatio: '16/5', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', cursor: 'pointer', padding: 0, position: 'relative' }}>
                                            {bannerPreview ? (
                                                <img src={bannerPreview} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                    <span style={{ fontSize: '0.85rem' }}>Añadir banner de la comunidad</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                )}

                                <div className="ep-field" style={{ marginTop: '24px' }}>
                                    <label className="ep-label">Nombre de la comunidad</label>
                                    <input
                                        type="text"
                                        required
                                        className="ep-input"
                                        value={settingsSpace.name}
                                        onChange={(e) => setSettingsSpace({ ...settingsSpace, name: e.target.value })}
                                    />
                                </div>
                                
                                <div className="ep-field" style={{ marginTop: '20px' }}>
                                    <label className="ep-label">Descripción</label>
                                    <textarea
                                        rows="4"
                                        className="ep-input ep-textarea"
                                        value={settingsSpace.description}
                                        onChange={(e) => setSettingsSpace({ ...settingsSpace, description: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                        
                        {activeSettingsSection === 'appearance' && (
                            <>
                                <div className="ep-field">
                                    <label className="ep-label">Color del Tema</label>
                                    <div className="ep-color-grid" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                                        {THEME_COLORS.map(color => (
                                            <button
                                                type="button"
                                                key={color}
                                                className={`ep-color-btn ${settingsSpace.theme_color === color ? 'selected' : ''}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setSettingsSpace({...settingsSpace, theme_color: color})}
                                                title={color}
                                            />
                                        ))}
                                        <div className="ep-custom-color" style={{ position: 'relative' }}>
                                            <input 
                                                type="color" 
                                                value={THEME_COLORS.includes(settingsSpace.theme_color) ? '#ffffff' : (settingsSpace.theme_color || '#ffffff')} 
                                                onChange={e => setSettingsSpace({...settingsSpace, theme_color: e.target.value})}
                                                style={{
                                                    position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer'
                                                }}
                                            />
                                            <div className="ep-color-btn custom" style={{ 
                                                backgroundColor: THEME_COLORS.includes(settingsSpace.theme_color) ? 'transparent' : settingsSpace.theme_color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)'
                                            }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Este color personalizará la cabecera y los elementos de tu comunidad.
                                    </p>
                                </div>
                            </>
                        )}

                        {activeSettingsSection === 'works' && (
                            <>
                                <div className="ep-field">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <label className="ep-label" style={{ marginBottom: 0 }}>Obras relacionadas</label>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mínimo 1 obra requerida.</span>
                                    </div>
                                    
                                    <div className="ep-favorites-grid">
                                        {settingsSpace.related_works?.map((work, idx) => (
                                            <div key={idx} className="ep-favorite-item">
                                                <img src={work.image} alt={work.title} />
                                                <div 
                                                    className="ep-favorite-item-overlay" 
                                                    onClick={() => {
                                                        if (settingsSpace.related_works.length <= 1) {
                                                            alert('Debe haber al menos 1 obra asociada.');
                                                            return;
                                                        }
                                                        setSettingsSpace({
                                                            ...settingsSpace,
                                                            related_works: settingsSpace.related_works.filter((_, i) => i !== idx)
                                                        });
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <span style={{color: 'var(--error)', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center'}}>Eliminar</span>
                                                </div>
                                            </div>
                                        ))}
                                        <button 
                                            type="button" 
                                            className="ep-empty-slot"
                                            onClick={() => setSearchModalOpen(true)}
                                            title="Añadir Obra"
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        
                                 {activeSettingsSection === 'emojis' && (
                            <>
                                <div className="ep-field">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ margin: '0', fontSize: '1rem', color: 'var(--text-primary)' }}>Emojis Personalizados ({emojis.length}/50)</h3>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                        {emojis.map(emoji => (
                                            <div key={emoji.id} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', border: '1px solid var(--border-subtle)' }}>
                                                <img src={emoji.image_url} alt={emoji.name} style={{ width: '48px', height: '48px', objectFit: 'contain', marginBottom: '8px' }} />
                                                
                                                {editingEmojiId === emoji.id ? (
                                                    <input 
                                                        type="text" 
                                                        className="ep-input" 
                                                        style={{ padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                        value={editingEmojiName}
                                                        onChange={e => setEditingEmojiName(e.target.value)}
                                                        autoFocus
                                                        onBlur={() => handleEditEmojiSubmit(emoji.id)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleEditEmojiSubmit(emoji.id);
                                                            if (e.key === 'Escape') setEditingEmojiId(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <span 
                                                        onClick={() => { setEditingEmojiId(emoji.id); setEditingEmojiName(emoji.name); }}
                                                        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all', textAlign: 'center', cursor: 'pointer' }}
                                                        title="Clic para editar"
                                                    >
                                                        :{emoji.name}:
                                                    </span>
                                                )}

                                                <button 
                                                    type="button"
                                                    onClick={() => handleDeleteEmoji(emoji.id)}
                                                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {emojis.length < 50 && (
                                            <div 
                                                onClick={() => setShowAddEmojiModal(true)}
                                                style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', cursor: 'pointer', minHeight: '100px' }}
                                            >
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Añadir</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {activeSettingsSection === 'danger' && (
                            <>
                                <div className="ep-field" style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)' }}>
                                    <h3 style={{ color: '#ef4444', margin: '0 0 8px 0', fontSize: '1rem' }}>Eliminar servidor</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', marginTop: 0 }}>
                                        Si eliminas este espacio, no podrás recuperarlo. Todos los canales, debates y mensajes se perderán de forma permanente.
                                    </p>
                                    <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', width: 'auto' }} onClick={() => {
                                        if (window.confirm('¿Estás SEGURO de que quieres borrar este espacio para siempre?')) {
                                            alert('Funcionalidad de borrar espacio aún no implementada.');
                                        }
                                    }}>
                                        Eliminar espacio
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="ep-modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={() => setIsSettingsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={isSavingSettings}>
                           {isSavingSettings ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isCreatingChannel && (
        <div className="modal-overlay" onClick={() => setIsCreatingChannel(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2>Crear Canal</h2>
              <button className="modal-close" onClick={() => setIsCreatingChannel(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateChannelSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)'}}>Nombre del canal</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: general, memes..."
                    value={newChannelName} 
                    onChange={e => setNewChannelName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '16px', gap: '16px'}}>
                  <button type="button" className="btn btn-ghost" onClick={() => setIsCreatingChannel(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{padding: '0.4rem 1rem', fontSize: '0.85rem', height: 'fit-content'}}>
                    Crear canal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {channelToDelete && (
        <div className="modal-overlay" onClick={() => { setEditingChannel(channelToDelete); setChannelToDelete(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2>¿Borrar canal?</h2>
              <button className="modal-close" onClick={() => { setEditingChannel(channelToDelete); setChannelToDelete(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{color: 'var(--text-secondary)', marginBottom: '24px'}}>
                Esta acción eliminará el canal <strong>{channelToDelete?.name}</strong> y todos sus mensajes de forma permanente.
              </p>
              <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px'}}>
                <button type="button" className="btn btn-ghost" onClick={() => { setEditingChannel(channelToDelete); setChannelToDelete(null); }}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" style={{backgroundColor: '#ef4444', padding: '0.4rem 1rem', fontSize: '0.85rem', height: 'fit-content'}} onClick={handleDeleteChannel}>
                  Borrar canal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {searchModalOpen && (
        <GlobalSearchModal 
          isOpen={searchModalOpen} 
          onClose={() => setSearchModalOpen(false)} 
          onSelect={(works) => {
            const current = settingsSpace.related_works || [];
            const newWorks = works.filter(w => !current.some(existing => existing.id === w.id));
            if (newWorks.length > 0) {
              setSettingsSpace({ ...settingsSpace, related_works: [...current, ...newWorks] });
            }
          }}
        />
      )}

    </div>
  );
}
