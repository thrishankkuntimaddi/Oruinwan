'use strict';

const Message = require('../../features/messages/message.model.js');
const DMSession = require('../../../models/DMSession');
const _Channel = require('../../features/channels/channel.model.js');
const Workspace = require('../../../models/Workspace');
const {} = require('../../../utils/memberHelpers');
const conversationKeysService = require('../conversations/conversationKeys.service');
const logger = require('../../shared/utils/logger');
const mongoose = require('mongoose');
const { loadAccessibleMessage } = require('./messageAccess');

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
        quotedMessageId = null,   
        ciphertext,
        messageIv,
        _isEncrypted,
        
        poll = null,
        contact = null,
        meeting = null,
        linkPreview = null,
        
        mentionText = '',
    } = messageData;

    
    
    
    
    
    
    const TEXT_TYPES = ['message'];
    if (TEXT_TYPES.includes(type) && (!ciphertext || !messageIv)) {
        throw new Error('E2EE required for text messages: missing ciphertext or messageIv');
    }

    
    const messageDoc = {
        type,
        company,
        workspace,
        channel,
        dm,
        sender,
        parentId,
        quotedMessageId: quotedMessageId || null,
        
        payload: type === 'message' ? {
            ciphertext,
            messageIv,
            isEncrypted: true,
        } : undefined,
        
        attachments: attachments || [],
    };

    
    if (poll) messageDoc.poll = poll;
    if (contact) messageDoc.contact = contact;
    if (meeting) messageDoc.meeting = meeting;
    if (linkPreview) messageDoc.linkPreview = linkPreview;

    logger.debug({ type }, `Creating message${type === 'message' ? ' 🔐' : ''}`);

    
    
    
    const message = await Message.create(messageDoc);

    
    await message.populate('sender', 'username email profilePicture');

    
    if (message.quotedMessageId) {
        await message.populate({
            path: 'quotedMessageId',
            populate: { path: 'sender', select: 'username profilePicture' }
        });
    }



    
    
    
    
    
    if (io) {
        const room = channel ? `channel:${channel}` : `dm:${dm}`;
        const messageObject = message.toObject();

        
        
        if (message.sender) {
            messageObject.sender = {
                _id: message.sender._id,
                username: message.sender.username,
                email: message.sender.email,
                profilePicture: message.sender.profilePicture
            };
        }

        
        messageObject.replyCount = 0;
        messageObject.reactions = messageObject.reactions || [];
        messageObject.isPinned = messageObject.isPinned || false;

        io.to(room).emit('new-message', messageObject);
    }

    
    
    
    
    
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
                    
                    await Message.findByIdAndUpdate(message._id, {
                        $set: { mentions: mentionedUserIds }
                    });

                    
                    
                    let channelName = 'a channel';
                    let channelId = channel || null;
                    if (channel) {
                        try {
                            const channelDoc = await Channel.findById(channel).select('name').lean();
                            if (channelDoc) channelName = channelDoc.name;
                        } catch (_) {  }
                    }

                    const senderDoc = message.sender;
                    const senderUsername = senderDoc?.username || 'Someone';
                    
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

                    logger.debug({ count: mentionedUserIds.length }, '[createMessage] Mention notifications dispatched');
                }

                
                if (isHere || isChannel) {
                    logger.warn({ isHere, isChannel }, '[createMessage] @here/@channel detected — bulk notify not yet implemented');
                }
            } catch (mentionErr) {
                logger.error({ err: mentionErr }, '[createMessage] Mention processing error (non-fatal)');
            }
        })();
    }

    return message;
}

