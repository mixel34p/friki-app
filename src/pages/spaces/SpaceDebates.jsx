import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSpaceDebates, createDebate } from '../../lib/spaceService';
import { useAuth } from '../../context/AuthContext';
import './SpaceDebates.css';

export default function SpaceDebates() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [debates, setDebates] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    useEffect(() => {
        loadDebates();
    }, [id]);

    const loadDebates = async () => {
        try {
            const data = await getSpaceDebates(id);
            setDebates(data);
        } catch (error) {
            console.error('Error loading debates', error);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim() || !user) return;
        try {
            await createDebate({ space_id: id, user_id: user.id, title, content });
            setShowModal(false);
            setTitle('');
            setContent('');
            loadDebates();
        } catch (error) {
            console.error('Error creating debate', error);
        }
    };

    return (
        <div className="space-debates-container">
            <div className="debates-header">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button className="chat-mobile-back" onClick={() => navigate(`/spaces/${id}`)} title="Volver a canales">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <h2>Debates</h2>
                </div>
                <button className="create-debate-btn" onClick={() => setShowModal(true)}>Create Thread</button>
            </div>
            
            <div className="debates-list">
                {debates.map(debate => (
                    <div key={debate.id} className="debate-item" onClick={() => navigate(`/spaces/${id}/debates/${debate.id}`)}>
                        <h3 className="debate-title">{debate.title}</h3>
                        <div className="debate-meta">
                            Created by {debate.user?.display_name || debate.user?.username || 'User'} on {new Date(debate.created_at).toLocaleDateString()}
                        </div>
                    </div>
                ))}
                {debates.length === 0 && <p className="no-debates">No debates yet. Be the first to start one!</p>}
            </div>

            {showModal && (
                <div className="debates-modal-overlay">
                    <div className="debates-modal-content">
                        <h3>Create New Thread</h3>
                        <form onSubmit={handleCreate}>
                            <input 
                                type="text" 
                                placeholder="Title" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                required 
                            />
                            <textarea 
                                placeholder="Content" 
                                value={content} 
                                onChange={e => setContent(e.target.value)} 
                                required 
                                rows="5"
                            />
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Cancel</button>
                                <button type="submit" className="submit-btn">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
