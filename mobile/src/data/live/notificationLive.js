// The notifications list (Home and Notifications screens) from server rows, kept live from socket
// events by patching the cached list in place instead of refetching it on every event.
import { invalidate, setQueryData } from '../query.js';
import { notificationKind, targetOf } from './notificationTarget.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

export function mapNotification(n) {
  return {
    id: idOf(n),
    type: notificationKind(n.type),
    actorId: idOf(n.actor || n.sender || n.meta?.actorId || n.meta?.senderId),
    actorName: n.meta?.assignerUsername || n.meta?.senderUsername || n.meta?.senderName || n.meta?.actorName
      || (typeof n.meta?.startedBy === 'string' ? n.meta.startedBy : n.meta?.startedBy?.username) // huddles
      || (n.title || '').split(' ')[0],
    title: n.title,
    text: n.title,
    preview: n.body || '',
    // A grouped chat row ("Ben · 5 new messages") moves up with its latest message.
    at: n.updatedAt || n.createdAt,
    count: Math.max(1, Number(n.meta?.count) || 1),
    read: Boolean(n.read),
    target: targetOf(n),
  };
}

const keyFor = (ws) => `notifications:${ws}`;
const LIMIT = 50;

/**
 * Apply one `notification:*` socket event to the cached list of its workspace.
 * Returns true when the cache was patched; unknown shapes fall back to a refetch.
 */
export function applyNotificationEvent(event, payload = {}) {
  const ws = payload.workspaceId || payload.notification?.workspaceId;
  if (!ws) {
    invalidate('notifications');
    return false;
  }
  const key = keyFor(String(ws));
  const ids = new Set((payload.ids || []).map(String));
  switch (event) {
    case 'notification:new':
    case 'notification:updated': {
      const row = mapNotification(payload.notification || {});
      if (!row.id) return false;
      setQueryData(key, (list) => (list ? [row, ...list.filter((x) => x.id !== row.id)].slice(0, LIMIT) : list));
      return true;
    }
    case 'notification:read':
      setQueryData(key, (list) => list?.map((x) => (ids.has(x.id) ? { ...x, read: true } : x)));
      return true;
    case 'notification:read-all':
      setQueryData(key, (list) => list?.map((x) => (x.read ? x : { ...x, read: true })));
      return true;
    case 'notification:deleted':
      setQueryData(key, (list) => list?.filter((x) => !ids.has(x.id)));
      return true;
    case 'notification:cleared':
      setQueryData(key, (list) => (list ? [] : list));
      return true;
    default:
      return false;
  }
}

export const NOTIFICATION_EVENTS = ['notification:new', 'notification:updated', 'notification:read', 'notification:read-all', 'notification:deleted', 'notification:cleared'];
