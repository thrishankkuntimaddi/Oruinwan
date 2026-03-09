import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react';

/**
 * ImageCropEditor
 * Canvas-based square crop editor — no external library.
 * Props:
 *   src       — data URL or object URL of the image to edit
 *   onConfirm — (blob) => void — called with the cropped JPEG blob
 *   onCancel  — () => void
 *   outputSize — pixel dimension of the output (default 400)
 */
const ImageCropEditor = ({ src, onConfirm, onCancel, outputSize = 400 }) => {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);

    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });
    const [ready, setReady] = useState(false);

    const CANVAS_SIZE = 320; // Display canvas is always 320×320

    // Load image
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            // Set initial zoom so the image fills the crop square
            const minDim = Math.min(img.naturalWidth, img.naturalHeight);
            const initZoom = CANVAS_SIZE / minDim;
            setZoom(initZoom);
            setOffset({ x: 0, y: 0 });
            setReady(true);
        };
        img.src = src;
    }, [src]);

    // Draw frame
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

        // Darkened overlay outside circle crop guide
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Circle border
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }, [ready, zoom, rotation, offset]);

    useEffect(() => { draw(); }, [draw]);

    // Drag-to-pan
    const onMouseDown = (e) => {
        setDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const onMouseMove = (e) => {
        if (!dragging) return;
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const onMouseUp = () => setDragging(false);

    // Touch support
    const onTouchStart = (e) => {
        const t = e.touches[0];
        setDragging(true);
        setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
    };
    const onTouchMove = (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
    };

    // Export cropped output
    const handleConfirm = () => {
        if (!imgRef.current) return;
        const out = document.createElement('canvas');
        out.width = outputSize;
        out.height = outputSize;
        const ctx = out.getContext('2d');

        const scale = outputSize / CANVAS_SIZE;
        ctx.translate(outputSize / 2 + offset.x * scale, outputSize / 2 + offset.y * scale);
        ctx.rotate((rotation * Math.PI) / 180);

        const w = imgRef.current.naturalWidth * zoom * scale;
        const h = imgRef.current.naturalHeight * zoom * scale;
        ctx.drawImage(imgRef.current, -w / 2, -h / 2, w, h);

        out.toBlob(
            (blob) => { if (blob) onConfirm(blob); },
            'image/jpeg', 0.92
        );
    };

    const zoomBy = (delta) => setZoom(z => Math.max(0.2, Math.min(5, z + delta)));

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Crop & Edit Photo</h3>
                    <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X size={16} />
                    </button>
                </div>

                {/* Canvas */}
                <div className="flex items-center justify-center bg-gray-900 py-6 px-6">
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_SIZE}
                        height={CANVAS_SIZE}
                        className="rounded-2xl cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onMouseUp}
                    />
                </div>

                <p className="text-center text-[11px] text-gray-400 py-2">Drag to reposition · Scroll or use buttons to zoom</p>

                {/* Controls */}
                <div className="px-5 py-3 space-y-3 border-t border-gray-200 dark:border-gray-800">
                    {/* Zoom slider */}
                    <div className="flex items-center gap-3">
                        <button onClick={() => zoomBy(-0.1)} className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <ZoomOut size={15} />
                        </button>
                        <input
                            type="range"
                            min="0.3"
                            max="4"
                            step="0.05"
                            value={zoom}
                            onChange={e => setZoom(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 accent-blue-600"
                        />
                        <button onClick={() => zoomBy(0.1)} className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <ZoomIn size={15} />
                        </button>
                        <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
                            <RotateCw size={15} />
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        <button onClick={onCancel}
                            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleConfirm}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors">
                            <Check size={14} /> Apply Crop
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropEditor;
