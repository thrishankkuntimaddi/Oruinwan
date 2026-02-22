/**
 * Message Socket Handlers
 * 
 * Handles all socket events related to messages:
 * - Conversation join/leave
 * - Typing indicators
 * - Message events (unified)
 * - Legacy message events
 * 
 * @module socket/handlers/messages
 */

const logger = require('../../../utils/logger');

/**
 * Register message-related socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Socket} socket - Individual socket connection
 */
function registerMessageHandlers(io, socket) {

    // ============================================================
    // CONVERSATION ROOM MANAGEMENT
    // ============================================================

    /**
     * Join a conversation room
     * Client emits this when opening a chat
     * IDEMPOTENT: Safe to call multiple times
     */
    socket.on('conversation:join', (data) => {
        const { conversationId, type, _workspaceId } = data;



        // Validate
        if (!conversationId || !type) {
            socket.emit('error', { message: 'Missing conversationId or type' });
            return;
        }

        // Determine room name
        const room = type === 'channel'
            ? `channel:${conversationId}`
            : type === 'dm'
                ? `dm:${conversationId}`
                : `thread:${conversationId}`;

        // Idempotent check: prevent duplicate joins
        if (socket.rooms.has(room)) {
            logger.socket(`⏭️ User ${socket.user.id} already in ${room}`);
            return;
        }

        // Join room
        socket.join(room);
        logger.socket(`💬 User ${socket.user.id} joined ${room}`);

        // Optionally broadcast join event
        socket.to(room).emit('conversation:member_joined', {
            userId: socket.user.id,
            conversationId,
            timestamp: new Date()
        });
    });

    /**
     * Leave a conversation room
     */
    socket.on('conversation:leave', (data) => {
        const { conversationId, type } = data;

        if (!conversationId || !type) return;

        const room = type === 'channel'
            ? `channel:${conversationId}`
            : type === 'dm'
                ? `dm:${conversationId}`
                : `thread:${conversationId}`;

        // Check if actually in room before leaving
        if (!socket.rooms.has(room)) {
            return; // Already not in room
        }

        socket.leave(room);
        logger.socket(`👋 User ${socket.user.id} left ${room}`);

        // Optionally broadcast leave event
        socket.to(room).emit('conversation:member_left', {
            userId: socket.user.id,
            conversationId,
            timestamp: new Date()
        });
    });

    // ============================================================
    // LEGACY ROOM MANAGEMENT (Backward Compatibility)
    // ============================================================

    /**
     * Legacy: Join channel
     * @deprecated Use conversation:join instead
     */
    socket.on('chat:join', (channelId) => {
        logger.socket(`🎯🎯🎯 [chat:join] EVENT RECEIVED!`);
        logger.socket(`📥 [chat:join] Channel ID: ${channelId}`);
        logger.socket(`📥 [chat:join] Socket ID: ${socket.id}`);
        logger.socket(`📥 [chat:join] User ID: ${socket.user.id}`);



        socket.join(`channel:${channelId}`);
        logger.socket(`💬 User ${socket.user.id} joined channel:${channelId} (legacy)`);
    });

    /**
     * Legacy: Leave channel
     * @deprecated Use conversation:leave instead
     */
    socket.on('chat:leave', (channelId) => {
        socket.leave(`channel:${channelId}`);
        logger.socket(`👋 User ${socket.user.id} left channel:${channelId} (legacy)`);
    });

    // ============================================================
    // UNIFIED EVENT HANDLER
    // ============================================================

    /**
     * Unified conversation event handler
     * This is the NEW ARCHITECTURE - handles all conversation events
     */
    socket.on('conversation:event', async (data) => {
        try {
            const { conversationId, conversationType, event } = data;

            // Validate
            if (!conversationId || !conversationType || !event) {
                socket.emit('error', { message: 'Invalid conversation event' });
                return;
            }

            logger.socket(`📤 Conversation event: ${event.type} in ${conversationType}:${conversationId}`);

            // Determine room
            const room = conversationType === 'channel'
                ? `channel:${conversationId}`
                : conversationType === 'dm'
                    ? `dm:${conversationId}`
                    : `thread:${conversationId}`;

            // Add metadata
            const fullEvent = {
                ...event,
                userId: socket.user.id,
                timestamp: new Date()
            };

            // Broadcast to room
            io.to(room).emit('conversation:event', {
                conversationId,
                conversationType,
                event: fullEvent
            });

            // Also emit specific legacy events for backward compatibility
            switch (event.type) {
                case 'message':
                    io.to(room).emit('new-message', event.payload);
                    break;
                case 'poll':
                    io.to(room).emit('poll:new', event.payload);
                    break;
                case 'meeting':
                    io.to(room).emit('meeting:new', event.payload);
                    break;
                case 'system':
                    io.to(room).emit('system:event', event.payload);
                    break;
                case 'edit':
                    io.to(room).emit('message:edited', event.payload);
                    break;
                case 'delete':
                    io.to(room).emit('message:deleted', event.payload);
                    break;
            }
        } catch (err) {
            console.error('Error handling conversation event:', err);
            socket.emit('error', { message: 'Failed to process event' });
        }
    });

    // ============================================================
    // TYPING INDICATORS
    // ============================================================

    /**
     * Typing indicator
     * Broadcasts to all users in the conversation except sender
     */
    socket.on('chat:typing', (data) => {
        const { channelId, dmId, isTyping } = data;

        const room = channelId ? `channel:${channelId}` : `dm:${dmId}`;

        if (!room) return;

        // Broadcast to others in room (not sender)
        socket.to(room).emit('chat:user_typing', {
            userId: socket.user.id,
            isTyping
        });
    });

    // ============================================================
    // DIRECT MESSAGE HANDLERS
    // ============================================================

    /**
     * Join DM room
     * Client emits this when opening a DM conversation
     * Validates user is a participant before allowing join
     */
    socket.on('join-dm', async (data) => {
        try {
            const { dmSessionId } = data;



            if (!dmSessionId) {
                socket.emit('error', { message: 'Missing dmSessionId' });
                return;
            }

            // Validate user is authenticated
            if (!socket.user || !socket.user.id) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // Load DMSession model
            const DMSession = require('../../../models/DMSession');

            // Verify DM session exists and user is a participant
            const dmSession = await DMSession.findById(dmSessionId);

            if (!dmSession) {
                socket.emit('error', { message: 'DM session not found' });
                return;
            }

            // Check if user is a participant
            const isParticipant = dmSession.participants.some(
                p => p.toString() === socket.user.id.toString()
            );

            if (!isParticipant) {
                logger.warn(`🚫 User ${socket.user.id} attempted to join DM ${dmSessionId} without authorization`);
                socket.emit('error', { message: 'Not a participant of this DM' });
                return;
            }

            // Join DM room
            const room = `dm:${dmSessionId}`;

            // Idempotent check
            if (socket.rooms.has(room)) {
                logger.socket(`⏭️ User ${socket.user.id} already in ${room}`);
                return;
            }

            socket.join(room);
            logger.socket(`💬 User ${socket.user.id} joined ${room}`);

        } catch (error) {
            console.error('Error joining DM room:', error);
            socket.emit('error', { message: 'Failed to join DM' });
        }
    });

    /**
     * Send DM message via socket
     * Calls existing messagesController.sendDirectMessage for persistence
     * Provides real-time delivery and optimistic UI reconciliation
     */
    socket.on('send-message', async (data) => {
        try {
            const { workspaceId, dmSessionId, receiverId, clientTempId, text } = data;

            // Validate required fields
            if (!workspaceId) {
                socket.emit('send-error', {
                    clientTempId,
                    message: 'Missing workspaceId'
                });
                return;
            }

            // Must have either dmSessionId (existing DM) or receiverId (new DM)
            if (!dmSessionId && !receiverId) {
                socket.emit('send-error', {
                    clientTempId,
                    message: 'Missing dmSessionId or receiverId'
                });
                return;
            }

            if (!text || !text.trim()) {
                socket.emit('send-error', {
                    clientTempId,
                    message: 'Message text is required'
                });
                return;
            }

            // Load required models and controllers (USING MODULAR ARCHITECTURE)
            const messagesController = require('../../modules/messages/messages.controller');
            const _DMSession = require('../../../models/DMSession');

            // Create mock request/response objects for controller
            const mockReq = {
                user: { sub: socket.user.id },
                body: {
                    workspaceId,
                    receiverId: receiverId || null,
                    text: text.trim(),
                    // Support encrypted payloads if provided
                    ciphertext: data.ciphertext,
                    messageIv: data.messageIv,
                    isEncrypted: data.isEncrypted || false
                },
                io // Pass io instance for broadcasting
            };

            const mockRes = {
                status: function (code) {
                    this.statusCode = code;
                    return this;
                },
                json: function (data) {
                    this.jsonData = data;
                    return this;
                }
            };

            // Call existing controller
            await messagesController.sendDirectMessage(mockReq, mockRes);

            // Check response status
            if (mockRes.statusCode === 201 && mockRes.jsonData && mockRes.jsonData.message) {
                let serverMessage = mockRes.jsonData.message;

                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 🔧 FIX: Ensure sender is fully populated for profile icon display
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // Socket emissions must include populated sender with username and profilePicture
                // Otherwise frontend can't display profile icons in real-time messages
                if (!serverMessage.sender?.username) {
                    logger.socket(`🔍 Sender not populated, re-fetching message ${serverMessage._id}`);
                    const Message = require('../../features/messages/message.model.js');
                    const populatedMessage = await Message.findById(serverMessage._id)
                        .populate('sender', 'username email profilePicture');

                    if (populatedMessage) {
                        serverMessage = populatedMessage.toObject();
                        logger.socket(`✅ Re-populated sender: ${serverMessage.sender?.username}`);
                    }
                }

                // Emit success to sender with clientTempId for optimistic UI reconciliation
                socket.emit('message-sent', {
                    clientTempId,
                    message: serverMessage
                });

                // Determine DM session ID
                const sessionId = dmSessionId || serverMessage.dm;

                // Broadcast to DM room (includes both participants)
                io.to(`dm:${sessionId}`).emit('new-message', {
                    message: serverMessage,
                    clientTempId
                });

                logger.socket(`✅ DM message sent: ${serverMessage._id} in dm:${sessionId}`);

            } else {
                // Controller returned error
                const errorMessage = mockRes.jsonData?.message || 'Failed to send message';
                socket.emit('send-error', {
                    clientTempId,
                    message: errorMessage
                });

                logger.warn(`⚠️ DM send failed for user ${socket.user.id}: ${errorMessage}`);
            }

        } catch (error) {
            console.error('Error sending DM message via socket:', error);
            socket.emit('send-error', {
                clientTempId: data.clientTempId,
                message: error.message || 'Internal server error'
            });
        }
    });

    // ============================================================
    // LEGACY MESSAGE HANDLER (Deprecated)
    // ============================================================

    /**
     * Legacy: Send message via socket
     * @deprecated Use HTTP POST /api/v2/messages/* instead
     * 
     * This is kept for backward compatibility but should not be used.
     * Messages should be created via HTTP for proper persistence.
     */
    socket.on('chat:message', (data) => {
        logger.warn('⚠️ DEPRECATED: chat:message event used. Use HTTP POST instead.');

        const { channelId, message } = data;

        // Still broadcast for backward compatibility
        io.to(`channel:${channelId}`).emit('chat:new_message', {
            ...message,
            sender: socket.user.id
        });
    });
}

module.exports = registerMessageHandlers;
