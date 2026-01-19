/**
 * Socket Emitter Service
 * 
 * Centralized service for emitting socket events from anywhere in the backend.
 * Provides type-safe, documented methods for emitting socket events.
 * 
 * This allows services and controllers to emit socket events without
 * directly accessing the socket.io instance.
 * 
 * @module socket/services/socketEmitter
 */

class SocketEmitter {
    constructor(io) {
        this.io = io;
    }

    // ============================================================
    // MESSAGE EVENTS
    // ============================================================

    /**
     * Emit new message to conversation
     * @param {string} conversationId - Conversation ID
     * @param {'channel'|'dm'|'thread'} type - Conversation type
     * @param {Object} message - Message object
     */
    emitNewMessage(conversationId, type, message) {
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : type === 'dm'
                ? `dm:${conversationId}`
                : `thread:${conversationId}`;

        // Emit legacy event
        this.io.to(room).emit('new-message', message);

        // Emit unified event
        this.io.to(room).emit('conversation:event', {
            conversationId,
            conversationType: type,
            event: {
                type: 'message',
                payload: message,
                userId: message.sender?._id || message.sender,
                timestamp: message.createdAt || new Date()
            }
        });

        console.log(`📤 Emitted new message to ${room}`);
    }

    /**
     * Emit message edit
     */
    emitMessageEdit(conversationId, type, message) {
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : `dm:${conversationId}`;

        this.io.to(room).emit('message:edited', message);
        this.io.to(room).emit('conversation:event', {
            conversationId,
            conversationType: type,
            event: {
                type: 'edit',
                payload: message,
                userId: message.sender?._id || message.sender,
                timestamp: new Date()
            }
        });
    }

    /**
     * Emit message delete
     */
    emitMessageDelete(conversationId, type, messageId) {
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : `dm:${conversationId}`;

        this.io.to(room).emit('message:deleted', { messageId });
        this.io.to(room).emit('conversation:event', {
            conversationId,
            conversationType: type,
            event: {
                type: 'delete',
                payload: { messageId },
                timestamp: new Date()
            }
        });
    }

    // ============================================================
    // MEETING EVENTS
    // ============================================================

    /**
     * Emit meeting created
     */
    emitMeetingCreated(channelId, meeting) {
        this.io.to(`channel:${channelId}`).emit('meeting:created', meeting);
        console.log(`📹 Emitted meeting created to channel:${channelId}`);
    }

    /**
     * Emit meeting ended
     */
    emitMeetingEnded(meetingId, channelId, data) {
        this.io.to(`meeting:${meetingId}`).emit('meeting:ended', data);
        if (channelId) {
            this.io.to(`channel:${channelId}`).emit('meeting:ended', data);
        }
    }

    // ============================================================
    // HUDDLE EVENTS
    // ============================================================

    /**
     * Emit huddle started
     */
    emitHuddleStarted(channelId, huddleData) {
        this.io.to(`channel:${channelId}`).emit('huddle:started', huddleData);
        console.log(`🎙️ Emitted huddle started to channel:${channelId}`);
    }

    /**
     * Emit huddle ended
     */
    emitHuddleEnded(huddleId, channelId, data) {
        this.io.to(`huddle:${huddleId}`).emit('huddle:ended', data);
        if (channelId) {
            this.io.to(`channel:${channelId}`).emit('huddle:ended', data);
        }
    }

    // ============================================================
    // POLL EVENTS
    // ============================================================

    /**
     * Emit poll created
     */
    emitPollCreated(channelId, poll) {
        this.io.to(`channel:${channelId}`).emit('poll:new', poll);
    }

    /**
     * Emit poll update
     */
    emitPollUpdate(channelId, poll) {
        this.io.to(`channel:${channelId}`).emit('poll:update', poll);
    }

    /**
     * Emit poll removed
     */
    emitPollRemoved(channelId, pollId) {
        this.io.to(`channel:${channelId}`).emit('poll:removed', { pollId });
    }

    // ============================================================
    // PRESENCE EVENTS
    // ============================================================

    /**
     * Emit user online
     */
    emitUserOnline(userId, username) {
        this.io.emit('user:online', {
            userId,
            username,
            timestamp: new Date()
        });
    }

    /**
     * Emit user offline
     */
    emitUserOffline(userId) {
        this.io.emit('user:offline', {
            userId,
            lastSeen: new Date()
        });
    }

    /**
     * Emit status change
     */
    emitStatusChange(userId, status, customStatus = null) {
        this.io.emit('user:status_change', {
            userId,
            status,
            customStatus,
            timestamp: new Date()
        });
    }

    // ============================================================
    // ADMIN EVENTS
    // ============================================================

    /**
     * Emit to admins only
     */
    emitToAdmins(event, data) {
        this.io.to('chttrix_admins').emit(event, data);
    }

    /**
     * Emit audit log update
     */
    emitAuditUpdate(logData) {
        this.emitToAdmins('audit:update', logData);
    }

    /**
     * Emit ticket notification
     */
    emitTicketNotification(type, ticketData) {
        this.emitToAdmins(`ticket:${type}`, ticketData);
    }

    // ============================================================
    // USER NOTIFICATIONS
    // ============================================================

    /**
     * Emit notification to specific user
     */
    emitToUser(userId, event, data) {
        this.io.to(`user:${userId}`).emit(event, data);
    }

    /**
     * Emit notification to multiple users
     */
    emitToUsers(userIds, event, data) {
        userIds.forEach(userId => {
            this.emitToUser(userId, event, data);
        });
    }

    // ============================================================
    // WORKSPACE EVENTS
    // ============================================================

    /**
     * Emit to workspace
     */
    emitToWorkspace(workspaceId, event, data) {
        this.io.to(`workspace:${workspaceId}`).emit(event, data);
    }

    /**
     * Emit to company
     */
    emitToCompany(companyId, event, data) {
        this.io.to(`company:${companyId}`).emit(event, data);
    }
}

// Singleton instance
let instance = null;

/**
 * Initialize the socket emitter with io instance
 * @param {Server} io - Socket.io server instance
 */
function initializeSocketEmitter(io) {
    instance = new SocketEmitter(io);
    return instance;
}

/**
 * Get the socket emitter instance
 * @returns {SocketEmitter}
 */
function getSocketEmitter() {
    if (!instance) {
        throw new Error('SocketEmitter not initialized. Call initializeSocketEmitter(io) first.');
    }
    return instance;
}

module.exports = {
    SocketEmitter,
    initializeSocketEmitter,
    getSocketEmitter
};
