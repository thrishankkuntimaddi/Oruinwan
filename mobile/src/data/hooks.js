// Query hooks for the active workspace. Keys start with the entity name so
// invalidate('tasks') refreshes every workspace's task list.
import { useMemo } from 'react';
import { api, useSession } from './session.js';
import { useQuery } from './query.js';

const useWs = () => useSession((s) => s.workspaceId);

export function useChannels() {
  const ws = useWs();
  return useQuery(ws && `channels:${ws}`, () => api().channels(ws));
}
export function useDms() {
  const ws = useWs();
  return useQuery(ws && `dms:${ws}`, () => api().dms(ws));
}
export function useMembers() {
  const ws = useWs();
  return useQuery(ws && `members:${ws}`, () => api().members(ws), { staleMs: 5 * 60_000 });
}
/** id → user lookup for the active workspace, including the signed-in user. */
export function useDirectory() {
  const { data } = useMembers();
  const me = useSession((s) => s.user);
  return useMemo(() => {
    const map = Object.fromEntries((data || []).map((u) => [u.id, u]));
    if (me) map[me.id] = { ...map[me.id], ...me };
    return map;
  }, [data, me]);
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
