import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pen, Eraser, Trash2, Palette, Save, Loader2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { Confirm } from '../ui/page';
import useCollabDoc from '../../lib/collab/useCollabDoc';
import CollabPresence from '../../lib/collab/CollabPresence';
import { LOCAL_ORIGIN } from '../../lib/collab/noteBlocks';
import { strokeHit, newStrokeId, roundPoint, readBoardTheme, strokeDrawColor } from '../../lib/collab/whiteboardStrokes';

/** The theme's board and pen colours, re-read when light/dark changes. */
function useBoardTheme() {
    const [theme, setTheme] = useState(() => readBoardTheme());
    useEffect(() => {
        const update = () => setTheme(readBoardTheme());
        const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        mq?.addEventListener?.('change', update);
        let obs = null;
        if (typeof MutationObserver !== 'undefined') {
            obs = new MutationObserver(update);
            obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
            obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
        }
        return () => { mq?.removeEventListener?.('change', update); obs?.disconnect(); };
    }, []);
    return theme;
}
const FONT = 'Inter, system-ui, sans-serif';
const W = 1200;
const H = 700;

const toolBtn = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600,
    borderRadius: '2px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
    background: active ? 'var(--accent)' : 'var(--bg-surface)', color: active ? 'var(--bg-base)' : 'var(--text-primary)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
});

/**
 * Meeting whiteboard. Live over the collab protocol (docType "whiteboard"):
 * a stroke is shared when the pen lifts, the eraser removes whole strokes,
 * and everyone sees each other's pointers. Without a live connection it falls
 * back to drawing locally and saving over REST.
 */
