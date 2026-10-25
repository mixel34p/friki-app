import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { getSpaces, createSpace, createSpaceChannel, getSpaceChannels, deleteSpaceChannel } from '../../lib/spaceService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ImageCropperModal from '../../components/ImageCropperModal';
import GlobalSearchModal from '../../components/GlobalSearchModal';
import './SpacesExplore.css';
import './SpacesDiscover.css';
import '../DiscoverWorks.css';
import '../Search.css';

function shuffleSpaces(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setIsLoading(true);
    try {
      const data = await getSpaces();
      setSpaces(shuffleSpaces(data));
      setFetchError(null);
    } catch (error) {
      console.error('Error loading spaces:', error);
      setFetchError(error.message || JSON.stringify(error));
    } finally {
      setIsLoading(false);
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

      // Remove forum channels that may still be created by the database default.
      try {
        const createdChannels = await getSpaceChannels(space.id);
        const legacyForumChannels = createdChannels.filter(channel =>
          ['foro', 'forum', 'debates'].includes(channel.type)
        );
        await Promise.all(legacyForumChannels.map(channel => deleteSpaceChannel(channel.id)));
      } catch (cleanupError) {
        console.warn('No se pudieron retirar los canales de foro heredados:', cleanupError);
      }
      
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Reset to page 1 whenever the search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredSpaces = spaces
    .filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const totalPages = Math.ceil(filteredSpaces.length / ITEMS_PER_PAGE);
  const pagedSpaces = filteredSpaces.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <main className="discover-works-page spaces-discover-page">
      <header className="discover-works-header spaces-catalog-header">
        <div className="discover-title-group">
          <button type="button" className="discover-back-button" onClick={() => navigate('/discover')} aria-label="Volver">
            <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1>Espacios</h1>
        </div>
      </header>

      <div className="spaces-discover-content">

        {/* Toolbar: búsqueda + ordenación */}
        <div className="spaces-toolbar">
          <div className="spaces-search-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="spaces-search-input"
              aria-label="Buscar espacios"
              placeholder="Buscar espacios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="spaces-create-button" type="button" aria-label="Crear espacio" title="Crear espacio" onClick={() => {
            if (!user) return navigate('/login');
            setIsModalOpen(true);
          }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error)', color: 'var(--error)', marginBottom: '1.5rem', textAlign: 'center' }}>
            <h3>Error de conexión</h3>
            <p><strong>{fetchError}</strong></p>
            <p>Es probable que el script SQL de Foreign Keys no se haya ejecutado correctamente en Supabase.</p>
          </div>
        )}

        {/* Search-style space catalog */}
        <section className="search-result-section spaces spaces-discover-results" aria-label="Espacios en Geeksphere" aria-live="polite">
        <div className="spaces-grid search-result-grid">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-card space-card-skeleton">
                <div className="skeleton-banner" />
                <div className="space-card-avatar-wrap">
                  <div className="skeleton-avatar" />
                </div>
                <div className="space-card-info">
                  <div className="skeleton-line" style={{ width: '60%', height: '1rem' }} />
                  <div className="skeleton-line" style={{ width: '100%', height: '0.75rem', marginTop: '0.25rem' }} />
                  <div className="skeleton-line" style={{ width: '80%', height: '0.75rem' }} />
                </div>
              </div>
            ))
          ) : pagedSpaces.length > 0 ? (
            pagedSpaces.map(space => {
              const memberCount = space.space_members?.[0]?.count ?? space.member_count ?? 0;
              const themeColor = space.theme_color || '#14b8a6';
              return (
                <Link key={space.id} to={`/spaces/${space.id}`} className="space-card search-result-card" style={{ '--tc': themeColor }}>
                  {/* Banner */}
                  <div
                    className="space-card-banner"
                    style={
                      space.banner_url
                        ? { backgroundImage: `url(${space.banner_url})` }
                        : { background: `linear-gradient(135deg, ${themeColor}55 0%, ${themeColor}22 100%)` }
                    }
                  >
                    {!space.banner_url && (
                      <div className="space-card-banner-pattern" style={{ '--tc': themeColor }} />
                    )}
                  </div>

                  {/* Avatar superpuesto */}
                  <div className="space-card-avatar-wrap">
                    <div className="space-card-avatar" style={{ borderColor: themeColor }}>
                      {space.avatar_url ? (
                        <img src={space.avatar_url} alt={space.name} />
                      ) : (
                        <div className="space-avatar-placeholder" style={{ color: themeColor }}>
                          {space.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-card-info">
                    <div className="space-card-title-row">
                      <span className="search-space-title-line">
                        <strong>{space.name}</strong>
                        {space.is_verified && (
                          <span className="search-space-verified" title="Espacio verificado" aria-label="Espacio verificado">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6.86 2.07-3.14 3.47 1.5 3.47-1.5 2.07 3.14 3.6.86-.57 3.65 2.43 2.8zM10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z"/>
                            </svg>
                          </span>
                        )}
                      </span>
                      <span className="space-members-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                        {memberCount} {memberCount === 1 ? 'usuario' : 'usuarios'}
                      </span>
                    </div>
                    <p className="space-desc">{space.description || 'Sin descripción.'}</p>
                    <div className="space-card-footer">
                      <span className="btn-enter-inline">Entrar →</span>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="spaces-empty-state">
              {searchTerm ? (
                <p>No se encontraron comunidades que coincidan con "{searchTerm}".</p>
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
        </section>

        {/* Paginación */}
        {!isLoading && totalPages > 1 && (
          <div className="spaces-pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Página anterior"
            >
              ←
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Mostrar siempre: primera, última, página actual y sus vecinas
              const nearCurrent = Math.abs(page - currentPage) <= 1;
              const isEdge = page === 1 || page === totalPages;
              if (!nearCurrent && !isEdge) {
                // Mostrar elipsis solo una vez por salto
                if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="page-ellipsis">…</span>;
                }
                return null;
              }
              return (
                <button
                  key={page}
                  className={`page-btn ${page === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              );
            })}

            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Página siguiente"
            >
              →
            </button>
          </div>
        )}

      </div>


      {isModalOpen && (
        createPortal(<div className="explore-modal-overlay" onClick={resetModal}>
          <div className="explore-modal-content" onClick={e => e.stopPropagation()}>
            
            {step === 1 && (
              <>
                <h2>Crear Nuevo Espacio</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Un espacio es una comunidad con canales de chat en tiempo real.
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
                    El espacio está creado. Puedes añadir canales de chat ahora o hacerlo más tarde.
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
        </div>, document.body)
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
          onSelect={(works) => {
            const newWorks = works.filter(w => !newSpace.related_works.some(existing => existing.id === w.id));
            if (newWorks.length > 0) {
              setNewSpace({ ...newSpace, related_works: [...newSpace.related_works, ...newWorks] });
            }
          }}
        />
      )}
    </main>
  );
}
