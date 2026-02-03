/**
 * Admin Socket Handlers
 * 
 * Handles all socket events related to admin functionality:
 * - Admin room join
 * - Admin DMs to companies
 * - Audit logs
 * - System notifications
 * - Tickets
 * 
 * @module socket/handlers/admin
 */

const User = require('../../../../models/User');
const AuditLog = require('../../../../models/AuditLog');

/**
 * Register admin-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerAdminHandlers(io, socket) {

    /**
     * Join admin room (requires admin role)
     */
    socket.on('admin:join', async () => {
        try {
            const user = await User.findById(socket.user.id);

            if (user && user.roles.includes('chttrix_admin')) {
                socket.join('chttrix_admins');


                socket.emit('admin:joined', {
                    message: 'Successfully joined admin room'
                });
            } else {
                socket.emit('error', { message: 'Unauthorized: Admin access required' });
            }
        } catch (err) {
            console.error('Error joining admin room:', err);
            socket.emit('error', { message: 'Failed to join admin room' });
        }
    });

    /**
     * Admin sends DM to company
     */
    socket.on('admin:dm:send', async (data) => {
        try {
            const { companyId, message } = data;

            if (!companyId || !message) {
                socket.emit('error', { message: 'Missing companyId or message' });
                return;
            }

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
                description: 'Admin sent direct message to company'
            });


        } catch (err) {
            console.error('Error sending admin DM:', err);
            socket.emit('error', { message: 'Failed to send DM' });
        }
    });

    /**
     * Company joins company room (to receive admin messages)
     */
    socket.on('company:join', async (companyId) => {
        if (!companyId) return;

        socket.join(`company:${companyId}`);

    });

    /**
     * Broadcast new audit log to admins
     */
    socket.on('audit:new', async (logData) => {
        io.to('chttrix_admins').emit('audit:update', logData);
    });

    /**
     * System health update (admin monitoring)
     */
    socket.on('health:update', (metrics) => {
        io.to('chttrix_admins').emit('health:metrics', metrics);
    });

    /**
     * Ticket created
     */
    socket.on('ticket:created', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:new', ticketData);

    });

    /**
     * Ticket updated
     */
    socket.on('ticket:updated', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:update', ticketData);
    });

    /**
     * Broadcast sent
     */
    socket.on('broadcast:sent', (broadcastData) => {
        io.to('chttrix_admins').emit('broadcast:complete', broadcastData);
    });

    /**
     * Company registered
     */
    socket.on('company:registered', (companyData) => {
        io.to('chttrix_admins').emit('company:pending', companyData);

    });
}

module.exports = registerAdminHandlers;
