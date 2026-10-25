// The Chats list: one list of channels, DMs, groups and agents, newest first, like WhatsApp.
// Up to three pinned chats sit on top; archived chats move to "Archived". Unread chats keep
// their place in time order and only get a count badge.
import { useMemo } from 'react';
import { api, useSession } from '../../data/session.js';
import { setQueryData, useQuery } from '../../data/query.js';
import { toast } from '../../lib/bus.js';

export const MAX_PINS = 3;

const keyOf = (kind, id) => `${kind}:${id}`;
const prefsKey = (ws) => ws && `convPrefs:${ws}`;

/** My pinned and archived chats, as a Map of "kind:id" → { pinnedAt, archivedAt }. */
export function useConversationPrefs() {
  const ws = useSession((s) => s.workspaceId);
  const { data } = useQuery(api().conversationPrefs && prefsKey(ws), () => api().conversationPrefs(ws), { staleMs: 60_000 });
  return useMemo(() => new Map((data || []).map((p) => [keyOf(p.kind, p.id), p])), [data]);
}

function patchPrefs(ws, conv, patch) {
  const now = new Date().toISOString();
  return setQueryData(prefsKey(ws), (list = []) => {
    const rest = list.filter((p) => !(p.kind === conv.kind && p.id === conv.id));
    const cur = list.find((p) => p.kind === conv.kind && p.id === conv.id) || { kind: conv.kind, id: conv.id, pinnedAt: null, archivedAt: null };
    const next = { ...cur };
    if ('pinned' in patch) {
      next.pinnedAt = patch.pinned ? now : null;
      if (patch.pinned) next.archivedAt = null;
    }
    if ('archived' in patch) {
      next.archivedAt = patch.archived ? now : null;
      if (patch.archived) next.pinnedAt = null;
    }
    return [...rest, next];
  });
}

/** Pin, unpin, archive or unarchive a chat for me (optimistic; rolled back if the server refuses). */
export async function setChatPref(conv, patch, prefs) {
  const ws = useSession.getState().workspaceId;
  if (patch.pinned && prefs) {
    const pinned = [...prefs.values()].filter((p) => p.pinnedAt && !(p.kind === conv.kind && p.id === conv.id)).length;
    if (pinned >= MAX_PINS) {
      toast(`You can pin up to ${MAX_PINS} chats. Unpin one first.`, 'danger');
      return false;
    }
  }
  const before = patchPrefs(ws, conv, patch);
  try {
    await api().setConversationPref(ws, conv, patch);
    return true;
  } catch (err) {
    setQueryData(prefsKey(ws), before);
    toast(err.code === 'PIN_LIMIT' ? `You can pin up to ${MAX_PINS} chats. Unpin one first.` : err.message || 'Could not change that chat', 'danger');
    return false;
  }
}

/** Every chat as { kind, item, key, pinnedAt, archivedAt }: joined channels, DMs, groups, agent DMs. */
export function allChats(channels = [], dms = [], prefs = new Map()) {
  const rows = [
    ...channels.filter((c) => c.isMember).map((c) => ({ kind: 'channel', item: c })),
    ...dms.map((d) => ({ kind: 'dm', item: d })),
  ];
  return rows.map((r) => {
    const key = keyOf(r.kind, r.item.id);
    const p = prefs.get(key);
    return { ...r, key, pinnedAt: p?.pinnedAt || null, archivedAt: p?.archivedAt || null };
  });
}

const byRecent = (a, b) => String(b.item.lastAt || '').localeCompare(String(a.item.lastAt || ''));

/**
 * The list for a segment: pinned chats first (in the order they were pinned), then the rest
 * newest first. Archived chats are left out (see archivedChats). Unread chats are not moved.
 * segment: 'all' | 'channels' | 'dms' | 'agents'.
 */
export function chatListFor(rows, segment = 'all') {
  const inSegment = rows.filter((r) => {
    if (r.archivedAt) return false;
    if (segment === 'channels') return r.kind === 'channel';
    if (segment === 'dms') return r.kind === 'dm' && !r.item.agentId;
    if (segment === 'agents') return r.kind === 'dm' && Boolean(r.item.agentId);
    return true;
  });
  const pinned = inSegment.filter((r) => r.pinnedAt).sort((a, b) => String(a.pinnedAt).localeCompare(String(b.pinnedAt)));
  const rest = inSegment.filter((r) => !r.pinnedAt).sort(byRecent);
  return [...pinned, ...rest];
}

export const archivedChats = (rows) => rows.filter((r) => r.archivedAt).sort(byRecent);

export const isUnreadRow = (r) => r.item.unread > 0 && !r.item.muted;

/** Unread count per segment, for the tab chips (muted chats don't count). */
export function segmentCounts(rows) {
  const sum = (seg) => chatListFor(rows, seg).filter(isUnreadRow).reduce((n, r) => n + (r.item.unread || 0), 0);
  return { all: sum('all'), channels: sum('channels'), dms: sum('dms'), agents: sum('agents') };
}

/** "You: …", "Ben: …" in channels and groups, the text alone in a 1:1 DM. */
export function previewText(row, me, plain) {
  const { item, kind } = row;
  const text = item.lastText ? plain(item.lastText) : '';
  if (!text) {
    if (kind === 'channel') return item.lastAt ? 'New message' : item.topic || 'No messages yet';
    return item.lastAt ? 'New message' : 'No messages yet';
  }
  const sender = item.lastSender;
  if (sender?.id && sender.id === me) return `You: ${text}`;
  if ((kind === 'channel' || item.isGroup) && sender?.name) return `${sender.name.split(' ')[0]}: ${text}`;
  return text;
}
