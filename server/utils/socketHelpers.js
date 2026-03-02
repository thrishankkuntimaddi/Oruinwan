// server/utils/socketHelpers.js

/**
 * Socket.io emission utilities to eliminate duplicate socket code
 * Centralizes socket emission patterns used across controllers
 */

/**
 * Get socket.io instance from request
 * @param {Object} req - Express request object
 * @returns {Object|null} Socket.io instance or null
 */
const getIO = (req) => {
    return req.app?.get("io") || req.io || null;
};

/**
 * Emit event to workspace room
 * @param {Object} req - Express request object
 * @param {String} workspaceId - Workspace ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToWorkspace = (req, workspaceId, event, data) => {
    const io = getIO(req);
    if (io && workspaceId) {
        io.to(`workspace_${workspaceId}`).emit(event, data);
    }
};

/**
 * Emit event to channel room
 * @param {Object} req - Express request object
 * @param {String} channelId - Channel ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToChannel = (req, channelId, event, data) => {
    const io = getIO(req);
    if (io && channelId) {
        io.to(`channel:${channelId}`).emit(event, data);
    }
};

/**
 * Emit event to user room
 * @param {Object} req - Express request object
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToUser = (req, userId, event, data) => {
    const io = getIO(req);
    if (io && userId) {
        io.to(`user_${userId}`).emit(event, data);
    }
};

/**
 * Emit event to DM room
 * @param {Object} req - Express request object
 * @param {String} dmId - DM session ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToDM = (req, dmId, event, data) => {
    const io = getIO(req);
    if (io && dmId) {
        io.to(`dm_${dmId}`).emit(event, data);
    }
};

/**
 * Emit to multiple users
 * @param {Object} req - Express request object
 * @param {Array} userIds - Array of user IDs
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.emitToUsers = (req, userIds, event, data) => {
    const io = getIO(req);
    if (io && userIds && Array.isArray(userIds)) {
        userIds.forEach(userId => {
            io.to(`user_${userId}`).emit(event, data);
        });
    }
};

/**
 * Broadcast to all connected clients
 * @param {Object} req - Express request object
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
exports.broadcast = (req, event, data) => {
    const io = getIO(req);
    if (io) {
        io.emit(event, data);
    }
};
