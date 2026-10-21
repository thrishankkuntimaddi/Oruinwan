import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useMediaUrl } from '../../utils/mediaUrl';
import { LoadingState, ErrorState } from '../../components/ui/page';
import { normalisePoint, normaliseRect, annotationStyle, isPin, visibleOn } from './reviewGeometry';

/**
 * The reviewed file (image / PDF page / video) with its annotations drawn on top.
 * When `annotating`, click (pin) or click-drag (box) on the frame calls
 * onDraft({ x, y, w, h, page, timeMs }) in normalised coordinates.
 *
 * PDFs render in the browser's viewer; boxes are relative to the visible frame of the
 * chosen `page` (the viewer is opened at that page).
 */
const ReviewCanvas = forwardRef(function ReviewCanvas({
    kind, url, annotations = [], numbers = {}, activeId, draft, annotating = false, page = 1,
    onSelect, onDraft, onTime, onPointer, pointers = [],
}, ref) {
    const { url: signed, error, refresh } = useMediaUrl(url ? { url } : null);
    const overlayRef = useRef(null);
    const videoRef = useRef(null);
    const [drawing, setDrawing] = useState(null); // { a, b }
    const [timeMs, setTimeMs] = useState(0);
    const lastPointer = useRef(0);

    useImperativeHandle(ref, () => ({
        seek(ms) {
            const v = videoRef.current;
            if (v && Number.isFinite(ms)) { v.currentTime = ms / 1000; v.pause(); setTimeMs(ms); }
        },
        pause() { videoRef.current?.pause(); },
        currentTimeMs() { return videoRef.current ? Math.round(videoRef.current.currentTime * 1000) : null; },
    }), []);

    useEffect(() => { if (annotating) videoRef.current?.pause(); }, [annotating]);

    const point = (e) => normalisePoint(e.clientX, e.clientY, overlayRef.current?.getBoundingClientRect());
    const videoMs = () => (kind === 'video' && videoRef.current ? Math.round(videoRef.current.currentTime * 1000) : null);

    const down = (e) => {
        if (!annotating || e.button > 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const p = point(e);
        setDrawing({ a: p, b: p });
    };
    const move = (e) => {
        const p = point(e);
        if (drawing) setDrawing((d) => ({ ...d, b: p }));
        const now = Date.now();
        if (onPointer && now - lastPointer.current > 80) {
            lastPointer.current = now;
            onPointer({ ...p, page, timeMs: videoMs() });
        }
    };
    const up = () => {
        if (!drawing) return;
        const box = normaliseRect(drawing.a, drawing.b);
        setDrawing(null);
        onDraft?.({ ...box, page: kind === 'pdf' ? page : 1, timeMs: videoMs() });
    };

    if (!url) return <ErrorState title="This version has no file" />;
    if (error) return <ErrorState title="Couldn’t open the file" message="You may no longer have access to it." onRetry={refresh} />;
    if (!signed) return <div className="dr-canvas"><LoadingState label="Opening the file…" /></div>;

    const ctx = { kind, page, timeMs };
    const shown = annotations.filter((a) => visibleOn(a, ctx));
    const live = drawing ? normaliseRect(drawing.a, drawing.b) : null;
    const pdfSrc = `${signed}#page=${page}&toolbar=0&navpanes=0&view=FitH`;

    return (
        <div className="dr-canvas">
            <div className="dr-frame" data-kind={kind}>
                {kind === 'image' && <img src={signed} alt="Reviewed file" draggable={false} onError={refresh} />}
                {kind === 'video' && (
                    <video
                        ref={videoRef} src={signed} controls preload="metadata" onError={refresh}
                        onTimeUpdate={(e) => { const ms = Math.round(e.currentTarget.currentTime * 1000); setTimeMs(ms); onTime?.(ms); }}
                    />
                )}
                {kind === 'pdf' && <iframe key={pdfSrc} src={pdfSrc} title="Reviewed PDF" />}

                <div
                    ref={overlayRef}
                    className="dr-overlay"
                    data-active={annotating ? 'true' : 'false'}
                    onPointerDown={down}
                    onPointerMove={move}
                    onPointerUp={up}
                    onPointerCancel={() => setDrawing(null)}
                    aria-label={annotating ? 'Click to pin a comment, or drag to mark an area' : undefined}
                >
                    {shown.map((a) => (
                        <button
                            key={a._id}
                            type="button"
                            className="dr-mark"
                            data-pin={isPin(a) ? 'true' : undefined}
                            data-resolved={a.resolved ? 'true' : undefined}
                            data-active={activeId === a._id ? 'true' : undefined}
                            style={annotationStyle(a)}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onSelect?.(a); }}
                            aria-label={`Comment ${numbers[a._id] || ''}: ${a.body}`}
                            title={a.body}
                        >
                            <span className="dr-num">{numbers[a._id] || '•'}</span>
                        </button>
                    ))}
                    {(live || draft) && (
                        <span className="dr-mark" data-draft="true" data-pin={isPin(live || draft) ? 'true' : undefined} style={annotationStyle(live || draft)}>
                            <span className="dr-num">+</span>
                        </span>
                    )}
                    {pointers.filter((p) => visibleOn({ page: p.page }, { kind, page })).map((p) => (
                        <span key={p.userId} className="dr-pointer" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                            <span /><span>{p.name}</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default ReviewCanvas;
