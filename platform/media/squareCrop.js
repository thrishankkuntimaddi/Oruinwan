// Square (1:1) cropping for profile photos and workspace pictures, like a WhatsApp group icon:
// the picture fills a square frame; drag to move it, zoom to get closer. The web and phone apps
// draw their own frame and controls and share this math.
//
// State: { zoom, x, y } where zoom >= 1 (1 = the picture just covers the frame) and x, y are
// the picture's top-left corner inside a frame `frame` pixels wide (always <= 0).

export const MAX_ZOOM = 4;
export const OUTPUT_SIZE = 512;

/** The picture's size in the frame at this zoom. */
export function displaySize(natural, frame, zoom = 1) {
  const cover = frame / Math.min(natural.width, natural.height);
  const scale = cover * Math.min(Math.max(zoom, 1), MAX_ZOOM);
  return { width: natural.width * scale, height: natural.height * scale, scale };
}

/** Keeps the frame covered: x, y clamped so no empty edge shows. */
export function clampCrop(natural, frame, { zoom = 1, x = 0, y = 0 } = {}) {
  const z = Math.min(Math.max(zoom, 1), MAX_ZOOM);
  const { width, height } = displaySize(natural, frame, z);
  return {
    zoom: z,
    x: Math.min(0, Math.max(frame - width, x)),
    y: Math.min(0, Math.max(frame - height, y)),
  };
}

/** Centred at zoom 1. */
export function initialCrop(natural, frame) {
  const { width, height } = displaySize(natural, frame, 1);
  return { zoom: 1, x: (frame - width) / 2, y: (frame - height) / 2 };
}

/** Zoom about the frame's centre, keeping what's in the middle in the middle. */
export function zoomCrop(natural, frame, crop, nextZoom) {
  const before = displaySize(natural, frame, crop.zoom);
  const after = displaySize(natural, frame, nextZoom);
  const cx = (frame / 2 - crop.x) / before.scale;
  const cy = (frame / 2 - crop.y) / before.scale;
  return clampCrop(natural, frame, { zoom: nextZoom, x: frame / 2 - cx * after.scale, y: frame / 2 - cy * after.scale });
}

/** The square of the original picture that the frame shows: { sx, sy, size } in its pixels. */
export function sourceSquare(natural, frame, crop) {
  const c = clampCrop(natural, frame, crop);
  const { scale } = displaySize(natural, frame, c.zoom);
  return { sx: (-c.x / scale) || 0, sy: (-c.y / scale) || 0, size: frame / scale };
}

/** Draws the cropped square into a canvas and returns a JPEG Blob (`size` × `size`). */
export function cropToBlob(image, natural, frame, crop, { size = OUTPUT_SIZE, type = 'image/jpeg', quality = 0.9 } = {}) {
  const { sx, sy, size: s } = sourceSquare(natural, frame, crop);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, sx, sy, s, s, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the picture'))), type, quality);
  });
}
