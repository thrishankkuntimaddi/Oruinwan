'use strict';

/**
 * GIPHY search for the sticker picker. The server calls GIPHY so the API key stays here;
 * the apps only get trimmed results. Nothing is offered unless GIPHY_API_KEY is set.
 * GIPHY_RATING (default pg-13) limits what search returns.
 */

const API = 'https://api.giphy.com/v1';
const KINDS = new Set(['gifs', 'stickers']);
// What we store when a GIF or sticker is sent (it is copied to our storage first).
const MAX_SEND_BYTES = 5 * 1024 * 1024;
const PAGE = 24;

const enabled = (env = process.env) => !!String(env.GIPHY_API_KEY || '').trim();
const kindOf = (k) => (KINDS.has(k) ? k : 'gifs');
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/** Only GIPHY's own media hosts are ever downloaded from. */
function isGiphyMediaUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && (u.hostname === 'giphy.com' || u.hostname.endsWith('.giphy.com'));
    } catch {
        return false;
    }
}

/** A small, animated preview for the picker grid. */
function previewOf(images = {}) {
    const r = images.fixed_width_small || images.fixed_width || images.preview_gif || images.original || {};
    const url = r.webp || r.url;
    if (!url || !isGiphyMediaUrl(url)) return null;
    return { url, width: num(r.width), height: num(r.height) };
}

/**
 * The rendition to store when it's sent: the best one under the size limit, WebP when GIPHY
 * has it (much smaller than GIF). Returns { url, width, height, mimeType } or null.
 */
function pickRendition(images = {}, kind = 'gifs') {
    const order = kind === 'stickers'
        ? ['original', 'fixed_width', 'fixed_width_small']
        : ['downsized_medium', 'original', 'fixed_width', 'downsized', 'fixed_width_small'];
    for (const name of order) {
        const r = images[name];
        if (!r) continue;
        const options = [
            r.webp && { url: r.webp, size: num(r.webp_size), mimeType: 'image/webp' },
            r.url && { url: r.url, size: num(r.size), mimeType: 'image/gif' },
        ].filter(Boolean);
        for (const o of options) {
            if (!isGiphyMediaUrl(o.url)) continue;
            if (o.size && o.size > MAX_SEND_BYTES) continue;
            return { url: o.url, mimeType: o.mimeType, width: num(r.width), height: num(r.height) };
        }
    }
    return null;
}

/** One search result, as the apps get it. */
function mapResult(item, kind) {
    if (!item || typeof item.id !== 'string') return null;
    const preview = previewOf(item.images);
    if (!preview) return null;
    const full = item.images?.original || {};
    return {
        id: item.id,
        kind: kindOf(kind),
        title: String(item.title || '').slice(0, 120),
        preview,
        width: num(full.width) || preview.width,
        height: num(full.height) || preview.height,
    };
}

async function getJson(path, params, { env = process.env, fetchImpl = fetch } = {}) {
    const qs = new URLSearchParams({ api_key: String(env.GIPHY_API_KEY || '').trim(), ...params });
    const res = await fetchImpl(`${API}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
        const err = new Error(res.status === 429 ? 'GIPHY is busy, try again in a minute' : 'GIPHY search failed');
        err.status = res.status === 429 ? 429 : 502;
        throw err;
    }
    return res.json();
}

/** Trending when q is empty. Returns { results, next } (next: offset of the next page, or null). */
async function search({ q = '', kind = 'gifs', offset = 0 } = {}, opts = {}) {
    const k = kindOf(kind);
    const env = opts.env || process.env;
    const query = String(q || '').trim().slice(0, 50);
    const start = Math.max(0, Math.min(4999, Number(offset) || 0));
    const params = { limit: String(PAGE), offset: String(start), rating: env.GIPHY_RATING || 'pg-13' };
    const body = query
        ? await getJson(`/${k}/search`, { ...params, q: query, lang: 'en' }, opts)
        : await getJson(`/${k}/trending`, params, opts);
    const results = (Array.isArray(body?.data) ? body.data : []).map((d) => mapResult(d, k)).filter(Boolean);
    const total = Number(body?.pagination?.total_count) || 0;
    const count = Number(body?.pagination?.count) || results.length;
    const next = count > 0 && start + count < Math.min(total || Infinity, 5000) ? start + count : null;
    return { results, next };
}

/** Downloads one GIF or sticker by its id. Returns { buffer, mimeType, width, height, title }. */
async function download(id, kind = 'gifs', opts = {}) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(id)) {
        throw Object.assign(new Error('Invalid GIPHY id'), { status: 400 });
    }
    const fetchImpl = opts.fetchImpl || fetch;
    const body = await getJson(`/gifs/${id}`, {}, opts);
    const item = body?.data;
    const rendition = pickRendition(item?.images, kindOf(kind));
    if (!rendition) throw Object.assign(new Error('That GIF is not available'), { status: 404 });
    const res = await fetchImpl(rendition.url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!res.ok) throw Object.assign(new Error('Could not fetch that GIF'), { status: 502 });
    const declared = Number(res.headers?.get?.('content-length'));
    if (declared > MAX_SEND_BYTES) throw Object.assign(new Error('That GIF is too large'), { status: 413 });
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_SEND_BYTES) throw Object.assign(new Error('That GIF is too large'), { status: 413 });
    return { buffer, mimeType: rendition.mimeType, width: rendition.width, height: rendition.height, title: String(item?.title || '') };
}

module.exports = { enabled, search, download, mapResult, pickRendition, previewOf, isGiphyMediaUrl, MAX_SEND_BYTES };
