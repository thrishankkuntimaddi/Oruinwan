// server/src/modules/messages/messages.service.js
/**
 * Messages Service - Business Logic Layer
 * Handles all message-related business logic including E2EE
 * 
 * @module messages/service
 */

const Message = require("../../features/messages/message.model.js");
const DMSession = require('../../../models/DMSession');
const Channel = require("../../features/channels/channel.model.js");
const Workspace = require('../../../models/Workspace');
const { isMember } = require('../../../utils/memberHelpers');
const conversationKeysService = require('../conversations/conversationKeys.service');

// ==================== MESSAGE CREATION ====================

/**
 * Create a new message (channel or DM)
 * E2EE ONLY - plaintext messages are NOT allowed
 * 
 * @param {Object} messageData - Message data
 * @param {Object} io - Socket.io instance for real-time events
 * @returns {Promise<Object>} Created message with populated fields
 */
async function createMessage(messageData, io = null) {
    const {
        type = 'message',
        company,
        workspace,
        channel,
        dm,
        sender,
        attachments = [],
        parentId = null,
        ciphertext,
        messageIv,
        isEncrypted
    } = messageData;

    // ============================================================
    // E2EE HARD ENFORCEMENT
    // ============================================================
    // All workspace messages MUST be encrypted
    // Server must be cryptographically blind
    if (!ciphertext || !messageIv) {
        throw new Error('E2EE required: missing ciphertext or messageIv');
    }

    // Build message document with CORRECT payload structure
    const messageDoc = {
        type,
        company,
        workspace,
        channel,
        dm,
        sender,
        parentId,
        // Payload matches Message schema exactly
        payload: {
            ciphertext,      // Base64-encoded AES-GCM ciphertext
            messageIv,       // Base64-encoded IV
            isEncrypted: true,
            attachments: attachments || []
        }
    };

    console.log('🔐 Creating encrypted message');

    // ============================================================
    // DB WRITE FIRST (CRITICAL: Prevent race conditions)
    // ============================================================
    const message = await Message.create(messageDoc);

    // Populate sender for response and real-time broadcast
    await message.populate('sender', 'username email profilePicture');

    // ============================================================
    // SOCKET EMIT AFTER DB SAVE (Race condition prevention)
    // ============================================================
    // Socket emit MUST come after DB write
    // Otherwise clients receive message before it's stored
    if (io) {
        const room = channel ? `channel:${channel}` : `dm:${dm}`;
        const messageObject = message.toObject();

        // Add default values for client-side rendering
        messageObject.replyCount = 0;
        messageObject.reactions = messageObject.reactions || [];
        messageObject.isPinned = messageObject.isPinned || false;

        io.to(room).emit('new-message', messageObject);
    }

    return message;
}

// ==================== MESSAGE RETRIEVAL ====================

/**
 * Fetch messages with cursor-based pagination
 * Uses _id for stable pagination (no race conditions)
 * 
 * @param {Object} query - Base query filter
 * @param {Object} options - Pagination and population options
 * @returns {Promise<Object>} Messages with hasMore flag
 */
async function fetchMessages(query, options = {}) {
    const {
        limit = 50,
        before = null,
        populateReplies = false,
        userJoinedAt = null
    } = options;

    // Build query with pagination
    let finalQuery = { ...query, parentId: null }; // Only top-level messages

    // Add join-date filter if provided (for channels)
    if (userJoinedAt) {
        finalQuery.createdAt = { $gte: userJoinedAt };
    }

    // Cursor-based pagination: get messages with _id less than 'before'
    if (before) {
        if (finalQuery.createdAt) {
            // If join date filter exists, we need to check if the 'before' message is after join
            const beforeMsg = await Message.findById(before);
            if (beforeMsg && beforeMsg.createdAt >= userJoinedAt) {
                finalQuery._id = { $lt: before };
            }
        } else {
            finalQuery._id = { $lt: before };
        }
    }

    // Fetch limit + 1 to check if there are more messages
    const fetchLimit = parseInt(limit) + 1;

    // Fetch messages (sorted by _id descending for cursor pagination)
    const messages = await Message.find(finalQuery)
        .sort({ _id: -1 }) // Use _id for stable ordering
        .limit(fetchLimit)
        .populate('sender', 'username email profilePicture')
        .populate('readBy.user', 'username')
        .populate({
            path: 'parentId',
            populate: { path: 'sender', select: 'username profilePicture' }
        });

    // Check if there are more messages
    const hasMore = messages.length > parseInt(limit);
    if (hasMore) {
        messages.pop(); // Remove the extra message
    }

    // Reverse for chronological order (oldest to newest)
    messages.reverse();

    // Populate reply counts if requested
    let messagesWithCounts = messages;
    if (populateReplies) {
        messagesWithCounts = await Promise.all(
            messages.map(async (msg) => {
                const replyCount = await Message.countDocuments({
                    parentId: msg._id,
                    type: { $ne: 'system' }
                });

                const msgObj = msg.toObject();
                msgObj.replyCount = replyCount;
                return msgObj;
            })
        );
    }

    return {
        messages: messagesWithCounts,
        hasMore
    };
}

