/**
 * ⚠️  TOMBSTONE — DO NOT ACTIVATE (Phase 1 Audit)
 *
 * This file is only importable via server/socket.js, which is itself NEVER
 * required by any active module (server.js uses server/socket/index.js instead).
 * Therefore, this entire module tree is DORMANT in production.
 *
 * Activating this file (by requiring it from server.js or socket/index.js) would
 * register DUPLICATE handlers alongside the active server/socket/index.js for:
 *   - messages (send-message, chat:join, join-dm, chat:message, chat:typing)
 *   - polls (poll:created, poll:voted, poll:closed, poll:deleted)
 *   - presence (user:status_change, workspace:join, disconnect)
 *   - admin (admin:join, admin:dm:send, company:join, audit:new, etc.)
 *
 * The only file from this tree that IS active is huddles.socket.js, which is
 * directly imported by server/socket/index.js (not via this file).
 *
 * @status DORMANT — never executed in production
 * @audit  Phase 1 — Duplicate Execution Elimination (2026-03-28)
 */


const logger = require('../../../utils/logger');
const registerMessageHandlers = require('./handlers/messages.socket');
const registerMeetingHandlers = require('./handlers/meetings.socket');
const registerHuddleHandlers = require('./handlers/huddles.socket');
const registerPresenceHandlers = require('./handlers/presence.socket');
const registerAdminHandlers = require('./handlers/admin.socket');
const registerPollHandlers = require('./handlers/polls.socket');

/**
 * Register all socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerSocketHandlers(io, socket) {
    logger.socket(`✅ Socket connected: ${socket.user.id}`);
    logger.socket(`🔍 [Socket] Socket ID: ${socket.id}`);
    logger.socket(`🔍 [Socket] Registering handlers for user: ${socket.user.id}`);

    // User joins their personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Register domain-specific handlers
    logger.socket(`📝 [Socket] Registering message handlers...`);
    registerMessageHandlers(io, socket);
    logger.socket(`✅ [Socket] Message handlers registered`);

    registerMeetingHandlers(io, socket);
    registerHuddleHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerAdminHandlers(io, socket);
    registerPollHandlers(io, socket);

    logger.socket(`🎯 [Socket] All handlers registered for ${socket.user.id}`);

    // Handle errors
    socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.user.id}:`, error);
    });
}

module.exports = registerSocketHandlers;
