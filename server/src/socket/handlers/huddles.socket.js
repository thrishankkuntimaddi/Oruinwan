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
    socket.on('huddle:start', async (data) => {
        const { channelId, huddleId } = data;

        if (!channelId || !huddleId) {
            socket.emit('error', { message: 'Missing channelId or huddleId' });
            return;
        }

        // SECURITY: Verify channel membership before announcing huddle start.
        // Any user knowing a channelId could previously push huddle:started into
        // any channel room without being a member.
        try {
            const Channel = require('../../features/channels/channel.model');
            const channel = await Channel.findById(channelId).select('members');
            if (!channel || !channel.isMember(socket.user.id)) {
                console.warn(`🚫 [huddle:start] User ${socket.user.id} denied — not a member of channel:${channelId}`);
                socket.emit('error', { message: 'Not a member of this channel' });
                return;
            }
        } catch (err) {
            console.error('[huddle:start] Channel membership check failed:', err);
            socket.emit('error', { message: 'Failed to verify channel membership' });
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
    });

    /**
     * Join a huddle
     */
    socket.on('huddle:join', async (data) => {
        const { huddleId, channelId, audioEnabled = true } = data;

        if (!huddleId) {
            socket.emit('error', { message: 'Missing huddleId' });
            return;
        }

        // SECURITY FIX (BUG-7): Verify channel membership before joining huddle room.
        // Previously any authenticated user knowing a huddleId could join without validation.
        // Huddles are tied to channels — you must be a channel member to attend.
        if (channelId) {
            try {
                const Channel = require('../../features/channels/channel.model');
                const channel = await Channel.findById(channelId).select('members');
                if (!channel || !channel.isMember(socket.user.id)) {
                    console.warn(`\uD83D\uDEAB [huddle:join] User ${socket.user.id} denied — not a member of channel:${channelId}`);
                    socket.emit('error', { message: 'Not a member of this channel' });
                    return;
                }
            } catch (err) {
                console.error('[huddle:join] Channel membership check failed:', err);
                socket.emit('error', { message: 'Failed to verify channel membership' });
                return;
            }
        } else {
            // No channelId provided — deny join (cannot verify authorization without it)
            console.warn(`\uD83D\uDEAB [huddle:join] User ${socket.user.id} denied — no channelId provided for huddle:${huddleId}`);
            socket.emit('error', { message: 'channelId required to join a huddle' });
            return;
        }

        // Join huddle room
        socket.join(`huddle:${huddleId}`);


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
    socket.on('huddle:end', async (data) => {
        const { huddleId, channelId, duration } = data;

        if (!huddleId) return;

        // SECURITY: Verify the user is actually in this huddle room before broadcasting end.
        // Without this check, any authenticated user knowing a huddleId can force-end any huddle.
        if (!socket.rooms.has(`huddle:${huddleId}`)) {
            console.warn(`🚫 [huddle:end] User ${socket.user.id} denied — not in huddle:${huddleId}`);
            socket.emit('error', { message: 'Not in this huddle' });
            return;
        }

        // Additionally verify channel membership if channelId provided
        if (channelId) {
            try {
                const Channel = require('../../features/channels/channel.model');
                const channel = await Channel.findById(channelId).select('members');
                if (!channel || !channel.isMember(socket.user.id)) {
                    console.warn(`🚫 [huddle:end] User ${socket.user.id} denied — not a member of channel:${channelId}`);
                    socket.emit('error', { message: 'Not a member of this channel' });
                    return;
                }
            } catch (err) {
                console.error('[huddle:end] Channel membership check failed:', err);
                socket.emit('error', { message: 'Failed to verify channel membership' });
                return;
            }
        }

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
