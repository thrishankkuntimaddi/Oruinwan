import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, StickyNote } from 'lucide-react';
import { Btn, EmptyState, LoadingState } from '../ui/page';
import './brainstorm.css';
import api from '@services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';

// Paper colours for the notes themselves (stored on each note, chosen by the user).
const NOTE_COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F9A8D4', '#C4B5FD', '#FCA5A5', '#6EE7B7'];
const NOTE_NAMES = ['Yellow', 'Green', 'Blue', 'Pink', 'Lilac', 'Coral', 'Mint'];

/**
 * Sticky notes for a meeting. Notes are stored on the server and the server
 * pushes changes to everyone in the meeting room (liveReady = room joined).
 */
const BrainstormBoard = ({ meetingId, liveReady = false }) => {
    const { socket } = useSocket();
    const { showToast } = useToast();
    const boardRef = useRef(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newText, setNewText] = useState('');
    const [newColor, setNewColor] = useState(NOTE_COLORS[0]);

    
    const dragging = useRef(null); 

    
    useEffect(() => {
        if (!meetingId) return;
        api.get(`/api/v2/collaboration/brainstorm/${meetingId}`)
            .then(({ data }) => setItems(data.items || []))
            .catch((err) => showToast(err?.response?.data?.message || 'Could not load the board', 'error'))
            .finally(() => setLoading(false));
    }, [meetingId, showToast]);

    
    useEffect(() => {
        if (!socket || !meetingId) return;
        const onUpdate = (data) => {
            if (data.meetingId !== meetingId) return;
            if (data.action === 'add' && data.item) {
                setItems(prev => {
                    const exists = prev.find(i => i._id === data.item._id);
                    return exists ? prev : [...prev, data.item];
                });
            } else if (data.action === 'update' && data.item) {
                setItems(prev => prev.map(i => i._id === data.item._id ? { ...i, ...data.item } : i));
            } else if (data.action === 'delete' && data.itemId) {
                setItems(prev => prev.filter(i => i._id !== data.itemId));
            }
        };
        socket.on('brainstorm:update', onUpdate);
        return () => socket.off('brainstorm:update', onUpdate);
    }, [socket, meetingId]);

    
    const handleAdd = useCallback(async () => {
        if (!newText.trim()) return;
        try {
            const { data } = await api.post(
                `/api/v2/collaboration/brainstorm/${meetingId}`,
                { text: newText.trim(), color: newColor, position: { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 } }
            );
            setItems(prev => {
                const exists = prev.find(i => i._id === data.item._id);
                return exists ? prev : [...prev, data.item];
            });
            setNewText('');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not add the note', 'error');
        }
    }, [meetingId, newText, newColor, showToast]);

    
    const handleDelete = useCallback(async (itemId) => {
        let removed;
        setItems(prev => { removed = prev.find(i => i._id === itemId); return prev.filter(i => i._id !== itemId); });
        try {
            await api.delete(`/api/v2/collaboration/brainstorm/${meetingId}/${itemId}`);
        } catch (err) {
            if (removed) setItems(prev => [...prev, removed]);
            showToast(err?.response?.data?.message || 'Could not delete the note', 'error');
        }
    }, [meetingId, showToast]);

    
    const onMouseDown = (e, itemId, origX, origY) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        dragging.current = { itemId, startX: e.clientX, startY: e.clientY, origX, origY };
    };

    const onMouseMove = useCallback((e) => {
        if (!dragging.current) return;
        const { itemId, startX, startY, origX, origY } = dragging.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newX = Math.max(0, origX + dx);
        const newY = Math.max(0, origY + dy);
        setItems(prev => prev.map(i => i._id === itemId ? { ...i, position: { x: newX, y: newY } } : i));
    }, []);

    const onMouseUp = useCallback(async (e) => {
        if (!dragging.current) return;
        const { itemId, startX, startY, origX, origY } = dragging.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newX = Math.max(0, origX + dx);
        const newY = Math.max(0, origY + dy);
        dragging.current = null;
        if (dx === 0 && dy === 0) return;

        try {
            await api.patch(
                `/api/v2/collaboration/brainstorm/${meetingId}/${itemId}`,
                { position: { x: newX, y: newY } }
            );
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not move the note', 'error');
        }
    }, [meetingId, showToast]);

    useEffect(() => {
        window.addEventListener('pointermove', onMouseMove);
        window.addEventListener('pointerup', onMouseUp);
        return () => {
            window.removeEventListener('pointermove', onMouseMove);
            window.removeEventListener('pointerup', onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    return (
        <div className="bs">
            <div className="bs-add">
                <input
                    className="gl-input"
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Write an idea and press Enter"
                    aria-label="New sticky note"
                    maxLength={280}
                />
                <div className="bs-colors" role="group" aria-label="Note colour">
                    {NOTE_COLORS.map((c, i) => (
                        <button
                            key={c}
                            type="button"
                            className="bs-color"
                            title={NOTE_NAMES[i]}
                            aria-label={NOTE_NAMES[i]}
                            aria-pressed={newColor === c}
                            onClick={() => setNewColor(c)}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <Btn variant="primary" icon={Plus} onClick={handleAdd} disabled={!newText.trim()}>Add note</Btn>
            </div>
            <p className="bs-hint">
                {liveReady
                    ? 'Drag notes to arrange them. Everyone with this meeting open sees changes live.'
                    : 'Notes are saved. Live updates start once you are connected to the meeting.'}
            </p>

            <div ref={boardRef} className="bs-board">
                {loading && <div className="bs-state"><LoadingState label="Loading the board…" /></div>}
                {!loading && items.length === 0 && (
                    <div className="bs-state">
                        <EmptyState icon={StickyNote} title="No notes yet" text="Add ideas above, then drag them into groups as the discussion goes." />
                    </div>
                )}
                {items.map(item => (
                    <div
                        key={item._id}
                        className="bs-note"
                        style={{
                            left: item.position?.x || 50,
                            top: item.position?.y || 50,
                            backgroundColor: item.color || NOTE_COLORS[0],
                        }}
                        onPointerDown={(e) => onMouseDown(e, item._id, item.position?.x || 50, item.position?.y || 50)}
                    >
                        <p>{item.text}</p>
                        <button
                            type="button"
                            className="bs-del"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                            title="Delete note"
                            aria-label="Delete note"
                        >
                            <X size={11} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrainstormBoard;
