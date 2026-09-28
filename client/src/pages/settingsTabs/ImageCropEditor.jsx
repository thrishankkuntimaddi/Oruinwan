import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button, IconButton } from './settingsUi';
import './account/account.css';

const CANVAS_SIZE = 320;

/**
 * Square crop editor for profile photos: drag to move, slider to zoom,
 * rotate in 90° steps. Calls onConfirm with a JPEG blob of `outputSize` px.
 */
const ImageCropEditor = ({ src, onConfirm, onCancel, outputSize = 400, busy = false }) => {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);

    const [baseZoom, setBaseZoom] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setReady(false);
        setFailed(false);
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            const fit = CANVAS_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
            setBaseZoom(fit);
            setZoom(fit);
            setOffset({ x: 0, y: 0 });
            setRotation(0);
            setReady(true);
        };
        img.onerror = () => setFailed(true);
        img.src = src;
    }, [src]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);

    const draw = useCallback(() => {
        if (!canvasRef.current || !imgRef.current || !ready) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        ctx.save();
        ctx.translate(CANVAS_SIZE / 2 + offset.x, CANVAS_SIZE / 2 + offset.y);
        ctx.rotate((rotation * Math.PI) / 180);
        const w = imgRef.current.naturalWidth * zoom;
        const h = imgRef.current.naturalHeight * zoom;
        ctx.drawImage(imgRef.current, -w / 2, -h / 2, w, h);
        ctx.restore();

        // Dim everything outside the circle the avatar is shown in.
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }, [ready, zoom, rotation, offset]);

    useEffect(() => { draw(); }, [draw]);

    // The canvas may be shown smaller than its pixel size on narrow screens.
    const scaleOf = () => {
        const rect = canvasRef.current?.getBoundingClientRect();
        return rect && rect.width ? CANVAS_SIZE / rect.width : 1;
    };

    const startDrag = (x, y) => {
        const s = scaleOf();
        setDragging(true);
        setDragStart({ x: x * s - offset.x, y: y * s - offset.y });
    };
    const moveDrag = (x, y) => {
        if (!dragging) return;
        const s = scaleOf();
        setOffset({ x: x * s - dragStart.x, y: y * s - dragStart.y });
    };
    const endDrag = () => setDragging(false);

    const minZoom = baseZoom * 0.5;
    const maxZoom = baseZoom * 4;
    const zoomBy = (factor) => setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z * factor)));

    const handleConfirm = () => {
        if (!imgRef.current) return;
        const out = document.createElement('canvas');
        out.width = outputSize;
        out.height = outputSize;
        const ctx = out.getContext('2d');
        // JPEG has no transparency: give transparent images a white background, not black.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputSize, outputSize);

        const scale = outputSize / CANVAS_SIZE;
        ctx.translate(outputSize / 2 + offset.x * scale, outputSize / 2 + offset.y * scale);
        ctx.rotate((rotation * Math.PI) / 180);
        const w = imgRef.current.naturalWidth * zoom * scale;
        const h = imgRef.current.naturalHeight * zoom * scale;
        ctx.drawImage(imgRef.current, -w / 2, -h / 2, w, h);

        out.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
    };

    return createPortal(
        <div className="stg">
            <div className="stg-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}>
                <div className="stg-dialog" role="dialog" aria-modal="true" aria-labelledby="stg-acc-crop-title">
                    <h3 id="stg-acc-crop-title">Crop photo</h3>
                    <div className="stg-dialog-body">
                        {failed ? 'This image could not be opened. Try a JPG or PNG.' : 'Drag to reposition. Use the slider to zoom.'}
                    </div>

                    {!failed && (
                        <>
                            <div className="stg-acc-crop-stage">
                                <canvas
                                    ref={canvasRef}
                                    width={CANVAS_SIZE}
                                    height={CANVAS_SIZE}
                                    aria-label="Crop area"
                                    onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
                                    onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
                                    onMouseUp={endDrag}
                                    onMouseLeave={endDrag}
                                    onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                                    onTouchMove={(e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
                                    onTouchEnd={endDrag}
                                />
                            </div>
                            <div className="stg-acc-crop-tools">
                                <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.15)} disabled={!ready}><ZoomOut size={15} /></IconButton>
                                <input
                                    type="range"
                                    aria-label="Zoom"
                                    min={minZoom}
                                    max={maxZoom}
                                    step={(maxZoom - minZoom) / 100 || 0.01}
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    disabled={!ready}
                                />
                                <IconButton label="Zoom in" onClick={() => zoomBy(1.15)} disabled={!ready}><ZoomIn size={15} /></IconButton>
                                <IconButton label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)} disabled={!ready}><RotateCw size={15} /></IconButton>
                            </div>
                        </>
                    )}

                    <div className="stg-dialog-actions">
                        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
                        {!failed && (
                            <Button variant="primary" onClick={handleConfirm} loading={busy} disabled={!ready}>
                                {busy ? 'Uploading…' : 'Save photo'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default ImageCropEditor;
