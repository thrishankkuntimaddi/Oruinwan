/**
 * Socket Layer - Main Entry Point
 * 
 * Registers all socket event handlers in a modular, domain-driven structure
 * 
 * @module socket
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
