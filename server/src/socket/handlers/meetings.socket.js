/**
 * Meeting Socket Handlers
 * 
 * Handles all socket events related to meetings:
 * - Meeting join/leave
 * - Meeting state changes
 * - Participant updates
 * 
 * @module socket/handlers/meetings
 */

/**
 * Register meeting-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerMeetingHandlers(io, socket) {

    /**
     * Join a meeting
     */
    socket.on('meeting:join', (data) => {
        const { meetingId, channelId } = data;

        if (!meetingId) {
            socket.emit('error', { message: 'Missing meetingId' });
            return;
        }

        // Join meeting room
        socket.join(`meeting:${meetingId}`);
        console.log(`📹 User ${socket.user.id} joined meeting:${meetingId}`);

        // Broadcast to all meeting participants
        io.to(`meeting:${meetingId}`).emit('meeting:joined', {
            meetingId,
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            timestamp: new Date()
        });

        // Also notify channel (if provided)
        if (channelId) {
            io.to(`channel:${channelId}`).emit('meeting:participant_joined', {
                meetingId,
                userId: socket.user.id
            });
        }
    });

    /**
     * Leave a meeting
     */
    socket.on('meeting:leave', (data) => {
        const { meetingId, channelId } = data;

        if (!meetingId) return;

        // Leave meeting room
        socket.leave(`meeting:${meetingId}`);
        console.log(`👋 User ${socket.user.id} left meeting:${meetingId}`);

        // Broadcast to remaining participants
        io.to(`meeting:${meetingId}`).emit('meeting:left', {
            meetingId,
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            timestamp: new Date()
        });

        // Notify channel
        if (channelId) {
            io.to(`channel:${channelId}`).emit('meeting:participant_left', {
                meetingId,
                userId: socket.user.id
            });
        }
    });

    /**
     * Meeting ended
     * Usually emitted by the host or server
     */
    socket.on('meeting:end', async (data) => {
        const { meetingId, channelId, duration } = data;

        if (!meetingId) return;

        // Broadcast to all participants
        io.to(`meeting:${meetingId}`).emit('meeting:ended', {
            meetingId,
            endedBy: socket.user.id,
            duration: duration || 0,
            timestamp: new Date()
        });

        // Notify channel
        if (channelId) {
            io.to(`channel:${channelId}`).emit('meeting:ended', {
                meetingId,
                endedBy: socket.user.id
            });
        }

        console.log(`🔒 Meeting ${meetingId} ended by ${socket.user.id}`);
    });
}

module.exports = registerMeetingHandlers;
