// Opens whatever a notification points at, in the tab that owns it.
import { nav } from '../../app/nav.js';
import { api } from '../../data/session.js';
import { setQueryData } from '../../data/query.js';
import { useSession } from '../../data/session.js';

/**
 * A tapped push notification: switch to its workspace if needed, then open its conversation
 * (or the Notifications list when it points at something else).
 */
export function openPush(data = {}) {
  const session = useSession.getState();
  if (session.status !== 'signed-in') return;
  if (data.workspaceId && data.workspaceId !== session.workspaceId && session.workspaces.some((w) => w.id === data.workspaceId)) {
    session.switchWorkspace(data.workspaceId);
  }
  if (session.pickingWorkspace) useSession.setState({ pickingWorkspace: false });
  const conv = data.channelId ? { kind: 'channel', id: data.channelId } : data.dmSessionId ? { kind: 'dm', id: data.dmSessionId } : null;
  if (conv) {
    nav.open('chats', 'conversation', conv);
    // A thread reply opens its thread on top of the conversation.
    if (data.parentMessageId) nav.push('thread', { kind: conv.kind, convId: conv.id, messageId: data.parentMessageId });
  } else nav.push('notifications');
}

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
  } else if (t.kind === 'meeting') nav.push('meeting', { id: t.id });
  else if (t.kind === 'task') nav.push('task', { id: t.id });
  else if (t.kind === 'note') nav.push('note', { id: t.id });
}
