import { useEffect, useSyncExternalStore } from 'react';
import api from '@services/api';

/**
 * The signed-in person's sticker library (server: /api/v2/stickers), shared by the composer's
 * sticker picker, the sticker maker and the "Save sticker" message action. Loaded once and
 * kept in memory; every change updates it in place.
 */

let state = { status: 'idle', stickers: [], giphy: false, error: null };
const listeners = new Set();
let inflight = null;

function set(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    listeners.forEach((l) => l());
}

const errorText = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

export function loadStickers({ force = false } = {}) {
    if (inflight) return inflight;
    if (state.status === 'ready' && !force) return Promise.resolve(state);
    if (state.status !== 'ready') set({ status: 'loading', error: null });
    inflight = api.get('/api/v2/stickers')
        .then(({ data }) => set({ status: 'ready', stickers: data?.stickers || [], giphy: !!data?.giphy, error: null }))
        .catch((err) => set({ status: state.status === 'ready' ? 'ready' : 'error', error: errorText(err, 'Stickers could not be loaded') }))
        .finally(() => { inflight = null; });
    return inflight.then(() => state);
}

/** { status, stickers, giphy, error }; loads the library on first use. */
export function useStickers() {
    const snap = useSyncExternalStore(
        (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        () => state,
    );
    useEffect(() => { loadStickers(); }, []);
    return snap;
}

const prepend = (sticker) => set((s) => ({ stickers: [sticker, ...s.stickers.filter((x) => x.id !== sticker.id)] }));

/** Packs in the order their newest sticker was added, each with its stickers. */
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
export async function saveFromAttachment(attachment, { pack } = {}) {
    try {
        const { data } = await api.post('/api/v2/stickers', {
            url: attachment?.url, pack, width: attachment?.width, height: attachment?.height,
        });
        if (data?.sticker) prepend(data.sticker);
        return data;
    } catch (err) {
        throw new Error(errorText(err, 'The sticker could not be saved'));
    }
}

/** Adds a picture from this device (made from a photo, or a GIF/WebP/PNG as is). */
export async function uploadSticker(file, { pack, width, height, made = false } = {}) {
    const form = new FormData();
    form.append('file', file, file.name || 'sticker');
    if (pack) form.append('pack', pack);
    if (width) form.append('width', String(width));
    if (height) form.append('height', String(height));
    if (made) form.append('made', 'true');
    try {
        const { data } = await api.post('/api/v2/stickers/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        prepend(data.sticker);
        return data.sticker;
    } catch (err) {
        throw new Error(errorText(err, 'The sticker could not be added'));
    }
}

export async function removeSticker(id) {
    const before = state.stickers;
    set((s) => ({ stickers: s.stickers.filter((x) => x.id !== id) }));
    try {
        await api.delete(`/api/v2/stickers/${id}`);
    } catch (err) {
        set({ stickers: before });
        throw new Error(errorText(err, 'The sticker could not be removed'));
    }
}

export async function moveToPack(id, pack) {
    const { data } = await api.patch(`/api/v2/stickers/${id}`, { pack });
    set((s) => ({ stickers: s.stickers.map((x) => (x.id === id ? data.sticker : x)) }));
    return data.sticker;
}

export async function renamePack(from, to) {
    await api.patch('/api/v2/stickers/packs', { from, to });
    const name = String(to || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'My stickers';
    set((s) => ({ stickers: s.stickers.map((x) => (x.pack === from ? { ...x, pack: name } : x)) }));
}

export async function removePack(name) {
    await api.delete('/api/v2/stickers/packs', { params: { name } });
    set((s) => ({ stickers: s.stickers.filter((x) => x.pack !== name) }));
}

/** GIPHY search (trending when q is empty). kind: gifs | stickers. Resolves { results, next }. */
export async function searchGiphy(q, kind = 'gifs', offset = 0, signal) {
    try {
        const { data } = await api.get('/api/v2/stickers/giphy', { params: { q, kind, offset }, signal });
        return data;
    } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
        throw new Error(errorText(err, 'GIF search failed'));
    }
}

/** Copies a GIPHY result to the server; resolves { attachment, sticker? }. */
export async function fromGiphy(id, kind = 'gifs', { save = false } = {}) {
    try {
        const { data } = await api.post('/api/v2/stickers/giphy', { id, kind, save });
        if (data?.sticker) prepend(data.sticker);
        return data;
    } catch (err) {
        throw new Error(errorText(err, 'That GIF could not be sent'));
    }
}

/** Is this message's image a sticker or GIF (shown without a frame)? */
export const isStickerAttachment = (a) => a?.variant === 'sticker';
export const isGifAttachment = (a) => a?.variant === 'gif' || /^image\/gif$/i.test(a?.mimeType || '');

export function __resetStickersForTests() {
    state = { status: 'idle', stickers: [], giphy: false, error: null };
    inflight = null;
}
