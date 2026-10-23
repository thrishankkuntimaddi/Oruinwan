// What a conversation's ⋮ menu offers: the same items as the web client's chat header
// (client/src/features/messaging/chatWindowComp/header/header.jsx), in its order.
//   DM:      voice call, video call, search, reminders, pinned, saved, view profile, mute, block, clear, delete
//   Group:   voice call, video call, search, reminders, pinned, saved, group info, mute, clear, delete
//   Channel: huddle, poll, search, threads, reminders, pinned, saved, channel info, members, mute

/**
 * opts: { kind: 'channel' | 'dm', isGroup, isAgent, muted, blocked, huddles (calls available),
 * polls (can create one here), threads (threads are on) }.
 * Returns [{ id, label, danger?, confirm? }]. `confirm` marks actions that ask first.
 */
export function conversationMenuItems(opts = {}) {
  const { kind, isGroup = false, isAgent = false, muted = false, blocked = false, huddles = false, polls = false, threads = true } = opts;
  const mute = { id: 'mute', label: muted ? 'Unmute notifications' : 'Mute notifications' };
  const common = [
    { id: 'search', label: 'Search in conversation' },
    kind === 'channel' && threads && { id: 'threads', label: 'Threads' },
    { id: 'reminders', label: 'Reminders' },
    { id: 'pinned', label: 'Pinned messages' },
    { id: 'saved', label: 'Saved messages' },
  ];
  if (kind === 'channel') {
    return [
      huddles && { id: 'huddle', label: 'Start huddle' },
      polls && { id: 'poll', label: 'Create poll' },
      ...common,
      { id: 'channelInfo', label: 'Channel info' },
      { id: 'members', label: 'Channel members' },
      mute,
    ].filter(Boolean);
  }
  const calls = huddles && !isAgent;
  return [
    calls && { id: 'voice', label: 'Voice call' },
    calls && { id: 'video', label: 'Video call' },
    ...common,
    isGroup ? { id: 'groupInfo', label: 'Group info' } : !isAgent && { id: 'profile', label: 'View profile' },
    mute,
    !isGroup && !isAgent && { id: 'block', label: blocked ? 'Unblock user' : 'Block user', confirm: !blocked },
    { id: 'clear', label: 'Clear chat', danger: true, confirm: true },
    { id: 'delete', label: 'Delete chat', danger: true, confirm: true },
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
