// The signed-in person's sticker library (server: /api/v2/stickers), the same one the web and
// desktop apps use (client/src/features/stickers/stickerStore.js). Loaded once, kept in memory.
import { useEffect, useSyncExternalStore } from 'react';
import { api, request } from '../../data/live/http.js';
import { postMultipart } from '../../data/live/attachments.js';
import { prefs } from '../../native/storage.js';

let state = { status: 'idle', stickers: [], giphy: false, aiImages: false, error: null };
const listeners = new Set();
let inflight = null;

function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}

export function loadStickers({ force = false } = {}) {
  if (inflight) return inflight;
  if (state.status === 'ready' && !force) return Promise.resolve(state);
  if (state.status !== 'ready') set({ status: 'loading', error: null });
  inflight = api
    .get('/v2/stickers')
    .then((data) => set({ status: 'ready', stickers: data?.stickers || [], giphy: !!data?.giphy, aiImages: !!data?.aiImages, error: null }))
    .catch((err) => set({ status: state.status === 'ready' ? 'ready' : 'error', error: err?.message || 'Stickers could not be loaded.' }))
    .finally(() => {
      inflight = null;
    });
  return inflight.then(() => state);
}

/** { status, stickers, giphy, error }; loads the library on first use. */
export function useStickers() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  useEffect(() => {
    loadStickers();
  }, []);
  return snap;
}

const prepend = (sticker) => set((s) => ({ stickers: [sticker, ...s.stickers.filter((x) => x.id !== sticker.id)] }));

/** Packs in the order their newest sticker was added. */
export function groupByPack(stickers) {
  const packs = new Map();
  for (const s of stickers || []) {
    const name = s.pack || 'My stickers';
    if (!packs.has(name)) packs.set(name, []);
    packs.get(name).push(s);
  }
  return [...packs.entries()].map(([name, items]) => ({ name, items }));
}

/** Saves a picture from a message (sticker, GIF or photo). Resolves { sticker, existed }. */
export async function saveFromAttachment(a, { pack } = {}) {
  const data = await api.post('/v2/stickers', { url: a?.url, pack, width: a?.width || undefined, height: a?.height || undefined });
  if (data?.sticker) prepend(data.sticker);
  return data;
}

/** Adds a picture from this phone (made from a photo, or a GIF/WebP/PNG as is). */
export async function uploadSticker(file, { pack, width, height, made = false } = {}) {
  const data = await postMultipart('/api/v2/stickers/upload', () => {
    const form = new FormData();
    form.append('file', file, file.name || 'sticker');
    if (pack) form.append('pack', pack);
    if (width) form.append('width', String(width));
    if (height) form.append('height', String(height));
    if (made) form.append('made', 'true');
    return form;
  });
  prepend(data.sticker);
  return data.sticker;
}

export async function removeSticker(id) {
  const before = state.stickers;
  set((s) => ({ stickers: s.stickers.filter((x) => x.id !== id) }));
  try {
    await api.del(`/v2/stickers/${id}`);
  } catch (err) {
    set({ stickers: before });
    throw err;
  }
}

export async function removePack(name) {
  await request('DELETE', '/v2/stickers/packs', { query: { name } });
  set((s) => ({ stickers: s.stickers.filter((x) => x.pack !== name) }));
}

/** GIPHY search (trending when q is empty). kind: gifs | stickers. Resolves { results, next }. */
export function searchGiphy(q, kind = 'gifs', offset = 0) {
  return api.get('/v2/stickers/giphy', { q, kind, offset });
}

/** Copies a GIPHY result to the server; resolves { attachment, sticker? }. */
export async function fromGiphy(id, kind = 'gifs', { save = false } = {}) {
  const data = await api.post('/v2/stickers/giphy', { id, kind, save });
  if (data?.sticker) prepend(data.sticker);
  return data;
}

/** Can this attachment be kept as a sticker (a still or animated picture)? */
export const canSaveAsSticker = (a) =>
  !!a?.url && a.type === 'image' && /^image\/(png|jpe?g|webp|gif)$/i.test(a.mimeType || 'image/png');

// ---------------------------------------------------------------- AI pictures

/** Looks for "turn me into…" (server: stickers/aiImage.js STYLES). */
export const AI_LOOKS = [
  { id: 'cat', label: 'Cat', emoji: '🐱' },
  { id: 'dog', label: 'Dog', emoji: '🐶' },
  { id: 'lion', label: 'Lion', emoji: '🦁' },
  { id: 'panda', label: 'Panda', emoji: '🐼' },
  { id: 'monkey', label: 'Monkey', emoji: '🐵' },
  { id: 'bunny', label: 'Bunny', emoji: '🐰' },
  { id: 'fox', label: 'Fox', emoji: '🦊' },
  { id: 'owl', label: 'Owl', emoji: '🦉' },
];

