/**
 * Minimal text edits for Yjs bindings.
 *
 * Editors here (textarea, contentEditable blocks) report the whole new value on
 * every input. Replacing a Y.Text wholesale would wipe concurrent edits from
 * other people, so we turn "old value → new value" into one delete + one insert
 * at the changed range, which is what a single keystroke, paste or cut is.
 */

/**
 * The single changed range between two strings.
 * @returns {{ index: number, remove: number, insert: string } | null} null when equal
 */
export function diffText(prev, next) {
    const a = prev == null ? '' : String(prev);
    const b = next == null ? '' : String(next);
    if (a === b) return null;
    const max = Math.min(a.length, b.length);
    let start = 0;
    while (start < max && a.charCodeAt(start) === b.charCodeAt(start)) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a.charCodeAt(endA - 1) === b.charCodeAt(endB - 1)) {
        endA--;
        endB--;
    }
    // Never split a surrogate pair (emoji): widen the range by one code unit.
    if (start > 0 && isHighSurrogate(a.charCodeAt(start - 1))) start--;
    if (endA < a.length && isLowSurrogate(a.charCodeAt(endA))) { endA++; endB++; }
    return { index: start, remove: endA - start, insert: b.slice(start, endB) };
}

function isHighSurrogate(c) { return c >= 0xd800 && c <= 0xdbff; }
function isLowSurrogate(c) { return c >= 0xdc00 && c <= 0xdfff; }

/**
 * Make a Y.Text equal to `next` with a minimal delete/insert.
 * Call it inside `doc.transact(fn, origin)` so the edit carries your origin.
 * @returns {boolean} whether anything changed
 */
export function applyTextDiff(ytext, next) {
    const d = diffText(ytext.toString(), next);
    if (!d) return false;
    if (d.remove > 0) ytext.delete(d.index, d.remove);
    if (d.insert) ytext.insert(d.index, d.insert);
    return true;
}

/** Where a caret at `pos` ends up after the change `d` (from diffText). */
export function transformIndex(pos, d) {
    if (!d || pos == null) return pos;
    if (pos <= d.index) return pos;
    if (pos >= d.index + d.remove) return pos - d.remove + d.insert.length;
    // The caret was inside the replaced range: put it after the inserted text.
    return d.index + d.insert.length;
}

/** Where a caret at `pos` ends up after a Yjs text delta (event.delta of a Y.Text observer). */
export function transformIndexByDelta(pos, delta) {
    if (pos == null || !Array.isArray(delta)) return pos;
    let cursor = 0; // position in the old text
    let shift = 0;
    for (const op of delta) {
        if (cursor > pos) break;
        if (op.retain != null) {
            cursor += op.retain;
        } else if (op.insert != null) {
            const len = typeof op.insert === 'string' ? op.insert.length : 1;
            if (cursor <= pos) shift += len;
        } else if (op.delete != null) {
            const removedBeforeCaret = Math.max(0, Math.min(op.delete, pos - cursor));
            shift -= removedBeforeCaret;
            cursor += op.delete;
        }
    }
    return Math.max(0, pos + shift);
}
