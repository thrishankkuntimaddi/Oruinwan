// Parse a GitHub unified-diff `patch` (one file, as the REST API returns it)
// into rows the diff viewer renders. Pure; unit-tested.
//
// Row: { kind: 'hunk'|'add'|'del'|'ctx'|'meta', text, oldNo, newNo }
//   hunk rows carry the "@@ -a,b +c,d @@ heading" line; `text` of code rows
//   excludes the leading +/-/space marker.

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parsePatch(patch) {
    const rows = [];
    if (!patch || typeof patch !== 'string') return rows;
    let oldNo = 0;
    let newNo = 0;
    const lines = patch.replace(/\r\n/g, '\n').split('\n');
    // A trailing newline produces one empty last element; drop it.
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
        const h = HUNK_RE.exec(line);
        if (h) {
            oldNo = Number(h[1]);
            newNo = Number(h[3]);
            rows.push({ kind: 'hunk', text: line, heading: h[5].trim(), oldNo: null, newNo: null });
            continue;
        }
        const c = line[0];
        if (c === '+') rows.push({ kind: 'add', text: line.slice(1), oldNo: null, newNo: newNo++ });
        else if (c === '-') rows.push({ kind: 'del', text: line.slice(1), oldNo: oldNo++, newNo: null });
        else if (c === '\\') rows.push({ kind: 'meta', text: line.replace(/^\\\s*/, ''), oldNo: null, newNo: null });
        else rows.push({ kind: 'ctx', text: c === ' ' ? line.slice(1) : line, oldNo: oldNo++, newNo: newNo++ });
    }
    return rows;
}

/** Split rows into highlightable runs: each hunk header followed by its code rows. */
export function groupHunks(rows) {
    const groups = [];
    let cur = null;
    for (const r of rows) {
        if (r.kind === 'hunk' || !cur) {
            cur = { header: r.kind === 'hunk' ? r : null, rows: [] };
            groups.push(cur);
            if (r.kind === 'hunk') continue;
        }
        cur.rows.push(r);
    }
    return groups;
}

/** Totals for a set of files (falls back to counting the patch). */
export function diffStats(files = []) {
    let additions = 0;
    let deletions = 0;
    for (const f of files) {
        if (Number.isFinite(f?.additions) && Number.isFinite(f?.deletions)) {
            additions += f.additions; deletions += f.deletions;
        } else {
            for (const r of parsePatch(f?.patch)) { if (r.kind === 'add') additions++; else if (r.kind === 'del') deletions++; }
        }
    }
    return { additions, deletions, files: files.length };
}

/** Sort files into a folder tree: [{ dir: 'src/a', files: [...] }], dirs alphabetical, root first. */
export function groupByDirectory(files = []) {
    const map = new Map();
    for (const f of files) {
        const name = String(f?.filename || '');
        const i = name.lastIndexOf('/');
        const dir = i === -1 ? '' : name.slice(0, i);
        if (!map.has(dir)) map.set(dir, []);
        map.get(dir).push(f);
    }
    return [...map.entries()]
        .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
        .map(([dir, list]) => ({ dir, files: list }));
}
