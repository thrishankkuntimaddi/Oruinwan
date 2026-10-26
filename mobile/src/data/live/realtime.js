// Live updates from the server over Socket.IO. Events refresh the matching cached lists;
// the screens then re-render from the query cache.
import { io } from 'socket.io-client';
import { clearUnreadLocally } from '../unread.js';
import { emit } from '../../lib/bus.js';
import { accessToken, refreshSession } from './http.js';
import { NOTIFICATION_EVENTS, applyNotificationEvent } from './notificationLive.js';

let socket = null;
let workspaceId = null;
let retryTimer = null;
let retryDelay = 2000;

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

function messageEvent(payload) {
  // new-message carries { message }, thread-reply carries { parentId, reply }.
  const m = payload?.message || payload?.reply || payload;
  const keys = ['channels', 'dms', 'workspaces'];
  const channelId = idOf(m?.channel) || payload?.channelId;
  const dmId = idOf(m?.dm) || payload?.dmSessionId;
  if (channelId) keys.push(`messages:${channelId}`);
  if (dmId) keys.push(`messages:${dmId}`);
  const parentId = idOf(m?.parentId) || payload?.parentId;
  if (parentId) keys.push(`thread:${parentId}`);
  emit('data:changed', keys);
}

/** An edit, delete or reaction: refresh the conversation, and the thread when it is a reply. */
function changeEvent(p) {
  const msg = p?.message || p;
  const channelId = p?.channelId || idOf(p?.channel) || idOf(msg?.channel);
  const dmId = p?.dmSessionId || p?.dmId || idOf(p?.dm) || idOf(msg?.dm);
  const parentId = p?.parentId || idOf(msg?.parentId);
  const keys = [channelId && `messages:${channelId}`, dmId && `messages:${dmId}`, parentId && `thread:${parentId}`].filter(Boolean);
  // A thread's own parent changed (edited or deleted): its thread view shows it too.
  const id = p?.messageId || idOf(msg);
  if (id) keys.push(`thread:${id}`);
  emit('data:changed', keys.length ? keys : ['messages']);
}

