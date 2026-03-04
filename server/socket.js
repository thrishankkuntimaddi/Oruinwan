// server/socket.js
/**
 * Socket.io Main Handler
 * 
 * This file delegates to the modular socket architecture in src/socket/
 * Legacy events are kept here for backward compatibility during migration.
 * 
 * @status migrating
 * @target server/src/socket/
 */

const AuditLog = require('./models/AuditLog');
const User = require('./models/User');
const registerSocketHandlers = require('./src/socket');

/**
 * Register all socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerChatHandlers(io, socket) {
    console.log(`✅ Socket connected: ${socket.user.id}`);

    // ==================== NEW MODULAR ARCHITECTURE ====================
    // Delegate to modular handlers in src/socket/
    registerSocketHandlers(io, socket);

    // ==================== LEGACY HANDLERS (Backward Compatibility) ====================
    // These are kept for backward compatibility
    // They will be removed once all clients migrate to new events

    // Admin-specific rooms (legacy)
    socket.on('admin:join', async () => {
        try {
            const user = await User.findById(socket.user.id);
            if (user && user.roles.includes('chttrix_admin')) {
                socket.join('chttrix_admins');
                console.log(`👑 Admin ${socket.user.id} joined admin room`);
            }
        } catch (err) {
            console.error('Error joining admin room:', err);
        }
    });

    // Real-time Direct Messages (Admin to Company) - legacy
    socket.on('admin:dm:send', async (data) => {
        try {
            // SECURITY: Only platform admins can send admin DMs
            const user = await User.findById(socket.user.id).select('roles');
            if (!user || !user.roles.includes('chttrix_admin')) {
                console.warn(`\uD83D\uDEAB [admin:dm:send] Non-admin user ${socket.user.id} denied`);
                socket.emit('error', { message: 'Admin privileges required' });
                return;
            }

            const { companyId, message } = data;

            // TODO: Save message to database

            // Emit to company admins
            io.to(`company:${companyId}`).emit('admin:dm:receive', {
                sender: socket.user.id,
                message,
                timestamp: new Date()
            });

            // Log audit
            await AuditLog.create({
                userId: socket.user.id,
                action: 'admin_message_sent',
                resource: 'Company',
                resourceId: companyId,
                description: `Admin sent direct message to company`
            });
        } catch (err) {
            console.error('Error sending admin DM:', err);
        }
    });

    // Join company room (for receiving admin messages) - legacy
    socket.on('company:join', async (companyId) => {
        try {
            // SECURITY FIX (M-7): Verify the user actually belongs to this company.
            // Without this check, any authenticated user could join any company room
            // and receive admin:dm:receive broadcasts from that company.
            const user = await User.findById(socket.user.id).select('companyId');
            if (!user || !user.companyId || user.companyId.toString() !== companyId) {
                console.warn(`\uD83D\uDEAB User ${socket.user.id} denied company:join for company:${companyId}`);
                socket.emit('error', { message: 'Unauthorized: invalid company' });
                return;
            }

            socket.join(`company:${companyId}`);
            console.log(`\uD83C\uDFE2 User ${socket.user.id} joined company:${companyId}`);

        } catch (err) {
            console.error('Error joining company room:', err);
            socket.emit('error', { message: 'Failed to join company room' });
        }
    });

    // Helper: inline chttrix_admin role guard for admin-only socket events
    const requireAdminSocket = async (eventName) => {
        const user = await User.findById(socket.user.id).select('roles');
        if (!user || !user.roles.includes('chttrix_admin')) {
            console.warn(`\uD83D\uDEAB [${eventName}] Non-admin user ${socket.user.id} denied`);
            socket.emit('error', { message: 'Admin privileges required' });
            return false;
        }
        return true;
    };

    // Broadcast new audit log to all admins - legacy
    // SECURITY: Guard — only platform admins should inject audit events
    socket.on('audit:new', async (logData) => {
        if (!await requireAdminSocket('audit:new')) return;
        io.to('chttrix_admins').emit('audit:update', logData);
    });

    // System health update - legacy
    // SECURITY: Guard — only platform admins should push health metrics
    socket.on('health:update', async (metrics) => {
        if (!await requireAdminSocket('health:update')) return;
        io.to('chttrix_admins').emit('health:metrics', metrics);
    });

    // Ticket notifications - legacy
    // SECURITY: Guard — only platform admins should broadcast ticket events
    socket.on('ticket:created', async (ticketData) => {
        if (!await requireAdminSocket('ticket:created')) return;
        io.to('chttrix_admins').emit('ticket:new', ticketData);
    });

    socket.on('ticket:updated', async (ticketData) => {
        if (!await requireAdminSocket('ticket:updated')) return;
        io.to('chttrix_admins').emit('ticket:update', ticketData);
    });

    // Broadcast notifications - legacy
    socket.on('broadcast:sent', async (broadcastData) => {
        if (!await requireAdminSocket('broadcast:sent')) return;
        io.to('chttrix_admins').emit('broadcast:complete', broadcastData);
    });

    // Company registration notification - legacy
    socket.on('company:registered', async (companyData) => {
        if (!await requireAdminSocket('company:registered')) return;
        io.to('chttrix_admins').emit('company:pending', companyData);
    });

    // SECURITY FIX (BUG-6): Legacy unguarded 'chat:join' and 'chat:leave' handlers REMOVED.
    // These ran in parallel with the secured handlers in src/socket/handlers/messages.socket.js
    // and allowed any authenticated user to join any channel room without membership validation.
    // The secured handlers registered by registerSocketHandlers() now exclusively handle
    // these events with proper database membership checks.

    // Legacy chat:message — only forwards if sender is actually in the channel room.
    // SECURITY: Without the room check below, any connected socket could inject messages
    // into any channel's broadcast stream by simply knowing the channelId.
    socket.on('chat:message', (data) => {
        const { channelId, message } = data;
        const roomName = `channel:${channelId}`;

        // Only allow broadcast if this socket is legitimately in the room
        // (i.e. passed the membership check in chat:join / conversation:join)
        if (!socket.rooms.has(roomName)) {
            console.warn(`\uD83D\uDEAB [chat:message] User ${socket.user.id} not in room ${roomName} — blocked`);
            socket.emit('error', { message: 'Not a member of this channel' });
            return;
        }

        io.to(roomName).emit('chat:new_message', {
            ...message,
            sender: socket.user.id
        });
    });

    // Legacy chat:typing — guard against non-members triggering typing indicators
    socket.on('chat:typing', (data) => {
        const { channelId, isTyping } = data;
        const roomName = `channel:${channelId}`;

        if (!socket.rooms.has(roomName)) return; // Silently drop — not in room

        socket.to(roomName).emit('chat:user_typing', {
            userId: socket.user.id,
            isTyping
        });
    });

    // ==================== POLL HANDLERS (ISOLATED) ====================
    // Polls are a separate feature and do NOT interfere with messaging

    // Poll created - broadcast to channel (room membership implicitly enforced
    // because the poll was created via authenticated HTTP POST, not socket)
    socket.on('poll:created', (data) => {
        const { channelId, poll } = data;
        console.log(`\uD83D\uDCCA New poll created in channel:${channelId} by user:${socket.user.id}`);
        io.to(`channel:${channelId}`).emit('poll:new', poll);
    });

    // Poll voted - broadcast updated poll to channel
    socket.on('poll:voted', (data) => {
        const { channelId, poll } = data;
        console.log(`\u2705 Poll ${poll._id} voted by user:${socket.user.id}`);
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    // Poll deleted - broadcast removal to channel
    socket.on('poll:deleted', (data) => {
        const { channelId, pollId } = data;
        console.log(`\uD83D\uDDD1\uFE0F Poll ${pollId} deleted from channel:${channelId}`);
        io.to(`channel:${channelId}`).emit('poll:removed', { pollId });
    });

    // Poll closed - broadcast update to channel
    socket.on('poll:closed', (data) => {
        const { channelId, poll } = data;
        console.log(`\uD83D\uDD12 Poll ${poll._id} closed in channel:${channelId}`);
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    // SECURITY FIX (M-2): The 'conversation:event' handler has been moved EXCLUSIVELY
    // to src/socket/handlers/messages.socket.js which:
    //   1. Verifies socket.rooms.has(room) BEFORE broadcasting (room-presence guard)
    //   2. Is registered once per connection via registerSocketHandlers()
    // Registering it here again (in the legacy layer) would fire the event twice:
    //   - once WITH the room guard (modular handler)
    //   - once WITHOUT (this legacy handler)
    // The second firing was a bypass vector — any authenticated socket could inject
    // events to any conversation room by knowing its ID.
    // DO NOT re-add a 'conversation:event' handler here.

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`\u274C Socket disconnected: ${socket.user.id}`);
    });
}

module.exports = registerChatHandlers;