const Whiteboard = ({ meetingId, boardId = meetingId }) => {
    // Page 1 is the meeting's board; other pages have their own id (and REST path).
    const restPath = boardId && boardId !== meetingId ? `/api/v2/collaboration/whiteboard/${meetingId}/pages/${boardId}` : `/api/v2/collaboration/whiteboard/${meetingId}`;
    const canvasRef = useRef(null);
    const { showToast } = useToast();
    const [dirty, setDirty] = useState(false);
    const [savedAt, setSavedAt] = useState(null);

    const [tool, setTool] = useState('pen');
    const theme = useBoardTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    // The pen is a theme slot (0 = ink); its colour follows the theme.
    const [penIdx, setPenIdx] = useState(0);
    const color = theme.pens[penIdx]?.color || theme.ink;
    const [lineWidth] = useState(3);
    const [drawing, setDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);
    const [strokes, setStrokes] = useState([]);
    const [saving, setSaving] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const collab = useCollabDoc('whiteboard', boardId, { enabled: !!boardId });
    const live = collab.live;
    const doc = collab.doc;
    const readOnly = live && collab.readOnly;
    const setPresence = collab.setPresence;
    const lastPointer = useRef(0);

    useEffect(() => {
        if (!meetingId) return;
        api.get(restPath)
            .then(({ data }) => {
                // The live doc wins once it is synced.
                if (data.strokes?.length) setStrokes((prev) => (prev.length ? prev : data.strokes));
            })
            .catch((err) => showToast(err?.response?.data?.message || 'Could not load the whiteboard', 'error'));
    }, [meetingId, restPath, showToast]);

    // Live: the shared stroke list is the board.
    useEffect(() => {
        if (!live || !doc) return undefined;
        const yStrokes = doc.getArray('strokes');
        const pull = () => setStrokes(yStrokes.toArray());
        pull();
        setDirty(false);
        yStrokes.observe(pull);
        return () => yStrokes.unobserve(pull);
    }, [live, doc]);

    const redraw = useCallback((allStrokes) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        allStrokes.forEach(stroke => {
            if (!stroke?.points?.length) return;
            ctx.beginPath();
            // Older boards stored "eraser" strokes painted in the board colour.
            ctx.strokeStyle = strokeDrawColor(stroke, themeRef.current);
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

    useEffect(() => { redraw(strokes); }, [strokes, redraw, theme]);

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width || canvas.width);
        const scaleY = canvas.height / (rect.height || canvas.height);
        const src = e.touches && e.touches.length ? e.touches[0] : e;
        return roundPoint({ x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY });
    };

    const sharePointer = (pos) => {
        if (!live) return;
        const now = Date.now();
        if (pos && now - lastPointer.current < 60) return;
        lastPointer.current = now;
        setPresence({ pointer: pos });
    };

    /** Remove the strokes under the eraser. */
    const eraseAt = (pos) => {
        const hitIds = strokes.filter((s) => strokeHit(s, pos, 10)).map((s) => s.id).filter(Boolean);
        const hitLegacy = strokes.filter((s) => !s.id && strokeHit(s, pos, 10));
        if (!hitIds.length && !hitLegacy.length) return;
        if (live && doc) {
            const yStrokes = doc.getArray('strokes');
            doc.transact(() => {
                for (let i = yStrokes.length - 1; i >= 0; i--) {
                    const s = yStrokes.get(i);
                    if ((s?.id && hitIds.includes(s.id)) || hitLegacy.includes(s)) yStrokes.delete(i, 1);
                }
            }, LOCAL_ORIGIN);
        } else {
            setStrokes((prev) => prev.filter((s) => !(s.id && hitIds.includes(s.id)) && !hitLegacy.includes(s)));
            setDirty(true);
        }
    };

    const onPointerDown = (e) => {
        if (readOnly) return;
        const pos = getPos(e);
        setDrawing(true);
        if (tool === 'eraser') { eraseAt(pos); return; }
        setCurrentPoints([pos]);
    };

    const onPointerMove = (e) => {
        const pos = getPos(e);
        sharePointer(pos);
        if (!drawing) return;
        if (tool === 'eraser') { eraseAt(pos); return; }
        setCurrentPoints(prev => {
            const next = [...prev, pos];
            const ctx = canvasRef.current?.getContext?.('2d');
            if (ctx && prev.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = strokeDrawColor({ color }, themeRef.current);
                ctx.lineWidth = lineWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(prev[prev.length - 1].x, prev[prev.length - 1].y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
            return next;
        });
    };

    const onPointerUp = () => {
        if (!drawing) return;
        setDrawing(false);
        if (tool === 'eraser' || currentPoints.length === 0) { setCurrentPoints([]); return; }
        const stroke = { id: newStrokeId(), tool: 'pen', color, lineWidth, points: currentPoints };
        setCurrentPoints([]);
        if (live && doc) {
            // Shared when the pen lifts.
            doc.transact(() => doc.getArray('strokes').push([stroke]), LOCAL_ORIGIN);
        } else {
            setStrokes(prev => [...prev, stroke]);
            setDirty(true);
        }
    };

    const onLeave = () => {
        onPointerUp();
        if (live) setPresence({ pointer: null });
    };

    const handleClear = () => {
        setConfirmClear(false);
        if (live && doc) {
            const yStrokes = doc.getArray('strokes');
            doc.transact(() => yStrokes.delete(0, yStrokes.length), LOCAL_ORIGIN);
        } else {
            setStrokes([]);
            setDirty(true);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post(restPath, { strokes });
            setDirty(false);
            setSavedAt(new Date());
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not save the whiteboard', 'error');
        } finally {
            setSaving(false);
        }
    };

    const pointers = live ? collab.peers.filter((p) => p.pointer && Number.isFinite(p.pointer.x)) : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px', fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {live || collab.closedText ? <CollabPresence collab={collab} /> : null}
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }} data-testid="whiteboard-mode">
                    {live
                        ? (readOnly ? 'You can watch this board but not draw on it.' : 'Live: everyone in this meeting sees strokes as you draw.')
                        : <>Not live: others see your drawing after you save and they reopen this tab.
                            {dirty ? ' You have unsaved changes.' : savedAt ? ` Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</>}
                </p>
            </div>
            {!readOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setTool('pen')} style={toolBtn(tool === 'pen')} aria-pressed={tool === 'pen'}>
                        <Pen size={13} /> Pen
                    </button>
                    <button type="button" onClick={() => setTool('eraser')} style={toolBtn(tool === 'eraser')} aria-pressed={tool === 'eraser'} title="Removes the strokes you touch">
                        <Eraser size={13} /> Eraser
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                        <Palette size={13} style={{ color: 'var(--text-secondary)' }} />
                        {theme.pens.map((p, i) => (
                            <button
                                type="button"
                                key={p.token}
                                title={`${p.label} pen`}
                                aria-label={`${p.label} pen`}
                                aria-pressed={penIdx === i && tool === 'pen'}
                                onClick={() => { setPenIdx(i); setTool('pen'); }}
                                style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: `var(${p.token})`, cursor: 'pointer', border: penIdx === i && tool === 'pen' ? '2px solid var(--accent)' : '1px solid var(--border-accent)', boxShadow: penIdx === i && tool === 'pen' ? '0 0 0 2px var(--bg-base)' : 'none' }}
                            />
                        ))}
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => setConfirmClear(true)} disabled={!strokes.length} style={{ ...toolBtn(false), color: 'var(--state-danger)', opacity: strokes.length ? 1 : 0.5 }}>
                            <Trash2 size={13} /> Clear
                        </button>
                        {!live && (
                            <button type="button" onClick={handleSave} disabled={saving || !dirty} style={{ ...toolBtn(true), opacity: saving || !dirty ? 0.6 : 1, cursor: saving || !dirty ? 'not-allowed' : 'pointer' }}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div style={{ position: 'relative', flex: 1, minHeight: '360px', overflow: 'hidden', border: '1px solid var(--border-default)', borderRadius: '2px', background: 'var(--bg-surface)', cursor: readOnly ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair' }}>
                <canvas
                    ref={canvasRef}
                    width={W}
                    height={H}
                    data-testid="whiteboard-canvas"
                    style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onLeave}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                />
                {pointers.map((p) => (
                    <span key={p.key} aria-hidden="true" style={{
                        position: 'absolute', left: `${(p.pointer.x / W) * 100}%`, top: `${(p.pointer.y / H) * 100}%`,
                        transform: 'translate(-2px, -2px)', pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                        transition: 'left 80ms linear, top 80ms linear',
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 0 2px var(--bg-base)' }} />
                        <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: 'var(--accent)', color: 'var(--gl-on-accent, var(--bg-base))', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</span>
                    </span>
                ))}
            </div>

            <Confirm
                open={confirmClear}
                title="Clear the whiteboard?"
                confirmLabel="Clear"
                tone="danger"
                onConfirm={handleClear}
                onClose={() => setConfirmClear(false)}
            >
                {live ? 'Every stroke is removed for everyone in this meeting.' : 'Every stroke is removed. Save afterwards to keep the empty board.'}
            </Confirm>
        </div>
    );
};

export default Whiteboard;
