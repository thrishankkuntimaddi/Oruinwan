/**
 * Call layout math: pure functions, no React, no DOM.
 *
 *  - Grid: pick the columns × rows that give the biggest tiles for the stage, keep tiles
 *    at 16:9 (4:3 or 1:1 allowed on narrow / portrait stages) so they never overflow, and
 *    page the people once a page would make tiles too small.
 *  - Stage (speaker, pinned, screen share): one big tile plus a scrollable filmstrip.
 *  - Duo (1:1 call): the other person fills the stage, I am a small corner tile.
 */

export const GAP = 10;
const WIDE = 16 / 9;

/** Most tiles on one page, per kind of device. */
export const PAGE_CAPS = { desktop: 16, tablet: 9, narrow: 6 };
/** Tiles narrower than this are too small to recognise anyone: page instead. */
export const MIN_TILE_W = { desktop: 160, tablet: 150, narrow: 120 };
const MIN_TILE_H = 72;

/** 'narrow' (phone-sized), 'tablet' (touch or medium window) or 'desktop'. */
export function deviceClassFor({ width = 1280, coarse = false } = {}) {
    if (width < 640) return 'narrow';
    if (coarse || width < 1100) return 'tablet';
    return 'desktop';
}

/** Tile shapes allowed on a stage: 16:9 always; squarer shapes on narrow or portrait stages. */
export function aspectsFor(width, height) {
    if (!(width > 0) || !(height > 0)) return [WIDE];
    const r = width / height;
    if (r < 1.3) return [WIDE, 4 / 3, 1];
    return [WIDE];
}

/**
 * The cols × rows (and tile size) that fit `n` tiles in width × height with the largest
 * tiles. Tile sizes are whole pixels and always fit: cols·w + gaps ≤ width, rows·h + gaps ≤ height.
 */
export function bestGrid(width, height, n, { gap = GAP, aspects = aspectsFor(width, height) } = {}) {
    const w = Math.max(0, width || 0);
    const h = Math.max(0, height || 0);
    if (n <= 0) return { cols: 0, rows: 0, tileW: 0, tileH: 0, aspect: WIDE };
    let best = null;
    for (let cols = 1; cols <= n; cols += 1) {
        const rows = Math.ceil(n / cols);
        // A column that would stay empty is never better.
        if (cols > 1 && Math.ceil(n / (cols - 1)) === rows) continue;
        const cellW = (w - gap * (cols - 1)) / cols;
        const cellH = (h - gap * (rows - 1)) / rows;
        if (cellW <= 0 || cellH <= 0) continue;
        for (const aspect of aspects) {
            const tileW = Math.floor(Math.min(cellW, cellH * aspect));
            const tileH = Math.floor(tileW / aspect);
            // 16:9 is preferred; a squarer tile has to be clearly bigger to win.
            const score = tileW * tileH * (aspect === WIDE ? 1 : 0.85);
            if (!best || score > best.score) best = { cols, rows, tileW, tileH, aspect, score };
        }
    }
    if (!best) return { cols: Math.min(n, 1), rows: n, tileW: 0, tileH: 0, aspect: WIDE };
    const { score: _score, ...grid } = best;
    return grid;
}

/** How many tiles fit on one page of this stage. */
export function perPageFor(width, height, device = 'desktop', { gap = GAP } = {}) {
    let cap = PAGE_CAPS[device] || PAGE_CAPS.desktop;
    // A short phone stage (landscape) holds fewer.
    if (device === 'narrow' && height < width * 1.3) cap = 4;
    const minW = MIN_TILE_W[device] || MIN_TILE_W.desktop;
    for (let n = cap; n > 1; n -= 1) {
        const g = bestGrid(width, height, n, { gap });
        if (g.tileW >= minW && g.tileH >= MIN_TILE_H) return n;
    }
    return 1;
}

/**
 * The grid for `count` people on `page`: { cols, rows, tileW, tileH, perPage, pages, page,
 * start, end }. The page is clamped, so people leaving never strand you on an empty page.
 */
export function gridLayout({ width, height, count, device = 'desktop', page = 0, gap = GAP }) {
    const total = Math.max(0, count | 0);
    const perPage = Math.max(1, Math.min(total || 1, perPageFor(width, height, device, { gap })));
    const pages = Math.max(1, Math.ceil(total / perPage));
    const p = Math.min(Math.max(0, page | 0), pages - 1);
    const start = p * perPage;
    const end = Math.min(total, start + perPage);
    const grid = bestGrid(width, height, end - start, { gap });
    return { kind: 'grid', ...grid, perPage, pages, page: p, start, end, width: gridWidth(grid, gap) };
}

/** The width of a grid's tiles plus gaps (so flex-wrap breaks after exactly `cols`). */
export function gridWidth({ cols, tileW }, gap = GAP) {
    return cols > 0 ? cols * tileW + (cols - 1) * gap : 0;
}

/**
 * One big tile plus a filmstrip of `stripCount` others. The strip goes to the right on wide
 * stages, below otherwise. Returns { strip: 'right'|'bottom'|null, mainW, mainH, thumbW, thumbH }.
 */
