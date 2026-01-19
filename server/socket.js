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

    // Real-time Direct Messages (Admin ↔ Company) - legacy
    socket.on('admin:dm:send', async (data) => {
        try {
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
        socket.join(`company:${companyId}`);
        console.log(`🏢 User ${socket.user.id} joined company:${companyId}`);
    });

    // Broadcast new audit log to all admins - legacy
    socket.on('audit:new', async (logData) => {
        io.to('chttrix_admins').emit('audit:update', logData);
    });

    // System health update - legacy
    socket.on('health:update', (metrics) => {
        io.to('chttrix_admins').emit('health:metrics', metrics);
    });

    // Ticket notifications - legacy
    socket.on('ticket:created', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:new', ticketData);
    });

    socket.on('ticket:updated', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:update', ticketData);
    });

    // Broadcast notifications - legacy
    socket.on('broadcast:sent', (broadcastData) => {
        io.to('chttrix_admins').emit('broadcast:complete', broadcastData);
    });

    // Company registration notification - legacy
    socket.on('company:registered', (companyData) => {
        io.to('chttrix_admins').emit('company:pending', companyData);
    });

    // Generic chat handlers (existing functionality) - legacy
    socket.on('chat:join', (channelId) => {
        socket.join(`channel:${channelId}`);
        console.log(`💬 User ${socket.user.id} joined channel:${channelId}`);
    });

    socket.on('chat:leave', (channelId) => {
        socket.leave(`channel:${channelId}`);
        console.log(`👋 User ${socket.user.id} left channel:${channelId}`);
    });

    socket.on('chat:message', (data) => {
        const { channelId, message } = data;
        io.to(`channel:${channelId}`).emit('chat:new_message', {
            ...message,
            sender: socket.user.id
        });
    });

    socket.on('chat:typing', (data) => {
        const { channelId, isTyping } = data;
        socket.to(`channel:${channelId}`).emit('chat:user_typing', {
            userId: socket.user.id,
            isTyping
        });
    });

    // ==================== POLL HANDLERS (ISOLATED) ====================
    // Polls are a separate feature and do NOT interfere with messaging

    // Poll created - broadcast to channel
    socket.on('poll:created', (data) => {
        const { channelId, poll } = data;
        console.log(`📊 New poll created in channel:${channelId} by user:${socket.user.id}`);
        io.to(`channel:${channelId}`).emit('poll:new', poll);
    });

    // Poll voted - broadcast updated poll to channel
    socket.on('poll:voted', (data) => {
        const { channelId, poll } = data;
        console.log(`✅ Poll ${poll._id} voted by user:${socket.user.id}`);
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    // Poll deleted - broadcast removal to channel
    socket.on('poll:deleted', (data) => {
        const { channelId, pollId } = data;
        console.log(`🗑️ Poll ${pollId} deleted from channel:${channelId}`);
        io.to(`channel:${channelId}`).emit('poll:removed', { pollId });
    });

    // Poll closed - broadcast update to channel
    socket.on('poll:closed', (data) => {
        const { channelId, poll } = data;
        console.log(`🔒 Poll ${poll._id} closed in channel:${channelId}`);
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    // ==================== UNIFIED EVENT HANDLER (NEW ARCHITECTURE) ====================
    // This is the future - unified event handling for all conversation events
    socket.on('conversation:event', async (data) => {
        try {
            const { conversationId, conversationType, event } = data;

            console.log(`📤 Conversation event: ${event.type} in ${conversationType}:${conversationId}`);

            // Determine room name
            const room = conversationType === 'channel'
                ? `channel:${conversationId}`
                : `dm:${conversationId}`;

            // Broadcast event to room
            io.to(room).emit('conversation:event', {
                ...event,
                timestamp: new Date()
            });

            // Also emit specific event types for backward compatibility
            switch (event.type) {
                case 'message':
                    io.to(room).emit('new-message', event.payload);
                    break;
                case 'poll':
                    io.to(room).emit('poll:new', event.payload);
                    break;
                case 'meeting':
                    io.to(room).emit('meeting:new', event.payload);
                    break;
                case 'system':
                    io.to(room).emit('system:event', event.payload);
                    break;
            }
        } catch (err) {
            console.error('Error handling conversation event:', err);
            socket.emit('error', { message: 'Failed to process event' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`❌ Socket disconnected: ${socket.user.id}`);
    });
}

module.exports = registerChatHandlers;