async function fetchMessages(query, options = {}) {
    const {
        limit = 50,
        before = null,
        after = null,
        around = null,
        populateReplies = false,
        userJoinedAt = null,
        userId = null
    } = options;

    let finalQuery = { ...query, parentId: null };
    if (userId) {
        finalQuery.hiddenFor = { $nin: [userId] };
    }

    if (userJoinedAt) {
        finalQuery.createdAt = { $gte: userJoinedAt };
    }

    if (around) {
        const anchorMsg = await Message.findById(around)
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

        if (!anchorMsg) {
            return { messages: [], hasMore: false, hasMoreNewer: false };
        }

        const halfLimit = Math.floor(parseInt(limit) / 2);

        // Fetch older messages (fetch halfLimit + 1)
        const olderQuery = { ...finalQuery, _id: { $lt: anchorMsg._id } };
        const older = await Message.find(olderQuery)
            .sort({ _id: -1 })
            .limit(halfLimit + 1)
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

        const hasMoreOlder = older.length > halfLimit;
        if (hasMoreOlder) {
            older.pop();
        }
        older.reverse();

        // Fetch newer messages (fetch halfLimit + 1)
        const newerQuery = { ...finalQuery, _id: { $gt: anchorMsg._id } };
        const newer = await Message.find(newerQuery)
            .sort({ _id: 1 })
            .limit(halfLimit + 1)
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

        const hasMoreNewer = newer.length > halfLimit;
        if (hasMoreNewer) {
            newer.pop();
        }

        const combined = [...older, anchorMsg, ...newer];

        let messagesWithCounts = combined.map(m => m.toObject ? m.toObject() : m);
        if (populateReplies) {
            const messageIds = combined.map(m => m._id);
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
            hasMore: hasMoreOlder,
            hasMoreNewer
        };
    } else if (after) {
        finalQuery._id = { $gt: after };

        const fetchLimit = parseInt(limit) + 1;
        const messages = await Message.find(finalQuery)
            .sort({ _id: 1 }) // oldest first (chronological order)
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

        const hasMoreNewer = messages.length > parseInt(limit);
        if (hasMoreNewer) {
            messages.pop();
        }

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
            hasMoreNewer
        };
    } else {
        if (before) {
            if (finalQuery.createdAt) {
                const beforeMsg = await Message.findById(before);
                if (beforeMsg && beforeMsg.createdAt >= userJoinedAt) {
                    finalQuery._id = { $lt: before };
                }
            } else {
                finalQuery._id = { $lt: before };
            }
        }

        const fetchLimit = parseInt(limit) + 1;

        const messages = await Message.find(finalQuery)
            .sort({ _id: -1 })
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

        const hasMore = messages.length > parseInt(limit);
        if (hasMore) {
            messages.pop();
        }

        messages.reverse();

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
}

async function findOrCreateDMSession(userId1, userId2, workspaceId) {
    
    
    
    
    
    
    
    const sortedParticipants = [String(userId1), String(userId2)].sort();

    
    let dmSession = await DMSession.findOne({
        workspace: workspaceId,
        participants: { $all: sortedParticipants, $size: 2 }
    });

    if (!dmSession) {
        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            throw new Error('Workspace not found');
        }

        
        
        
        
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

        
        
        
        logger.info({ dmSessionId: dmSession._id }, '[DM][E2EE] Bootstrapping conversation key for new DM session');

        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: dmSession._id,
                conversationType: 'dm',
                workspaceId: workspaceId,
                members: sortedParticipants
            });
            logger.info({ dmSessionId: dmSession._id }, '[DM][E2EE] Conversation key created');
        } catch (keyError) {
            
            if (keyError.message && keyError.message.includes('already exists')) {
                logger.debug({ dmSessionId: dmSession._id }, '[DM][E2EE] Conversation key already exists (idempotent)');
            } else {
                logger.error({ err: keyError, dmSessionId: dmSession._id }, '[DM][E2EE] Failed to create conversation key');
                throw new Error('Failed to initialize DM encryption: ' + keyError.message);
            }
        }
    } else {
        
        dmSession.lastMessageAt = new Date();
        await dmSession.save();
    }

    return dmSession;
}

