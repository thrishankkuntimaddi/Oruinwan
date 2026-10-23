// Marking an open conversation read (readBy on the server, read receipts for others).
// Over the socket when it is connected; otherwise over REST, so a read is never dropped
// because the page opened (or came back) before the realtime connection did.

/** One send per conversation, newest message and connection state. */
export function markReadKey({ type, id, latestEventId, connected }) {
    return `${type}:${id}:${latestEventId || ''}:${connected ? 'socket' : 'rest'}`;
}

/**
 * Sends the read. `post(url, body)` is the REST client (returns a promise).
 * Returns 'socket' | 'rest' | null (nothing to mark).
 */
export function sendMarkRead({ socket, post, type, id, receipts = true, onError }) {
    if (!type || !id) return null;
    const body = { type, id: String(id), receipts };
    if (socket?.connected) {
        socket.emit('mark-chat-read', body);
        return 'socket';
    }
    if (!post) return null;
    Promise.resolve()
        .then(() => post('/api/chat/reset-unread', body))
        .catch((err) => onError?.(err));
    return 'rest';
}
