// Opens whatever a notification points at, in the tab that owns it.
import { nav } from '../../app/nav.js';
import { api } from '../../data/session.js';
import { setQueryData } from '../../data/query.js';
import { useSession } from '../../data/session.js';
import { pushTarget } from '../../data/live/notificationTarget.js';

/**
 * A tapped push notification: switch to its workspace if needed, then open its conversation
 * (or the Activity tab when it points at something else).
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
    return;
  }
  // Meeting reminders, design reviews, AI suggestions… open what they're about.
  if (!openTarget(pushTarget(data))) nav.open('activity');
}

/** Opens a notification target; false when there's nothing to open. */
export function openTarget(t) {
  if (!t) return false;
  if (t.kind === 'channel' || t.kind === 'dm') nav.open('chats', 'conversation', { kind: t.kind, id: t.id });
  else if (t.kind === 'thread') {
    nav.open('chats', 'conversation', { kind: t.convKind || 'channel', id: t.conv });
    nav.push('thread', { kind: t.convKind || 'channel', convId: t.conv, messageId: t.id });
  } else if (t.kind === 'meeting') nav.push('meeting', t.tab ? { id: t.id, tab: t.tab } : { id: t.id });
  // Design reviews live in Tasks → Planning, so a review opens in the Tasks tab.
  else if (t.kind === 'designReview') nav.push('designReview', { id: t.id }, { tab: 'tasks' });
  else if (t.kind === 'task') nav.push('task', { id: t.id });
  else if (t.kind === 'tasks') nav.setTab('tasks');
  else if (t.kind === 'note') nav.push('note', { id: t.id });
  else return false;
  return true;
}

export function openNotification(n) {
  if (!n.read) {
    const ws = useSession.getState().workspaceId;
    setQueryData(`notifications:${ws}`, (list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    api().markNotificationRead(n.id).catch(() => {});
  }
  openTarget(n.target);
}
