/** Whiteboard stroke helpers (docType "whiteboard": Y.Array of { id, tool, color, lineWidth, points }). */

let seq = 0;
export const newStrokeId = () => `s-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Points are stored with one decimal: plenty for a 1200×700 board, and half the size. */
export const roundPoint = ({ x, y }) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });

function distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
}

/** Whether `pos` touches the stroke (within `radius` plus half the line width). */
export function strokeHit(stroke, pos, radius = 8) {
    const pts = stroke?.points;
    if (!Array.isArray(pts) || pts.length === 0 || !pos) return false;
    const reach = radius + (Number(stroke.lineWidth) || 3) / 2;
    if (pts.length === 1) return Math.hypot(pos.x - pts[0].x, pos.y - pts[0].y) <= reach;
    for (let i = 1; i < pts.length; i++) {
        if (distToSegment(pos, pts[i - 1], pts[i]) <= reach) return true;
    }
    return false;
}

/* ── Theme colours ────────────────────────────────────────────────────────
   The board is the app's neutral surface (light or dark); pens are the theme's
   text colour, the gold accent and the state colours. Strokes keep storing a
   plain colour string (the phone draws the same format), so near-black and
   near-white strokes count as "ink" and are drawn in the current text colour,
   which keeps them readable in both themes (older boards too). */

export const PEN_TOKENS = [
    { token: '--text-primary', label: 'Ink', fallback: '#e8e3da' },
    { token: '--accent', label: 'Gold', fallback: '#b8956a' },
    { token: '--state-danger', label: 'Red', fallback: '#d9534f' },
    { token: '--state-success', label: 'Green', fallback: '#3fa772' },
    { token: '--state-warning', label: 'Amber', fallback: '#d9a13b' },
];

/** '#abc', '#aabbcc' or 'rgb(a, b, c)' → [r, g, b], else null. */
export function parseColor(c) {
    const s = String(c || '').trim();
    let m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
    m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    return null;
}

/** Relative luminance 0..1 (null when unreadable). */
export function luminance(c) {
    const rgb = parseColor(c);
    if (!rgb) return null;
    const [r, g, b] = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Near-black or near-white (or unreadable): drawn in the theme's text colour. */
export function isInk(c) {
    const l = luminance(c);
    return l === null || l >= 0.7 || l <= 0.03;
}

/** The colour to draw a stored stroke with, for the current theme ({ ink, board }). */
export function strokeDrawColor(stroke, theme) {
    if (stroke?.tool === 'eraser') return theme.board;
    const c = stroke?.color;
    return !c || isInk(c) ? theme.ink : c;
}

/** Read the theme now: pens, ink and board as real colour strings. */
export function readBoardTheme(el = typeof document !== 'undefined' ? document.documentElement : null) {
    const css = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    const read = (token, fallback) => (css?.getPropertyValue(token) || '').trim() || fallback;
    const pens = PEN_TOKENS.map((p) => ({ ...p, color: read(p.token, p.fallback) }));
    return { pens, ink: pens[0].color, board: read('--bg-surface', '#1c1b19') };
}
