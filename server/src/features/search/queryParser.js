'use strict';

/**
 * Search query syntax parser (pure — no I/O). Grammar documented in
 * docs/api/search.md; clients mirror it for local (E2EE) message search.
 *
 *   query     := token (WS token)*
 *   token     := operator | phrase | word
 *   operator  := KEY ':' value          KEY ∈ from in before after on has is type (case-insensitive)
 *   value     := '"' chars '"' | non-space chars
 *   phrase    := '"' chars '"'          (unterminated quote runs to the end of the query)
 *   word      := non-space chars
 *
 * Unknown keys, empty values and invalid values are kept as plain text and
 * reported in `warnings`, so "ratio:3" or "http://x" still search literally.
 */

const MAX_QUERY_LENGTH = 512;
const MAX_TOKENS = 64;

const HAS_VALUES = ['file', 'link', 'image'];
const IS_VALUES = ['pinned', 'thread'];
const TYPE_ALIASES = {
    message: 'message', messages: 'message', msg: 'message',
    task: 'task', tasks: 'task',
    note: 'note', notes: 'note',
    file: 'file', files: 'file',
    page: 'knowledge', pages: 'knowledge', knowledge: 'knowledge', doc: 'knowledge', docs: 'knowledge',
    channel: 'channel', channels: 'channel',
    person: 'user', people: 'user', user: 'user', users: 'user', contact: 'user',
};
const KEYS = ['from', 'in', 'before', 'after', 'on', 'has', 'is', 'type'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → Date at 00:00 UTC, or null when not a real calendar date. */
function parseDay(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date;
}

/** Split into raw tokens: { key?, value, quoted }. */
function tokenize(input) {
    const tokens = [];
    const s = input;
    let i = 0;
    while (i < s.length && tokens.length < MAX_TOKENS) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) break;

        if (s[i] === '"') {
            const end = s.indexOf('"', i + 1);
            const value = end === -1 ? s.slice(i + 1) : s.slice(i + 1, end);
            tokens.push({ value, quoted: true });
            i = end === -1 ? s.length : end + 1;
            continue;
        }

        let j = i;
        while (j < s.length && !/\s/.test(s[j]) && s[j] !== '"') j++;
        const word = s.slice(i, j);
        const colon = word.indexOf(':');
        const key = colon > 0 ? word.slice(0, colon).toLowerCase() : null;

        if (key && KEYS.includes(key)) {
            let value = word.slice(colon + 1);
            if (value === '' && s[j] === '"') {
                const end = s.indexOf('"', j + 1);
                value = end === -1 ? s.slice(j + 1) : s.slice(j + 1, end);
                j = end === -1 ? s.length : end + 1;
                tokens.push({ key, value, quoted: true, raw: `${word}"${value}"` });
            } else {
                tokens.push({ key, value, quoted: false, raw: word });
            }
        } else {
            tokens.push({ value: word, quoted: false });
        }
        i = j;
    }
    return tokens;
}

function emptyFilters() {
    return { from: [], in: [], before: null, after: null, on: null, has: [], is: [], types: [] };
}

function pushUnique(list, v) {
    if (!list.includes(v)) list.push(v);
}

/**
 * Parse a search query.
 * @param {string} input
 * @returns {{
 *   text: string, terms: string[], phrases: string[],
 *   filters: { from: string[], in: string[], before: string|null, after: string|null, on: string|null,
 *              has: string[], is: string[], types: string[] },
 *   dateRange: { gte?: Date, lt?: Date } | null,
 *   hasFilters: boolean, warnings: string[]
 * }}
 */