export function stageLayout({ width, height, stripCount, device = 'desktop', gap = GAP }) {
    const w = Math.max(0, width || 0);
    const h = Math.max(0, height || 0);
    if (!stripCount) return { kind: 'stage', strip: null, mainW: w, mainH: h, thumbW: 0, thumbH: 0, stripLength: 0 };
    if (w / Math.max(1, h) >= 1.5 && w >= 900) {
        const thumbW = clamp(Math.round(w * 0.16), 140, 220);
        const thumbH = Math.round(thumbW / WIDE);
        return { kind: 'stage', strip: 'right', mainW: Math.max(0, w - thumbW - gap), mainH: h, thumbW, thumbH, stripLength: h };
    }
    const [lo, hi] = device === 'narrow' ? [54, 90] : [64, 128];
    const thumbH = clamp(Math.round(h * 0.2), lo, hi);
    const thumbW = Math.round(thumbH * WIDE);
    return { kind: 'stage', strip: 'bottom', mainW: w, mainH: Math.max(0, h - thumbH - gap), thumbW, thumbH, stripLength: w };
}

/**
 * Which filmstrip tiles are on screen: { first, last } (inclusive), from the scroll offset.
 * Only those play video. `size` is a tile's length along the strip.
 */
export function filmstripWindow({ count, size, gap = GAP, scroll = 0, viewport = 0, overscan = 1 }) {
    if (count <= 0) return { first: 0, last: -1 };
    const step = Math.max(1, size + gap);
    if (!(viewport > 0)) return { first: 0, last: Math.min(count - 1, 5) };
    const first = Math.min(count - 1, Math.max(0, Math.floor(Math.max(0, scroll) / step) - overscan));
    const last = Math.min(count - 1, Math.ceil((Math.max(0, scroll) + viewport) / step) - 1 + overscan);
    return { first, last: Math.max(first, last) };
}

/** My small self-view in a 1:1 call. */
export function pipLayout({ width, height }) {
    const portrait = width > 0 && height > 0 && width / height < 0.9;
    const pipW = clamp(Math.round((width || 0) * (portrait ? 0.3 : 0.2)), 96, 240);
    const pipH = Math.round(pipW / (portrait ? 3 / 4 : WIDE));
    return { pipW, pipH };
}

export const PIP_CORNERS = ['tl', 'tr', 'bl', 'br'];

/** The corner nearest to where the self-view was dropped (centre x, y in the stage). */
export function nearestCorner(x, y, width, height) {
    return `${y < height / 2 ? 't' : 'b'}${x < width / 2 ? 'l' : 'r'}`;
}

/** -1 (next page: swiped left), 1 (previous page) or 0 for a touch swipe. */
export function swipeDirection(dx, dy, threshold = 50) {
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
    return dx < 0 ? -1 : 1;
}

/**
 * Who the speaker view (and the mini call) features: whoever is talking, else the last
 * speaker, else someone with video, else the first other person, else me.
 */
export function pickFeatured(participants, speaking, lastId) {
    const others = participants.filter(p => !p.isLocal);
    const talking = others.find(p => speaking.has(p.userId));
    if (talking) return talking;
    const last = lastId && participants.find(p => p.userId === lastId);
    if (last) return last;
    return others.find(p => p.videoEnabled) || others[0] || participants[0] || null;
}

/** The person sharing their screen (someone else's share comes first), or null. */
export function findSharer(participants, { localSharing = false } = {}) {
    return participants.find(p => !p.isLocal && p.screenSharing && p.videoEnabled)
        || (localSharing ? participants.find(p => p.isLocal) || null : null);
}

/**
 * What the stage shows, given the chosen view ('auto' | 'grid' | 'speaker') and pin:
 *  - a pinned person (or screen) is always on the main stage;
 *  - someone else's screen share takes the main stage unless "Grid" was chosen;
 *  - "Speaker" puts whoever talks on the main stage;
 *  - a 1:1 call ('auto') shows the other person full size and me in a corner;
 *  - otherwise the grid.
 * Returns { kind: 'grid' | 'stage' | 'duo', mainId, reason }.
 */
export function resolveView({ view = 'auto', pinnedId = null, participants = [], sharerId = null, speakerId = null }) {
    const has = id => id && participants.some(p => p.userId === id);
    if (has(pinnedId) && participants.length > 1) return { kind: 'stage', mainId: pinnedId, reason: 'pinned' };
    if (has(sharerId) && view !== 'grid') return { kind: 'stage', mainId: sharerId, reason: 'screen' };
    if (view === 'speaker' && participants.length > 1) {
        const other = participants.find(p => !p.isLocal);
        return { kind: 'stage', mainId: has(speakerId) ? speakerId : other?.userId, reason: 'speaker' };
    }
    if (view === 'auto' && participants.length === 2 && participants.some(p => p.isLocal)) {
        return { kind: 'duo', mainId: participants.find(p => !p.isLocal).userId, reason: 'duo' };
    }
    return { kind: 'grid', mainId: null, reason: 'grid' };
}

function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
}
