// Query hooks for the active workspace. Keys start with the entity name so
// invalidate('tasks') refreshes every workspace's task list.
import { useEffect, useMemo } from 'react';
import { api, useSession } from './session.js';
import { useQuery } from './query.js';
import { activePeople } from '../lib/standing.js';
import { setMentionNames } from '../../../platform/people/mentions.js';

const useWs = () => useSession((s) => s.workspaceId);

export function useChannels() {
  const ws = useWs();
  return useQuery(ws && `channels:${ws}`, () => api().channels(ws));
}
export function useDms() {
  const ws = useWs();
  return useQuery(ws && `dms:${ws}`, () => api().dms(ws));
}
/** Everyone, including people who left or were removed (names on what they wrote). */
export function useAllMembers() {
  const ws = useWs();
  const q = useQuery(ws && `members:${ws}`, () => api().members(ws), { staleMs: 5 * 60_000 });
  // Messages draw "@Full Name" as one mention once they know the workspace's usernames.
  useEffect(() => {
    if (q.data) setMentionNames(q.data.map((u) => u?.username));
  }, [q.data]);
  return q;
}
/** The people who can be messaged, mentioned and added: active members only. */
export function useMembers() {
  const q = useAllMembers();
  const data = useMemo(() => (q.data ? activePeople(q.data) : q.data), [q.data]);
  return { ...q, data };
}
/** id → user lookup for the active workspace (former members too), including the signed-in user. */
export function useDirectory() {
  const { data } = useAllMembers();
  const me = useSession((s) => s.user);
  return useMemo(() => {
    const map = Object.fromEntries((data || []).map((u) => [u.id, u]));
    if (me) map[me.id] = { ...map[me.id], ...me };
    return map;
  }, [data, me]);
}
/** Agents installed in this workspace: Oruinwan AI, Claude, ChatGPT… */
export function useAgents() {
  const ws = useWs();
  return useQuery(ws && `agents:${ws}`, () => api().agents?.(ws) ?? []);
}
/** Oruinwan AI plus the models this workspace connected (Claude, ChatGPT, Gemini, Grok). */
export function useAssistants() {
  const ws = useWs();
  return useQuery(ws && `assistants:${ws}`, () => api().assistants?.(ws) ?? []);
}
export function useTasks() {
  const ws = useWs();
  return useQuery(ws && `tasks:${ws}`, () => api().tasks(ws));
}
export function useNotes() {
  const ws = useWs();
  return useQuery(ws && `notes:${ws}`, () => api().notes(ws));
}
export function useNotifications() {
  const ws = useWs();
  return useQuery(ws && `notifications:${ws}`, () => api().notifications(ws), { staleMs: 15_000 });
}
export function useKnowledge() {
  const ws = useWs();
  return useQuery(ws && `knowledge:${ws}`, () => api().knowledge(ws), { staleMs: 60_000 });
}
export function useFiles() {
  const ws = useWs();
  return useQuery(ws && `files:${ws}`, () => api().files(ws), { staleMs: 60_000 });
}
/** Files shared with the person: filters { kind, source, q, sort, limit } (features/files/filesUi.js). */
export function useSharedFiles({ kind = 'all', source = 'all', q = '', sort = 'newest', limit = 50 } = {}) {
  const ws = useWs();
  return useQuery(
    ws && `files:${ws}:shared:${kind}:${source}:${q}:${sort}:${limit}`,
    () => api().sharedFiles(ws, { kind, source, q, sort, limit }),
    { staleMs: 30_000 },
  );
}
export function useIntegrations() {
  const ws = useWs();
  return useQuery(ws && `integrations:${ws}`, () => api().integrations(ws), { staleMs: 60_000 });
}
export function useSessions() {
  return useQuery('sessions', () => api().sessions());
}

/** Total unread across channels (not muted) and DMs, plus mentions. */
export function useUnreadCounts() {
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const { data: notifications } = useNotifications();
  return useMemo(() => {
    const ch = (channels || []).filter((c) => c.isMember && !c.muted);
    return {
      channels: ch.reduce((a, c) => a + (c.unread || 0), 0),
      mentions: ch.reduce((a, c) => a + (c.mentions || 0), 0),
      dms: (dms || []).reduce((a, d) => a + (d.unread || 0), 0),
      notifications: (notifications || []).filter((n) => !n.read).length,
    };
  }, [channels, dms, notifications]);
}
