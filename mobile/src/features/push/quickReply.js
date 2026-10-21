// What a message notification's actions do. Taps open the conversation (openPush); "Mark as
// read" clears it without opening anything; "Reply" opens the conversation (or thread) with the
// typed text in the composer, focused, because replies are encrypted inside the app. The person
// sends it with one tap, and can still edit it.
import { nav, useNav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { toast } from '../../lib/bus.js';
import { openPush } from '../home/openTarget.js';
import { repostWithActions } from '../../native/push.js';

/** The conversation a push is about: { kind, id, parentId } or null. */
export function conversationOf(data = {}) {
  if (data.channelId) return { kind: 'channel', id: String(data.channelId), parentId: data.parentMessageId || null };
  if (data.dmSessionId) return { kind: 'dm', id: String(data.dmSessionId), parentId: data.parentMessageId || null };
  return null;
}

/** 'open' | 'read' | 'reply' | 'notifications' for a notification and its action. */
export function quickReplyPlan(data, action) {
  const conv = conversationOf(data);
  if (!conv) return { kind: 'notifications' };
  if (action?.id === 'read') return { kind: 'read', conv };
  if (action?.id === 'reply') return { kind: 'reply', conv, text: (action.input || '').trim() };
  return { kind: 'open', conv };
}

export async function handleNotification(data = {}, action = null) {
  const plan = quickReplyPlan(data, action);
  const session = useSession.getState();
  if (session.status !== 'signed-in') return;
  if (plan.kind === 'read') {
    try {
      await api().markConversationRead(plan.conv);
      invalidate('channels', 'dms', `messages:${plan.conv.id}`);
    } catch (err) {
      toast(err.message || "Couldn't mark it as read", 'danger');
    }
    return;
  }
  if (plan.kind !== 'reply' || !plan.text) {
    openPush(data);
    return;
  }
  if (data.workspaceId && data.workspaceId !== session.workspaceId && session.workspaces.some((w) => w.id === data.workspaceId)) {
    session.switchWorkspace(data.workspaceId);
  }
  if (session.pickingWorkspace) useSession.setState({ pickingWorkspace: false });
  const { conv, text } = plan;
  if (conv.parentId) {
    nav.open('chats', 'conversation', { kind: conv.kind, id: conv.id });
    nav.push('thread', { kind: conv.kind, convId: conv.id, messageId: conv.parentId, draft: text });
  } else {
    nav.open('chats', 'conversation', { kind: conv.kind, id: conv.id, draft: text });
  }
}

/** The conversation on screen right now (its notifications aren't shown). */
function openConversationId() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
  const { tab, stacks } = useNav.getState();
  if (tab !== 'chats') return null;
  const top = stacks.chats[stacks.chats.length - 1];
  if (!top) return null;
  if (top.name === 'conversation') return String(top.params.id);
  if (top.name === 'thread') return String(top.params.convId);
  return null;
}

/** A push while the app runs: Android re-posts it with the actions, unless it's on screen. */
export function handleReceived(notification) {
  const conv = conversationOf(notification?.data);
  if (!conv) return;
  repostWithActions(notification, { show: openConversationId() !== conv.id });
}
