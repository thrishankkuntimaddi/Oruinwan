// Search query syntax, the same words people type on the web:
//   from:@username   in:#channel   before:2026-01-31   after:2026-01-01   on:2026-01-15
//   has:file|link|image   is:pinned|thread   type:task|note|file|page|message   "exact phrase"
// Message bodies are end-to-end encrypted, so messages are matched here on the phone
// (matchMessage); the other kinds go to the server's /api/search with the filters it
// understands (serverParams).

export const HAS_VALUES = ['file', 'link', 'image'];
export const IS_VALUES = ['pinned', 'thread'];
export const TYPE_VALUES = ['task', 'note', 'file', 'page', 'message'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A local calendar day as a Date at 00:00, or null when the text isn't a real day. */
export function parseDay(text) {
  if (!DATE.test(text || '')) return null;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Splits a query into tokens, keeping "quoted phrases" (and key:"quoted values") together. */
function tokenize(input) {
  const out = [];
  const re = /(\S+?:)?"([^"]*)"?|(\S+)/g;
  for (const m of String(input || '').matchAll(re)) {
    if (m[2] !== undefined) out.push(m[1] ? { word: `${m[1]}${m[2]}` } : { phrase: m[2] });
    else out.push({ word: m[3] });
  }
  return out;
}

/**
 * Parses a query. Unknown keys (and bad values) are kept as ordinary words, so typing
 * "time:10" still searches for that text.
 * Returns { terms, phrases, from, in, before, after, on, has, is, type, errors }.
 */
export function parseSearchQuery(input) {
  const q = { terms: [], phrases: [], from: [], in: [], before: null, after: null, on: null, has: [], is: [], type: null, errors: [] };
  for (const t of tokenize(input)) {
    if (t.phrase !== undefined) {
      const p = t.phrase.trim().toLowerCase();
      if (p) q.phrases.push(p);
      continue;
    }
    const word = t.word;
    const at = word.indexOf(':');
    const key = at > 0 ? word.slice(0, at).toLowerCase() : null;
    const value = at > 0 ? word.slice(at + 1) : '';
    const v = value.toLowerCase();
    let used = true;
    switch (key) {
      case 'from': {
        const name = v.replace(/^@/, '');
        if (name) q.from.push(name);
        else used = false;
        break;
      }
      case 'in': {
        const name = v.replace(/^#/, '');
        if (name) q.in.push(name);
        else used = false;
        break;
      }
      case 'before':
      case 'after':
      case 'on':
        if (parseDay(v)) q[key] = v;
        else if (v) q.errors.push(`${key}: needs a date like 2026-01-31`);
        else used = false;
        break;
      case 'has':
        if (HAS_VALUES.includes(v)) q.has.includes(v) || q.has.push(v);
        else used = false;
        break;
      case 'is':
        if (IS_VALUES.includes(v)) q.is.includes(v) || q.is.push(v);
        else used = false;
        break;
      case 'type':
        if (TYPE_VALUES.includes(v)) q.type = v;
        else used = false;
        break;
      default:
        used = false;
    }
    if (!used && word) q.terms.push(word.toLowerCase());
  }
  return q;
}

/** True when the query asks for nothing at all. */
export function isEmptyQuery(q) {
  return !q || (!q.terms.length && !q.phrases.length && !q.from.length && !q.in.length && !q.before && !q.after && !q.on && !q.has.length && !q.is.length && !q.type);
}

/** The free text of a query (words and phrases), for searches that only take text. */
export function freeText(q) {
  return [...q.terms, ...q.phrases].join(' ').trim();
}

/** { from, to } as ISO strings for the date filters, or nulls. */
export function dateRange(q) {
  let from = null;
  let to = null;
  if (q.on) {
    const d = parseDay(q.on);
    from = d;
    to = new Date(d.getTime() + DAY_MS - 1);
  }
  if (q.after) {
    // "after:2026-01-01" starts the next day, as in Slack.
    const d = new Date(parseDay(q.after).getTime() + DAY_MS);
    from = from && from > d ? from : d;
  }
  if (q.before) {
    const d = new Date(parseDay(q.before).getTime() - 1);
    to = to && to < d ? to : d;
  }
  return { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null };
}

/** Which result kinds the query can return. */
export function wantsKind(q, kind) {
  if (!q.type) return true;
  return q.type === kind;
}

const LINK = /\bhttps?:\/\/\S+/i;

/**
 * Whether a message from the phone's index matches. `m` is { text, authorId, at, parentId,
 * pinned, replyCount, attachments: [{ type, mimeType }] }; `conv` is { kind, name };
 * `ctx.usernameOf(id)` gives the author's username (and `ctx.nameOf(id)` their display name).
 */
export function matchMessage(m, conv, q, ctx = {}) {
  if (q.type && q.type !== 'message') return false;
  const text = String(m.text || '').toLowerCase();
  if (!q.terms.every((w) => text.includes(w))) return false;
  if (!q.phrases.every((p) => text.includes(p))) return false;
  if (q.from.length) {
    const handles = [ctx.usernameOf?.(m.authorId), ctx.nameOf?.(m.authorId)].filter(Boolean).map((s) => String(s).toLowerCase());
    if (!q.from.some((f) => handles.some((h) => h === f || h.replace(/\s+/g, '') === f))) return false;
  }
  if (q.in.length) {
    const name = String(conv?.name || '').toLowerCase().replace(/^#/, '');
    if (conv?.kind !== 'channel' || !q.in.includes(name)) return false;
  }
  const { from, to } = dateRange(q);
  const at = new Date(m.at).getTime();
  if (from && !(at >= new Date(from).getTime())) return false;
  if (to && !(at <= new Date(to).getTime())) return false;
  const files = m.attachments || [];
  for (const h of q.has) {
    if (h === 'link' && !LINK.test(m.text || '')) return false;
    if (h === 'file' && !files.length) return false;
    if (h === 'image' && !files.some((f) => f.type === 'image' || String(f.mimeType || '').startsWith('image/'))) return false;
  }
  for (const i of q.is) {
    if (i === 'pinned' && !m.pinned) return false;
    if (i === 'thread' && !(m.parentId || m.replyCount > 0)) return false;
  }
  return true;
}

/** Query params for GET /api/search for one kind ('knowledge' | 'file' | 'task' | 'note'). */
export function serverParams(q, kind) {
  const { from, to } = dateRange(q);
  const params = { q: freeText(q), type: kind, semantic: 'false' };
  if (from) params.from = from;
  if (to) params.to = to;
  return params;
}

/** Adds or replaces one filter in the query text (used by the filter chips). */
export function setFilter(input, key, value) {
  const kept = tokenize(input)
    .filter((t) => !(t.word && t.word.toLowerCase().startsWith(`${key}:`)))
    .map((t) => (t.phrase !== undefined ? `"${t.phrase}"` : t.word));
  if (value) kept.push(`${key}:${value}`);
  return kept.join(' ') + (kept.length ? ' ' : '');
}

/** The value of one filter in the query text, or ''. */
export function filterValue(input, key) {
  const t = tokenize(input).find((x) => x.word && x.word.toLowerCase().startsWith(`${key}:`));
  return t ? t.word.slice(key.length + 1) : '';
}
