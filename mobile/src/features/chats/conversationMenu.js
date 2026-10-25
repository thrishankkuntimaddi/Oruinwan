// A conversation's options, split in two so nothing appears twice:
//  - section 'hub' (tap the conversation's name): what's in it and how it notifies you —
//    channel/group info or profile, members, threads, pinned, saved, reminders, notifications.
//  - section 'actions' (the ⋮ button): things you do — search, poll, video huddle, block,
//    clear, delete. The header's own huddle button starts a voice huddle.

/**
 * opts: { kind: 'channel' | 'dm', isGroup, isAgent, muted, blocked, huddles (calls available),
 * polls (can create one here), threads (threads are on) }.
 * Returns [{ id, label, section, danger?, confirm? }]. `confirm` marks actions that ask first.
 */
export function conversationMenuItems(opts = {}) {
  const { kind, isGroup = false, isAgent = false, muted = false, blocked = false, huddles = false, polls = false, threads = true } = opts;
  const hub = (item) => ({ ...item, section: 'hub' });
  const act = (item) => ({ ...item, section: 'actions' });
  const mute = hub({ id: 'mute', label: muted ? 'Unmute notifications' : 'Mute notifications' });
  const video = huddles && !isAgent && act({ id: 'video', label: 'Start a video huddle' });
  const tools = [
    hub({ id: 'reminders', label: 'Reminders' }),
    hub({ id: 'pinned', label: 'Pinned messages' }),
    hub({ id: 'saved', label: 'Saved messages' }),
  ];
  if (kind === 'channel') {
    return [
      hub({ id: 'channelInfo', label: 'Channel info' }),
      hub({ id: 'members', label: 'Channel members' }),
      threads && hub({ id: 'threads', label: 'Threads' }),
      ...tools,
      mute,
      act({ id: 'search', label: 'Search in conversation' }),
      polls && act({ id: 'poll', label: 'Create poll' }),
      video,
    ].filter(Boolean);
  }
  return [
    isGroup ? hub({ id: 'groupInfo', label: 'Group info' }) : !isAgent && hub({ id: 'profile', label: 'View profile' }),
    ...tools,
    mute,
    act({ id: 'search', label: 'Search in conversation' }),
    video,
    !isGroup && !isAgent && act({ id: 'block', label: blocked ? 'Unblock user' : 'Block user', confirm: !blocked }),
    act({ id: 'clear', label: 'Clear chat', danger: true, confirm: true }),
    act({ id: 'delete', label: 'Delete chat', danger: true, confirm: true }),
  ].filter(Boolean);
}

/** Loaded messages whose decrypted text contains the query (newest first). */
export function searchConversation(items, query, limit = 50) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (let i = (items?.length || 0) - 1; i >= 0 && out.length < limit; i -= 1) {
    const m = items[i];
    if (!m || m.pending || m.state !== 'ok' || m.type === 'checklist') continue;
    const hay = [m.text, ...(m.attachments || []).map((a) => a?.name)].filter(Boolean).join('\n').toLowerCase();
    if (hay.includes(q)) out.push(m);
  }
  return out;
}

/** "Hello **team**, the …" → a one-line excerpt around the first match. */
export function matchExcerpt(text, query, radius = 40) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const q = String(query || '').trim().toLowerCase();
  const at = q ? t.toLowerCase().indexOf(q) : -1;
  if (at < 0) return t.length > radius * 2 ? `${t.slice(0, radius * 2)}…` : t;
  const start = Math.max(0, at - radius);
  const end = Math.min(t.length, at + q.length + radius);
  return `${start > 0 ? '…' : ''}${t.slice(start, end)}${end < t.length ? '…' : ''}`;
}
