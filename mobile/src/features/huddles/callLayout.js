// Pure layout rules for the call screen on phones and tablets (no React, no DOM), tested on their own.
//
// The screen is one of these views:
//   solo     just me, full size
//   duo      a 1:1 call: the other person full size, me in a small corner window
//   grid     everyone in equal tiles, a page at a time (swipe for more pages, never dropping anyone)
//   speaker  whoever is talking large, everyone else in a filmstrip
//   stage    a pinned person, or a shared screen, large with a filmstrip
// Every size here is in CSS pixels; rects are { x, y, w, h } inside the stage area.

export const GAP = 8;
/** Used when the stage hasn't been measured yet (tests, the first frame). */
export const FALLBACK_SIZE = { width: 360, height: 640 };

function size({ width, height } = {}) {
  return width > 0 && height > 0 ? { width, height } : FALLBACK_SIZE;
}

/** 'portrait' | 'landscape'. A square stage counts as landscape. */
export const orientationOf = (width, height) => (width >= height ? 'landscape' : 'portrait');

/** A tablet-sized stage (both sides at least this) fits more tiles per page. */
export const LARGE_STAGE = 600;

const isLarge = ({ width, height }) => Math.min(width, height) >= LARGE_STAGE;

/** How many tiles one grid page holds: 6 on a phone (2×3 or 3×2), 12 on a tablet. */
export function pageCapacity(stage) {
  return isLarge(size(stage)) ? 12 : 6;
}

/**
 * Columns and rows for `count` tiles on one page.
 *   phone portrait:  1 → 1×1, 2 → stacked 1×2, 3–4 → 2×2, 5–6 → 2×3
 *   phone landscape: 1 → 1×1, 2 → 2×1, 3 → 3×1, 4 → 2×2, 5–6 → 3×2
 *   tablets add 7–9 → 3×3 and 10–12 → 3×4 (portrait) or 4×3 (landscape).
 */
