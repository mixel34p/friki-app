import React, { useState, useEffect } from 'react';
import { getListLikesCount, checkUserListLike, toggleListLike } from '../lib/listService';
import { useAuth } from '../context/AuthContext';

export default function ListLikeButton({ listId, compact = false }) {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        let isMounted = true;
        async function fetchLikes() {
            try {
                const [likesCount, userLiked] = await Promise.all([
                    getListLikesCount(listId),
                    user ? checkUserListLike(listId, user.id) : Promise.resolve(false)
                ]);
                if (isMounted) {
                    setCount(likesCount);
                    setLiked(userLiked);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchLikes();
        return () => { isMounted = false; };
    }, [listId, user]);

    const handleToggle = async (e) => {
        e.preventDefault();
        if (!user) return;
        try {
            // Optimistic UI
            setLiked(!liked);
            setCount(prev => liked ? Math.max(0, prev - 1) : prev + 1);

            await toggleListLike(listId, user.id);
            const isNowLiked = await checkUserListLike(listId, user.id);
            if (isNowLiked !== !liked) {
                // Revert if failed
                setLiked(isNowLiked);
                setCount(prev => isNowLiked ? prev + 1 : Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error(err);
            // Revert on error
            setLiked(!liked);
            setCount(prev => liked ? Math.max(0, prev - 1) : prev + 1);
        }
    };

    if (loading) return <div className="review-like-btn loading">...</div>;

    return (
        <button 
            className={`review-like-btn ${liked ? 'liked' : ''}`} 
            onClick={handleToggle}
            disabled={!user}
            title={user ? (liked ? 'Quitar like' : 'Dar like') : 'Inicia sesión para dar like'}
            aria-label={user ? (liked ? 'Quitar like' : 'Dar like') : 'Inicia sesión para dar like'}
        >
            <svg viewBox="0 0 24 24" width="16" height="16" fill={liked ? 'var(--profile-accent-visible, var(--brand-primary))' : 'none'} stroke={liked ? 'var(--profile-accent-visible, var(--brand-primary))' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            {(count > 0 || !compact) && <span>{count > 0 ? count : 'Like'}</span>}
        </button>
    );
}

