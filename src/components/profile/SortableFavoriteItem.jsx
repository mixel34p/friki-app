import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const IconClose = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

export function SortableFavoriteItem({ item, onRemove, onClick }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className="ep-favorite-item"
            onClick={onClick}
            {...attributes} 
            {...listeners}
        >
            {item.cover_url || item.image_url || item.cover ? (
                <img src={item.cover_url || item.image_url || item.cover} alt="" />
            ) : (
                <div className="no-cover">{item.name}</div>
            )}
            <div className="ep-favorite-item-overlay">
                <span className="ep-favorite-name">{item.name}</span>
            </div>
            <button
                type="button"
                className="ep-remove-item-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
            >
                <IconClose />
            </button>
        </div>
    );
}
