import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { MAX_ZOOM, clampCrop, cropToBlob, displaySize, initialCrop, zoomCrop } from '@platform/media/squareCrop.js';

const FRAME = 280;

/**
 * Crop a picture to a square (1:1), like a WhatsApp group icon: drag to move it, zoom with the
 * slider or the mouse wheel. `round` shows a circle guide (profile photos are shown round).
 * onDone(blob) gets a 512×512 JPEG.
 */
export default function SquareCropDialog({ file, title = 'Crop picture', round = false, onCancel, onDone, busy = false }) {
    const [src, setSrc] = useState(null);
    const [natural, setNatural] = useState(null);
    const [crop, setCrop] = useState(null);
    const [error, setError] = useState(null);
    const imgRef = useRef(null);
    const drag = useRef(null);

    useEffect(() => {
        if (!file) return undefined;
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);

    const onLoad = (e) => {
        const n = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight };
        if (!n.width || !n.height) { setError('That picture could not be read.'); return; }
        setNatural(n);
        setCrop(initialCrop(n, FRAME));
    };

    const onPointerDown = (e) => {
        if (!crop) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, start: crop };
    };
    const onPointerMove = (e) => {
        if (!drag.current || !natural) return;
        const d = drag.current;
        setCrop(clampCrop(natural, FRAME, { zoom: d.start.zoom, x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
    };
    const onPointerUp = () => { drag.current = null; };
    const setZoom = (z) => natural && crop && setCrop(zoomCrop(natural, FRAME, crop, z));
    const onWheel = (e) => { if (crop) setZoom(crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };

    const save = async () => {
        if (!natural || !crop || !imgRef.current) return;
        try {
            onDone?.(await cropToBlob(imgRef.current, natural, FRAME, crop));
        } catch (err) {
            setError(err.message || 'Could not crop the picture');
        }
    };

    const shown = natural && crop ? displaySize(natural, FRAME, crop.zoom) : null;

    return (
        <div data-testid="square-crop" role="dialog" aria-modal="true" aria-label={title}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
            <div className="anim-pop-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 2, width: 'min(360px, calc(100vw - 32px))', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
                    <button type="button" aria-label="Close" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
                </div>
                <div
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
                    style={{ position: 'relative', width: FRAME, height: FRAME, margin: '0 auto', overflow: 'hidden', background: 'var(--bg-active)', touchAction: 'none', cursor: drag.current ? 'grabbing' : 'grab', userSelect: 'none' }}
                >
                    {src && (
                        <img ref={imgRef} src={src} alt="" onLoad={onLoad} draggable={false}
                            style={shown ? { position: 'absolute', left: crop.x, top: crop.y, width: shown.width, height: shown.height, maxWidth: 'none' } : { opacity: 0 }} />
                    )}
                    {/* The guide: outside the square (or circle) is dimmed. */}
                    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: round ? '50%' : 12, boxShadow: '0 0 0 999px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.85)' }} />
                </div>
                {error && <p role="alert" style={{ color: 'var(--state-danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                    <ZoomOut size={14} style={{ color: 'var(--text-muted)' }} />
                    <input type="range" aria-label="Zoom" min={1} max={MAX_ZOOM} step={0.01} value={crop?.zoom || 1}
                        onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
                    <ZoomIn size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Drag to move · zoom to fit</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                    <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={onCancel} disabled={busy}>Cancel</button>
                    <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" data-testid="square-crop-save" onClick={save} disabled={busy || !crop}>
                        {busy ? 'Saving…' : 'Use picture'}
                    </button>
                </div>
            </div>
        </div>
    );
}
