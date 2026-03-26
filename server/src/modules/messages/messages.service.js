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
        quotedMessageId = null,   // ← WhatsApp-style inline reply (NOT a thread)
        ciphertext,
        messageIv,
        _isEncrypted,
        // Phase-7 rich-message fields
        poll = null,
        contact = null,
        meeting = null,
        linkPreview = null,
        // Mention parsing — plaintext sent alongside ciphertext, never stored as message content
        mentionText = '',
    } = messageData;

    // ============================================================
    // E2EE ENFORCEMENT — type-aware (Phase-7 update)
    // ============================================================
    // Standard text messages MUST be encrypted.
    // Rich types (poll, file, image, video, voice, contact, meeting)
    // carry structured data instead of ciphertext and bypass this gate.
    const TEXT_TYPES = ['message'];
    if (TEXT_TYPES.includes(type) && (!ciphertext || !messageIv)) {
        throw new Error('E2EE required for text messages: missing ciphertext or messageIv');
    }

    // Build message document
    const messageDoc = {
        type,
        company,
        workspace,
        channel,
        dm,
        sender,
        parentId,
        quotedMessageId: quotedMessageId || null,
        // E2EE payload — only populated for type==='message'
        payload: type === 'message' ? {
            ciphertext,
            messageIv,
            isEncrypted: true,
        } : undefined,
        // Canonical attachments field (Phase-7)
        attachments: attachments || [],
    };

    // Attach Phase-7 subdocuments only when provided
    if (poll) messageDoc.poll = poll;
    if (contact) messageDoc.contact = contact;
    if (meeting) messageDoc.meeting = meeting;
    if (linkPreview) messageDoc.linkPreview = linkPreview;

    console.log(`📨 Creating message [type=${type}]${type === 'message' ? ' 🔐' : ''}`);

    // ============================================================
    // DB WRITE FIRST (CRITICAL: Prevent race conditions)
    // ============================================================
    const message = await Message.create(messageDoc);

    // Populate sender for response and real-time broadcast
    await message.populate('sender', 'username email profilePicture');

    // Populate quotedMessage for inline reply preview
    if (message.quotedMessageId) {
        await message.populate({
            path: 'quotedMessageId',
            populate: { path: 'sender', select: 'username profilePicture' }
        });
    }

    // ============================================================
    // FIX 4: Update channel activity counters (non-blocking)
    // Keeps lastMessageAt and messageCount accurate for ordering + unread
    // ============================================================
    if (channel) {
        const Channel = require('../../features/channels/channel.model.js');
        Channel.findByIdAndUpdate(
            channel,
            {
                $inc: { messageCount: 1 },
                $set: { lastMessageAt: message.createdAt }
            }
        ).catch(err => console.error('[createMessage] Failed to update channel counters:', err));
    }

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

    // ============================================================
    // MENTION PROCESSING — fire-and-forget, never delays delivery
    // Parse mentionText (plaintext) to find @username handles,
    // resolve to user IDs, store on message, and send notifications.
    // ============================================================
    if (mentionText && company) {
        (async () => {
            try {
                const { extractMentions } = require('../../utils/mentionParser');
                const notificationService = require('../../features/notifications/notificationService');
                const Channel = require('../../features/channels/channel.model.js');

                const { mentionedUserIds, isHere, isChannel } = await extractMentions(
                    mentionText,
                    company,
                    sender
                );

                if (mentionedUserIds.length > 0) {
                    // Persist mentions array on the message document
                    await Message.findByIdAndUpdate(message._id, {
                        $set: { mentions: mentionedUserIds }
                    });

                    // Send a notification to each mentioned user
                    // notificationService.mention() already exists — zero changes needed
                    let channelName = 'a channel';
                    let channelId = channel || null;
                    if (channel) {
                        try {
                            const channelDoc = await Channel.findById(channel).select('name').lean();
                            if (channelDoc) channelName = channelDoc.name;
                        } catch (_) { /* non-critical */ }
                    }

                    const senderDoc = message.sender;
                    const senderUsername = senderDoc?.username || 'Someone';
                    // Truncate mentionText for notification snippet (max 60 chars)
                    const snippet = mentionText.length > 60
                        ? mentionText.slice(0, 57) + '...'
                        : mentionText;

                    await Promise.allSettled(
                        mentionedUserIds.map(userId =>
                            notificationService.mention(io, {
                                mentionedUserId: userId,
                                senderUsername,
                                workspaceId: workspace,
                                channelName,
                                channelId,
                                snippet,
                            })
                        )
                    );

                    console.log(`[createMessage] 📣 Mention notifications sent to ${mentionedUserIds.length} user(s)`);
                }

                // @here / @channel — log for now, bulk notify in a future phase
                if (isHere || isChannel) {
                    console.log(`[createMessage] 📢 @${isHere ? 'here' : 'channel'} detected — bulk notify not yet implemented`);
                }
            } catch (mentionErr) {
                console.error('[createMessage] Mention processing error (non-fatal):', mentionErr.message);
            }
        })();
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
        })
        .populate({
            path: 'quotedMessageId',
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
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CRITICAL: Always sort participants so the pair [A,B] === [B,A].
    // The MongoDB unique multikey index on { workspace, participants } only
    // prevents duplicates when the stored array is identical. By sorting, we
    // guarantee the stored array is always in the same order, making the index
    // work correctly and preventing E11000 errors when either user initiates.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const sortedParticipants = [String(userId1), String(userId2)].sort();

    // Find existing session using $all + $size (order-independent)
    let dmSession = await DMSession.findOne({
        workspace: workspaceId,
        participants: { $all: sortedParticipants, $size: 2 }
    });

    if (!dmSession) {
        // Get workspace to extract company
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            throw new Error('Workspace not found');
        }

        // ── Atomic findOneAndUpdate with upsert ────────────────────────────
        // Using upsert prevents a race condition where two concurrent requests
        // both find no session and both try to create one (E11000).
        // The filter uses the sorted participants array for consistent matching.
        try {
            dmSession = await DMSession.findOneAndUpdate(
                {
                    workspace: workspaceId,
                    participants: { $all: sortedParticipants, $size: 2 }
                },
                {
                    $setOnInsert: {
                        workspace: workspaceId,
                        company: workspace.company || null,
                        participants: sortedParticipants,
                        lastMessageAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );
        } catch (upsertErr) {
            // Handle race condition: another request just created the session
            if (upsertErr.code === 11000) {
                dmSession = await DMSession.findOne({
                    workspace: workspaceId,
                    participants: { $all: sortedParticipants, $size: 2 }
                });
                if (!dmSession) throw upsertErr;
            } else {
                throw upsertErr;
            }
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DM E2EE: Bootstrap conversation key at creation (same as channels)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`🔐 [DM][E2EE] Bootstrapping conversation key for new DM session ${dmSession._id}`);

        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: dmSession._id,
                conversationType: 'dm',
                workspaceId: workspaceId,
                members: sortedParticipants
            });
            console.log(`✅ [DM][E2EE] Conversation key created for DM ${dmSession._id}`);
        } catch (keyError) {
            // If key already exists (idempotent), that's fine — log and continue
            if (keyError.message && keyError.message.includes('already exists')) {
                console.log(`ℹ️ [DM][E2EE] Conversation key already exists for DM ${dmSession._id}`);
            } else {
                console.error(`❌ [DM][E2EE] Failed to create conversation key for DM ${dmSession._id}:`, keyError);
                throw new Error('Failed to initialize DM encryption: ' + keyError.message);
            }
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
                .select('payload type text createdAt sender')
                .populate('sender', 'username');

            // Find the other user
            const otherUser = session.participants.find(
                (p) => {
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

            // ✅ FIX: Build meaningful lastMessage for E2EE and attachment-type messages
            let lastMessageText = 'No messages yet';
            if (lastMsg) {
                if (lastMsg.type === 'image') lastMessageText = '📷 Photo';
                else if (lastMsg.type === 'video') lastMessageText = '🎬 Video';
                else if (lastMsg.type === 'voice') lastMessageText = '🎵 Voice note';
                else if (lastMsg.type === 'file') lastMessageText = '📎 File';
                else if (lastMsg.type === 'poll') lastMessageText = '📊 Poll';
                else if (lastMsg.type === 'contact') lastMessageText = '👤 Contact';
                else if (lastMsg.type === 'meeting') lastMessageText = '📅 Meeting';
                else if (lastMsg.text) lastMessageText = lastMsg.text; // plaintext edit fallback
                else if (lastMsg.payload?.isEncrypted || lastMsg.payload?.ciphertext) lastMessageText = '🔒 Encrypted message';
                else lastMessageText = 'Message';
            }

            return {
                id: session._id,
                otherUser: otherUser || { username: 'Self' },
                otherUserId: otherUser?._id || otherUser,
                lastMessage: lastMessageText,
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
 * Updates payload.ciphertext (E2EE) or text, sets editedAt, increments version
 */
async function editMessage(messageId, userId, { text, ciphertext, messageIv } = {}, io) {
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

    if (ciphertext && messageIv) {
        // E2EE edit: update the encrypted payload so batchDecryptMessages sees new text on reload
        // Save a history snapshot first — store '[encrypted]' since we don't have the plaintext
        message.editHistory = message.editHistory || [];
        message.editHistory.push({
            text: null,
            ciphertext: message.payload?.ciphertext || null,
            messageIv: message.payload?.messageIv || null,
            isEncrypted: true,
            editedAt: message.editedAt || message.updatedAt || new Date()
        });
        message.markModified('editHistory');

        message.payload = {
            ...(message.payload || {}),
            ciphertext,
            messageIv,
            isEncrypted: true
        };
        message.markModified('payload');
    } else if (text) {
        // Plaintext fallback: save current text to history before overwriting
        message.editHistory = message.editHistory || [];
        message.editHistory.push({
            text: message.text || '',
            editedAt: message.editedAt || message.updatedAt || new Date()
        });
        message.markModified('editHistory');

        message.text = text;
    }

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
    const isSender = message.sender._id.toString() === userId.toString();

    // Channel admins may also delete any message for everyone
    let isChannelAdmin = false;
    if (!isSender && message.channel) {
        const Channel = require('../../features/channels/channel.model');
        const channel = await Channel.findById(message.channel).select('admins createdBy').lean();
        if (channel) {
            const adminIds = (channel.admins || []).map(id => id.toString());
            isChannelAdmin = adminIds.includes(userId.toString()) ||
                channel.createdBy?.toString() === userId.toString();
        }
    }

    if (!isSender && !isChannelAdmin) {
        const err = new Error('Unauthorized: only the sender or a channel admin can delete this message for everyone');
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
