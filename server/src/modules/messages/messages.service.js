// server/src/modules/messages/messages.service.js
/**
 * Messages Service - Business Logic Layer
 * Handles all message-related business logic including E2EE
 * 
 * @module messages/service
 */

const Message = require('../../../models/Message');
const DMSession = require('../../../models/DMSession');
const Channel = require('../../../models/Channel');
const Workspace = require('../../../models/Workspace');
const { isMember } = require('../../../utils/memberHelpers');

// ==================== MESSAGE CREATION ====================

/**
 * Create a new message (channel or DM)
 * Handles both encrypted and unencrypted messages
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
        text,
        attachments = [],
        parentId = null,
        ciphertext,
        messageIv,
        isEncrypted = false
    } = messageData;

    // Build message document
    const messageDoc = {
        type,
        company,
        workspace,
        channel,
        dm,
        sender,
        parentId
    };

    // Handle E2EE content
    if (isEncrypted && ciphertext && messageIv) {
        messageDoc.ciphertext = ciphertext;
        messageDoc.messageIv = messageIv;
        messageDoc.isEncrypted = true;
        messageDoc.encryptionVersion = 'aes-256-gcm-v1';
        messageDoc.payload = {
            text: '', // Empty for encrypted messages
            attachments: attachments || []
        };
        console.log('🔐 Storing encrypted message');
    } else {
        // Unencrypted message
        messageDoc.isEncrypted = false;
        messageDoc.payload = {
            text: text || '',
            attachments: attachments || []
        };
    }

    // Create message
    const message = await Message.create(messageDoc);

    // Populate sender for response and real-time broadcast
    await message.populate('sender', 'username email profilePicture');

    // Convert to plain object to ensure all virtuals and getters are included
    const messageObject = message.toObject();

    // Add default values for fields that may be missing
    messageObject.replyCount = 0;
    messageObject.reactions = messageObject.reactions || [];
    messageObject.isPinned = messageObject.isPinned || false;
    messageObject.isDeleted = messageObject.isDeleted || false;

    // Emit real-time event with fully populated message
    if (io) {
        const room = channel ? `channel:${channel}` : `dm:${dm}`;
        console.log(`📡 Broadcasting new-message to room: ${room}`);
        console.log(`📨 Message ID: ${messageObject._id}, Sender: ${messageObject.sender?.username}`);
        io.to(room).emit('new-message', messageObject);
        console.log(`✅ Successfully emitted new-message to ${room}`);
    }

    return message;
}

// ==================== MESSAGE RETRIEVAL ====================

/**
 * Fetch messages with pagination and filtering
 * 
 * @param {Object} query - Base query filter
 * @param {Object} options - Pagination and population options
 * @returns {Promise<Object>} Messages with metadata
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

    // Pagination: get messages before a specific timestamp
    if (before) {
        const beforeMsg = await Message.findById(before);
        if (beforeMsg) {
            finalQuery.createdAt = userJoinedAt
                ? { $gte: userJoinedAt, $lt: beforeMsg.createdAt }
                : { $lt: beforeMsg.createdAt };
        }
    }

    // Fetch messages
    const messages = await Message.find(finalQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('sender', 'username email profilePicture')
        .populate('readBy.user', 'username')
        .populate({
            path: 'parentId',
            populate: { path: 'sender', select: 'username profilePicture' }
        });

    // Reverse for chronological order
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

    // Check if there are more messages
    const totalCount = await Message.countDocuments(query);
    const hasMore = messages.length === limit;

    return {
        messages: messagesWithCounts,
        hasMore,
        total: totalCount
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
            const otherUser = session.participants.find(
                (p) => String(p._id) !== String(userId)
            );

            // Count unread messages
            const unreadCount = await Message.countDocuments({
                dm: session._id,
                sender: { $ne: userId },
                readBy: { $ne: userId }
            });

            return {
                id: session._id,
                otherUser: otherUser || { username: 'Self' },
                otherUserId: otherUser?._id,
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
