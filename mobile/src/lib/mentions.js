// @mentions and #channel links in the composer. People are mentioned by username (the server
// resolves @handles: server/src/utils/mentionParser.js); @channel notifies everyone in the
// channel and @here the people online, unless the channel limits them to its admins.
// The message itself is end-to-end encrypted, so the handles go to the server separately as
// `mentionText`, as on the web.

/** While typing: { trigger: '@' | '#', query, start, end } for the word before the caret, or null. */
export function mentionAt(text, caret = text.length) {
  const before = String(text || '').slice(0, caret);
  const m = /(^|[\s(])([@#])([\w.-]*)$/.exec(before);
  if (!m) return null;
  return { trigger: m[2], query: m[3].toLowerCase(), start: caret - m[3].length - 1, end: caret };
}

/** Whether this person may use @channel / @here in a channel with this policy. */
export function canBroadcast(policy, { canManage = false, workspaceRole } = {}) {
  if (!policy || policy.broadcastMentions !== 'admins') return true;
  return Boolean(canManage || ['admin', 'owner'].includes(workspaceRole));
}

export const BROADCASTS = [
  { id: 'channel', handle: 'channel', label: '@channel', hint: 'Notify everyone in this channel' },
  { id: 'here', handle: 'here', label: '@here', hint: 'Notify everyone online right now' },
];

const starts = (s, q) => String(s || '').toLowerCase().startsWith(q);
const words = (s, q) => String(s || '').toLowerCase().split(/\s+/).some((w) => w.startsWith(q));

/**
 * Suggestions for a mention being typed.
 *  '@': people (by username or name), then @channel/@here when allowed (channels only).
 *  '#': channels by name.
 * Returns [{ kind: 'person' | 'broadcast' | 'channel', id, insert, label, hint, item }].
 */
export function mentionSuggestions(at, { people = [], channels = [], me, inChannel = false, allowBroadcast = true, limit = 6 } = {}) {
  if (!at) return [];
  const q = at.query;
  if (at.trigger === '#') {
    return channels
      .filter((c) => c?.name && starts(c.name, q))
      .sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((c) => ({ kind: 'channel', id: c.id, insert: `#${c.name}`, label: `#${c.name}`, hint: c.topic || '', item: c }));
  }
  const found = people
    .filter((u) => u && u.id !== me && u.username && (starts(u.username, q) || words(u.name, q)))
    .sort((a, b) => Number(starts(b.username, q)) - Number(starts(a.username, q)) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((u) => ({ kind: 'person', id: u.id, insert: `@${u.username}`, label: u.name, hint: `@${u.username}`, item: u }));
  const broadcasts = inChannel
    ? BROADCASTS.filter((b) => starts(b.handle, q)).map((b) => ({
        kind: 'broadcast',
        id: b.id,
        insert: `@${b.handle}`,
        label: b.label,
        hint: allowBroadcast ? b.hint : 'Only channel admins can use this here',
        disabled: !allowBroadcast,
      }))
    : [];
  return [...found, ...broadcasts];
}

/** Puts a suggestion into the text: { text, caret }. */
export function applyMention(text, at, suggestion) {
  const insert = `${suggestion.insert} `;
  const next = `${text.slice(0, at.start)}${insert}${text.slice(at.end).replace(/^ /, '')}`;
  return { text: next, caret: at.start + insert.length };
}

/**
 * The handles in a message for the server: known usernames, plus @channel / @here when
 * allowed. '' when there are none. `usernames` is a Set of lower-case usernames.
 */
export function mentionTextFor(text, usernames, { allowBroadcast = true } = {}) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/(^|[^\w@])@([a-zA-Z0-9_.-]+)/g)) {
    const handle = m[2].replace(/[.-]+$/, '').toLowerCase();
    if (handle === 'channel' || handle === 'here' || handle === 'everyone') {
      // @everyone is the same as @channel on the server.
      if (allowBroadcast) out.add(`@${handle}`);
    } else if (usernames?.has(handle)) out.add(`@${handle}`);
  }
  return [...out].join(' ');
}
