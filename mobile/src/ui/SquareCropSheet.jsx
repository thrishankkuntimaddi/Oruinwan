// Crop a picture to a square (1:1), like a WhatsApp group icon: drag to move it, pinch or use the
// slider to zoom. `round` shows a circle guide (profile photos are shown round). The math is
// shared with the web app (platform/media/squareCrop.js). onDone(blob) gets a 512×512 JPEG.
import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { MAX_ZOOM, clampCrop, cropToBlob, displaySize, initialCrop, zoomCrop } from '../../../platform/media/squareCrop.js';
import { Sheet } from './Overlay.jsx';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';

const FRAME = 280;

export function SquareCropSheet({ file, title = 'Crop picture', round = false, busy = false, onCancel, onDone }) {
  const [src, setSrc] = useState(null);
  const [natural, setNatural] = useState(null);
  const [crop, setCrop] = useState(null);
  const [error, setError] = useState(null);
  const img = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setCrop(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onLoad = (e) => {
    const n = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight };
    if (!n.width || !n.height) return setError('That picture could not be read.');
    setNatural(n);
    setCrop(initialCrop(n, FRAME));
    return undefined;
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (!crop) return;
    if (pts.length === 1) gesture.current = { kind: 'drag', x: pts[0].x, y: pts[0].y, start: crop };
    else if (pts.length === 2) gesture.current = { kind: 'pinch', dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), start: crop };
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !natural || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (g.kind === 'drag' && pts.length === 1) {
      setCrop(clampCrop(natural, FRAME, { zoom: g.start.zoom, x: g.start.x + pts[0].x - g.x, y: g.start.y + pts[0].y - g.y }));
    } else if (g.kind === 'pinch' && pts.length === 2 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setCrop(zoomCrop(natural, FRAME, g.start, g.start.zoom * (dist / g.dist)));
    }
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
    startGesture();
  };

  const save = async () => {
    if (!natural || !crop || !img.current) return;
    try {
      onDone?.(await cropToBlob(img.current, natural, FRAME, crop));
    } catch (err) {
      setError(err.message || 'Could not crop the picture');
    }
  };

  const shown = natural && crop ? displaySize(natural, FRAME, crop.zoom) : null;

  return (
    <Sheet open={Boolean(file)} onClose={busy ? () => {} : onCancel} title={title}>
      <div data-testid="square-crop" className="px-4 pb-4">
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative mx-auto touch-none select-none overflow-hidden bg-surface-2"
          style={{ width: FRAME, height: FRAME }}
        >
          {src && (
            <img
              ref={img}
              src={src}
              alt=""
              onLoad={onLoad}
              draggable={false}
              style={shown ? { position: 'absolute', left: crop.x, top: crop.y, width: shown.width, height: shown.height, maxWidth: 'none' } : { opacity: 0 }}
            />
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 border-2 border-white/85"
            style={{ borderRadius: round ? '50%' : 14, boxShadow: '0 0 0 999px rgb(0 0 0 / 0.35)' }}
          />
        </div>
        {error && <p className="mt-2 text-center text-[13px] text-danger">{error}</p>}
        <div className="mt-4 flex items-center gap-2 text-text-3">
          <Icon as={ZoomOut} size={16} />
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop?.zoom || 1}
            onChange={(e) => natural && crop && setCrop(zoomCrop(natural, FRAME, crop, Number(e.target.value)))}
            className="flex-1 accent-[rgb(var(--c-accent))]"
          />
          <Icon as={ZoomIn} size={16} />
        </div>
        <p className="mt-1 text-center text-xs text-text-3">Drag to move · pinch to zoom</p>
        <div className="mt-4 flex gap-2">
          <Button block variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button block loading={busy} disabled={!crop} onClick={save} data-testid="square-crop-save">Use picture</Button>
        </div>
      </div>
    </Sheet>
  );
}
