// Opens whatever a notification points at, in the tab that owns it.
import { nav } from '../../app/nav.js';
import { api } from '../../data/session.js';
import { setQueryData } from '../../data/query.js';
import { useSession } from '../../data/session.js';

export function openNotification(n) {
  if (!n.read) {
    const ws = useSession.getState().workspaceId;
    setQueryData(`notifications:${ws}`, (list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    api().markNotificationRead(n.id).catch(() => {});
  }
  const t = n.target;
  if (!t) return;
  if (t.kind === 'channel' || t.kind === 'dm') nav.open('chats', 'conversation', { kind: t.kind, id: t.id });
  else if (t.kind === 'thread') {
    nav.open('chats', 'conversation', { kind: t.convKind || 'channel', id: t.conv });
    nav.push('thread', { kind: t.convKind || 'channel', convId: t.conv, messageId: t.id });
  } else if (t.kind === 'task') nav.push('task', { id: t.id });
  else if (t.kind === 'note') nav.push('note', { id: t.id });
}
