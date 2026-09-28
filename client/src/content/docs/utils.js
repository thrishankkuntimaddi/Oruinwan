/**
 * Pure helpers shared by the docs content index, the renderer and the tests.
 *
 * Page content is a list of blocks:
 *   'A paragraph with **bold**, `code`, [a link](/docs/x/y) and [[Mod+K]] keys.'
 *   { h: 'Section heading' }              → h2 (listed in "On this page")
 *   { h3: 'Sub heading' }                 → h3 (listed, indented)
 *   { list: ['…'] } | { steps: ['…'] }
 *   { callout: 'tip' | 'note' | 'warning', title?, text }
 *   { table: { head: ['…'], rows: [['…']] } }
 *   { code: '…', lang?, title? }
 *   { codeTabs: [{ label, lang, code }] }
 *   { figure: '<figure id>', caption? }  → animated illustration (pages/docs/DocsFigures)
 *   { shortcuts: [{ keys: [['Mod', 'K']], label }] }
 *   { cards: [{ to, title, text }] }
 * Inline text: **bold**, `code`, [label](href), [[Mod+Shift+A]] keyboard chips.
 */

export function slugify(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[`*[\]()]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'section';
}

/** Headings of a page, with ids that are unique within the page. */
export function headingsOf(page) {
    const used = new Map();
    const out = [];
    for (const b of page?.blocks || []) {
        if (!b || typeof b !== 'object') continue;
        const text = b.h || b.h3;
        if (!text) continue;
        const base = slugify(text);
        const n = used.get(base) || 0;
        used.set(base, n + 1);
        out.push({ id: n ? `${base}-${n + 1}` : base, text, level: b.h ? 2 : 3 });
    }
    return out;
}

/** Strip inline markup so text can be searched or shown as a snippet. */
export function plainText(text) {
    return String(text || '')
        .replace(/\[\[([^\]]+)\]\]/g, (_, k) => k.replace(/\+/g, ' '))
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');
}

/** All readable text in one block (used by search). */
export function blockText(b) {
    if (typeof b === 'string') return plainText(b);
    if (!b || typeof b !== 'object') return '';
    if (b.h || b.h3) return plainText(b.h || b.h3);
    if (b.list || b.steps) return (b.list || b.steps).map(plainText).join(' ');
    if (b.callout) return `${plainText(b.title)} ${plainText(b.text)}`;
    if (b.table) return [...(b.table.head || []), ...(b.table.rows || []).flat()].map(plainText).join(' ');
    if (b.code) return `${b.title || ''} ${b.code}`;
    if (b.codeTabs) return b.codeTabs.map((t) => `${t.label} ${t.code}`).join(' ');
    if (b.figure) return plainText(b.caption);
    if (b.shortcuts) return b.shortcuts.map((s) => `${s.label} ${s.keys.flat().join(' ')}`).join(' ');
    if (b.cards) return b.cards.map((c) => `${c.title} ${c.text || ''}`).join(' ');
    return '';
}

/** Lower-case, strip accents and markup so "Huddlé" matches "huddle". */
export function normalize(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[*`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Crude plural folding so "threads" also finds "thread". */
export function queryWords(query) {
    return normalize(query).split(' ').filter(Boolean)
        .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/** Every internal docs link (/docs/...) found in a page's inline text and cards. */
export function linksOf(page) {
    const found = [];
    const scan = (s) => {
        const re = /\[[^\]]+\]\(([^)]+)\)/g;
        let m;
        while ((m = re.exec(String(s || '')))) found.push(m[1]);
    };
    for (const b of page?.blocks || []) {
        if (typeof b === 'string') { scan(b); continue; }
        if (!b) continue;
        (b.list || b.steps || []).forEach(scan);
        if (b.callout) { scan(b.text); scan(b.title); }
        if (b.table) (b.table.rows || []).flat().forEach(scan);
        if (b.cards) b.cards.forEach((c) => found.push(c.to));
    }
    scan(page?.summary);
    return found.filter((h) => typeof h === 'string' && h.startsWith('/docs'));
}
