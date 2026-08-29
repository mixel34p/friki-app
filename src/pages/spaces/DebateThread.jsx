import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDebateById, getDebateReplies, addDebateReply } from '../../lib/spaceService';
import { useAuth } from '../../context/AuthContext';
import './DebateThread.css';

export default function DebateThread() {
    const { debateId } = useParams();
    const { user } = useAuth();
    const [debate, setDebate] = useState(null);
    const [replies, setReplies] = useState([]);
    const [text, setText] = useState('');

    useEffect(() => {
        loadDebate();
        loadReplies();
    }, [debateId]);

    const loadDebate = async () => {
        try {
            const data = await getDebateById(debateId);
            setDebate(data);
        } catch (error) {
            console.error('Error loading debate', error);
        }
    };

    const loadReplies = async () => {
        try {
            const data = await getDebateReplies(debateId);
            setReplies(data);
        } catch (error) {
            console.error('Error loading replies', error);
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!text.trim() || !user) return;
        try {
            await addDebateReply(debateId, user.id, text);
            setText('');
            loadReplies();
        } catch (error) {
            console.error('Error adding reply', error);
        }
    };

    if (!debate) return <div className="loading">Loading...</div>;

    return (
        <div className="debate-thread-container">
            <div className="debate-original-post">
                <div className="post-header">
                    <img src={debate.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="post-avatar" />
                    <div>
                        <h2 className="post-title">{debate.title}</h2>
                        <div className="post-meta">
                            By {debate.user?.display_name || debate.user?.username || 'User'} on {new Date(debate.created_at).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div className="post-content">{debate.content}</div>
            </div>
            
            <div className="debate-replies">
                <h3 className="replies-title">Replies</h3>
                <div className="replies-list">
                    {replies.map(reply => (
                        <div key={reply.id} className="debate-reply">
                            <img src={reply.user?.avatar_url || '/default-avatar.png'} alt="avatar" className="reply-avatar" />
                            <div className="reply-body">
                                <div className="reply-header">
                                    <span className="reply-username">{reply.user?.display_name || reply.user?.username || 'User'}</span>
                                    <span className="reply-time">{new Date(reply.created_at).toLocaleString()}</span>
                                </div>
                                <div className="reply-content">{reply.content}</div>
                            </div>
                        </div>
                    ))}
                    {replies.length === 0 && <p className="no-replies">No replies yet.</p>}
                </div>
            </div>

            <form className="debate-reply-form" onSubmit={handleReply}>
                <textarea 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    placeholder="Write a reply..." 
                    rows="4"
                    required
                />
                <button type="submit" className="reply-btn">Post Reply</button>
            </form>
        </div>
    );
}
