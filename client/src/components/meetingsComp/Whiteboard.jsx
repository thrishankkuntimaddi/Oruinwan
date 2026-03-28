// client/src/components/meetingsComp/Whiteboard.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pen, Eraser, Trash2, Palette } from 'lucide-react';
import api from '../../../services/api';
import { useSocket } from '../../contexts/SocketContext';

const COLORS = ['#FFFFFF', '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#000000'];

/**
 * Canvas-based whiteboard with realtime socket sync.
 */
const Whiteboard = ({ meetingId, workspaceId }) => {
    const canvasRef = useRef(null);
    const { socket } = useSocket();

    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#FFFFFF');
    const [lineWidth] = useState(3);
    const [drawing, setDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);
    const [strokes, setStrokes] = useState([]);
    const [saving, setSaving] = useState(false);

    // ── Load persisted strokes ─────────────────────────────────────────────────
    useEffect(() => {
        if (!meetingId) return;
        api.get(`/api/v2/collaboration/whiteboard/${meetingId}`)
            .then(({ data }) => {
                if (data.strokes?.length) {
                    setStrokes(data.strokes);
                }
            })
            .catch(() => { /* ignore */ });
    }, [meetingId]);

    // ── Redraw canvas on stroke change ─────────────────────────────────────────
    const redraw = useCallback((allStrokes) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        allStrokes.forEach(stroke => {
            if (!stroke.points?.length) return;
            ctx.beginPath();
            ctx.strokeStyle = stroke.tool === 'eraser' ? '#1a1a2e' : (stroke.color || '#FFFFFF');
            ctx.lineWidth = stroke.tool === 'eraser' ? (stroke.lineWidth * 4) : (stroke.lineWidth || 3);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            stroke.points.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
        });
    }, []);

    useEffect(() => { redraw(strokes); }, [strokes, redraw]);

    // ── Socket listener — remote strokes ───────────────────────────────────────
    useEffect(() => {
        if (!socket || !meetingId) return;

        const onUpdate = (data) => {
            if (data.meetingId !== meetingId) return;
            if (data.action === 'clear') {
                setStrokes([]);
            } else if (data.stroke) {
                setStrokes(prev => [...prev, data.stroke]);
            }
        };
        socket.on('whiteboard:update', onUpdate);
        return () => socket.off('whiteboard:update', onUpdate);
    }, [socket, meetingId]);

    // ── Mouse / Touch drawing ──────────────────────────────────────────────────
    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY };
    };

    const onPointerDown = (e) => {
        setDrawing(true);
        const pos = getPos(e);
        setCurrentPoints([pos]);
    };

    const onPointerMove = (e) => {
        if (!drawing) return;
        const pos = getPos(e);
        setCurrentPoints(prev => {
            const next = [...prev, pos];
            // Live draw current stroke
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.strokeStyle = tool === 'eraser' ? '#1a1a2e' : color;
            ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (prev.length > 0) {
                ctx.moveTo(prev[prev.length - 1].x, prev[prev.length - 1].y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
            return next;
        });
    };

    const onPointerUp = () => {
        if (!drawing || currentPoints.length === 0) return;
        setDrawing(false);

        const stroke = { tool, color, lineWidth, points: currentPoints };
        setStrokes(prev => [...prev, stroke]);
        setCurrentPoints([]);

        // Emit to peers
        socket?.emit('whiteboard:update', { meetingId, action: 'stroke', stroke });
    };

    // ── Clear board ───────────────────────────────────────────────────────────
    const handleClear = () => {
        setStrokes([]);
        socket?.emit('whiteboard:update', { meetingId, action: 'clear' });
    };

    // ── Persist snapshot to server ─────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post(
                `/api/v2/collaboration/whiteboard/${meetingId}`,
                { workspaceId, strokes }
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => setTool('pen')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <Pen size={13} /> Pen
                </button>
                <button
                    onClick={() => setTool('eraser')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <Eraser size={13} /> Eraser
                </button>

                <div className="flex items-center gap-1.5 ml-2">
                    <Palette size={13} className="text-gray-400" />
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => { setColor(c); setTool('pen'); }}
                            className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${color === c && tool === 'pen' ? 'border-indigo-500 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>

                <div className="ml-auto flex gap-2">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/40 transition-all"
                    >
                        <Trash2 size={13} /> Clear
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-[#1a1a2e]" style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={700}
                    className="w-full h-full"
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onPointerUp}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                />
            </div>
        </div>
    );
};

export default Whiteboard;
