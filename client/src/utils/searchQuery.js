// Search query syntax shared by the results page and local (decrypted) message search.
// It mirrors the server parser (server/src/features/search/queryParser.js, docs/api/search.md),
// which reads the same raw query, so the chips, the local message matches and the server
// results agree.
//
//   from:@username|me   in:#channel (or in:@person: DMs, local message search only)
//   before:YYYY-MM-DD   after:YYYY-MM-DD   on:YYYY-MM-DD     (UTC days, like the server)
//   has:file|link|image   is:pinned|thread
//   type:message|task|note|file|page|channel|person  (+ the server's aliases)
//   "quoted phrases"   and plain words
//
// Operators with an unknown key or an invalid value stay as plain words.

export const HAS_VALUES = ['file', 'link', 'image'];
export const IS_VALUES = ['pinned', 'thread'];
export const TYPE_VALUES = ['message', 'task', 'note', 'file', 'page', 'channel', 'person'];
/** The server's type: aliases, mapped to the names used in queries here. */
export const TYPE_ALIASES = {
    message: 'message', messages: 'message', msg: 'message',
    task: 'task', tasks: 'task',
    note: 'note', notes: 'note',
    file: 'file', files: 'file',
    page: 'page', pages: 'page', knowledge: 'page', doc: 'page', docs: 'page',
    channel: 'channel', channels: 'channel',
    person: 'person', people: 'person', user: 'person', users: 'person', contact: 'person',
};
/** Same input limits as the server. */
export const MAX_QUERY_LENGTH = 512;
export const MAX_TOKENS = 64;
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
    if (key === 'type') return TYPE_ALIASES[lower] || null;
    // The server lower-cases every value; do the same so chips show what it searched.
    return lower;
}

/**
 * Splits into tokens like the server: a quote always starts a phrase (even mid-word,
 * so abc"def" is the word abc and the phrase def), and KEY:"quoted value" stays together
 * for the eight operator keys. Reads at most MAX_QUERY_LENGTH chars and MAX_TOKENS tokens.
 */
function tokenize(input) {
    const tokens = [];
    const re = /([a-zA-Z]+):"([^"]*)"?|"([^"]*)"?|([^\s"]+)/g;
    const text = String(input || '').slice(0, MAX_QUERY_LENGTH);
    let m;
    while ((m = re.exec(text)) && tokens.length < MAX_TOKENS) {
        if (m[1] !== undefined) {
            const key = m[1].toLowerCase();
            if (OPERATOR_KEYS.includes(key)) {
                tokens.push({ key, value: m[2], raw: m[0] });
            } else {
                // Not an operator: "ratio:" is a word and the quoted part a phrase.
                tokens.push({ word: m[1] + ':', raw: m[1] + ':' });
                if (tokens.length < MAX_TOKENS) tokens.push({ phrase: m[2], raw: m[0].slice(m[1].length + 1) });
            }
        } else if (m[3] !== undefined) tokens.push({ phrase: m[3], raw: m[0] });
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

const pad2 = (n) => String(n).padStart(2, '0');

/** Local calendar day of a date as YYYY-MM-DD (for chips the user picks, like "Today"). */
export function dayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** UTC day of a date as YYYY-MM-DD: the server reads before:/after:/on: as UTC days. */
export function utcDayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const isImage = (a) => /^image\//i.test(a?.mimeType || a?.mimetype || a?.type || '')
    || a?.type === 'image'
    || /\.(png|jpe?g|gif|webp|heic|svg|bmp)$/i.test(a?.name || a?.fileName || a?.filename || '');

/**
 * Does a message match a parsed query?
 * @param {object} parsed  from parseSearchQuery
 * @param {object} msg     { text, sender:{username}, createdAt, attachments?, isPinned?, threadParentId?, replyCount? }
 * @param {object} conv    { type:'channel'|'dm', name }
 * @param {object} [me]    the signed-in user { id, username }, for from:me
 */
export function matchesMessage(parsed, msg, conv = {}, me = null) {
    if (parsed.type.length && !parsed.type.includes('message')) return false;

    const attachments = msg.attachments || [];
    const haystack = [msg.text || '', ...attachments.map((a) => a?.name || a?.fileName || a?.filename || '')]
        .join(' ').toLowerCase();
    for (const t of parsed.terms) if (!haystack.includes(t.toLowerCase())) return false;
    for (const ph of parsed.phrases) if (!haystack.includes(ph.toLowerCase())) return false;

    if (parsed.from.length) {
        const sender = String(msg.sender?.username || msg.sender?.name || '').toLowerCase();
        const senderId = String(msg.sender?._id || msg.sender?.id || msg.senderId || '');
        const isMe = !!me && ((me.id && senderId && String(me.id) === senderId)
            || (me.username && String(me.username).toLowerCase() === sender));
        if (!parsed.from.some((f) => (f === 'me' ? isMe : f === sender))) return false;
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
        const day = utcDayKey(msg.createdAt);
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
