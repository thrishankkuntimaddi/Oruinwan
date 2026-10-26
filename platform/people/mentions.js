// @mentions in message text, the same on the web, desktop and phone apps (the server has the same
// rule in server/src/utils/mentionMatch.js).
//
// Usernames can have spaces ("Pakanati Shiva Kumar Goud"), so after an "@" the longest known name
// wins: "@Pakanati Shiva Kumar Goud hi" mentions the whole name, not "Pakanati". Anything else after
// an "@" is read as a one-word handle (@here, @channel, @gemini, or a name we don't know).

const WORD = /[\p{L}\p{N}_]/u;
const fold = (s) => String(s || '').toLowerCase().replace(/[\s ]+/g, ' ').trim();

/** Known names, longest first, folded (lower case, single spaces). */
function candidates(names) {
  return [...new Set((names || []).map(fold).filter(Boolean))].sort((a, b) => b.length - a.length);
}

/**
 * Every mention in `text`: [{ start, end, handle, key, known }].
 *   handle  the text after "@" as written ("Pakanati Shiva Kumar Goud")
 *   key     lower-case handle with single spaces, to look people up by
 *   known   one of `names` (otherwise a one-word handle)
 * An "@" right after a letter, digit, "@" or "/" is not a mention (emails, URLs).
 */
export function findMentions(text, names = [], { prepared } = {}) {
  const src = String(text || '');
  if (!src.includes('@')) return [];
  const list = prepared || candidates(names);
  // Same length as src, so indexes line up.
  const flat = src.toLowerCase().replace(/[\s ]/g, ' ');
  const out = [];
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] !== '@') continue;
    if (i > 0 && /[\p{L}\p{N}_@/]/u.test(src[i - 1])) continue;
    const rest = flat.slice(i + 1);
    const hit = list.find((c) => rest.startsWith(c) && !WORD.test(rest[c.length] || ''));
    if (hit) {
      out.push({ start: i, end: i + 1 + hit.length, handle: src.slice(i + 1, i + 1 + hit.length), key: hit, known: true });
      i += hit.length;
      continue;
    }
    const m = /^[\p{L}\p{N}_.-]+/u.exec(src.slice(i + 1));
    const handle = m ? m[0].replace(/[.-]+$/, '') : '';
    if (!handle) continue;
    out.push({ start: i, end: i + 1 + handle.length, handle, key: handle.toLowerCase(), known: false });
    i += handle.length;
  }
  return out;
}

/** The lower-case keys of the known names mentioned in `text`. */
export function mentionedKeys(text, names = []) {
  return new Set(findMentions(text, names).filter((m) => m.known).map((m) => m.key));
}

/** The people mentioned, in order, once each: `people` are { username, ... }. */
export function mentionedPeople(text, people = []) {
  const byKey = new Map();
  for (const p of people || []) {
    const k = fold(p?.username);
    if (k && !byKey.has(k)) byKey.set(k, p);
  }
  const out = [];
  const seen = new Set();
  for (const m of findMentions(text, [...byKey.keys()])) {
    const p = byKey.get(m.key);
    if (!p || seen.has(m.key)) continue;
    seen.add(m.key);
    out.push(p);
  }
  return out;
}

export { fold as foldMentionName };

// The workspace's usernames, for drawing mentions in messages. The app sets them when the
// workspace's members load; message views subscribe so they redraw once the names are known.
let known = [];
let knownSig = '';
let prepared = [];
const listeners = new Set();

export function setMentionNames(names) {
  const next = candidates(names);
  const sig = next.join('\n');
  if (sig === knownSig) return;
  known = next;
  knownSig = sig;
  prepared = next;
  listeners.forEach((fn) => fn());
}

export function getMentionNames() {
  return known;
}

/** findMentions with the names set by setMentionNames. */
export function findKnownMentions(text) {
  return findMentions(text, null, { prepared });
}

export function subscribeMentionNames(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
