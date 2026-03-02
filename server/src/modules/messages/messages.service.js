// server/src/modules/messages/messages.service.js
/**
 * Messages Service - Business Logic Layer
 * Handles all message-related business logic including E2EE
 * 
 * @module messages/service
 */

const Message = require("../../features/messages/message.model.js");
const DMSession = require('../../../models/DMSession');
const _Channel = require("../../features/channels/channel.model.js");
const Workspace = require('../../../models/Workspace');
const { _isMember } = require('../../../utils/memberHelpers');
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
        _isEncrypted
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

        // 🔧 Ensure sender is properly structured for reliable frontend rendering
        // This guarantees profile icons display correctly in real-time
        if (message.sender) {
            messageObject.sender = {
                _id: message.sender._id,
                username: message.sender.username,
                email: message.sender.email,
                profilePicture: message.sender.profilePicture
            };
        }

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
        userJoinedAt = null,
        userId = null
    } = options;

    // Build query with pagination
    // Only top-level messages, and exclude messages hidden for this user
    let finalQuery = { ...query, parentId: null };
    if (userId) {
        finalQuery.hiddenFor = { $nin: [userId] };
    }

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

    // Pre-aggregate all reply counts in ONE query (no N+1)
    let messagesWithCounts = messages.map(m => m.toObject ? m.toObject() : m);
    if (populateReplies) {
        const messageIds = messages.map(m => m._id);
        const counts = await Message.aggregate([
            {
                $match: {
                    parentId: { $in: messageIds },
                    type: { $ne: 'system' }
                }
            },
            { $group: { _id: '$parentId', replyCount: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [c._id.toString(), c.replyCount]));
        messagesWithCounts = messagesWithCounts.map(msgObj => ({
            ...msgObj,
            replyCount: countMap.get(msgObj._id.toString()) || 0
        }));
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

// ==================== MESSAGE MUTATIONS ====================

/**
 * Edit a message (sender only)
 * Updates text, sets editedAt, increments version
 */
async function editMessage(messageId, userId, newText, io) {
    const message = await Message.findById(messageId)
        .populate('sender', 'username email profilePicture');
    if (!message) throw new Error('Message not found');

    if (message.sender._id.toString() !== userId.toString()) {
        const err = new Error('Unauthorized: only the sender can edit this message');
        err.status = 403;
        throw err;
    }

    if (message.isDeleted) {
        const err = new Error('Cannot edit a deleted message');
        err.status = 400;
        throw err;
    }

    // Store new text in payload for E2EE consistency
    // Note: for encrypted messages, newText IS the new ciphertext/payload blob
    message.text = newText;
    message.editedAt = new Date();
    message.version = (message.version || 1) + 1;
    await message.save();

    const room = message.channel
        ? `channel:${message.channel}`
        : `dm:${message.dm}`;

    if (io) {
        io.to(room).emit('message:edited', message.toObject());
    }

    return message;
}

/**
 * Delete a message.
 *
 * scope === 'me'       → hide message only for the requesting user (hiddenFor[] field).
 *                         Any channel member may do this to any message.
 * scope === 'everyone' → universally soft-delete (sender-only, default behaviour).
 *
 * @param {string} messageId
 * @param {string} userId
 * @param {Object} io        - socket.io server instance
 * @param {string} [scope]   - 'me' | 'everyone' (default: 'everyone')
 * @param {string} [socketId] - the requester's individual socket id (for 'me' scope)
 */
async function deleteMessage(messageId, userId, io, scope = 'everyone', socketId = null) {
    const message = await Message.findById(messageId)
        .populate('sender', 'username email profilePicture');
    if (!message) throw new Error('Message not found');

    const room = message.channel
        ? `channel:${message.channel}`
        : `dm:${message.dm}`;

    // ── Delete For Me ────────────────────────────────────────────
    if (scope === 'me') {
        // Any user can hide any message from their own view
        const alreadyHidden = message.hiddenFor.some(
            id => id.toString() === userId.toString()
        );
        if (!alreadyHidden) {
            message.hiddenFor.push(userId);
            await message.save();
        }

        // Emit ONLY to the requester's socket (personal – not the whole room)
        if (io && socketId) {
            io.to(socketId).emit('message:hidden', { messageId });
        }

        return message;
    }

    // ── Delete For Everyone ───────────────────────────────────────
    if (message.sender._id.toString() !== userId.toString()) {
        const err = new Error('Unauthorized: only the sender can delete this message for everyone');
        err.status = 403;
        throw err;
    }

    message.isDeleted = true;
    message.isDeletedUniversally = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    if (io) {
        io.to(room).emit('message:deleted', {
            messageId,
            deletedBy: userId,
            deletedByName: message.sender?.username || null,
            deletedAt: message.deletedAt
        });
    }

    return message;
}

/**
 * Add a reaction to a message.
 * Enforces ONE reaction per user per message:
 *   – If the user already has the SAME emoji → no-op (idempotent).
 *   – If the user has a DIFFERENT emoji → remove old one, add new one.
 */
async function addReaction(messageId, userId, emoji, io) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');

    const existingReaction = message.reactions.find(
        r => r.userId.toString() === userId.toString()
    );

    if (existingReaction) {
        if (existingReaction.emoji === emoji) {
            // Same emoji clicked again — treat as a no-op (client toggles off via removeReaction)
            // Nothing to save; still re-emit so the client stays in sync
        } else {
            // Different emoji — swap: remove old, add new
            message.reactions = message.reactions.filter(
                r => r.userId.toString() !== userId.toString()
            );
            message.reactions.push({ userId, emoji });
            await message.save();
        }
    } else {
        // First reaction from this user
        message.reactions.push({ userId, emoji });
        await message.save();
    }

    const room = message.channel
        ? `channel:${message.channel}`
        : `dm:${message.dm}`;

    if (io) {
        io.to(room).emit('message:reaction_added', {
            messageId,
            userId,
            emoji,
            reactions: message.reactions
        });
    }

    return message;
}

/**
 * Remove a reaction from a message
 */
async function removeReaction(messageId, userId, emoji, io) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');

    message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );
    await message.save();

    const room = message.channel
        ? `channel:${message.channel}`
        : `dm:${message.dm}`;

    if (io) {
        io.to(room).emit('message:reaction_removed', {
            messageId,
            userId,
            emoji,
            reactions: message.reactions
        });
    }

    return message;
}

// ==================== EXPORTS ====================

module.exports = {
    createMessage,
    fetchMessages,
    findOrCreateDMSession,
    getUserDMSessions,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction
};
