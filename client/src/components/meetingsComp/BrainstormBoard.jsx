import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import api from '@services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';

const NOTE_COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F9A8D4', '#C4B5FD', '#FCA5A5', '#6EE7B7'];
const FONT = 'Inter, system-ui, sans-serif';

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
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px', fontFamily: FONT }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                {liveReady
                    ? 'Notes are saved and appear live for everyone who has this meeting open.'
                    : 'Notes are saved; live updates start once you are connected to the meeting.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="New sticky note…"
                    style={{ flex: 1, minWidth: '160px', padding: '8px 10px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', fontFamily: FONT }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                    {NOTE_COLORS.map(c => (
                        <button
                            key={c}
                            title="Note colour"
                            aria-label={`Note colour ${c}`}
                            onClick={() => setNewColor(c)}
                            style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: newColor === c ? '2px solid var(--text-primary)' : '1px solid var(--border-accent)' }}
                        />
                    ))}
                </div>
                <button
                    onClick={handleAdd}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px', fontWeight: 600, background: 'var(--accent)', color: '#0c0c0c', border: '1px solid var(--accent)', borderRadius: '2px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}
                >
                    <Plus size={14} /> Add note
                </button>
            </div>

            <div
                ref={boardRef}
                style={{ flex: 1, position: 'relative', minHeight: '400px', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}
            >
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Loading board…
                    </div>
                )}
                {!loading && items.length === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <p style={{ fontSize: '13px' }}>The board is empty</p>
                        <p style={{ fontSize: '12px' }}>Add sticky notes above to get started</p>
                    </div>
                )}
                {items.map(item => (
                    <div
                        key={item._id}
                        className="group"
                        style={{
                            position: 'absolute',
                            left: item.position?.x || 50,
                            top: item.position?.y || 50,
                            backgroundColor: item.color || '#FBBF24',
                            cursor: 'grab',
                            minWidth: 120,
                            maxWidth: 200,
                            padding: '10px 22px 10px 10px',
                            borderRadius: '2px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                            userSelect: 'none' }}
                        onMouseDown={(e) => onMouseDown(e, item._id, item.position?.x || 50, item.position?.y || 50)}
                    >
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#1a1916', wordBreak: 'break-word', lineHeight: 1.4 }}>
                            {item.text}
                        </p>
                        <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                            title="Delete note"
                            aria-label="Delete note"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ position: 'absolute', top: 4, right: 4, display: 'flex', padding: '2px', borderRadius: '2px', background: 'rgba(0,0,0,0.12)', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={10} style={{ color: '#1a1916' }} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrainstormBoard;