export function connectRealtime(base) {
  disconnectRealtime();
  socket = io(base, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: accessToken() }),
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    retryDelay = 2000;
    clearTimeout(retryTimer);
    retryTimer = null;
    emit('realtime', { connected: true });
    if (workspaceId) socket.emit('join-workspace', { workspaceId });
  });
  socket.on('disconnect', () => emit('realtime', { connected: false }));
  // Huddle signalling and live/ended announcements go to the huddle client (features/huddles).
  socket.onAny((event, payload) => {
    if (event.startsWith('huddle:')) emit('huddle', { event, payload });
    else {
      // Meeting rooms (features/meetings): brainstorm board and agenda changes.
      if (event.startsWith('brainstorm:') || event.startsWith('meeting:')) emit('meeting', { event, payload });
      // Everything else too, for features that patch what they show (polls, checklists, reminders).
      emit('socket', { event, payload });
    }
  });
  socket.on('connect_error', (err) => {
    // The server rejected the handshake (usually an expired access token). Socket.IO does not
    // retry those by itself, so refresh and reconnect with backoff until it works.
    if (/token|auth/i.test(err?.message || '')) scheduleAuthRetry();
  });

  socket.on('new-message', messageEvent);
  socket.on('thread-reply', messageEvent);
  // Oruinwan AI answering in a conversation, streamed to everyone in it.
  socket.on('ai:reply', (p) => emit('ai:reply', p));
  for (const ev of ['message:edited', 'message:deleted', 'message-deleted', 'message:reaction_added', 'message:reaction_removed', 'reaction-added', 'reaction-removed', 'message-pinned', 'message-unpinned', 'message-updated']) {
    socket.on(ev, changeEvent);
  }
  socket.on('new-dm-session', () => emit('data:changed', ['dms']));
  // Read on another device (or another tab): clear its unread count here too.
  socket.on('conversation:read', (p) => {
    if (p?.conversationId) clearUnreadLocally(p.conversationType === 'channel' ? 'channel' : 'dm', p.conversationId);
  });
  // I joined a workspace on another device (an invitation accepted in the browser).
  socket.on('workspaces:changed', () => emit('data:changed', ['workspaces']));
  // Group DMs: renamed, people added or removed, or I was removed.
  socket.on('dm:members_updated', () => emit('data:changed', ['dms']));
  socket.on('dm:removed', () => emit('data:changed', ['dms']));
  // The conversation got a new key (a group added or removed someone): fetch it before the next send.
  socket.on('conversation:key_rotated', (p) => emit('key:rotated', { conversationId: p?.conversationId, conversationType: p?.conversationType }));
  // invited-to-channel: someone added me to a channel (I'm not in its room yet).
  for (const ev of ['channel-created', 'channel-updated', 'channel-deleted', 'channel-member-added', 'invited-to-channel']) socket.on(ev, () => emit('data:changed', ['channels']));
  for (const ev of ['task-created', 'task-updated', 'task-assigned', 'task-removed']) socket.on(ev, () => emit('data:changed', ['tasks', 'task:']));
  // A task's Discussion tab: comments and automatic entries.
  for (const ev of ['task:discussion', 'task:discussion-removed']) socket.on(ev, (p) => emit('data:changed', [p?.taskId ? `taskdisc:${p.taskId}` : 'taskdisc:']));
  // Threads views: lock state.
  socket.on('thread:locked', () => emit('data:changed', ['threads:']));
  for (const ev of ['note-created', 'note-updated', 'note-deleted', 'note-shared']) socket.on(ev, () => emit('data:changed', ['notes', 'note:']));
  // Patch the cached list in place (a refetch per event made the list jump and flood).
  for (const ev of NOTIFICATION_EVENTS) socket.on(ev, (p) => applyNotificationEvent(ev, p));
  socket.on('workspace-updated', () => emit('data:changed', ['workspaces']));
  // Send later: the server sent one (or couldn't): the Scheduled and Sent lists update live, and a
  // failure says why (it stays in Scheduled to retry or edit).
  socket.on('scheduled-message:sent', () => emit('data:changed', ['scheduled:', 'sent:']));
  socket.on('scheduled-message:failed', (p) => {
    emit('data:changed', ['scheduled:']);
    emit('toast', { message: `A scheduled message wasn't sent${p?.error ? `: ${p.error}` : ''}. It's in Scheduled to try again.`, tone: 'danger', id: `sched-${p?.id || ''}` });
  });
  // Free-plan limits (features/plan): today's AI count after each request, and an invitee who
  // couldn't join my workspace because they reached their own limit.
  socket.on('plan:ai_usage', (p) => emit('plan:ai_usage', p));
  socket.on('plan:limit_reached', (p) => emit('plan:limit_reached', p));
  for (const ev of ['user:online', 'user:offline', 'user:idle', 'user-status-changed']) socket.on(ev, () => emit('data:changed', ['members']));
}

function scheduleAuthRetry() {
  if (retryTimer || !socket) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try {
      await refreshSession();
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) return; // session is gone: auth:expired was emitted
    }
    retryDelay = Math.min(retryDelay * 2, 60000);
    socket?.connect();
  }, retryDelay);
}

/** Called when the app comes back to the foreground. */
export function resumeRealtime() {
  if (socket && !socket.connected) {
    retryDelay = 2000;
    socket.connect();
  }
}

export function joinWorkspace(id) {
  workspaceId = id;
  if (socket?.connected && id) socket.emit('join-workspace', { workspaceId: id });
}

export function socketEmit(event, payload) {
  if (socket?.connected) socket.emit(event, payload);
}

/** An emit the server answers with an acknowledgement (null when offline or after a timeout). */
export function socketRequest(event, payload, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve(null);
    const t = setTimeout(() => resolve(null), timeoutMs);
    socket.emit(event, payload, (res) => {
      clearTimeout(t);
      resolve(res ?? null);
    });
  });
}

export const realtimeConnected = () => Boolean(socket?.connected);

/** The app's socket (or null), for live document editing (lib/collab). */
export const realtimeSocket = () => socket;

export function setActive(active) {
  socketEmit(active ? 'user:active' : 'user:idle', {});
}

export function disconnectRealtime() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
