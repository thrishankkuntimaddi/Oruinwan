// server/src/socket/socketConnection.js
// Socket.IO connection handler
// Extracted from server.js (Phase 4 cleanup)

const User = require('../../models/User');
const logger = require('../../utils/logger');
const registerChatHandlers = require('../../socket/index');
const presenceService = require('../features/presence/presence.service');

/**
 * Registers the io.on("connection") handler on the given io instance.
 * Handles:
 *   - Private user room join
 *   - Presence tracking (online/idle/offline)
 *   - Platform support room auto-join
 *   - Chat handlers delegation
 *
 * @param {import('socket.io').Server} io
 */
function registerSocketConnection(io) {
  io.on('connection', async (socket) => {
    logger.debug('Socket connected:', socket.user.id);
    const socketUserId = socket.user.id;

    // Each user joins their own private room for targeted notifications
    socket.join(`user:${socketUserId}`);

    // ── MULTI-PLATFORM: Presence tracking ─────────────────────────────────────
    let userCompanyId = null;
    try {
      const dbUser = await User.findById(socketUserId).select('companyId').lean();
      userCompanyId = dbUser?.companyId?.toString() || null;
      await presenceService.setOnline(io, socketUserId, socket.id, userCompanyId);
      // Legacy broadcast for backward compat
      io.emit('user-status-changed', { userId: socketUserId, status: 'active' });
    } catch (err) {
      logger.error('Error setting user online (presence):', err);
    }

    // ── Idle signal from client ────────────────────────────────────────────────
    socket.on('user:idle', () => {
      presenceService.setIdle(io, socketUserId, userCompanyId).catch(() => {});
    });

    // ── Active signal from client ──────────────────────────────────────────────
    socket.on('user:active', () => {
      presenceService.setOnline(io, socketUserId, socket.id, userCompanyId).catch(() => {});
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      presenceService.setOffline(io, socketUserId, socket.id, userCompanyId).catch(() => {});
      logger.debug('Socket disconnected:', socketUserId);
    });
    // ──────────────────────────────────────────────────────────────────────────

    registerChatHandlers(io, socket);

    // ── PLATFORM SUPPORT ROOMS ──────────────────────────────────────────────
    // Every authenticated user auto-joins their own personal support room.
    // This enables ChttrixAdmin to send DMs directly to individual users.
    socket.join(`user-support:${socketUserId}`);
    logger.debug(`[SUPPORT] User ${socketUserId} joined user-support:${socketUserId}`);

    // Auto-join platform-admins room for chttrix admins
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
