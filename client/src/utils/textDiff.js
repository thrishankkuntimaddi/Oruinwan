/**
 * Tiny word-level diff based on the longest common subsequence.
 *
 * Returns an array of segments `{ type: 'same' | 'added' | 'removed', text }`
 * in reading order. Whitespace is preserved: tokens are words and the runs of
 * whitespace between them, and adjacent segments of the same type are merged.
 */

function tokenize(text) {
    if (!text) return [];
    return String(text).match(/\s+|[^\s]+/g) || [];
}

export function diffWords(oldText = '', newText = '') {
    const a = tokenize(oldText);
    const b = tokenize(newText);
    const n = a.length;
    const m = b.length;

    // LCS length table (n+1 x m+1), filled from the end so we can walk forwards.
    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            table[i][j] = a[i] === b[j]
                ? table[i + 1][j + 1] + 1
                : Math.max(table[i + 1][j], table[i][j + 1]);
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
    while (i < n && j < m) {
        if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
        else if (table[i + 1][j] >= table[i][j + 1]) { push('removed', a[i]); i++; }
        else { push('added', b[j]); j++; }
    }
    while (i < n) push('removed', a[i++]);
    while (j < m) push('added', b[j++]);
    return out;
}

/** True when the diff contains at least one change. */
export function hasChanges(segments) {
    return segments.some(s => s.type !== 'same');
}

export default diffWords;
