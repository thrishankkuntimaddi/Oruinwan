// Search query syntax shared by the results page and local (decrypted) message search.
// The server understands the same operators, so the raw query is sent unchanged.
//
//   from:@username   in:#channel (or in:@person for a DM)
//   before:YYYY-MM-DD   after:YYYY-MM-DD   on:YYYY-MM-DD
//   has:file|link|image   is:pinned|thread
//   type:task|note|file|page|message
//   "quoted phrases"   and plain words
//
// Operators with an unknown key or an invalid value stay as plain words.

export const HAS_VALUES = ['file', 'link', 'image'];
export const IS_VALUES = ['pinned', 'thread'];
export const TYPE_VALUES = ['task', 'note', 'file', 'page', 'message'];
const LIST_KEYS = ['from', 'in', 'has', 'is', 'type'];
const DATE_KEYS = ['before', 'after', 'on'];
export const OPERATOR_KEYS = [...LIST_KEYS, ...DATE_KEYS];
const KEY_ORDER = ['from', 'in', 'type', 'has', 'is', 'after', 'before', 'on'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(value) {
    if (!DATE_RE.test(value || '')) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const stripSigil = (key, value) => {
    if (key === 'from') return value.replace(/^@/, '');
    return value;
};

function normalizeValue(key, raw) {
    const value = stripSigil(key, String(raw || '').trim());
    if (!value) return null;
    if (DATE_KEYS.includes(key)) return isValidDay(value) ? value : null;
    const lower = value.toLowerCase();
    if (key === 'has') return HAS_VALUES.includes(lower) ? lower : null;
    if (key === 'is') return IS_VALUES.includes(lower) ? lower : null;
    if (key === 'type') return TYPE_VALUES.includes(lower) ? lower : null;
    return value;
}

/** Splits into tokens, keeping "quoted phrases" and key:"quoted values" together. */
function tokenize(input) {
    const tokens = [];
    const re = /([a-zA-Z]+):"([^"]*)"?|"([^"]*)"?|(\S+)/g;
    let m;
    while ((m = re.exec(input))) {
        if (m[1] !== undefined) tokens.push({ key: m[1].toLowerCase(), value: m[2], raw: m[0] });
        else if (m[3] !== undefined) tokens.push({ phrase: m[3], raw: m[0] });
        else tokens.push({ word: m[4], raw: m[0] });
    }
    return tokens;
}

export function emptyParsed() {
    return { terms: [], phrases: [], from: [], in: [], has: [], is: [], type: [], before: null, after: null, on: null, text: '' };
}

/**
 * Parses a query string.
 * @returns {{terms:string[], phrases:string[], from:string[], in:string[], has:string[], is:string[],
 *            type:string[], before:?string, after:?string, on:?string, text:string}}
 *   `text` is the free text (words and quoted phrases) without the operators.
 */
export function parseSearchQuery(input) {
    const out = emptyParsed();
    const textParts = [];
    for (const tok of tokenize(String(input || ''))) {
        let key = tok.key;
        let value = tok.value;
        if (tok.word !== undefined) {
            const idx = tok.word.indexOf(':');
            if (idx > 0) {
                key = tok.word.slice(0, idx).toLowerCase();
                value = tok.word.slice(idx + 1);
            }
        }
        if (key && OPERATOR_KEYS.includes(key)) {
            const v = normalizeValue(key, value);
            if (v != null) {
                if (DATE_KEYS.includes(key)) out[key] = v;
                else if (!out[key].some((x) => x.toLowerCase() === v.toLowerCase())) out[key].push(v);
                continue;
            }
        }
        if (tok.phrase !== undefined) {
            if (tok.phrase.trim()) {
                out.phrases.push(tok.phrase.trim());
                textParts.push(`"${tok.phrase.trim()}"`);
            }
            continue;
        }
        // Unknown operator or invalid value: keep it as a plain word.
        const word = tok.word !== undefined ? tok.word : tok.raw;
        out.terms.push(word);
        textParts.push(word);
    }
    out.text = textParts.join(' ');
    return out;
}

/** True when the query uses at least one operator. */
export function hasOperators(parsed) {
    const p = typeof parsed === 'string' ? parseSearchQuery(parsed) : parsed;
    return LIST_KEYS.some((k) => p[k].length > 0) || DATE_KEYS.some((k) => !!p[k]);
}

const quoteIfNeeded = (v) => (/\s/.test(v) ? `"${v}"` : v);

function formatOperator(key, value) {
    if (key === 'from') return `from:@${quoteIfNeeded(value)}`.replace('@"', '"@');
    return `${key}:${quoteIfNeeded(value)}`;
}

/** Turns a parsed query back into a string (operators first, then free text). */
export function buildSearchQuery(parsed) {
    const parts = [];
    for (const key of KEY_ORDER) {
        if (DATE_KEYS.includes(key)) {
            if (parsed[key]) parts.push(formatOperator(key, parsed[key]));
        } else {
            for (const v of parsed[key] || []) parts.push(formatOperator(key, v));
        }
    }
    if (parsed.text) parts.push(parsed.text);
    else {
        for (const ph of parsed.phrases || []) parts.push(`"${ph}"`);
        for (const t of parsed.terms || []) parts.push(t);
    }
    return parts.join(' ').trim();
}

/** Lists the operators of a query as chips: [{ key, value, label }]. */
export function queryChips(query) {
    const p = typeof query === 'string' ? parseSearchQuery(query) : query;
    const chips = [];
    for (const key of KEY_ORDER) {
        const values = DATE_KEYS.includes(key) ? (p[key] ? [p[key]] : []) : p[key];
        for (const value of values) {
            const shown = key === 'from' ? `@${value}` : value;
            chips.push({ key, value, label: `${key}: ${shown}` });
        }
    }
    return chips;
}

/**
 * Sets an operator in a query string. List keys add the value (`replace: true`
 * swaps any existing values); date keys always replace. An empty value removes the key.
 */
export function setQueryOperator(query, key, value, { replace = false } = {}) {
    const p = parseSearchQuery(query);
    const v = value == null || value === '' ? null : normalizeValue(key, value);
    if (DATE_KEYS.includes(key)) {
        p[key] = v;
        if (key === 'on' && v) { p.before = null; p.after = null; }
        if ((key === 'before' || key === 'after') && v) p.on = null;
    } else if (LIST_KEYS.includes(key)) {
        if (replace || v == null) p[key] = [];
        if (v != null && !p[key].some((x) => x.toLowerCase() === v.toLowerCase())) p[key].push(v);
    }
    return buildSearchQuery(p);
}

/** Removes one operator value (or every value of `key` when `value` is omitted). */
export function removeQueryOperator(query, key, value) {
    const p = parseSearchQuery(query);
    if (DATE_KEYS.includes(key)) p[key] = null;
    else if (LIST_KEYS.includes(key)) {
        p[key] = value == null ? [] : p[key].filter((x) => x.toLowerCase() !== String(value).toLowerCase());
    }
    return buildSearchQuery(p);
}

// ── Matching (local decrypted messages) ─────────────────────────────────────

const LINK_RE = /(https?:\/\/|www\.)\S+/i;

/** Local calendar day of a date as YYYY-MM-DD. */
export function dayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isImage = (a) => /^image\//i.test(a?.mimeType || a?.mimetype || a?.type || '')
    || a?.type === 'image'
    || /\.(png|jpe?g|gif|webp|heic|svg|bmp)$/i.test(a?.name || a?.fileName || a?.filename || '');

/**
 * Does a message match a parsed query?
 * @param {object} parsed  from parseSearchQuery
 * @param {object} msg     { text, sender:{username}, createdAt, attachments?, isPinned?, threadParentId?, replyCount? }
 * @param {object} conv    { type:'channel'|'dm', name }
 */
export function matchesMessage(parsed, msg, conv = {}) {
    if (parsed.type.length && !parsed.type.includes('message')) return false;

    const attachments = msg.attachments || [];
    const haystack = [msg.text || '', ...attachments.map((a) => a?.name || a?.fileName || a?.filename || '')]
        .join(' ').toLowerCase();
    for (const t of parsed.terms) if (!haystack.includes(t.toLowerCase())) return false;
    for (const ph of parsed.phrases) if (!haystack.includes(ph.toLowerCase())) return false;

    if (parsed.from.length) {
        const sender = String(msg.sender?.username || msg.sender?.name || '').toLowerCase();
        if (!parsed.from.some((f) => f.toLowerCase() === sender)) return false;
    }
    if (parsed.in.length) {
        const name = String(conv.name || '').toLowerCase();
        const ok = parsed.in.some((raw) => {
            const target = raw.toLowerCase();
            if (target.startsWith('#')) return conv.type === 'channel' && name === target.slice(1);
            if (target.startsWith('@')) return conv.type !== 'channel' && name === target.slice(1);
            return name === target;
        });
        if (!ok) return false;
    }

    if (parsed.before || parsed.after || parsed.on) {
        const day = dayKey(msg.createdAt);
        if (!day) return false;
        if (parsed.on && day !== parsed.on) return false;
        if (parsed.before && !(day < parsed.before)) return false;
        if (parsed.after && !(day > parsed.after)) return false;
    }

    for (const h of parsed.has) {
        if (h === 'link' && !LINK_RE.test(msg.text || '')) return false;
        if (h === 'file' && attachments.length === 0) return false;
        if (h === 'image' && !attachments.some(isImage)) return false;
    }
    for (const i of parsed.is) {
        if (i === 'pinned' && !msg.isPinned) return false;
        if (i === 'thread' && !msg.threadParentId && !(msg.replyCount > 0)) return false;
    }
    return true;
}
