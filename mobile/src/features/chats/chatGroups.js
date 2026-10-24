// The Chats list's sections. Every conversation is always listed in its own section (Channels,
// Direct messages) — unread ones are highlighted there. The Unread group, when shown, only
// mirrors them on top (Slack's behaviour); it never takes them out of their section. Earlier the
// "All" view moved unread conversations out of Channels / Direct messages, so a conversation
// with a new message seemed to vanish from its section.

const byLatest = (a, b) => (b.lastAt || '').localeCompare(a.lastAt || '');

/**
 * { channels, dms, unread } for the Chats list. `channels`: joined channels matching the query,
 * newest first. `dms`: DMs with people (agent chats are listed under Agents). `unread`:
 * [{ kind, item }] of the unread ones (muted channels excluded), newest first.
 */
export function chatSections({ channels = [], dms = [], query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const joined = (channels || [])
    .filter((c) => c.isMember && (!q || String(c.name || '').toLowerCase().includes(q)))
    .sort(byLatest);
  const people = (dms || []).filter((d) => !d.agentId && (!q || String(d.user?.name || '').toLowerCase().includes(q)));
  const unread = [
    ...joined.filter((c) => c.unread > 0 && !c.muted).map((c) => ({ kind: 'channel', item: c })),
    ...people.filter((d) => d.unread > 0).map((d) => ({ kind: 'dm', item: d })),
  ].sort((a, b) => byLatest(a.item, b.item));
  return { channels: joined, dms: people, unread };
}