async function getUserDMSessions(userId, workspaceId) {
    const sessions = await DMSession.find({
        workspace: workspaceId,
        participants: { $in: [userId] }
    }).populate('participants', 'username email profilePicture isOnline userStatus');

    
    const sessionList = await Promise.all(
        sessions.map(async (session) => {
            
            const lastMsg = await Message.findOne({ dm: session._id })
                .sort({ createdAt: -1 })
                .select('payload type text createdAt sender')
                .populate('sender', 'username');

            
            const otherUser = session.participants.find(
                (p) => {
                    const participantId = p?._id || p;
                    return String(participantId) !== String(userId);
                }
            );

            
            const unreadCount = await Message.countDocuments({
                dm: session._id,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
            });

            
            let lastMessageText = 'No messages yet';
            if (lastMsg) {
                if (lastMsg.type === 'image') lastMessageText = '📷 Photo';
                else if (lastMsg.type === 'video') lastMessageText = '🎬 Video';
                else if (lastMsg.type === 'voice') lastMessageText = '🎵 Voice note';
                else if (lastMsg.type === 'file') lastMessageText = '📎 File';
                else if (lastMsg.type === 'poll') lastMessageText = '📊 Poll';
                else if (lastMsg.type === 'contact') lastMessageText = '👤 Contact';
                else if (lastMsg.type === 'meeting') lastMessageText = '📅 Meeting';
                else if (lastMsg.text) lastMessageText = lastMsg.text; 
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

function httpError(status, message) {
    return Object.assign(new Error(message), { status });
}

function roomFor(message) {
    if (message.channel) return `channel:${message.channel._id || message.channel}`;
    if (message.dm) return `dm:${message.dm._id || message.dm}`;
    return null;
}

/** Snapshot of the message's current content in the editHistory entry shape. */
function snapshotCurrentContent(message) {
    const encrypted = !!message.payload?.ciphertext;
    return {
        text: encrypted ? null : (message.text || ''),
        ciphertext: encrypted ? message.payload.ciphertext : null,
        messageIv: encrypted ? (message.payload.messageIv || null) : null,
        isEncrypted: encrypted,
        // When this state became current: last edit, or creation for the original.
        editedAt: message.editedAt || message.createdAt || message.updatedAt || new Date(),
        restoredFromVersion: message.restoredFromVersion ?? null,
    };
}

async function editMessage(messageId, userId, { text, ciphertext, messageIv } = {}, io) {
    const hasCipher = typeof ciphertext === 'string' && ciphertext.trim() !== '';
    const hasText = typeof text === 'string' && text.trim() !== '';
    if (!hasCipher && !hasText) throw httpError(400, 'Edit cannot be empty');
    if (hasCipher && !(typeof messageIv === 'string' && messageIv.trim() !== '')) {
        throw httpError(400, 'messageIv is required with ciphertext');
    }

    const message = await Message.findById(messageId)
        .populate('sender', 'username email profilePicture');
    if (!message) throw httpError(404, 'Message not found');

    if (message.sender._id.toString() !== userId.toString()) {
        throw httpError(403, 'Unauthorized: only the sender can edit this message');
    }

    if (message.isDeleted || message.isDeletedUniversally) {
        throw httpError(400, 'Cannot edit a deleted message');
    }

    if (hasCipher && message.payload?.ciphertext === ciphertext) {
        throw httpError(400, 'Edit is identical to the current message');
    }
    if (!hasCipher && message.text === text) {
        throw httpError(400, 'Edit is identical to the current message');
    }

    message.editHistory = message.editHistory || [];
    message.editHistory.push(snapshotCurrentContent(message));
    message.markModified('editHistory');

    if (hasCipher) {
        const prev = message.payload?.toObject ? message.payload.toObject() : (message.payload || {});
        message.payload = { ...prev, ciphertext, messageIv, isEncrypted: true };
        message.markModified('payload');
    } else {
        message.text = text;
    }

    message.restoredFromVersion = null;
    message.editedAt = new Date();
    message.version = (message.version || 1) + 1;
    await message.save();

    const room = roomFor(message);
    if (io && room) {
        io.to(room).emit('message:edited', message.toObject());
    }

    return message;
}

/**
 * Restore an older version of a message. The current content is pushed into
 * editHistory first, so no version is ever lost.
 */
async function restoreMessageVersion(messageId, userId, versionIndex, io) {
    const message = await Message.findById(messageId)
        .populate('sender', 'username email profilePicture');
    if (!message) throw httpError(404, 'Message not found');

    const senderId = message.sender?._id || message.sender;
    if (String(senderId) !== String(userId)) {
        throw httpError(403, 'Only the sender can restore a previous version');
    }
    if (message.isDeleted || message.isDeletedUniversally) {
        throw httpError(400, 'Cannot restore a deleted message');
    }

    const history = message.editHistory || [];
    const idx = Number(versionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= history.length) {
        throw httpError(400, 'Invalid versionIndex');
    }

    const target = history[idx];
    const targetVersion = idx + 1;
    const targetEncrypted = !!(target.ciphertext && target.messageIv);
    if (!targetEncrypted && (target.text === null || target.text === undefined)) {
        throw httpError(400, 'Selected version has no restorable content');
    }

    history.push(snapshotCurrentContent(message));
    message.editHistory = history;
    message.markModified('editHistory');

    const prev = message.payload?.toObject ? message.payload.toObject() : (message.payload || {});
    if (targetEncrypted) {
        message.payload = { ...prev, ciphertext: target.ciphertext, messageIv: target.messageIv, isEncrypted: true };
    } else {
        message.payload = { ...prev, ciphertext: undefined, messageIv: undefined, isEncrypted: false };
        message.text = target.text;
    }
    message.markModified('payload');

    message.restoredFromVersion = targetVersion;
    message.editedAt = new Date();
    message.version = (message.version || 1) + 1;
    await message.save();

    const room = roomFor(message);
    if (io && room) {
        io.to(room).emit('message:edited', message.toObject());
    }

    return message;
}

async function deleteMessage(messageId, userId, io, scope = 'everyone', socketId = null) {
    const message = await Message.findById(messageId)
        .populate('sender', 'username email profilePicture');
    if (!message) throw new Error('Message not found');

    const room = message.channel
        ? `channel:${message.channel}`
        : `dm:${message.dm}`;

    
    if (scope === 'me') {
        
        const alreadyHidden = message.hiddenFor.some(
            id => id.toString() === userId.toString()
        );
        if (!alreadyHidden) {
            message.hiddenFor.push(userId);
            await message.save();
        }

        
        if (io && socketId) {
            io.to(socketId).emit('message:hidden', { messageId });
        }

        return message;
    }

    
    const isSender = message.sender._id.toString() === userId.toString();

    
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

async function addReaction(messageId, userId, emoji, io) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');

    const existingReaction = message.reactions.find(
        r => r.userId.toString() === userId.toString()
    );

    if (existingReaction) {
        if (existingReaction.emoji === emoji) {
            
            
        } else {
            
            message.reactions = message.reactions.filter(
                r => r.userId.toString() !== userId.toString()
            );
            message.reactions.push({ userId, emoji });
            await message.save();
        }
    } else {
        
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

async function checklistToggle(messageId, itemIndex, userId, io) {
    const message = await Message.findById(messageId);
    if (!message) throw Object.assign(new Error('Message not found'), { status: 404 });
    if (message.type !== 'checklist') throw Object.assign(new Error('Message is not a checklist'), { status: 400 });

    const item = message.checklist[itemIndex];
    if (!item) throw Object.assign(new Error('Checklist item not found'), { status: 404 });

    const nowChecked = !item.checked;
    message.checklist[itemIndex].checked   = nowChecked;
    message.checklist[itemIndex].checkedBy  = nowChecked ? userId : null;
    message.checklist[itemIndex].checkedAt  = nowChecked ? new Date() : null;
    message.markModified('checklist');
    await message.save();

    const room = message.channel ? `channel:${message.channel}` : `dm:${message.dm}`;
    if (io) {
        io.to(room).emit('message:checklist_updated', {
            messageId,
            itemIndex,
            checklist: message.checklist,
        });
    }

    return message.checklist;
}

async function resolveThread(messageId, userId, io) {
    const message = await Message.findById(messageId).select(
        'channel dm resolvedThreadAt resolvedBy'
    );
    if (!message) throw Object.assign(new Error('Message not found'), { status: 404 });

    const isNowResolved = !message.resolvedThreadAt; 
    message.resolvedThreadAt = isNowResolved ? new Date() : null;
    message.resolvedBy       = isNowResolved ? userId : null;
    await message.save();

    const room = message.channel ? `channel:${message.channel}` : `dm:${message.dm}`;
    if (io) {
        io.to(room).emit('thread:resolved', {
            messageId,
            resolved:          isNowResolved,
            resolvedBy:        isNowResolved ? userId : null,
            resolvedThreadAt:  message.resolvedThreadAt,
        });
    }

    return {
        resolved:         isNowResolved,
        resolvedThreadAt: message.resolvedThreadAt,
        resolvedBy:       message.resolvedBy,
    };
}

const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const PRIORITY_ALIASES = { urgent: 'highest', critical: 'highest', normal: 'medium', none: 'lowest' };

function normalizePriority(p) {
    const v = String(p || '').toLowerCase().trim();
    if (TASK_PRIORITIES.includes(v)) return v;
    return PRIORITY_ALIASES[v] || 'medium';
}

/**
 * Create a task from a message. The title/description are plaintext supplied
 * by the client (the server cannot read E2EE content). Workspace and company
 * always come from the message; any client-supplied workspaceId is ignored.
 */
async function convertToTask(messageId, userId, taskData = {}, io) {
    const title = typeof taskData.title === 'string' ? taskData.title.trim() : '';
    if (!title) throw httpError(400, 'title is required');
    if (title.length > 500) throw httpError(400, 'title is too long');

    const message = await loadAccessibleMessage(Message, messageId, userId, {
        select: 'channel dm workspace company sender linkedTaskId isDeletedUniversally',
        lean: true,
    });
    if (message.isDeletedUniversally) throw httpError(400, 'Cannot convert a deleted message');
    if (message.linkedTaskId) throw httpError(409, 'Message is already linked to a task');

    let workspaceId = message.workspace || null;
    let companyId = message.company || null;
    if (!workspaceId && message.channel) {
        const ch = await _Channel.findById(message.channel).select('workspace company').lean();
        workspaceId = ch?.workspace || null;
        companyId = companyId || ch?.company || null;
    }

    let assignedTo = [userId];
    if (Array.isArray(taskData.assigneeIds) && taskData.assigneeIds.length) {
        const ids = [...new Set(taskData.assigneeIds.map(String))];
        if (ids.some(id => !mongoose.Types.ObjectId.isValid(id))) throw httpError(400, 'Invalid assigneeIds');
        if (!workspaceId) throw httpError(400, 'Assignees require a workspace message');
        const ws = await Workspace.findById(workspaceId).select('members company').lean();
        const active = new Set((ws?.members || [])
            .filter(m => m.user && m.status !== 'removed')
            .map(m => String(m.user)));
        const invalid = ids.filter(id => !active.has(id));
        if (invalid.length) throw httpError(400, `Assignees are not workspace members: ${invalid.join(', ')}`);
        assignedTo = ids;
        companyId = companyId || ws?.company || null;
    }

    let dueDate = null;
    if (taskData.dueDate) {
        dueDate = new Date(taskData.dueDate);
        if (isNaN(dueDate.getTime())) throw httpError(400, 'Invalid dueDate');
    }

    const Task = require('../../../models/Task');
    const task = await Task.create({
        title,
        description:   typeof taskData.description === 'string' ? taskData.description.slice(0, 10000) : '',
        dueDate,
        priority:      normalizePriority(taskData.priority),
        status:        'todo',
        company:       companyId,
        workspace:     workspaceId,
        taskType:      workspaceId ? 'workspace' : 'personal',
        visibility:    'private',
        createdBy:     userId,
        assignedTo,
        linkedMessage: message._id,
        linkedDM:      message.dm || null,
        source:        'manual',
    });

    await Message.findByIdAndUpdate(messageId, { $set: { linkedTaskId: task._id } });

    const room = roomFor(message);
    if (io && room) {
        io.to(room).emit('message:task_created', {
            messageId,
            taskId:    task._id,
            taskTitle: task.title,
        });
    }

    return task;
}

/** All versions of a message, oldest → newest, with ciphertext for client-side decryption. */
async function getMessageVersions(messageId, userId) {
    const message = await loadAccessibleMessage(Message, messageId, userId, {
        select: 'text payload editHistory editedAt version isDeleted isDeletedUniversally channel dm sender restoredFromVersion createdAt',
        lean: true,
    });

    const senderId = String(message.sender?._id || message.sender);
    const deleted = !!(message.isDeleted || message.isDeletedUniversally);
    const history = message.editHistory || [];

    return {
        messageId: String(message._id || messageId),
        senderId,
        canRestore: senderId === String(userId) && !deleted && history.length > 0,
        current: {
            version:     message.version || history.length + 1,
            editedAt:    message.editedAt || null,
            isEncrypted: !!message.payload?.ciphertext,
            ciphertext:  message.payload?.ciphertext || null,
            messageIv:   message.payload?.messageIv || null,
            text:        message.payload?.ciphertext ? null : (message.text || ''),
            restoredFromVersion: message.restoredFromVersion ?? null,
        },
        versions: history.map((h, i) => ({
            index:       i,
            version:     i + 1,
            editedAt:    h.editedAt || null,
            isEncrypted: !!(h.isEncrypted || h.ciphertext),
            ciphertext:  h.ciphertext || null,
            messageIv:   h.messageIv || null,
            text:        h.text ?? null,
            restoredFromVersion: h.restoredFromVersion ?? null,
        })),
    };
}

/** Legacy diff endpoint: the /versions shape plus the old fields. */
async function getMessageDiff(messageId, userId) {
    const v = await getMessageVersions(messageId, userId);
    return {
        ...v,
        version:     v.current.version,
        editedAt:    v.current.editedAt,
        currentText: v.current.text || (v.current.isEncrypted ? '[Encrypted]' : ''),
        editHistory: v.versions.map(h => ({
            version:     h.version,
            text:        h.text || (h.isEncrypted ? '[Encrypted]' : null),
            isEncrypted: h.isEncrypted,
            editedAt:    h.editedAt,
        })),
    };
}

async function toggleBookmark(messageId, userId) {
    const message = await loadAccessibleMessage(Message, messageId, userId, {
        select: 'bookmarkedBy channel dm',
    });
    const isBookmarked = (message.bookmarkedBy || []).some(id => String(id) === String(userId));
    await Message.updateOne(
        { _id: message._id },
        isBookmarked ? { $pull: { bookmarkedBy: userId } } : { $addToSet: { bookmarkedBy: userId } }
    );
    return { bookmarked: !isBookmarked, messageId: String(message._id) };
}

async function getBookmarks(userId, { limit = 50, skip = 0 } = {}) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const sk = Math.max(parseInt(skip, 10) || 0, 0);
    return Message.find({
        bookmarkedBy: userId,
        isDeletedUniversally: { $ne: true },
        hiddenFor: { $ne: userId },
    })
        .sort({ createdAt: -1 })
        .skip(sk)
        .limit(lim)
        .select('-hiddenFor -bookmarkedBy -editHistory')
        .populate('sender', 'username profilePicture')
        .populate('channel', 'name')
        .lean();
}

module.exports = {
    createMessage,
    fetchMessages,
    findOrCreateDMSession,
    getUserDMSessions,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    
    checklistToggle,
    resolveThread,
    convertToTask,
    getMessageDiff,
    getMessageVersions,
    restoreMessageVersion,
    toggleBookmark,
    getBookmarks,
    normalizePriority,
};
