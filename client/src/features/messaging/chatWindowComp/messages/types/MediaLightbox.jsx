import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react';
import { getMediaUrl } from '../../../../../utils/mediaUrl';
import { downloadAttachment } from '../../../../../utils/uploadFile';

// Images on screen register here so the lightbox can step through the conversation's
// photos in the order they appear.
const registry = new Map(); // id -> { attachment, el }

export function registerLightboxImage(id, attachment, el) {
    registry.set(id, { attachment, el });
    return () => { if (registry.get(id)?.el === el) registry.delete(id); };
}

function orderedGallery() {
    return [...registry.entries()]
        .filter(([, v]) => v.el?.isConnected)
        .sort(([, a], [, b]) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .map(([id, v]) => ({ id, attachment: v.attachment }));
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

const ctrlBtn = {
    width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/** Full-screen image viewer: zoom (buttons, wheel, double-click), pan, previous/next, download. */
export default function MediaLightbox({ startId, onClose }) {
    const [gallery] = useState(() => orderedGallery());
    const [index, setIndex] = useState(() => Math.max(0, gallery.findIndex((g) => g.id === startId)));
    const [url, setUrl] = useState(null);
    const [failed, setFailed] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [downloading, setDownloading] = useState(false);
    const drag = useRef(null);
    const current = gallery[index]?.attachment;

    useEffect(() => {
        let cancelled = false;
        setUrl(null); setFailed(false); setZoom(1); setPan({ x: 0, y: 0 });
        if (!current) return undefined;
        getMediaUrl(current).then((u) => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [current]);

    const go = useCallback((d) => setIndex((i) => Math.min(gallery.length - 1, Math.max(0, i + d))), [gallery.length]);
    const zoomBy = useCallback((f) => setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z * f).toFixed(2)));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
    }), []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
            else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === '+' || e.key === '=') zoomBy(1.25);
            else if (e.key === '-') zoomBy(0.8);
        };
        window.addEventListener('keydown', onKey, true);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = prevOverflow; };
    }, [go, zoomBy, onClose]);

    const download = async () => {
        if (!current || downloading) return;
        setDownloading(true);
        try { await downloadAttachment(current); } catch { /* the toolbar stays usable */ }
        setDownloading(false);
    };

    const onPointerDown = (e) => {
        if (zoom <= 1) return;
        e.preventDefault();
        drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => { if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
    const onPointerUp = () => { drag.current = null; };

    return createPortal(
        <div data-testid="media-lightbox" role="dialog" aria-modal="true" aria-label={current?.name || 'Image'}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(8,8,8,0.96)', display: 'flex', flexDirection: 'column' }}>
            {/* top bar */}
            <div onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', color: '#fff', fontSize: 13 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                    {current?.name || 'Image'}
                    {gallery.length > 1 && <span data-testid="lightbox-counter" style={{ marginLeft: 10, opacity: 0.6 }}>{index + 1} / {gallery.length}</span>}
                </span>
                <button type="button" style={ctrlBtn} onClick={() => zoomBy(0.8)} disabled={zoom <= MIN_ZOOM} title="Zoom out" aria-label="Zoom out"><ZoomOut size={16} /></button>
                <span data-testid="lightbox-zoom" style={{ minWidth: 44, textAlign: 'center', fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>{Math.round(zoom * 100)}%</span>
                <button type="button" style={ctrlBtn} onClick={() => zoomBy(1.25)} disabled={zoom >= MAX_ZOOM} title="Zoom in" aria-label="Zoom in"><ZoomIn size={16} /></button>
                <button type="button" style={ctrlBtn} onClick={download} title="Download" aria-label="Download">
                    {downloading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
                </button>
                <button type="button" style={ctrlBtn} onClick={onClose} title="Close (Esc)" aria-label="Close"><X size={16} /></button>
            </div>

            {/* image */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                onWheel={(e) => { e.stopPropagation(); zoomBy(e.deltaY < 0 ? 1.15 : 0.87); }}>
                {!url && !failed && <Loader2 size={28} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />}
                {failed && <span style={{ color: '#fff', opacity: 0.7, fontSize: 13 }}>Couldn’t load this image.</span>}
                {url && (
                    <img src={url} alt={current?.name || 'Image'} draggable={false}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => { e.stopPropagation(); if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); } else setZoom(2); }}
                        onError={() => setFailed(true)}
                        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                        style={{
                            maxWidth: '92vw', maxHeight: 'calc(100vh - 80px)', objectFit: 'contain', userSelect: 'none',
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transition: drag.current ? 'none' : 'transform 120ms ease',
                            cursor: zoom > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
                        }} />
                )}
                {gallery.length > 1 && index > 0 && (
                    <button type="button" data-testid="lightbox-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} title="Previous (←)" aria-label="Previous image"
                        style={{ ...ctrlBtn, position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44 }}>
                        <ChevronLeft size={22} />
                    </button>
                )}
                {gallery.length > 1 && index < gallery.length - 1 && (
                    <button type="button" data-testid="lightbox-next" onClick={(e) => { e.stopPropagation(); go(1); }} title="Next (→)" aria-label="Next image"
                        style={{ ...ctrlBtn, position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44 }}>
                        <ChevronRight size={22} />
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
}
