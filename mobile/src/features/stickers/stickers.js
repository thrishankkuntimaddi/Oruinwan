// The signed-in person's sticker library (server: /api/v2/stickers), the same one the web and
// desktop apps use (client/src/features/stickers/stickerStore.js). Loaded once, kept in memory.
import { useEffect, useSyncExternalStore } from 'react';
import { api, request } from '../../data/live/http.js';
import { postMultipart } from '../../data/live/attachments.js';

let state = { status: 'idle', stickers: [], giphy: false, error: null };
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
    .then((data) => set({ status: 'ready', stickers: data?.stickers || [], giphy: !!data?.giphy, error: null }))
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

export function __resetStickersForTests() {
  state = { status: 'idle', stickers: [], giphy: false, error: null };
  inflight = null;
}
