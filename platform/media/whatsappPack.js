// Getting stickers ready for WhatsApp's sticker packs: 512 × 512 WebP under 100 KB each, a
// 96 × 96 PNG tray icon under 50 KB, 3 to 30 stickers per pack, still and animated not mixed.
// Pictures are fitted into the square on a transparent background (never stretched).
// https://github.com/WhatsApp/stickers/tree/main/Android

export const WA_SIZE = 512;
export const WA_TRAY = 96;
export const WA_MAX_BYTES = 100 * 1024;
export const WA_TRAY_MAX_BYTES = 50 * 1024;
export const WA_MIN = 3;
export const WA_MAX = 30;

/** A pack id WhatsApp accepts ([A-Za-z0-9._-]), stable for the same pack name. */
export function packIdentifier(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
  const slug = String(name || 'pack').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'pack';
  return `oruinwan_${slug}_${(h >>> 0).toString(36)}`;
}

/** Is this an animation (a GIF, or an animated WebP)? Those can't join a still pack. */
export async function isAnimated(blob) {
  if (/gif/i.test(blob?.type || '')) return true;
  if (!/webp/i.test(blob?.type || '')) return false;
  const head = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const text = String.fromCharCode(...head);
  return text.includes('ANIM') || (text.includes('VP8X') && (head[20] & 0x02) !== 0);
}

function fit(img, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const k = Math.min(size / w, size / h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
  return c;
}

const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));

/** One still sticker for WhatsApp: a WebP blob under the limit (quality lowered until it fits). */
export async function waSticker(img) {
  const c = fit(img, WA_SIZE);
  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const b = await toBlob(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') throw new Error("This phone can't make WebP stickers");
    if (b.size <= WA_MAX_BYTES) return b;
  }
  throw new Error('A sticker is too detailed for WhatsApp');
}

/** The tray icon (the pack's little picture in WhatsApp). */
export async function waTray(img) {
  const b = await toBlob(fit(img, WA_TRAY), 'image/png');
  if (!b || b.size > WA_TRAY_MAX_BYTES) throw new Error("Couldn't make the pack icon");
  return b;
}

/** Blob → base64 (no data: prefix), for the native side. */
export async function base64Of(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
