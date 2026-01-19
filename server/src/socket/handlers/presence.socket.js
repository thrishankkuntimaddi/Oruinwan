/**
 * Presence Socket Handlers
 * 
 * Handles all socket events related to user presence:
 * - Online/offline status
 * - Custom status messages
 * - Activity tracking
 * 
 * @module socket/handlers/presence
 */

/**
 * Register presence-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerPresenceHandlers(io, socket) {

    /**
     * User came online
     * Automatically triggered on connection
     */
    const broadcastOnline = () => {
        io.emit('user:online', {
            userId: socket.user.id,
            username: socket.user.username || 'Unknown',
            timestamp: new Date()
        });
    };

    // Broadcast online status when connected
    broadcastOnline();

    /**
     * Status change (online, away, busy, offline)
     */
    socket.on('user:status_change', (data) => {
        const { status, customStatus } = data;

        // Validate status
        const validStatuses = ['online', 'away', 'busy', 'offline'];
        if (!validStatuses.includes(status)) {
            socket.emit('error', { message: 'Invalid status' });
            return;
        }

        // Broadcast to all users (or workspace-specific)
        io.emit('user:status_change', {
            userId: socket.user.id,
            status,
            customStatus: customStatus || null,
            timestamp: new Date()
        });

        console.log(`👤 User ${socket.user.id} status changed to ${status}`);
    });

    /**
     * Set custom status message
     */
    socket.on('user:custom_status', (data) => {
        const { customStatus } = data;

        io.emit('user:custom_status_changed', {
            userId: socket.user.id,
            customStatus,
            timestamp: new Date()
        });
    });

    /**
     * Join workspace room for presence updates
     */
    socket.on('workspace:join', (workspaceId) => {
        if (!workspaceId) return;

        socket.join(`workspace:${workspaceId}`);
        console.log(`🏢 User ${socket.user.id} joined workspace:${workspaceId}`);

        // Notify workspace members
        io.to(`workspace:${workspaceId}`).emit('workspace:member_online', {
            userId: socket.user.id,
            timestamp: new Date()
        });
    });

    /**
     * Leave workspace room
     */
    socket.on('workspace:leave', (workspaceId) => {
        if (!workspaceId) return;

        socket.leave(`workspace:${workspaceId}`);
        console.log(`👋 User ${socket.user.id} left workspace:${workspaceId}`);
    });
}

module.exports = registerPresenceHandlers;
