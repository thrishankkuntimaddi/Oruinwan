const User = require('../../models/User');
const logger = require('../../utils/logger');
const registerChatHandlers = require('./chatHandlers'); 
const presenceService = require('../features/presence/presence.service');

function registerSocketConnection(io) {
  io.on('connection', async (socket) => {
    logger.debug('Socket connected:', socket.user.id);
    const socketUserId = socket.user.id;

    
    socket.join(`user:${socketUserId}`);

    
    let userCompanyId = null;
    try {
      const dbUser = await User.findById(socketUserId).select('companyId').lean();
      userCompanyId = dbUser?.companyId?.toString() || null;
      await presenceService.setOnline(io, socketUserId, socket.id, userCompanyId);
      
      io.emit('user-status-changed', { userId: socketUserId, status: 'active' });
    } catch (err) {
      logger.error('Error setting user online (presence):', err);
    }

    
    socket.on('user:idle', () => {
      presenceService.setIdle(io, socketUserId, userCompanyId).catch(() => {});
    });

    
    socket.on('user:active', () => {
      presenceService.setOnline(io, socketUserId, socket.id, userCompanyId).catch(() => {});
    });

    
    socket.on('disconnect', () => {
      presenceService.setOffline(io, socketUserId, socket.id, userCompanyId).catch(() => {});
      logger.debug('Socket disconnected:', socketUserId);
    });
    

    registerChatHandlers(io, socket);

    
    
    
    socket.join(`user-support:${socketUserId}`);
    logger.debug(`[SUPPORT] User ${socketUserId} joined user-support:${socketUserId}`);

    
    try {
      const dbUser = await User.findById(socketUserId).select('roles').lean();
      if (dbUser?.roles?.includes('platform-admin') || dbUser?.roles?.includes('chttrix_admin')) {
        socket.join('platform-admins');
        logger.debug(`[SUPPORT] Platform admin ${socketUserId} joined platform-admins room`);
      }
    } catch (err) {
      logger.error('[SUPPORT] Auto platform-admin room join error:', err);
    }
  });
}

module.exports = registerSocketConnection;
