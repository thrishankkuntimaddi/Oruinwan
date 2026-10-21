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
