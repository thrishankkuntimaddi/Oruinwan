import { io } from 'socket.io-client';
import { getToken } from './storage';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5001';

let socket = null;

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

  socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
  socket.on('disconnect', (reason) => console.warn('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));
  socket.on('join-error', ({ event, code, message }) =>
    console.warn(`[Socket] Join error on ${event} (${code}): ${message}`)
  );

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinWorkspace(workspaceId) {
  socket?.emit('join-workspace', { workspaceId });
}

export function leaveWorkspace(workspaceId) {
  
}

export function joinChannel(channelId, ackCallback) {
  if (!socket) return;
  if (typeof ackCallback === 'function') {
    socket.emit('chat:join', channelId, ackCallback);
  } else {
    socket.emit('chat:join', channelId);
  }
}

export function leaveChannel(channelId) {
  if (socket) socket.emit('chat:leave', channelId); 
}

export function joinDM(dmSessionId) {
  socket?.emit('join-dm', { dmSessionId });
}

export function leaveDM(dmSessionId) {
  if (socket) socket.emit('leave-dm', { dmSessionId });
}

export function socketSendMessage(payload) {
  socket?.emit('send-message', payload);
}

export function markRead(type, id) {
  socket?.emit('mark-chat-read', { type, id });
}

export function sendTyping({ dmSessionId, channelId }) {
  socket?.emit('typing', { dmSessionId, channelId });
}

export function addReaction(messageId, emoji) {
  socket?.emit('add-reaction', { messageId, emoji });
}

export function removeReaction(messageId) {
  socket?.emit('remove-reaction', { messageId });
}

export function deleteMessage(params) {
  socket?.emit('delete-message', params);
}

export function signalIdle() {
  socket?.emit('user:idle');
}

export function signalActive() {
  socket?.emit('user:active');
}