function parseQuery(input) {
    const raw = typeof input === 'string' ? input.slice(0, MAX_QUERY_LENGTH) : '';
    const filters = emptyFilters();
    const terms = [];
    const phrases = [];
    const warnings = [];
    const keepAsText = (tok, why) => {
        warnings.push(why);
        terms.push(tok.raw || `${tok.key}:${tok.value}`);
    };

    for (const tok of tokenize(raw)) {
        if (!tok.key) {
            if (!tok.value) continue;
            (tok.quoted ? phrases : terms).push(tok.value);
            continue;
        }
        const value = tok.value.trim();
        if (!value) { keepAsText(tok, `Empty value for "${tok.key}:"`); continue; }
        const lower = value.toLowerCase();

        switch (tok.key) {
            case 'from': {
                const name = lower.replace(/^@/, '');
                if (!name) { keepAsText(tok, 'Empty from:'); break; }
                pushUnique(filters.from, name);
                break;
            }
            case 'in': {
                const name = lower.replace(/^#/, '');
                if (!name) { keepAsText(tok, 'Empty in:'); break; }
                pushUnique(filters.in, name);
                break;
            }
            case 'before':
            case 'after':
            case 'on': {
                if (!parseDay(value)) { keepAsText(tok, `Invalid date "${value}" for ${tok.key}: (use YYYY-MM-DD)`); break; }
                filters[tok.key] = value;
                break;
            }
            case 'has': {
                if (!HAS_VALUES.includes(lower)) { keepAsText(tok, `Unknown has:${value} (use ${HAS_VALUES.join('|')})`); break; }
                pushUnique(filters.has, lower);
                break;
            }
            case 'is': {
                if (!IS_VALUES.includes(lower)) { keepAsText(tok, `Unknown is:${value} (use ${IS_VALUES.join('|')})`); break; }
                pushUnique(filters.is, lower);
                break;
            }
            case 'type': {
                const t = TYPE_ALIASES[lower];
                if (!t) { keepAsText(tok, `Unknown type:${value}`); break; }
                pushUnique(filters.types, t);
                break;
            }
            default:
                keepAsText(tok, `Unknown operator ${tok.key}:`);
        }
    }

    const dateRange = buildDateRange(filters);
    if (dateRange && dateRange.gte && dateRange.lt && dateRange.gte >= dateRange.lt) {
        warnings.push('Date filters do not overlap — no results can match');
    }

    const hasFilters = filters.from.length > 0 || filters.in.length > 0 || !!dateRange
        || filters.has.length > 0 || filters.is.length > 0 || filters.types.length > 0;

    return {
        text: [...terms, ...phrases].join(' ').trim(),
        terms,
        phrases,
        filters,
        dateRange,
        hasFilters,
        warnings,
    };
}

/**
 * before:D → createdAt < D 00:00 UTC; after:D → createdAt ≥ D+1 00:00 UTC;
 * on:D → D 00:00 ≤ createdAt < D+1 00:00 (UTC). Combined filters intersect.
 */
function buildDateRange(filters) {
    let gte = null;
    let lt = null;
    const tighten = (lo, hi) => {
        if (lo && (!gte || lo > gte)) gte = lo;
        if (hi && (!lt || hi < lt)) lt = hi;
    };
    if (filters.on) {
        const d = parseDay(filters.on);
        tighten(d, new Date(d.getTime() + DAY_MS));
    }
    if (filters.after) tighten(new Date(parseDay(filters.after).getTime() + DAY_MS), null);
    if (filters.before) tighten(null, parseDay(filters.before));
    if (!gte && !lt) return null;
    const range = {};
    if (gte) range.gte = gte;
    if (lt) range.lt = lt;
    return range;
}

/** Mongo createdAt condition for a parsed dateRange (null when none). */
function dateRangeToMongo(dateRange) {
    if (!dateRange) return null;
    const cond = {};
    if (dateRange.gte) cond.$gte = dateRange.gte;
    if (dateRange.lt) cond.$lt = dateRange.lt;
    return cond;
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive RegExp requiring every term and phrase (in any order).
 * Returns null when there is no free text.
 */
function textRegex(parsed) {
    const parts = [...parsed.terms, ...parsed.phrases].filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return new RegExp(escapeRegex(parts[0]), 'i');
    return new RegExp(parts.map(p => `(?=[\\s\\S]*${escapeRegex(p)})`).join('') + '[\\s\\S]*', 'i');
}

/**
 * Which result kinds may still match given the operators present. A filter
 * that a kind cannot honour excludes that kind rather than being ignored.
 */
const SUPPORT = {
    message:   { from: true,  in: true,  date: true,  has: ['file', 'link', 'image'], is: ['pinned', 'thread'] },
    task:      { from: true,  in: true,  date: true,  has: [],                         is: [] },
    note:      { from: true,  in: true,  date: true,  has: ['file', 'image'],          is: ['pinned'] },
    file:      { from: true,  in: false, date: true,  has: ['file', 'image'],          is: [] },
    knowledge: { from: true,  in: false, date: true,  has: [],                         is: [] },
    channel:   { from: true,  in: false, date: true,  has: [],                         is: [] },
    user:      { from: false, in: false, date: false, has: [],                         is: [] },
};
const ALL_KINDS = Object.keys(SUPPORT);

function applicableKinds(parsed) {
    const f = parsed.filters;
    return ALL_KINDS.filter((kind) => {
        if (f.types.length && !f.types.includes(kind)) return false;
        const s = SUPPORT[kind];
        if (f.from.length && !s.from) return false;
        if (f.in.length && !s.in) return false;
        if (parsed.dateRange && !s.date) return false;
        if (f.has.some(h => !s.has.includes(h))) return false;
        if (f.is.some(v => !s.is.includes(v))) return false;
        return true;
    });
}

module.exports = {
    parseQuery,
    parseDay,
    buildDateRange,
    dateRangeToMongo,
    textRegex,
    applicableKinds,
    SUPPORT,
    HAS_VALUES,
    IS_VALUES,
    TYPE_ALIASES,
    MAX_QUERY_LENGTH,
};
