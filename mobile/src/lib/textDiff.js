// Word-level differences between two versions of a message, for the edit history viewer.

const split = (s) => String(s ?? '').match(/\s+|[^\s]+/g) || [];

/**
 * Parts of `after` compared with `before`: [{ type: 'same' | 'add' | 'del', text }].
 * Longest common subsequence over words (and the spaces between them); long texts fall back
 * to a whole replacement so a huge message can't stall the phone.
 */
export function wordDiff(before, after, { maxCells = 250_000 } = {}) {
  const a = split(before);
  const b = split(after);
  if (a.length * b.length > maxCells) {
    return [before && { type: 'del', text: String(before) }, after && { type: 'add', text: String(after) }].filter(Boolean);
  }
  const cols = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * cols + j] = a[i] === b[j] ? lcs[(i + 1) * cols + j + 1] + 1 : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
      push('del', a[i]);
      i += 1;
    } else {
      push('add', b[j]);
      j += 1;
    }
  }
  while (i < a.length) push('del', a[i++]);
  while (j < b.length) push('add', b[j++]);
  return out;
}
