// server/socket.js
// Socket.io handlers for real-time features

const AuditLog = require('./models/AuditLog');
const User = require('./models/User');

/**
 * Register all socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerChatHandlers(io, socket) {
    console.log(`✅ Socket connected: ${socket.user.id}`);

    // Join user-specific room for private notifications
    socket.join(`user:${socket.user.id}`);

    // Admin-specific rooms
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

    // Real-time Direct Messages (Admin ↔ Company)
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

    // Join company room (for receiving admin messages)
    socket.on('company:join', async (companyId) => {
        socket.join(`company:${companyId}`);
        console.log(`🏢 User ${socket.user.id} joined company:${companyId}`);
    });

    // Broadcast new audit log to all admins
    socket.on('audit:new', async (logData) => {
        io.to('chttrix_admins').emit('audit:update', logData);
    });

    // System health update
    socket.on('health:update', (metrics) => {
        io.to('chttrix_admins').emit('health:metrics', metrics);
    });

    // Ticket notifications
    socket.on('ticket:created', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:new', ticketData);
    });

    socket.on('ticket:updated', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:update', ticketData);
    });

    // Broadcast notifications
    socket.on('broadcast:sent', (broadcastData) => {
        io.to('chttrix_admins').emit('broadcast:complete', broadcastData);
    });

    // Company registration notification
    socket.on('company:registered', (companyData) => {
        io.to('chttrix_admins').emit('company:pending', companyData);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`❌ Socket disconnected: ${socket.user.id}`);
    });

    // Generic chat handlers (existing functionality)
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
}

module.exports = registerChatHandlers;
