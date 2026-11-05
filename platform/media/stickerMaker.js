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
/** Behind a cut-out: nothing (transparent), a colour, or a picture. */
export const STICKER_BACKGROUNDS = ['none', 'color', 'image'];
export const BACKGROUND_COLORS = ['#ffffff', '#111111', '#f5c46b', '#f39a6b', '#f87171', '#f9a8d4', '#a78bfa', '#93c5fd', '#86efac', '#fde68a'];

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

/** Caption at the bottom: white, heavy, with a dark edge so it reads on any picture. */
function drawCaption(ctx, caption, S, bottom) {
  const text = String(caption || '').trim();
  if (!text) return;
  const fontSize = Math.round(S * 0.1);
  ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const lines = wrapCaption(ctx, text, S * 0.84);
  const lineH = fontSize * 1.1;
  let y = S - bottom - (lines.length - 1) * lineH;
  for (const line of lines) {
    ctx.lineWidth = fontSize * 0.22;
    ctx.strokeStyle = '#111111';
    ctx.strokeText(line, S / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, S / 2, y);
    y += lineH;
  }
}

const sizeOf = (img) => ({ w: img.naturalWidth || img.videoWidth || img.width, h: img.naturalHeight || img.videoHeight || img.height });

/** Draw `img` to cover a box (like CSS object-fit: cover). */
function drawCover(ctx, img, x, y, w, h) {
  const { w: iw, h: ih } = sizeOf(img);
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * A cut-out sticker: only the subject (the mask's kept part), sized to fill the sticker, with a
 * white outline that follows its shape, over nothing, a colour or a picture.
 * `maskImage` is a canvas the size of `image` whose alpha says what to keep (cutout.maskCanvas).
 */
function drawCutout(canvas, image, { maskImage, box, caption, outline, background }) {
  const S = STICKER_SIZE;
  const ctx = canvas.getContext('2d');
  const { w: N } = sizeOf(image);
  // The subject alone, at the picture's size.
  const subject = document.createElement('canvas');
  subject.width = N;
  subject.height = N;
  const sctx = subject.getContext('2d');
  sctx.drawImage(image, 0, 0, N, N);
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(maskImage, 0, 0, N, N);

  // Fit the subject's box into the sticker, leaving room for the outline.
  const ring = outline ? Math.round(S * 0.03) : 0;
  const pad = Math.round(S * 0.04) + ring;
  const b = box || { x: 0, y: 0, w: N, h: N };
  const scale = Math.min((S - 2 * pad) / b.w, (S - 2 * pad) / b.h);
  const dw = b.w * scale;
  const dh = b.h * scale;
  const dx = (S - dw) / 2;
  const dy = (S - dh) / 2;

  const kind = background?.kind || 'none';
  if (kind !== 'none') {
    const inset = Math.round(S * 0.02);
    ctx.save();
    shapePath(ctx, 'rounded', inset, inset, S - 2 * inset);
    ctx.clip();
    if (kind === 'image' && background.image) drawCover(ctx, background.image, inset, inset, S - 2 * inset, S - 2 * inset);
    else {
      ctx.fillStyle = background.color || '#ffffff';
      ctx.fillRect(0, 0, S, S);
    }
    ctx.restore();
  }

  if (ring) {
    // A white silhouette drawn all around the subject makes the outline; a soft shadow under it.
    const white = document.createElement('canvas');
    white.width = S;
    white.height = S;
    const wctx = white.getContext('2d');
    wctx.drawImage(subject, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
    wctx.globalCompositeOperation = 'source-in';
    wctx.fillStyle = '#ffffff';
    wctx.fillRect(0, 0, S, S);
    ctx.save();
    if (kind === 'none') {
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = S * 0.02;
      ctx.shadowOffsetY = S * 0.006;
    }
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(white, Math.cos(a) * ring, Math.sin(a) * ring);
    }
    ctx.restore();
  }
  ctx.drawImage(subject, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
  drawCaption(ctx, caption, S, Math.round(S * 0.07));
  return canvas;
}

/**
 * Draws the sticker into `canvas` (resized to STICKER_SIZE). `image` is the square crop (an
 * <img>, ImageBitmap or canvas). Options: { shape: rounded | circle | full, caption, outline }.
 * With `maskImage` (a cut-out) it draws only the subject, over `background`
 * ({ kind: none | color | image, color, image }); `box` is the subject's box in `image` pixels.
 */
export function drawSticker(canvas, image, { shape = 'rounded', caption = '', outline = true, maskImage = null, box = null, background = null } = {}) {
  const S = STICKER_SIZE;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  if (maskImage) return drawCutout(canvas, image, { maskImage, box, caption, outline, background });
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

  drawCaption(ctx, caption, S, pad + border + S * 0.05);
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
