// Live updates from the server over Socket.IO. Events refresh the matching cached lists;
// the screens then re-render from the query cache.
import { io } from 'socket.io-client';
import { emit } from '../../lib/bus.js';
import { accessToken, refreshSession } from './http.js';

let socket = null;
let workspaceId = null;
let lastAuthRetry = 0;

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
    emit('realtime', { connected: true });
    if (workspaceId) socket.emit('join-workspace', { workspaceId });
  });
  socket.on('disconnect', () => emit('realtime', { connected: false }));
  socket.on('connect_error', async (err) => {
    // Expired access token: refresh at most every 5 s, then reconnect.
    if (/token|auth/i.test(err?.message || '') && Date.now() - lastAuthRetry > 5000) {
      lastAuthRetry = Date.now();
      try {
        await refreshSession();
        socket?.connect();
      } catch {
        /* auth:expired already emitted when the session is gone */
      }
    }
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
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
