// Live updates from the server over Socket.IO. Events refresh the matching cached lists;
// the screens then re-render from the query cache.
import { io } from 'socket.io-client';
import { emit } from '../../lib/bus.js';
import { accessToken, refreshSession } from './http.js';

let socket = null;
let workspaceId = null;
let retryTimer = null;
let retryDelay = 2000;

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

function messageEvent(payload) {
  const m = payload?.message || payload;
  const keys = ['channels', 'dms', 'workspaces'];
  const channelId = idOf(m?.channel) || payload?.channelId;
  const dmId = idOf(m?.dm) || payload?.dmSessionId;
  if (channelId) keys.push(`messages:${channelId}`);
  if (dmId) keys.push(`messages:${dmId}`);
  if (m?.parentId) keys.push(`thread:${idOf(m.parentId)}`, channelId ? `messages:${channelId}` : `messages:${dmId}`);
  emit('data:changed', keys);
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
  socket.on('connect_error', (err) => {
    // The server rejected the handshake (usually an expired access token). Socket.IO does not
    // retry those by itself, so refresh and reconnect with backoff until it works.
    if (/token|auth/i.test(err?.message || '')) scheduleAuthRetry();
  });

  socket.on('new-message', messageEvent);
  socket.on('thread-reply', messageEvent);
  for (const ev of ['message:edited', 'message:deleted', 'message-deleted', 'message:reaction_added', 'message:reaction_removed', 'reaction-added', 'reaction-removed', 'message-pinned', 'message-unpinned']) {
    socket.on(ev, (p) => {
      const channelId = p?.channelId || idOf(p?.message?.channel);
      const dmId = p?.dmSessionId || idOf(p?.message?.dm);
      emit('data:changed', [channelId && `messages:${channelId}`, dmId && `messages:${dmId}`].filter(Boolean).concat(channelId || dmId ? [] : ['messages']));
    });
  }
  socket.on('new-dm-session', () => emit('data:changed', ['dms']));
  for (const ev of ['channel-created', 'channel-updated', 'channel-deleted', 'channel-member-added']) socket.on(ev, () => emit('data:changed', ['channels']));
  for (const ev of ['task-created', 'task-updated', 'task-assigned', 'task-removed']) socket.on(ev, () => emit('data:changed', ['tasks', 'task:']));
  for (const ev of ['note-created', 'note-updated', 'note-deleted', 'note-shared']) socket.on(ev, () => emit('data:changed', ['notes', 'note:']));
  for (const ev of ['notification:new', 'notification:read', 'notification:read-all', 'notification:deleted', 'notification:cleared']) {
    socket.on(ev, () => emit('data:changed', ['notifications']));
  }
  socket.on('workspace-updated', () => emit('data:changed', ['workspaces']));
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
