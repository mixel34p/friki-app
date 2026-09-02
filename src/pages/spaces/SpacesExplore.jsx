import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSpaces, createSpace, createSpaceChannel } from '../../lib/spaceService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ImageCropperModal from '../../components/ImageCropperModal';
import GlobalSearchModal from '../../components/GlobalSearchModal';
import './SpacesExplore.css';

export default function SpacesExplore() {
  const [spaces, setSpaces] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Space Data
  const [newSpace, setNewSpace] = useState({ name: '', description: '', theme_color: '#14b8a6', related_works: [] });
  const [createdSpaceId, setCreatedSpaceId] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  
  // Image Upload State
  const fileInputRef = useRef(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [cropModal, setCropModal] = useState({ isOpen: false, src: null });
  
  // Channels State (Step 2)
  const [extraChannels, setExtraChannels] = useState([{ name: '', type: 'chat' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      const data = await getSpaces();
      setSpaces(data);
      setFetchError(null);
    } catch (error) {
      console.error('Error loading spaces:', error);
      setFetchError(error.message || JSON.stringify(error));
    }
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setStep(1);
    setNewSpace({ name: '', description: '', theme_color: '#14b8a6', related_works: [] });
    setCreatedSpaceId(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setExtraChannels([{ name: '', type: 'chat' }]);
  };

  // ── Image Handling ──
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
        alert('La imagen no puede superar 1MB');
        return;
    }
    const previewUrl = URL.createObjectURL(file);
    setCropModal({ isOpen: true, src: previewUrl });
    e.target.value = '';
  };

  const handleCropComplete = (croppedBlob, croppedUrl) => {
    setAvatarFile(croppedBlob);
    setAvatarPreview(croppedUrl);
    setCropModal({ isOpen: false, src: null });
  };

  const uploadImage = async (file) => {
    if (!file || !user) return null;
    const ext = file.name.split('.').pop() || 'jpeg';
    const fileName = `${user.id}_${Date.now()}.${ext}`;
    
    // Asumimos que existe un bucket llamado 'spaces'
    const { error: err } = await supabase.storage.from('spaces').upload(fileName, file, { upsert: true });
    if (err) {
        console.error('Upload error:', err);
        throw err;
    }
    return supabase.storage.from('spaces').getPublicUrl(fileName).data.publicUrl;
  };

  // ── Step 1: Create Space ──
  // ── Step 1: Info ──
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!user) return alert('Debes iniciar sesión para crear un espacio.');
    if (!newSpace.name.trim()) return alert('El nombre es obligatorio.');
    
    setStep(2);
  };

  // ── Step 2: Works ──
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    if (!newSpace.related_works || newSpace.related_works.length === 0) {
      return alert('Debes asociar al menos 1 obra (juego, anime o manga) a tu comunidad.');
    }
    
    setIsSubmitting(true);
    try {
      let avatar_url = null;
      if (avatarFile) {
        avatar_url = await uploadImage(avatarFile);
      }

      const space = await createSpace({
        name: newSpace.name,
        description: newSpace.description,
        avatar_url,
        owner_id: user.id,
        theme_color: newSpace.theme_color,
        related_works: newSpace.related_works
      });
      
      setCreatedSpaceId(space.id);
      loadSpaces();
      setStep(3);
    } catch (error) {
      console.error('Error in step 2:', error);
      alert(`Error: ${error.message || JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 3: Extra Channels ──
  const handleAddChannelField = () => {
    setExtraChannels([...extraChannels, { name: '', type: 'chat' }]);
  };

  const handleChannelChange = (index, value) => {
    const updated = [...extraChannels];
    updated[index].name = value;
    setExtraChannels(updated);
  };

  const handleRemoveChannelField = (index) => {
    const updated = [...extraChannels];
    updated.splice(index, 1);
    setExtraChannels(updated);
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const validChannels = extraChannels.filter(c => c.name.trim() !== '');
      for (const ch of validChannels) {
        await createSpaceChannel({ space_id: createdSpaceId, name: ch.name.trim(), type: ch.type });
      }
      resetModal();
      navigate(`/spaces/${createdSpaceId}`);
    } catch (error) {
      console.error('Error creating extra channels:', error);
      alert('Error al crear los canales adicionales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredSpaces = spaces.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Portadas estáticas para el mosaico del fondo (estilo Landing)
  const heroCovers = [
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co2lbd.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co1yy9.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co2v0n.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co2mvt.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co1qkx.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co2ro6.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co399o.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co2vdg.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co4ap2.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co28h8.jpg',
  ];

  // Multiplicamos las portadas para asegurar que llenen todo el ancho y alto de la pantalla
  const backgroundGridCovers = Array(5).fill(heroCovers).flat();

  return (
    <div className="spaces-explore-container">
      
      {/* Hero Section */}
      <div className="spaces-hero">
        <div className="spaces-hero-bg">
          {backgroundGridCovers.map((url, i) => (
            <img key={i} src={url} alt="" />
          ))}
        </div>
        <div className="spaces-hero-content">
          <h1>Descubre Comunidades</h1>
          <p>Únete a espacios creados por fans, chatea en tiempo real y participa en los foros de debate.</p>
          <div className="spaces-hero-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              + Crear nuevo espacio
            </button>
            <Link to="/spaces" className="btn-secondary" style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              Ver Mis Comunidades
            </Link>
          </div>
        </div>
      </div>

      <div className="spaces-main-content">
        {/* Search Bar */}
        <div className="spaces-search-section">
          <div className="spaces-search-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              className="spaces-search-input"
              placeholder="Buscar por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Grid de Comunidades */}
        {fetchError && (
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error)', color: 'var(--error)', marginBottom: '1.5rem', textAlign: 'center' }}>
            <h3>Error de conexión</h3>
            <p><strong>{fetchError}</strong></p>
            <p>Es probable que el script SQL de Foreign Keys no se haya ejecutado correctamente en Supabase.</p>
          </div>
        )}

        <div className="spaces-list">
          {filteredSpaces.map(space => {
            const memberCount = space.space_members?.[0]?.count || 0;
            return (
              <div key={space.id} className="space-card-list-item">
                <div className="space-card-avatar">
                  {space.avatar_url ? (
                    <img src={space.avatar_url} alt={space.name} />
                  ) : (
                    <div className="space-avatar-placeholder">
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="space-card-body">
                  <div className="space-card-header">
                    <h3 className="space-name">
                      {space.name}
                      {space.is_verified && (
                        <span className="verified-badge" title="Comunidad Verificada" style={{ color: '#1d9bf0' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6-.86 2.07-3.14 3.47 1.5 3.47-1.5 2.07 3.14 3.6.86-.57 3.65 2.43 2.8zM10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z"/>
                          </svg>
                        </span>
                      )}
                    </h3>
                    <span className="space-members">
                      {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}
                    </span>
                  </div>
                  <p className="space-desc">{space.description || 'Sin descripción.'}</p>
                </div>
                <div className="space-card-actions">
                  <Link to={`/spaces/${space.id}`} className="btn-enter">
                    Entrar a la comunidad
                  </Link>
                </div>
              </div>
            );
          })}
          
          {filteredSpaces.length === 0 && (
            <div className="spaces-empty-state">
              {searchTerm ? (
                <p>No se encontraron espacios que coincidan con "{searchTerm}".</p>
              ) : (
                <>
                  <p>No hay ningún espacio todavía.</p>
                  <button className="btn-secondary" onClick={() => setIsModalOpen(true)} style={{ marginTop: '1rem' }}>
                    Sé el primero en crear uno
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="explore-modal-overlay" onClick={resetModal}>
          <div className="explore-modal-content" onClick={e => e.stopPropagation()}>
            
            {step === 1 && (
              <>
                <h2>Crear Nuevo Espacio</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Un espacio es una comunidad con foros y chats en tiempo real.
                </p>
                
                <form onSubmit={handleStep1Submit}>
                  
                  <div className="form-group avatar-upload-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      onChange={handleFileChange}
                    />
                    <button 
                      type="button" 
                      className="avatar-upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" />
                      ) : (
                        <div className="avatar-placeholder-content">
                            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            <span>Subir Icono</span>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="form-group">
                    <label>Nombre del espacio</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Fans de Hollow Knight"
                      value={newSpace.name}
                      onChange={e => setNewSpace({...newSpace, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea
                      required
                      placeholder="¿De qué trata esta comunidad?"
                      rows="3"
                      value={newSpace.description}
                      onChange={e => setNewSpace({...newSpace, description: e.target.value})}
                    />
                  </div>
                  
                  <div className="input-group">
                    <label className="input-label">Color del Tema</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <input 
                        type="color" 
                        value={newSpace.theme_color} 
                        onChange={e => setNewSpace({...newSpace, theme_color: e.target.value})}
                        style={{
                          width: '40px',
                          height: '40px',
                          padding: '0',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Elige un color que represente a tu comunidad.
                      </span>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={resetModal} disabled={isSubmitting}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                      Siguiente Paso
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <h2>Obras Relacionadas</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Añade al menos una obra (juego, anime, manga) sobre la que trate tu comunidad. Esto ayudará a otros usuarios a encontrarla.
                </p>
                <form onSubmit={handleStep2Submit}>
                  <div className="ep-favorites-grid" style={{ marginBottom: '1.5rem' }}>
                    {newSpace.related_works.map((work, idx) => (
                      <div key={idx} className="ep-favorite-item">
                          <img src={work.image} alt={work.title} />
                          <div 
                              className="ep-favorite-item-overlay" 
                              onClick={() => setNewSpace({...newSpace, related_works: newSpace.related_works.filter((_, i) => i !== idx)})}
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
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setStep(1)} disabled={isSubmitting}>
                      Atrás
                    </button>
                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Creando...' : 'Crear Comunidad'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Añadir Canales</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    ¡Espacio creado! Hemos generado un canal <strong># General</strong> y un <strong>Foro de Debates</strong> por defecto. ¿Quieres añadir más canales de chat?
                </p>
                
                <form onSubmit={handleStep3Submit}>
                  
                  <div className="channels-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {extraChannels.map((ch, index) => (
                      <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                         <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>#</span>
                         <input
                           type="text"
                           placeholder="nombre-del-canal"
                           value={ch.name}
                           onChange={e => handleChannelChange(index, e.target.value)}
                           style={{ flex: 1 }}
                         />
                         <button 
                           type="button" 
                           onClick={() => handleRemoveChannelField(index)}
                           style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.2rem' }}
                         >
                           &times;
                         </button>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={handleAddChannelField}
                    style={{ background: 'none', border: '1px dashed var(--border-default)', color: 'var(--text-secondary)', padding: '0.5rem', width: '100%', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '1.5rem' }}
                  >
                    + Añadir otro canal
                  </button>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => { resetModal(); navigate(`/spaces/${createdSpaceId}`); }} disabled={isSubmitting}>
                      Omitir
                    </button>
                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Guardando...' : 'Finalizar y Entrar'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}

      {cropModal.isOpen && (
        <ImageCropperModal
            imageSrc={cropModal.src}
            aspect={1}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropModal({ isOpen: false, src: null })}
        />
      )}
      {searchModalOpen && (
        <GlobalSearchModal 
          isOpen={searchModalOpen} 
          onClose={() => setSearchModalOpen(false)} 
          onSelect={(work) => {
            if (!newSpace.related_works.some(w => w.id === work.id)) {
              setNewSpace({ ...newSpace, related_works: [...newSpace.related_works, work] });
            }
          }}
        />
      )}
    </div>
  );
}
