/**
 * Poll Socket Handlers
 * 
 * Handles all socket events related to polls:
 * - Poll created/voted/closed/deleted
 * 
 * @module socket/handlers/polls
 */

/**
 * Register poll-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerPollHandlers(io, socket) {

    /**
     * Poll created - broadcast to channel
     */
    socket.on('poll:created', (data) => {
        const { channelId, poll } = data;

        if (!channelId || !poll) {
            socket.emit('error', { message: 'Missing channelId or poll' });
            return;
        }



        // Broadcast to channel
        io.to(`channel:${channelId}`).emit('poll:new', poll);
    });

    /**
     * Poll voted - broadcast updated poll
     */
    socket.on('poll:voted', (data) => {
        const { channelId, poll } = data;

        if (!channelId || !poll) return;



        // Broadcast updated poll to channel
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    /**
     * Poll closed - broadcast update
     */
    socket.on('poll:closed', (data) => {
        const { channelId, poll } = data;

        if (!channelId || !poll) return;



        // Broadcast updated poll
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    /**
     * Poll deleted - broadcast removal
     */
    socket.on('poll:deleted', (data) => {
        const { channelId, pollId } = data;

        if (!channelId || !pollId) return;



        // Broadcast removal
        io.to(`channel:${channelId}`).emit('poll:removed', { pollId });
    });
}

module.exports = registerPollHandlers;
