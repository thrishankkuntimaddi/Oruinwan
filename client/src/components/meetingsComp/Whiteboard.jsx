import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pen, Eraser, Trash2, Palette, Save, Loader2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const COLORS = ['#FFFFFF', '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#000000'];
// The drawing surface keeps its own dark "board" colour in both themes (strokes are stored with it).
const BOARD_BG = '#1a1a2e';
const FONT = 'Inter, system-ui, sans-serif';

const toolBtn = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600,
    borderRadius: '2px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
    background: active ? 'var(--accent)' : 'var(--bg-surface)', color: active ? '#0c0c0c' : 'var(--text-primary)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
});

/**
 * Meeting whiteboard. Drawing is local until Save: there is no live stroke
 * sync, so the UI says so instead of pretending to be shared.
 */
const Whiteboard = ({ meetingId }) => {
    const canvasRef = useRef(null);
    const { showToast } = useToast();
    const [dirty, setDirty] = useState(false);
    const [savedAt, setSavedAt] = useState(null);

    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#FFFFFF');
    const [lineWidth] = useState(3);
    const [drawing, setDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);
    const [strokes, setStrokes] = useState([]);
    const [saving, setSaving] = useState(false);

    
    useEffect(() => {
        if (!meetingId) return;
        api.get(`/api/v2/collaboration/whiteboard/${meetingId}`)
            .then(({ data }) => {
                if (data.strokes?.length) {
                    setStrokes(data.strokes);
                }
            })
            .catch((err) => showToast(err?.response?.data?.message || 'Could not load the whiteboard', 'error'));
    }, [meetingId, showToast]);

    
    const redraw = useCallback((allStrokes) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        allStrokes.forEach(stroke => {
            if (!stroke.points?.length) return;
            ctx.beginPath();
            ctx.strokeStyle = stroke.tool === 'eraser' ? BOARD_BG : (stroke.color || '#FFFFFF');
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
            
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.strokeStyle = tool === 'eraser' ? BOARD_BG : color;
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
        setDirty(true);
    };

    const handleClear = () => {
        setStrokes([]);
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post(`/api/v2/collaboration/whiteboard/${meetingId}`, { strokes });
            setDirty(false);
            setSavedAt(new Date());
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not save the whiteboard', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px', fontFamily: FONT }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                Not live: others see your drawing after you save and they reopen this tab.
                {dirty ? ' You have unsaved changes.' : savedAt ? ` Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setTool('pen')} style={toolBtn(tool === 'pen')}>
                    <Pen size={13} /> Pen
                </button>
                <button onClick={() => setTool('eraser')} style={toolBtn(tool === 'eraser')}>
                    <Eraser size={13} /> Eraser
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                    <Palette size={13} style={{ color: 'var(--text-secondary)' }} />
                    {COLORS.map(c => (
                        <button
                            key={c}
                            title={`Colour ${c}`}
                            aria-label={`Colour ${c}`}
                            onClick={() => { setColor(c); setTool('pen'); }}
                            style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: color === c && tool === 'pen' ? '2px solid var(--accent)' : '1px solid var(--border-accent)' }}
                        />
                    ))}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button onClick={handleClear} style={{ ...toolBtn(false), color: 'var(--state-danger)' }}>
                        <Trash2 size={13} /> Clear
                    </button>
                    <button onClick={handleSave} disabled={saving || !dirty} style={{ ...toolBtn(true), opacity: saving || !dirty ? 0.6 : 1, cursor: saving || !dirty ? 'not-allowed' : 'pointer' }}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: '360px', overflow: 'hidden', border: '1px solid var(--border-default)', borderRadius: '2px', background: BOARD_BG, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={700}
                    style={{ width: '100%', height: '100%', display: 'block' }}
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