export function gridShape(count, stage) {
  const s = size(stage);
  const n = Math.max(1, Math.min(count, pageCapacity(s)));
  const landscape = orientationOf(s.width, s.height) === 'landscape';
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return landscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
  if (n === 3 && landscape) return { cols: 3, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return landscape ? { cols: 4, rows: 3 } : { cols: 3, rows: 4 };
}

/** Number of grid pages for `count` people. */
export function pageCount(count, stage) {
  return Math.max(1, Math.ceil(Math.max(0, count) / pageCapacity(stage)));
}

/** A page index kept inside 0…pages-1 (after people leave or the phone turns). */
export function clampPage(page, count, stage) {
  const last = pageCount(count, stage) - 1;
  return Math.min(Math.max(0, Math.floor(page) || 0), last);
}

/**
 * The grid for one page: which people it shows (start…end of the ordered list) and where each
 * tile goes. A short last row is centred.
 */
export function gridLayout({ width, height, count, page = 0, gap = GAP }) {
  const s = size({ width, height });
  const capacity = pageCapacity(s);
  const pages = pageCount(count, s);
  const current = clampPage(page, count, s);
  const start = current * capacity;
  const onPage = Math.max(0, Math.min(capacity, count - start));
  const { cols, rows } = gridShape(onPage || 1, s);
  const tileWidth = (s.width - gap * (cols - 1)) / cols;
  const tileHeight = (s.height - gap * (rows - 1)) / rows;
  const rects = [];
  for (let i = 0; i < onPage; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? onPage - row * cols : cols;
    const shift = ((cols - inRow) * (tileWidth + gap)) / 2;
    rects.push({ x: shift + col * (tileWidth + gap), y: row * (tileHeight + gap), w: tileWidth, h: tileHeight });
  }
  return { cols, rows, tileWidth, tileHeight, capacity, pageCount: pages, page: current, start, end: start + onPage, rects };
}

/**
 * One person large with a filmstrip of `stripCount` others: along the bottom in portrait, down
 * the right side in landscape. With nobody in the strip the stage takes everything.
 */
export function stageLayout({ width, height, stripCount = 0, gap = GAP }) {
  const s = size({ width, height });
  if (stripCount <= 0) {
    return { stage: { x: 0, y: 0, w: s.width, h: s.height }, strip: null, item: null, direction: null };
  }
  if (orientationOf(s.width, s.height) === 'portrait') {
    const stripH = Math.round(Math.min(120, Math.max(84, s.height * 0.16)));
    const item = { w: Math.round(stripH * 0.85), h: stripH };
    return {
      stage: { x: 0, y: 0, w: s.width, h: s.height - stripH - gap },
      strip: { x: 0, y: s.height - stripH, w: s.width, h: stripH },
      item,
      direction: 'row',
    };
  }
  const stripW = Math.round(Math.min(180, Math.max(110, s.width * 0.2)));
  const item = { w: stripW, h: Math.round(stripW * 0.75) };
  return {
    stage: { x: 0, y: 0, w: s.width - stripW - gap, h: s.height },
    strip: { x: s.width - stripW, y: 0, w: stripW, h: s.height },
    item,
    direction: 'column',
  };
}

/**
 * Which filmstrip items are on screen (plus `buffer` either side) for a scroll offset, as
 * [start, end): only these attach video.
 */
export function stripVisibleRange({ offset = 0, viewport, itemSize, gap = GAP, count, buffer = 1 }) {
  if (count <= 0) return [0, 0];
  if (!(viewport > 0) || !(itemSize > 0)) return [0, Math.min(count, 1 + buffer)];
  const step = itemSize + gap;
  const first = Math.floor(Math.max(0, offset) / step);
  const last = Math.ceil((Math.max(0, offset) + viewport) / step);
  return [Math.min(count - 1, Math.max(0, first - buffer)), Math.min(count, last + buffer)];
}

/**
 * Which view to show.
 *   mode: null (automatic), 'grid' or 'speaker' (the person's choice).
 *   pinnedId: someone pinned large. sharingId: someone sharing a screen (takes the stage unless
 *   the person went back to everyone).
 * Returns { kind, focusId } with kind solo | duo | grid | speaker | stage.
 */
export function resolveView({ count, mode = null, pinnedId = null, sharingId = null }) {
  if (count <= 1) return { kind: 'solo', focusId: null };
  if (pinnedId) return { kind: 'stage', focusId: pinnedId };
  if (sharingId) return { kind: 'stage', focusId: sharingId };
  if (mode === 'grid') return { kind: 'grid', focusId: null };
  if (count === 2) return { kind: 'duo', focusId: null };
  if (mode === 'speaker') return { kind: 'speaker', focusId: null };
  return { kind: 'grid', focusId: null };
}

/**
 * The order of the grid: someone sharing first, then cameras on, then everyone else (each in the
 * order they joined), with me placed on the first page so I always see myself.
 */
export function orderForGrid(participants, { capacity = 6 } = {}) {
  const list = participants || [];
  const rank = (p) => (p.sharing ? 0 : p.videoEnabled ? 1 : 2);
  const others = list.filter((p) => !p.isLocal).sort((a, b) => rank(a) - rank(b));
  const me = list.find((p) => p.isLocal);
  if (!me) return others;
  const at = Math.min(Math.max(0, capacity - 1), others.length);
  return [...others.slice(0, at), me, ...others.slice(at)];
}

/**
 * The active speaker for the speaker view and the minimised call: someone else who is talking
 * (keeping the current one while they still talk, so it doesn't flicker), else whoever it was,
 * else someone with their camera on, else the first other person, else me.
 */
export function pickSpeaker(participants, speaking = {}, previousId = null) {
  const list = participants || [];
  const others = list.filter((p) => !p.isLocal);
  if (!others.length) return list[0]?.userId ?? null;
  const prev = others.find((p) => p.userId === previousId);
  if (prev && speaking[prev.userId]) return prev.userId;
  const talking = others.find((p) => speaking[p.userId]);
  if (talking) return talking.userId;
  if (prev) return prev.userId;
  return (others.find((p) => p.videoEnabled) || others[0]).userId;
}

/** The page holding `index` of the ordered list. */
export const pageOf = (index, stage) => (index < 0 ? -1 : Math.floor(index / pageCapacity(stage)));

/** Where a self-view window of size box sits in a corner ('tl' | 'tr' | 'bl' | 'br') of the area. */
export function cornerPosition(corner, box, area, margin = 12) {
  const a = size(area);
  const left = corner.endsWith('l') ? margin : a.width - box.w - margin;
  const top = corner.startsWith('t') ? margin : a.height - box.h - margin;
  return { x: Math.max(0, left), y: Math.max(0, top) };
}

/** The nearest corner to a window dropped at (x, y) (its top-left) in the area. */
export function nearestCorner({ x, y }, box, area) {
  const a = size(area);
  const cx = x + box.w / 2;
  const cy = y + box.h / 2;
  return `${cy < a.height / 2 ? 't' : 'b'}${cx < a.width / 2 ? 'l' : 'r'}`;
}

/** The self-view window in a 1:1 call: a little phone-shaped box, wider when the stage is landscape. */
export function selfViewSize(stage) {
  const s = size(stage);
  const short = Math.round(Math.min(120, Math.max(84, Math.min(s.width, s.height) * 0.28)));
  const long = Math.round(short * 1.34);
  return orientationOf(s.width, s.height) === 'portrait' ? { w: short, h: long } : { w: long, h: short };
}