/** Gemini edits the photo into the look; resolves a File with the new picture. */
export async function makeAiPicture(photo, { style, prompt } = {}) {
  const data = await postMultipart('/api/v2/stickers/ai-image', () => {
    const form = new FormData();
    form.append('file', photo, photo.name || 'photo.jpg');
    form.append('style', style);
    if (prompt) form.append('prompt', prompt);
    return form;
  });
  const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
  const ext = /png/.test(data.mimeType) ? 'png' : /webp/.test(data.mimeType) ? 'webp' : 'jpg';
  return { file: new File([bytes], `ai-${style}.${ext}`, { type: data.mimeType }), used: data.used ?? null, max: data.max ?? null };
}

// ---------------------------------------------------------------- recent

const RECENT_KEY = 'stickers.recent';
const RECENT_MAX = 16;

/** Remember a sticker was just sent (newest first, this device only). */
export function noteStickerUsed(id) {
  if (!id) return;
  const list = (prefs.get(RECENT_KEY, []) || []).filter((x) => x !== id);
  prefs.set(RECENT_KEY, [id, ...list].slice(0, RECENT_MAX));
  set({}); // let the sheet re-read the list
}

/** Recently sent stickers that are still in the library. */
export function recentStickers(stickers) {
  const byId = new Map((stickers || []).map((s) => [s.id, s]));
  return (prefs.get(RECENT_KEY, []) || []).map((id) => byId.get(id)).filter(Boolean);
}

// ---------------------------------------------------------------- packs

/** Move one sticker to another pack (created when it doesn't exist yet). */
export async function moveSticker(id, pack) {
  const data = await api.patch(`/v2/stickers/${id}`, { pack });
  if (data?.sticker) set((s) => ({ stickers: s.stickers.map((x) => (x.id === id ? data.sticker : x)) }));
  return data?.sticker;
}

export async function renamePack(from, to) {
  await api.patch('/v2/stickers/packs', { from, to });
  await loadStickers({ force: true });
}

// ---------------------------------------------------------------- import

const IMAGE_EXT = /\.(webp|png|gif|jpe?g)$/i;
const MIME = { webp: 'image/webp', png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/**
 * Stickers from files: pictures as they are, and sticker-pack archives (.zip, WhatsApp's
 * .wastickers) unpacked. The pack's name comes from its title.txt when there is one.
 * Resolves [{ file, pack }] ready for uploadSticker; tray icons are skipped.
 */
export async function filesToImport(files) {
  const out = [];
  for (const f of files || []) {
    if (/\.(zip|wastickers)$/i.test(f.name) || /zip/i.test(f.type)) {
      const { unzipSync, strFromU8 } = await import('fflate');
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
      const names = Object.keys(entries);
      const title = names.find((n) => /(^|\/)title\.txt$/i.test(n));
      const pack = (title ? strFromU8(entries[title]).trim() : f.name.replace(/\.(zip|wastickers)$/i, '')).slice(0, 40) || 'Imported';
      for (const n of names) {
        if (!IMAGE_EXT.test(n) || /(^|\/)(tray|icon)[^/]*$/i.test(n) || n.startsWith('__MACOSX')) continue;
        const ext = n.split('.').pop().toLowerCase();
        out.push({ file: new File([entries[n]], n.split('/').pop(), { type: MIME[ext] || 'image/webp' }), pack });
      }
    } else if (/^image\//.test(f.type) || IMAGE_EXT.test(f.name)) {
      out.push({ file: f, pack: null });
    }
  }
  return out;
}

/** Upload a batch; resolves { added, failed }. `onProgress(done, total)`. */
export async function importStickers(items, { pack, onProgress } = {}) {
  let added = 0;
  let failed = 0;
  for (const [i, it] of items.entries()) {
    try {
      await uploadSticker(it.file, { pack: it.pack || pack || 'Imported' });
      added += 1;
    } catch {
      failed += 1;
    }
    onProgress?.(i + 1, items.length);
  }
  return { added, failed };
}

// ---------------------------------------------------------------- copy / save

/** The sticker's picture as a PNG blob (the clipboard only takes PNG). */
async function pngBlob(url) {
  const blob = await (await fetch(url)).blob();
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext('2d').drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not copy'))), 'image/png'));
}

/** Copy the picture so it can be pasted into another app. Resolves true when it worked. */
export async function copyStickerImage(url) {
  if (!url || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(url) })]);
    return true;
  } catch {
    return false;
  }
}

export function __resetStickersForTests() {
  state = { status: 'idle', stickers: [], giphy: false, aiImages: false, error: null };
  inflight = null;
}
