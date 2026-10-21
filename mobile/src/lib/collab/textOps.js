// Small text helpers for binding editors to Yjs: turn a whole-text change into one
// minimal edit, and move a caret across edits made by someone else.

/** The changed middle between two strings: { index, remove, insert } (null when equal). */
export function diffRange(prev, next) {
  prev = String(prev ?? '');
  next = String(next ?? '');
  if (prev === next) return null;
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start += 1;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)) {
    endPrev -= 1;
    endNext -= 1;
  }
  return { index: start, remove: endPrev - start, insert: next.slice(start, endNext) };
}

/** Replace a Y.Text's text with `next` by deleting/inserting only the changed middle (same as the server). */
export function diffReplaceText(ytext, next) {
  const d = diffRange(ytext.toString(), next);
  if (!d) return false;
  const run = () => {
    if (d.remove) ytext.delete(d.index, d.remove);
    if (d.insert) ytext.insert(d.index, d.insert);
  };
  if (ytext.doc) ytext.doc.transact(run);
  else run();
  return true;
}

/**
 * Where `index` ends up after a Yjs text delta ([{ retain } | { insert } | { delete }]).
 * Text inserted exactly at the index lands before it unless `stickLeft` (a selection's start
 * should stay put, its end should grow).
 */
export function transformIndex(delta, index, stickLeft = false) {
  let pos = 0; // position in the old text
  let shift = 0;
  for (const op of delta || []) {
    if (pos > index || (pos === index && stickLeft && op.insert != null)) break;
    if (op.retain != null) pos += op.retain;
    else if (op.insert != null) shift += typeof op.insert === 'string' ? op.insert.length : 1;
    else if (op.delete != null) {
      const removed = Math.min(op.delete, Math.max(0, index - pos));
      shift -= removed;
      pos += op.delete;
    }
  }
  return Math.max(0, index + shift);
}

/**
 * A caret's new offset when its text changed from `oldText` to `newText` without a delta
 * (e.g. a rich-text block re-rendered from someone else's edit): edits after the caret
 * leave it, edits before it shift it, and a caret inside the changed part goes to its end.
 */
export function caretShift(oldText, newText, offset) {
  const d = diffRange(oldText, newText);
  if (!d) return offset;
  if (offset <= d.index) return offset;
  if (offset >= d.index + d.remove) return offset + d.insert.length - d.remove;
  return d.index + d.insert.length;
}
