import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import api from '@services/api';
import { useSocket } from '../../contexts/SocketContext';

const NOTE_COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F9A8D4', '#C4B5FD', '#FCA5A5', '#6EE7B7'];

const BrainstormBoard = ({ meetingId, workspaceId }) => {
    const { socket } = useSocket();
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
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [meetingId]);

    
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
                { workspaceId, text: newText.trim(), color: newColor, position: { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 } }
            );
            setItems(prev => {
                const exists = prev.find(i => i._id === data.item._id);
                return exists ? prev : [...prev, data.item];
            });
            setNewText('');
        } catch {  }
    }, [meetingId, workspaceId, newText, newColor]);

    
    const handleDelete = useCallback(async (itemId) => {
        setItems(prev => prev.filter(i => i._id !== itemId));
        try {
            await api.delete(`/api/v2/collaboration/brainstorm/${meetingId}/${itemId}`);
        } catch {  }
    }, [meetingId]);

    
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

        try {
            await api.patch(
                `/api/v2/collaboration/brainstorm/${meetingId}/${itemId}`,
                { position: { x: newX, y: newY } }
            );
        } catch {  }
    }, [meetingId]);

    useEffect(() => {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    return (
        <div className="flex flex-col h-full gap-3">
            {}
            <div className="flex items-center gap-2 flex-wrap">
                <input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="New sticky note…"
                    className="flex-1 min-w-[160px] px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white placeholder-gray-400"
                />
                <div className="flex gap-1">
                    {NOTE_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setNewColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${newColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-medium"
                >
                    <Plus size={14} /> Add Note
                </button>
            </div>

            {}
            <div
                ref={boardRef}
                className="flex-1 relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 overflow-hidden"
                style={{ minHeight: '400px' }}
            >
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                        Loading board…
                    </div>
                )}
                {!loading && items.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                        <p className="text-sm">Brainstorm board is empty</p>
                        <p className="text-xs">Add sticky notes above to get started</p>
                    </div>
                )}
                {items.map(item => (
                    <div
                        key={item._id}
                        style={{
                            position: 'absolute',
                            left: item.position?.x || 50,
                            top: item.position?.y || 50,
                            backgroundColor: item.color || '#FBBF24',
                            cursor: 'grab',
                            minWidth: 120,
                            maxWidth: 200,
                            userSelect: 'none' }}
                        className="rounded-xl shadow-lg p-3 group"
                        onMouseDown={(e) => onMouseDown(e, item._id, item.position?.x || 50, item.position?.y || 50)}
                    >
                        <p className="text-sm font-medium text-gray-900 break-words leading-snug pr-4">
                            {item.text}
                        </p>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded bg-black/10 hover:bg-black/20"
                        >
                            <X size={10} className="text-gray-700" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrainstormBoard;
