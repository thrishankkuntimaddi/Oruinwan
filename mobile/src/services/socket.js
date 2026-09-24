/**
 * Singleton socket.io client.
 *  - connectSocket() is idempotent and returns the same socket while connecting.
 *  - Listeners are registered in a module registry (subscribe) so they can be
 *    added/removed synchronously, before or after the socket exists.
 *  - Rooms joined through this module are re-joined after every reconnect.
 *  - Handshake auth reads the latest access token; auth failures trigger a refresh.
 */
import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { loadTokens, getAccessTokenSync, refreshSession } from './tokens';
import { emit as emitEvent } from './events';

let socket = null;
let connectPromise = null;
let hasConnected = false;
let lastAuthRefresh = 0;
let status = 'disconnected'; // 'connecting' | 'connected' | 'disconnected'

const registry = new Map(); // event -> Set<handler>
const rooms = new Map(); // key -> () => void (re-join fn)
const statusListeners = new Set();

function setStatus(s) {
  status = s;
  statusListeners.forEach((fn) => fn(s));
}

export function getSocketStatus() { return status; }
export function onSocketStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function createSocket() {
  const s = io(SOCKET_URL, {
    auth: (cb) => cb({ token: getAccessTokenSync() }),
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 10000,
  });

  for (const [event, set] of registry) set.forEach((fn) => s.on(event, fn));

  s.on('connect', () => {
    setStatus('connected');
    rooms.forEach((join) => join());
    if (hasConnected) emitEvent('socket:reconnect');
    hasConnected = true;
  });
  s.on('disconnect', (reason) => {
    setStatus('disconnected');
    // Server-initiated disconnects are not retried automatically by socket.io.
    if (reason === 'io server disconnect') setTimeout(() => socket === s && s.connect(), 2000);
  });
  s.on('connect_error', (err) => {
    setStatus('disconnected');
    const msg = err?.message || '';
    if (/auth|token/i.test(msg) && Date.now() - lastAuthRefresh > 5000) {
      lastAuthRefresh = Date.now();
      refreshSession()
        .then(() => { if (socket === s && !s.connected) s.connect(); })
        .catch(() => {});
    }
  });
  s.on('join-error', ({ event, code, message } = {}) =>
    console.warn(`[Socket] join error on ${event} (${code}): ${message}`),
  );
  setStatus('connecting');
  return s;
}

export function connectSocket() {
  if (socket) {
    if (!socket.connected && !socket.active) socket.connect();
    return Promise.resolve(socket);
  }
  if (!connectPromise) {
    connectPromise = loadTokens()
      .then(() => {
        if (!socket) socket = createSocket();
        return socket;
      })
      .finally(() => { connectPromise = null; });
  }
  return connectPromise;
}

export function getSocket() { return socket; }
export function isSocketConnected() { return !!socket?.connected; }

export function disconnectSocket() {
  rooms.clear();
  hasConnected = false;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  setStatus('disconnected');
}

/** Subscribe to a server event. Returns a synchronous unsubscribe. */
export function subscribe(event, handler) {
  if (!registry.has(event)) registry.set(event, new Set());
  registry.get(event).add(handler);
  socket?.on(event, handler);
  return () => {
    registry.get(event)?.delete(handler);
    socket?.off(event, handler);
  };
}

function emit(event, ...args) {
  if (socket?.connected) socket.emit(event, ...args);
}

/** Emit and wait for the server ack (rejects on timeout / disconnected). */
export function emitWithAck(event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error('Socket not connected'));
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

// ── Rooms (tracked so they are re-joined on reconnect) ───────────────────
export function joinWorkspace(workspaceId) {
  if (!workspaceId) return () => {};
  const key = `ws:${workspaceId}`;
  const join = () => emit('join-workspace', { workspaceId });
  rooms.set(key, join);
  join();
  return () => rooms.delete(key);
}

/** Joins a channel room; resolves with the server ack ({success} | {error, code}). */
export function joinChannel(channelId) {
  const key = `ch:${channelId}`;
  let latest = Promise.resolve({ success: false, code: 'NOT_CONNECTED' });
  const join = () => {
    latest = emitWithAck('chat:join', channelId).catch((e) => ({ error: e.message, code: 'TIMEOUT' }));
    return latest;
  };
  rooms.set(key, join);
  if (socket?.connected) join();
  return {
    ack: () => latest,
    leave: () => {
      rooms.delete(key);
      emit('chat:leave', channelId);
    },
  };
}

export function joinDM(dmSessionId) {
  const key = `dm:${dmSessionId}`;
  const join = () => emit('join-dm', { dmSessionId });
  rooms.set(key, join);
  join();
  return () => {
    rooms.delete(key);
    emit('leave-dm', { dmSessionId });
  };
}

// ── Actions ──────────────────────────────────────────────────────────────
export function markRead(type, id) { emit('mark-chat-read', { type, id }); }

const lastTyping = new Map();
/** Throttled to one emit per 2.5 s per conversation. */
export function sendTyping({ dmSessionId, channelId }) {
  const key = dmSessionId || channelId;
  if (!key) return;
  const now = Date.now();
  if (now - (lastTyping.get(key) || 0) < 2500) return;
  lastTyping.set(key, now);
  emit('typing', dmSessionId ? { dmSessionId } : { channelId });
}

export function addReaction(messageId, emoji) { emit('add-reaction', { messageId, emoji }); }
export function removeReaction(messageId) { emit('remove-reaction', { messageId }); }
export function deleteMessage(params) { emit('delete-message', params); }
export function signalIdle() { emit('user:idle'); }
export function signalActive() { emit('user:active'); }
