import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  createTemplate,
  updateTemplate,
  getTemplateById,
  DEFAULT_TIER_CONFIG,
  TIER_COLORS_PALETTE
} from '../../lib/listService';
import { searchGames } from '../../lib/gameService';
import { searchAnime } from '../../lib/animeService';
import './CreateTemplate.css';

export default function CreateTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Base info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listType, setListType] = useState('tierlist'); // 'tierlist', 'ranking', 'grid'
  const [mediaType, setMediaType] = useState('games'); // 'games', 'anime'
  const [visibility, setVisibility] = useState('public');
  
  // Step 2: Structure
  const [tiers, setTiers] = useState(DEFAULT_TIER_CONFIG.tierlist.tiers);
  const [activeTierColorIdx, setActiveTierColorIdx] = useState(null);
  
  const [maxItems, setMaxItems] = useState(DEFAULT_TIER_CONFIG.ranking.max_items);
  
  const [gridCells, setGridCells] = useState(DEFAULT_TIER_CONFIG.grid.cells);
  const [gridColumns, setGridColumns] = useState(DEFAULT_TIER_CONFIG.grid.columns);
  
  // Step 3: Items
  const [templateItems, setTemplateItems] = useState([]);
  const [itemTab, setItemTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [customItemName, setCustomItemName] = useState('');
  const [customItemUrl, setCustomItemUrl] = useState('');
  
  useEffect(() => {
    if (id) {
      setIsLoading(true);
      getTemplateById(id).then(template => {
        if (template) {
          setTitle(template.title);
          setDescription(template.description || '');
          setListType(template.type);
          setMediaType(template.mediaType);
          setVisibility(template.visibility || 'public');
          
          if (template.type === 'tierlist' && template.config?.tiers) {
            setTiers(template.config.tiers);
          } else if (template.type === 'ranking' && template.config?.maxItems) {
            setMaxItems(template.config.maxItems);
          } else if (template.type === 'grid' && template.config?.cells) {
            setGridCells(template.config.cells);
            setGridColumns(template.config.columns || 2);
          }
          
          if (template.defaultItems) {
            setTemplateItems(template.defaultItems);
          }
        }
        setIsLoading(false);
      }).catch(err => {
        console.error(err);
        setIsLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, mediaType]);

  const handleSearch = async (query) => {
    try {
      if (mediaType === 'games') {
        const results = await searchGames(query);
        setSearchResults(results || []);
      } else {
        const results = await searchAnime(query);
        setSearchResults(results || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTier = () => {
    const newId = 't' + Date.now();
    setTiers([...tiers, { id: newId, label: 'Nuevo', color: TIER_COLORS_PALETTE[0] }]);
  };

  const handleRemoveTier = (index) => {
    if (tiers.length <= 2) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleTierChange = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const handleAddGridCell = () => {
    const newId = 'c' + Date.now();
    setGridCells([...gridCells, { id: newId, label: 'Nueva Celda' }]);
  };

  const handleRemoveGridCell = (index) => {
    if (gridCells.length <= 1) return;
    setGridCells(gridCells.filter((_, i) => i !== index));
  };

  const handleGridCellChange = (index, value) => {
    const newCells = [...gridCells];
    newCells[index].label = value;
    setGridCells(newCells);
  };

  const handleAddItem = (item) => {
    if (!templateItems.find(i => i.id === item.id)) {
      setTemplateItems([...templateItems, {
        id: item.id || 'custom-' + Date.now(),
        name: item.name || item.title,
        imageUrl: item.image_url || item.imageUrl || item.cover_image,
        year: item.year || item.release_year
      }]);
    }
  };

  const handleRemoveItem = (itemId) => {
    setTemplateItems(templateItems.filter(i => i.id !== itemId));
  };

  const handleAddCustomItem = () => {
    if (customItemName.trim()) {
      handleAddItem({
        id: 'custom-' + Date.now(),
        name: customItemName,
        image_url: customItemUrl
      });
      setCustomItemName('');
      setCustomItemUrl('');
    }
  };

  const validateStep1 = () => {
    if (!title.trim()) return false;
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) {
      alert('El título es obligatorio.');
      return;
    }
    setStep(step + 1);
  };

  const handlePublish = async () => {
    const config = {};
    if (listType === 'tierlist') config.tiers = tiers;
    if (listType === 'ranking') config.maxItems = maxItems;
    if (listType === 'grid') {
      config.cells = gridCells;
      config.columns = gridColumns;
    }

    const templateData = {
      title,
      description,
      type: listType,
      mediaType,
      visibility,
      config,
      defaultItems: templateItems,
      authorId: user?.id
    };

    try {
      setIsLoading(true);
      if (id) {
        await updateTemplate(id, templateData);
        navigate(`/templates/${id}`);
      } else {
        const newTemplate = await createTemplate(templateData);
        if(newTemplate && newTemplate.id) {
           navigate(`/templates/${newTemplate.id}`);
        } else {
           navigate(`/templates`);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error al guardar la plantilla');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-template-page">
      <h1>{id ? 'Editar plantilla' : 'Crear nueva plantilla'}</h1>
      
      <div className="steps-bar">
        {[1, 2, 3].map((num) => (
          <React.Fragment key={num}>
            <div className="step-item">
              <div className={`step-circle ${step === num ? 'active' : step > num ? 'done' : ''}`}>
                {num}
              </div>
              <span className={`step-label ${step === num ? 'active' : ''}`}>
                {num === 1 ? 'Información' : num === 2 ? 'Estructura' : 'Items'}
              </span>
            </div>
            {num < 3 && <div className="step-line" />}
          </React.Fragment>
        ))}
      </div>

      <div className="step-content">
        {step === 1 && (
          <div className="step-1">
            <div className="form-group">
              <label>Título *</label>
              <input 
                type="text" 
                className="input" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Ej: Top 10 JRPGs de PS2"
              />
            </div>
            
            <div className="form-group">
              <label>Descripción</label>
              <textarea 
                className="input" 
                maxLength="300"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe de qué trata esta lista..."
              />
            </div>

            <div className="form-group">
              <label>Tipo de Lista</label>
              <div className="type-cards">
                <div className={`type-card ${listType === 'tierlist' ? 'active' : ''}`} onClick={() => setListType('tierlist')}>
                  <div className="type-card-icon">☰</div>
                  <h3>Tierlist</h3>
                  <p>Clásico S/A/B/C/D, ordena lo que quieras por niveles</p>
                </div>
                <div className={`type-card ${listType === 'ranking' ? 'active' : ''}`} onClick={() => setListType('ranking')}>
                  <div className="type-card-icon">🏆</div>
                  <h3>Ranking</h3>
                  <p>Tu top personal, del 1 al N</p>
                </div>
                <div className={`type-card ${listType === 'grid' ? 'active' : ''}`} onClick={() => setListType('grid')}>
                  <div className="type-card-icon">⊞</div>
                  <h3>Grid</h3>
                  <p>Celdas con etiquetas, como un about-me de tus favoritos</p>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Media</label>
              <div className="media-toggle">
                <button 
                  className={`media-btn ${mediaType === 'games' ? 'active' : ''}`}
                  onClick={() => setMediaType('games')}
                >Videojuegos</button>
                <button 
                  className={`media-btn ${mediaType === 'anime' ? 'active' : ''}`}
                  onClick={() => setMediaType('anime')}
                >Anime</button>
              </div>
            </div>

            <div className="form-group">
              <label>Visibilidad</label>
              <div className="visibility-options">
                <label className="visibility-option">
                  <input 
                    type="radio" 
                    name="visibility" 
                    value="public" 
                    checked={visibility === 'public'} 
                    onChange={() => setVisibility('public')}
                  />
                  🌐 Pública
                </label>
                <label className="visibility-option">
                  <input 
                    type="radio" 
                    name="visibility" 
                    value="private" 
                    checked={visibility === 'private'} 
                    onChange={() => setVisibility('private')}
                  />
                  🔒 Privada
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && listType === 'tierlist' && (
          <div className="step-2">
            <h2>Configura tus tiers</h2>
            <div className="tier-list-editor">
              {tiers.map((tier, idx) => (
                <div key={tier.id}>
                  <div className="tier-row-editor">
                    <div 
                      className={`tier-color-swatch ${activeTierColorIdx === idx ? 'active' : ''}`} 
                      style={{ backgroundColor: tier.color }}
                      onClick={() => setActiveTierColorIdx(activeTierColorIdx === idx ? null : idx)}
                    />
                    <input 
                      type="text" 
                      className="input" 
                      value={tier.label}
                      onChange={(e) => handleTierChange(idx, 'label', e.target.value)}
                    />
                    <button className="btn btn-ghost" onClick={() => handleRemoveTier(idx)}>X</button>
                  </div>
                  {activeTierColorIdx === idx && (
                    <div className="color-palette">
                      {TIER_COLORS_PALETTE.map((color, i) => (
                        <div 
                          key={i} 
                          className="color-dot" 
                          style={{ backgroundColor: color }}
                          onClick={() => { handleTierChange(idx, 'color', color); setActiveTierColorIdx(null); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" style={{marginTop:'1rem'}} onClick={handleAddTier}>+ Añadir tier</button>
            
            <div className="tier-preview">
              <h3>Preview Live</h3>
              {tiers.map((tier) => (
                <div key={tier.id} className="tier-preview-row">
                  <div className="tier-preview-label" style={{ backgroundColor: tier.color }}>{tier.label}</div>
                  <div style={{flex: 1}}></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && listType === 'ranking' && (
          <div className="step-2">
            <h2>Configura el ranking</h2>
            <div className="form-group">
              <label>Número máximo de posiciones</label>
              <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                <button className="btn btn-secondary" onClick={() => setMaxItems(Math.max(1, maxItems - 1))}>-</button>
                <input 
                  type="number" 
                  className="input" 
                  min="1" 
                  max="20" 
                  value={maxItems}
                  onChange={(e) => setMaxItems(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{width:'80px', textAlign:'center'}}
                />
                <button className="btn btn-secondary" onClick={() => setMaxItems(Math.min(20, maxItems + 1))}>+</button>
              </div>
            </div>
            
            <div className="ranking-preview">
              <h3>Preview</h3>
              {Array.from({length: maxItems}).map((_, i) => (
                <div key={i} className="ranking-row">
                  <span className="ranking-num">{i + 1}</span>
                  <div className="ranking-preview-item">
                    <span className="ranking-preview-cover" aria-hidden="true" />
                    <span className="ranking-preview-name">Posición {i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && listType === 'grid' && (
          <div className="step-2">
            <h2>Configura las celdas</h2>
            <p style={{color:'#888', fontSize:'0.875rem'}}>Nota: Las etiquetas de las celdas son fijas y no pueden ser cambiadas por los usuarios que usen esta plantilla</p>
            
            <div className="form-group" style={{marginTop:'1rem'}}>
              <label>Columnas: {gridColumns}</label>
              <div style={{display:'flex', gap:'0.5rem'}}>
                <button className={`btn ${gridColumns === 2 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGridColumns(2)}>2</button>
                <button className={`btn ${gridColumns === 3 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGridColumns(3)}>3</button>
              </div>
            </div>

            <div className="tier-list-editor" style={{marginTop:'1rem'}}>
              {gridCells.map((cell, idx) => (
                <div className="tier-row-editor" key={cell.id}>
                  <input 
                    type="text" 
                    className="input" 
                    value={cell.label}
                    onChange={(e) => handleGridCellChange(idx, e.target.value)}
                  />
                  <button className="btn btn-ghost" onClick={() => handleRemoveGridCell(idx)}>X</button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" style={{marginTop:'1rem'}} onClick={handleAddGridCell}>+ Añadir celda</button>

            <div className="grid-preview" style={{gridTemplateColumns: `repeat(${gridColumns}, 1fr)`}}>
              {gridCells.map((cell) => (
                <div key={cell.id} className="grid-preview-cell">
                  {cell.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-3">
            <h2>Items por defecto</h2>
            <p style={{color:'#888'}}>Items que aparecerán en el pool de quien use tu plantilla (opcional)</p>

            <div className="tabs">
              <div className={`tab ${itemTab === 'search' ? 'active' : ''}`} onClick={() => setItemTab('search')}>Buscar {mediaType === 'games' ? 'juegos' : 'anime'}</div>
              <div className={`tab ${itemTab === 'custom' ? 'active' : ''}`} onClick={() => setItemTab('custom')}>Item custom</div>
            </div>

            {itemTab === 'search' && (
              <div>
                <input 
                  type="text" 
                  className="input" 
                  placeholder={`Buscar ${mediaType === 'games' ? 'videojuego' : 'anime'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="search-results">
                  {searchResults.map(res => {
                    const isAdded = templateItems.some(i => i.id === res.id);
                    return (
                      <div key={res.id} className="search-result-item">
                        <div className="search-result-info">
                          <img src={res.image_url || res.imageUrl || res.cover_image} alt="" />
                          <div>
                            <div style={{fontWeight:'bold'}}>{res.name || res.title}</div>
                            <div style={{fontSize:'0.8rem', color:'#888'}}>{res.year || res.release_year}</div>
                          </div>
                        </div>
                        <button 
                          className={`btn btn-sm ${isAdded ? 'btn-ghost' : 'btn-secondary'}`}
                          onClick={() => !isAdded && handleAddItem(res)}
                          disabled={isAdded}
                        >
                          {isAdded ? '✓' : '+'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {itemTab === 'custom' && (
              <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Nombre del item"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                />
                <input 
                  type="text" 
                  className="input" 
                  placeholder="URL de la imagen"
                  value={customItemUrl}
                  onChange={(e) => setCustomItemUrl(e.target.value)}
                />
                {customItemUrl && (
                  <div style={{marginTop:'0.5rem'}}>
                    <p style={{fontSize:'0.8rem', color:'#888', marginBottom:'0.25rem'}}>Preview:</p>
                    <img src={customItemUrl} alt="preview" style={{width:'40px', height:'54px', objectFit:'cover', borderRadius:'4px'}} onError={(e) => e.target.style.display='none'} />
                  </div>
                )}
                <button className="btn btn-secondary" onClick={handleAddCustomItem} disabled={!customItemName.trim()}>Añadir item custom</button>
              </div>
            )}

            <div style={{marginTop:'2rem'}}>
              <h3>{templateItems.length} items en la plantilla</h3>
              <div className="items-grid-preview">
                {templateItems.map(item => (
                  <div key={item.id} className="item-thumb-remove" title={item.name}>
                    <img src={item.imageUrl || item.image_url} alt={item.name} />
                    <button className="remove-btn" onClick={() => handleRemoveItem(item.id)}>X</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-nav-buttons">
        <button className="btn btn-ghost" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          {step > 1 ? 'Anterior' : 'Cancelar'}
        </button>
        {step < 3 ? (
          <button className="btn btn-primary" onClick={handleNextStep}>Siguiente</button>
        ) : (
          <button className="btn btn-primary" onClick={handlePublish} disabled={isLoading}>
            {isLoading ? 'Guardando...' : (id ? 'Guardar cambios' : 'Publicar plantilla')}
          </button>
        )}
      </div>
    </div>
  );
}
