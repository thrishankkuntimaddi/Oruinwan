// Opens whatever a notification points at, in the tab that owns it.
import { nav } from '../../app/nav.js';
import { api } from '../../data/session.js';
import { setQueryData } from '../../data/query.js';
import { useSession } from '../../data/session.js';
import { pushTarget } from '../../data/live/notificationTarget.js';
import { parseConversationLink } from '../../lib/shareContent.js';
import { toast } from '../../lib/bus.js';

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

/** Opens a parsed message/thread link once signed in ({ workspaceId, kind, id, messageId, threadId }). */
export function openLinkTarget(link) {
  const session = useSession.getState();
  if (link.workspaceId && link.workspaceId !== session.workspaceId) {
    if (!session.workspaces.some((w) => w.id === link.workspaceId)) {
      toast("That message is in a workspace you're not in", 'danger');
      return;
    }
    session.switchWorkspace(link.workspaceId);
  }
  if (session.pickingWorkspace) useSession.setState({ pickingWorkspace: false });
  nav.open('chats', 'conversation', link.messageId && !link.threadId ? { kind: link.kind, id: link.id, highlight: link.messageId } : { kind: link.kind, id: link.id });
  if (link.threadId) nav.push('thread', { kind: link.kind, convId: link.id, messageId: link.threadId });
}

let pendingOff = null;

/**
 * A shared message or thread link (https://<web>/workspace/…, oruinwan://workspace/…) opened the
 * app: show it, after sign-in if needed. Returns false when the link isn't one.
 */
export function openConversationLink(url) {
  const link = parseConversationLink(url);
  if (!link) return false;
  pendingOff?.();
  pendingOff = null;
  if (useSession.getState().status === 'signed-in') {
    openLinkTarget(link);
    return true;
  }
  pendingOff = useSession.subscribe((s) => {
    if (s.status !== 'signed-in') return;
    pendingOff?.();
    pendingOff = null;
    openLinkTarget(link);
  });
  return true;
}
