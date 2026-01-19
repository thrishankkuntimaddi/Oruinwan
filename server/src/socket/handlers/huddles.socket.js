/**
 * Huddle Socket Handlers
 * 
 * Handles all socket events related to huddles (voice channels):
 * - Huddle start/join/leave/end
 * - Audio state changes
 * 
 * @module socket/handlers/huddles
 */

/**
 * Register huddle-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerHuddleHandlers(io, socket) {

    /**
     * Start a huddle in a channel
     */
    socket.on('huddle:start', (data) => {
        const { channelId, huddleId } = data;

        if (!channelId || !huddleId) {
            socket.emit('error', { message: 'Missing channelId or huddleId' });
            return;
        }

        // Notify channel that huddle started
        io.to(`channel:${channelId}`).emit('huddle:started', {
            huddleId,
            channelId,
            startedBy: {
                _id: socket.user.id,
                username: socket.user.username || 'Unknown'
            },
            timestamp: new Date()
        });

        console.log(`🎙️ Huddle ${huddleId} started in channel:${channelId}`);
    });

    /**
     * Join a huddle
     */
    socket.on('huddle:join', (data) => {
        const { huddleId, channelId, audioEnabled = true } = data;

        if (!huddleId) {
            socket.emit('error', { message: 'Missing huddleId' });
            return;
        }

        // Join huddle room
        socket.join(`huddle:${huddleId}`);
        console.log(`🎙️ User ${socket.user.id} joined huddle:${huddleId}`);

        // Broadcast to huddle participants
        io.to(`huddle:${huddleId}`).emit('huddle:joined', {
            huddleId,
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            audioEnabled,
            timestamp: new Date()
        });

        // Notify channel
        if (channelId) {
            io.to(`channel:${channelId}`).emit('huddle:participant_joined', {
                huddleId,
                userId: socket.user.id
            });
        }
    });

    /**
     * Leave a huddle
     */
    socket.on('huddle:leave', (data) => {
        const { huddleId, channelId } = data;

        if (!huddleId) return;

        // Leave huddle room
        socket.leave(`huddle:${huddleId}`);
        console.log(`👋 User ${socket.user.id} left huddle:${huddleId}`);

        // Broadcast to remaining participants
        io.to(`huddle:${huddleId}`).emit('huddle:left', {
            huddleId,
            userId: socket.user.id,
            timestamp: new Date()
        });

        // Notify channel
        if (channelId) {
            io.to(`channel:${channelId}`).emit('huddle:participant_left', {
                huddleId,
                userId: socket.user.id
            });
        }
    });

    /**
     * End a huddle
     */
    socket.on('huddle:end', (data) => {
        const { huddleId, channelId, duration } = data;

        if (!huddleId) return;

        // Broadcast end to all participants
        io.to(`huddle:${huddleId}`).emit('huddle:ended', {
            huddleId,
            channelId,
            duration: duration || 0,
            timestamp: new Date()
        });

        // Notify channel
        if (channelId) {
            io.to(`channel:${channelId}`).emit('huddle:ended', {
                huddleId
            });
        }

        console.log(`🔇 Huddle ${huddleId} ended`);
    });

    /**
     * Toggle audio (mute/unmute)
     */
    socket.on('huddle:audio_toggle', (data) => {
        const { huddleId, audioEnabled } = data;

        if (!huddleId) return;

        // Broadcast to huddle participants
        io.to(`huddle:${huddleId}`).emit('huddle:audio_changed', {
            userId: socket.user.id,
            audioEnabled
        });
    });
}

module.exports = registerHuddleHandlers;
