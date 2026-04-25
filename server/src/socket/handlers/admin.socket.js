const User = require('../../../../models/User');
const AuditLog = require('../../../../models/AuditLog');

function registerAdminHandlers(io, socket) {

    
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

    
    socket.on('admin:dm:send', async (data) => {
        try {
            const { companyId, message } = data;

            if (!companyId || !message) {
                socket.emit('error', { message: 'Missing companyId or message' });
                return;
            }

            

            
            io.to(`company:${companyId}`).emit('admin:dm:receive', {
                sender: socket.user.id,
                message,
                timestamp: new Date()
            });

            
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

    
    socket.on('company:join', async (companyId) => {
        if (!companyId) return;

        socket.join(`company:${companyId}`);

    });

    
    socket.on('audit:new', async (logData) => {
        io.to('chttrix_admins').emit('audit:update', logData);
    });

    
    socket.on('health:update', (metrics) => {
        io.to('chttrix_admins').emit('health:metrics', metrics);
    });

    
    socket.on('ticket:created', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:new', ticketData);

    });

    
    socket.on('ticket:updated', (ticketData) => {
        io.to('chttrix_admins').emit('ticket:update', ticketData);
    });

    
    socket.on('broadcast:sent', (broadcastData) => {
        io.to('chttrix_admins').emit('broadcast:complete', broadcastData);
    });

    
    socket.on('company:registered', (companyData) => {
        io.to('chttrix_admins').emit('company:pending', companyData);

    });
}

module.exports = registerAdminHandlers;
