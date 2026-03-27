/**
 * Chttrix Mobile — Socket.IO Client
 * Real-time WebSocket connection for messages, presence, and notifications.
 */
import { io } from 'socket.io-client';
import { getToken } from './storage';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5001';

let socket = null;

/**
 * Connect to the Chttrix Socket.IO server with an authenticated JWT.
 * Returns the socket instance (idempotent — reuses existing connection).
 */
export async function connectSocket() {
  if (socket?.connected) return socket;

  const token = await getToken();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Return the current socket instance (may be null if not yet connected).
 */
export function getSocket() {
  return socket;
}

/**
 * Cleanly disconnect and reset the socket reference.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join a DM session room for real-time messages.
 * @param {string} dmSessionId
 */
export function joinDM(dmSessionId) {
  socket?.emit('join-dm', { dmSessionId });
}

/**
 * Join a channel room.
 * @param {string} channelId
 */
export function joinChannel(channelId) {
  socket?.emit('chat:join', channelId);
}

/**
 * Send a typing indicator.
 * @param {{ dmSessionId?: string, channelId?: string }} params
 */
export function sendTyping(params) {
  socket?.emit('typing', params);
}
