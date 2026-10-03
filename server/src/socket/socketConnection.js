const identity = require('../identity');
const DMSession = require('../../models/DMSession');
const logger = require('../../utils/logger');
const registerChatHandlers = require('./chatHandlers');
const presenceService = require('../features/presence/presence.service');

/**
 * Emit a presence change only to sockets that share a tenant/conversation with the user:
 * the company room (auto-joined in chatHandlers as `company_<id>`) and the user's DM rooms
 * (`dm:<sessionId>`, auto-joined in chatHandlers). Never broadcast to every tenant.
 */
async function emitStatusChanged(io, userId, companyId, payload) {
  const rooms = [];
  if (companyId) rooms.push(`company_${companyId}`);
  try {
    const dms = await DMSession.find({ participants: userId }).select('_id').lean();
    for (const dm of dms) rooms.push(`dm:${dm._id}`);
  } catch (err) {
    logger.warn({ err }, '[PRESENCE] Could not load DM rooms for status broadcast');
  }
  if (rooms.length > 0) io.to(rooms).emit('user-status-changed', payload);
}

function registerSocketConnection(io) {
  io.on('connection', (socket) => {
    const socketUserId = socket.user.id;
    logger.debug({ userId: socketUserId }, 'Socket connected');

    // Mutable per-socket state filled in by the async bootstrap below.
    let userCompanyId = null;

    // ── Register every listener synchronously, BEFORE any await, so that a socket that
    //    drops during bootstrap still runs its disconnect cleanup. ──
    socket.join(`user:${socketUserId}`);
    socket.join(`user-support:${socketUserId}`);

    socket.on('user:idle', () => {
      presenceService.setIdle(io, socketUserId, userCompanyId).catch(() => {});
    });

    socket.on('user:active', () => {
      presenceService.setOnline(io, socketUserId, socket.id, userCompanyId).catch(() => {});
    });

    socket.on('disconnect', () => {
      presenceService.setOffline(io, socketUserId, socket.id, userCompanyId).catch(() => {});
      logger.debug({ userId: socketUserId }, 'Socket disconnected');
    });

    registerChatHandlers(io, socket);
    // What this tab shows (notifications skip push for active web users).
    require('../modules/notifications/viewingPresence').registerViewingHandlers(socket, socketUserId);

    // ── Async bootstrap ──
    (async () => {
      let dbUser = null;
      try {
        dbUser = await identity.users.findById(socketUserId);
      } catch (err) {
        logger.error({ err }, 'Error loading user for socket bootstrap');
      }

      // The socket may have disconnected while we were awaiting; do not resurrect presence.
      if (!socket.connected) return;

      userCompanyId = dbUser?.companyId?.toString() || null;

      try {
        await presenceService.setOnline(io, socketUserId, socket.id, userCompanyId);
        await emitStatusChanged(io, socketUserId, userCompanyId, { userId: socketUserId, status: 'active' });
      } catch (err) {
        logger.error({ err }, 'Error setting user online (presence)');
      }

      if (dbUser?.roles?.includes('platform-admin') || dbUser?.roles?.includes('chttrix_admin')) {
        socket.join('platform-admins');
        logger.debug(`[SUPPORT] Platform admin ${socketUserId} joined platform-admins room`);
      }
    })();
  });
}

module.exports = registerSocketConnection;