// ==================== DM SESSION MANAGEMENT ====================

/**
 * Find or create a DM session between two users
 * 
 * @param {String} userId1 - First user ID
 * @param {String} userId2 - Second user ID
 * @param {String} workspaceId - Workspace ID
 * @returns {Promise<Object>} DM session document
 */
async function findOrCreateDMSession(userId1, userId2, workspaceId) {
    // Find existing session
    let dmSession = await DMSession.findOne({
        workspace: workspaceId,
        participants: { $all: [userId1, userId2], $size: 2 }
    });

    if (!dmSession) {
        // Get workspace to extract company
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            throw new Error('Workspace not found');
        }

        // Create new DM session
        dmSession = await DMSession.create({
            workspace: workspaceId,
            company: workspace.company || null,
            participants: [userId1, userId2],
            lastMessageAt: new Date()
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DM E2EE: Bootstrap conversation key at creation (same as channels)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CRITICAL: DMs must have encryption keys before any messages can be sent
        // This mirrors the channel pattern: bootstrapConversationKey({ conversationType: 'channel', ... })
        console.log(`🔐 [DM][E2EE] Bootstrapping conversation key for new DM session ${dmSession._id}`);

        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: dmSession._id,
                conversationType: 'dm',  // DM-specific type
                workspaceId: workspaceId,
                members: [userId1, userId2]  // Both participants
            });
            console.log(`✅ [DM][E2EE] Conversation key created for DM ${dmSession._id}`);
        } catch (keyError) {
            console.error(`❌ [DM][E2EE] Failed to create conversation key for DM ${dmSession._id}:`, keyError);
            // Note: DMSession exists but without encryption keys
            // Frontend will fail gracefully with E2EE enforcement
            throw new Error('Failed to initialize DM encryption: ' + keyError.message);
        }
    } else {
        // Update last message time
        dmSession.lastMessageAt = new Date();
        await dmSession.save();
    }

    return dmSession;
}

/**
 * Get all DM sessions for a user in a workspace
 * 
 * @param {String} userId - User ID
 * @param {String} workspaceId - Workspace ID
 * @returns {Promise<Array>} DM session list with metadata
 */
async function getUserDMSessions(userId, workspaceId) {
    const sessions = await DMSession.find({
        workspace: workspaceId,
        participants: { $in: [userId] }
    }).populate('participants', 'username email profilePicture isOnline userStatus');

    // Enrich with last message and unread count
    const sessionList = await Promise.all(
        sessions.map(async (session) => {
            // Get last message
            const lastMsg = await Message.findOne({ dm: session._id })
                .sort({ createdAt: -1 })
                .select('payload createdAt sender')
                .populate('sender', 'username');

            // Find the other user
            // After populate, each participant IS a User object (not nested)
            const otherUser = session.participants.find(
                (p) => {
                    // Handle both populated (User object) and unpopulated (ObjectId) cases
                    const participantId = p?._id || p;
                    return String(participantId) !== String(userId);
                }
            );

            // Count unread messages
            const unreadCount = await Message.countDocuments({
                dm: session._id,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
            });

            return {
                id: session._id,
                otherUser: otherUser || { username: 'Self' },
                otherUserId: otherUser?._id || otherUser,
                lastMessage: lastMsg?.payload?.text || 'No messages yet',
                lastMessageAt: lastMsg?.createdAt || session.createdAt,
                unreadCount
            };
        })
    );

    return sessionList;
}

// ==================== EXPORTS ====================

module.exports = {
    createMessage,
    fetchMessages,
    findOrCreateDMSession,
    getUserDMSessions
};
