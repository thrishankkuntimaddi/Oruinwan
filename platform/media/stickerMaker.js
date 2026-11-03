// Making a sticker from a photo, shared by the web and phone apps: the photo is first cropped to
// a square (squareCrop.js), then cut to a shape on a transparent background with a white
// outline (the classic sticker look) and an optional caption. The result is a 512×512 WebP
// (PNG where the browser can't write WebP, e.g. Safari).
//
// GIFs and WebP/PNG pictures can also be added as they are, so animated stickers stay animated.

export const STICKER_SIZE = 512;
export const STICKER_MAX_BYTES = 5 * 1024 * 1024;
export const STICKER_SHAPES = ['rounded', 'circle', 'full'];
export const CAPTION_MAX = 40;

const AS_IS = /^image\/(gif|webp|png)$/i;

/** Can this file be added to the library without redrawing it (keeps animation and transparency)? */
export function canAddAsIs(file) {
  return !!file && AS_IS.test(String(file.type || '')) && file.size > 0 && file.size <= STICKER_MAX_BYTES;
}

/** Is it a picture the maker can draw (not HEIC/SVG/TIFF, which browsers can't always read)? */
export function canMakeFrom(file) {
  const t = String(file?.type || '').toLowerCase();
  return /^image\//.test(t) && !/^image\/(heic|heif|tiff|svg\+xml)/.test(t);
}

/** A reason this file can't become a sticker, or null. */
export function stickerFileProblem(file) {
  if (!file) return 'Pick a picture';
  if (!canMakeFrom(file)) return 'Pick a photo, PNG, WebP or GIF';
  if (file.size > 20 * 1024 * 1024) return 'That picture is too large';
  return null;
}

/** Splits a caption into at most two lines that fit `maxWidth` (ctx.measureText decides). */
export function wrapCaption(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().slice(0, CAPTION_MAX).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  else if (line && lines.length === maxLines && !lines[maxLines - 1].endsWith('…')) {
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

function shapePath(ctx, shape, x, y, size) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  } else {
    const r = shape === 'full' ? 0 : size * 0.16;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + size, y, x + size, y + size, r);
    ctx.arcTo(x + size, y + size, x, y + size, r);
    ctx.arcTo(x, y + size, x, y, r);
    ctx.arcTo(x, y, x + size, y, r);
  }
  ctx.closePath();
}

/**
 * Draws the sticker into `canvas` (resized to STICKER_SIZE). `image` is the square crop (an
 * <img>, ImageBitmap or canvas). Options: { shape: rounded | circle | full, caption, outline }.
 */
export function drawSticker(canvas, image, { shape = 'rounded', caption = '', outline = true } = {}) {
  const S = STICKER_SIZE;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const framed = shape !== 'full';
  const border = framed && outline ? Math.round(S * 0.035) : 0;
  const pad = framed ? Math.round(S * 0.04) : 0;
  const inner = S - 2 * pad;

  if (border) {
    // White outline with a soft shadow, drawn under the picture.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = S * 0.02;
    ctx.shadowOffsetY = S * 0.006;
    ctx.fillStyle = '#ffffff';
    shapePath(ctx, shape, pad, pad, inner);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  shapePath(ctx, shape, pad + border, pad + border, inner - 2 * border);
  ctx.clip();
  ctx.drawImage(image, pad + border, pad + border, inner - 2 * border, inner - 2 * border);
  ctx.restore();

  const text = String(caption || '').trim();
  if (text) {
    const fontSize = Math.round(S * 0.1);
    ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const lines = wrapCaption(ctx, text, S * 0.84);
    const lineH = fontSize * 1.1;
    let y = S - pad - border - S * 0.05 - (lines.length - 1) * lineH;
    for (const line of lines) {
      ctx.lineWidth = fontSize * 0.22;
      ctx.strokeStyle = '#111111';
      ctx.strokeText(line, S / 2, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, S / 2, y);
      y += lineH;
    }
  }
  return canvas;
}

/** The canvas as a WebP Blob, or PNG where WebP can't be written. */
export function canvasToStickerBlob(canvas) {
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));
  return toBlob('image/webp', 0.9).then((b) => (b && b.type === 'image/webp' ? b : toBlob('image/png'))).then((b) => {
    if (!b) throw new Error('Could not make the sticker');
    return b;
  });
}

/** Loads a Blob into an <img> that's ready to draw. */
export function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const done = () => resolve(img);
      (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(done);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That picture could not be read'));
    };
    img.src = url;
  });
}

/** A File for the finished sticker, with a sensible name. */
export function stickerFile(blob, name = 'sticker') {
  const ext = blob.type === 'image/webp' ? 'webp' : 'png';
  const base = String(name || 'sticker').replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'sticker';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

/** Sticker display box: stickers show at most `max` px, keeping their shape. */
export function stickerBox(width, height, max = 160) {
  const w = Number(width) || max;
  const h = Number(height) || max;
  const scale = Math.min(max / w, max / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
