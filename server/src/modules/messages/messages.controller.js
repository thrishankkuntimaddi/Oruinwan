const logger = require('../../../utils/logger');
const messagesService = require('./messages.service');
const Channel = require("../../features/channels/channel.model.js");
const Message = require("./message.model.js");
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const DMSession = require('../../../models/DMSession');
const { handleError } = require('../../../utils/responseHelpers');
const conversationKeysService = require('../conversations/conversationKeys.service');
const mongoose = require('mongoose');
const { canAccessMessage, loadAccessibleMessage } = require('./messageAccess');
const { redactReadBy, readersHidingReceipts } = require('../../features/auth/privacy.service');
const { sanitizeAttachments } = require('../uploads/attachmentSanitizer');

// Validated attachments, or null after answering the request with the error.
async function cleanAttachmentsOrRespond(res, attachments, senderId) {
    try {
        return await sanitizeAttachments(attachments, senderId);
    } catch (err) {
        if (err && err.status && err.status < 500) {
            res.status(err.status).json({ message: err.message, code: err.code });
            return null;
        }
        throw err;
    }
}

function sendError(res, err, label) {
    if (err && err.status && err.status < 500) {
        return res.status(err.status).json({ message: err.message });
    }
    return handleError(res, err, label);
}

exports.sendDirectMessage = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: sendDirectMessage');
    try {
        const senderId = req.user.sub;
        const {
            receiverId,
            dmSessionId,  
            workspaceId,
            attachments,
            replyTo,
            ciphertext,
            messageIv,
            isEncrypted,
            clientTempId,
            mentionText = '',   
            
            type = 'message',
            poll = null,
            contact = null,
            meeting = null,
            checklistCount = 0,
            linkPreview = null,
        } = req.body;

        
        
        
        const STRUCTURED_TYPES_DM = ['image', 'video', 'file', 'voice', 'poll', 'contact', 'meeting'];
        if (!STRUCTURED_TYPES_DM.includes(type) && (!ciphertext || !messageIv || !isEncrypted)) {
            return res.status(400).json({
                message: 'E2EE required: ciphertext and messageIv must be provided'
            });
        }

        
        
        
        let dmSession;

        if (dmSessionId) {
            
            logger.info('📨 [sendDirectMessage] Using DM session ID:', dmSessionId);

            dmSession = await DMSession.findById(dmSessionId);
            if (!dmSession) {
                return res.status(404).json({ message: 'DM Session not found' });
            }

            
            const isParticipant = dmSession.participants.some(
                (p) => String(p) === String(senderId)
            );
            if (!isParticipant) {
                return res.status(403).json({
                    message: 'Not authorized to send messages in this DM'
                });
            }

            logger.info('✅ [sendDirectMessage] DM session verified, participants:',
                dmSession.participants.map(p => String(p)));

        } else if (receiverId) {
            
            logger.info('📨 [sendDirectMessage] Using receiver ID:', receiverId);

            
            if (!workspaceId) {
                return res.status(400).json({ message: 'workspaceId required when using receiverId' });
            }

            
            const receiver = await identity.users.findById(receiverId);
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }

            const ws = await identity.workspaces.findById(workspaceId);
            const memberIds = new Set((ws?.members || []).filter(m => m.status !== 'removed').map(m => String(m.user)));
            if (!ws || !memberIds.has(String(senderId)) || !memberIds.has(String(receiverId))) {
                return res.status(403).json({ message: 'Both users must be members of this workspace' });
            }

            dmSession = await messagesService.findOrCreateDMSession(
                senderId,
                receiverId,
                workspaceId
            );

            logger.info('✅ [sendDirectMessage] DM session resolved:', dmSession._id);
        } else {
            return res.status(400).json({
                message: 'Either dmSessionId or receiverId must be provided'
            });
        }

        // Either side having blocked the other stops the conversation.
        const blocks = dmSession.blockedBy || [];
        if (blocks.some(b => String(b.user) === String(senderId))) {
            return res.status(403).json({ code: 'YOU_BLOCKED', message: 'You blocked this person. Unblock them to send messages.' });
        }
        if (blocks.length > 0) {
            return res.status(403).json({ code: 'BLOCKED', message: "You can't send messages to this person." });
        }

        // A new message brings a deleted (hidden) conversation back for both people.
        if ((dmSession.hiddenFor || []).length > 0) {
            await DMSession.updateOne({ _id: dmSession._id }, { $set: { hiddenFor: [] } });
        }

        const cleanAttachments = await cleanAttachmentsOrRespond(res, attachments, senderId);
        if (!cleanAttachments) return undefined;
        if (['image', 'video', 'file', 'voice'].includes(type) && cleanAttachments.length === 0) {
            return res.status(400).json({ message: 'An attachment message needs a file' });
        }

        const message = await messagesService.createMessage(
            {
                type,
                company: dmSession.company,
                workspace: dmSession.workspace,
                dm: dmSession._id,
                sender: senderId,
                attachments: cleanAttachments,
                parentId: replyTo || null,
                quotedMessageId: req.body.quotedMessageId || null,
                ciphertext,
                messageIv,
                isEncrypted,
                clientTempId,
                mentionText,
                
                poll,
                contact,
                meeting,
                checklistCount,
                linkPreview,
            },
            req.io
        );

        return res.status(201).json({ message });
    } catch (err) {
        return handleError(res, err, 'SEND DM ERROR');
    }
};

exports.getDMs = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: getDMs');
    try {
        const userId = req.user.sub;
        const { workspaceId, dmSessionId, dmId } = req.params;
        const { limit, before, after, around } = req.query;

        logger.info('🔍 [getDMs] DEBUG:', {
            userId,
            workspaceId,
            dmSessionId,
            dmId,
            allParams: req.params,
            fullPath: req.path,
            originalUrl: req.originalUrl
        });

        
        const sessionId = dmSessionId || dmId;

        logger.info('🔍 [getDMs] Looking up DM session:', {
            sessionId,
            workspaceId
        });

        
        let dmSession = await DMSession.findById(sessionId);

        
        
        
        
        if (!dmSession) {
            logger.info('⚠️ [getDMs] DM session not found, attempting to resolve as userId...');
            logger.info('🔄 [getDMs] Treating sessionId as otherUserId and creating DM session');

            try {
                
                dmSession = await messagesService.findOrCreateDMSession(
                    userId,           
                    sessionId,        
                    workspaceId
                );

                logger.info('✅ [getDMs] DM session resolved/created:', {
                    newSessionId: dmSession._id,
                    originalIdWasUserId: true
                });
            } catch (resolveError) {
                logger.error('❌ [getDMs] Failed to resolve DM session:', resolveError.message);
                return res.status(404).json({
                    message: 'DM Session not found and could not be created',
                    details: resolveError.message
                });
            }
        }

        
        const isParticipant = dmSession.participants.some(
            (p) => String(p) === String(userId)
        );
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not a participant in this DM' });
        }

        
        // "Clear chat" hides everything before this user's clear time, for them only.
        const cleared = (dmSession.clearedAt || []).find(c => String(c.user) === String(userId));

        const result = await messagesService.fetchMessages(
            { dm: dmSession._id },  
            {
                limit: parseInt(limit) || 50,
                before,
                after,
                around,
                populateReplies: true,
                userId,
                userJoinedAt: cleared?.clearedAt || null,
            }
        );
        // Readers who turned read receipts off are hidden from everyone but themselves.
        result.messages = await redactReadBy(result.messages, userId);

        
        
        const wasAutoResolved = String(sessionId) !== String(dmSession._id);

        return res.json({
            ...result,
            
            dmSessionId: dmSession._id,
            redirectRequired: wasAutoResolved,
            ...(wasAutoResolved && {
                notice: 'DM session was resolved from user ID to session ID'
            })
        });
    } catch (err) {
        return handleError(res, err, 'GET DMs ERROR');
    }
};

exports.getWorkspaceDMList = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: getWorkspaceDMList');
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const sessions = await messagesService.getUserDMSessions(userId, workspaceId);

        return res.json({ sessions });
    } catch (err) {
        return handleError(res, err, 'GET WORKSPACE DM LIST ERROR');
    }
};

/** GET /workspace/:workspaceId/activity — see activity.service.js. */
exports.getWorkspaceActivity = async (req, res) => {
    try {
        const { getWorkspaceActivity } = require('./activity.service');
        const data = await getWorkspaceActivity(req.user.sub, req.params.workspaceId);
        res.set('Cache-Control', 'no-store');
        return res.json(data);
    } catch (err) {
        return sendError(res, err, 'GET WORKSPACE ACTIVITY ERROR');
    }
};

exports.resolveDMSession = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: resolveDMSession');
    try {
        const { workspaceId, userId: otherUserId } = req.params;
        const currentUserId = req.user.sub;

        
        
        const workspace = await identity.workspaces.findById(workspaceId);

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        
        const memberIds = workspace.members.filter(m => m.status !== 'removed').map(m => String(m.user));
        if (!memberIds.includes(String(currentUserId))) {
            return res.status(403).json({ message: 'You are not a member of this workspace' });
        }
        if (!memberIds.includes(String(otherUserId))) {
            return res.status(403).json({ message: 'Target user is not a member of this workspace' });
        }

        
        const sortedParticipants = [
            new mongoose.Types.ObjectId(currentUserId),
            new mongoose.Types.ObjectId(otherUserId)
        ].sort((a, b) => a.toString().localeCompare(b.toString()));

        
        let dmSession = await DMSession.findOne({
            workspace: workspaceId,
            participants: {
                $all: sortedParticipants,
                $size: 2
            }
        });

        let isNewSession = false;

        
        if (!dmSession) {
            try {
                dmSession = await DMSession.create({
                    workspace: workspaceId,
                    company: workspace.company || null,
                    participants: sortedParticipants,
                    createdAt: new Date()
                });
                isNewSession = true;
            } catch (createErr) {
                
                if (createErr.code === 11000) {
                    dmSession = await DMSession.findOne({
                        workspace: workspaceId,
                        participants: { $all: sortedParticipants, $size: 2 }
                    });
                    if (!dmSession) throw createErr; 
                    isNewSession = false;
                } else {
                    throw createErr;
                }
            }
        }

        
        
        // New or existing: make sure the key exists and both participants hold it.
        try {
            await conversationKeysService.ensureDMConversationKey(dmSession._id);
        } catch (keyErr) {
            logger.error(`⚠️ [MESSAGES:MODULAR][RESOLVE_DM] Key ensure failed (non-fatal):`, keyErr.message);
        }
        logger.info(`✅ [MESSAGES:MODULAR][RESOLVE_DM] ${isNewSession ? 'Created' : 'Found'} DM session ${dmSession._id}`);

        return res.json({
            success: true,
            dmSessionId: dmSession._id,
            otherUserId: otherUserId,
            workspaceId: dmSession.workspace,
            participants: dmSession.participants
        });
    } catch (err) {
        logger.error('[MESSAGES:MODULAR][RESOLVE_DM] ERROR:', err);
        return handleError(res, err, 'RESOLVE DM SESSION ERROR');
    }
};

exports.sendChannelMessage = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: sendChannelMessage');
    try {
        const senderId = req.user.sub;
        const {
            channelId,
            attachments,
            replyTo,          
            quotedMessageId,  
            ciphertext,
            messageIv,
            isEncrypted,
            clientTempId,
            mentionText = '',   
            
            type = 'message',
            poll = null,
            contact = null,
            meeting = null,
            checklistCount = 0,
            linkPreview = null,
        } = req.body;

        
        
        
        const STRUCTURED_TYPES_CH = ['image', 'video', 'file', 'voice', 'poll', 'contact', 'meeting'];
        if (!STRUCTURED_TYPES_CH.includes(type) && (!ciphertext || !messageIv || !isEncrypted)) {
            return res.status(400).json({
                message: 'E2EE required: ciphertext and messageIv must be provided'
            });
        }

        
        if (!channelId) {
            return res.status(400).json({ message: 'channelId required' });
        }

        
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        
        if (!channel.isMember(senderId)) {
            return res.status(403).json({ message: 'Not a channel member' });
        }

        // Announcement channels: only channel admins (or workspace owners/admins) start messages.
        if (channel.postingPolicy === 'admins') {
            const { canManageChannel } = require('../../features/channels/channelMute.controller');
            if (!(await canManageChannel(channel, senderId))) {
                return res.status(403).json({ code: 'POSTING_RESTRICTED', message: 'Only channel admins can post in this channel.' });
            }
        }

        const cleanAttachments = await cleanAttachmentsOrRespond(res, attachments, senderId);
        if (!cleanAttachments) return undefined;
        if (['image', 'video', 'file', 'voice'].includes(type) && cleanAttachments.length === 0) {
            return res.status(400).json({ message: 'An attachment message needs a file' });
        }

        const message = await messagesService.createMessage(
            {
                type,
                company: channel.company,
                workspace: channel.workspace,
                channel: channelId,
                sender: senderId,
                attachments: cleanAttachments,
                parentId: replyTo || null,
                quotedMessageId: quotedMessageId || null,
                ciphertext,
                messageIv,
                isEncrypted,
                clientTempId,
                mentionText,
                
                poll,
                contact,
                meeting,
                checklistCount,
                linkPreview,
            },
            req.io
        );

        return res.status(201).json({ message });
    } catch (err) {
        return handleError(res, err, 'SEND CHANNEL ERROR');
    }
};

exports.getChannelMessages = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: getChannelMessages');
    try {
        const userId = req.user.sub;
        const { channelId } = req.params;
        const { limit, before, after, around } = req.query;

        
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        
        const isUserMember = channel.isMember(userId);
        if (!isUserMember) {
            return res.status(403).json({ message: 'Not a channel member' });
        }

        
        const userJoinedAt = channel.getUserJoinDate(userId);

        
        const result = await messagesService.fetchMessages(
            { channel: channelId },
            {
                limit: parseInt(limit) || 50,
                before,
                after,
                around,
                populateReplies: true,
                userJoinedAt,
                userId   
            }
        );
        result.messages = await redactReadBy(result.messages, userId);

        
        const channelMembers = channel.members.map((m) => ({
            userId: m.user ? m.user.toString() : m.toString(),
            joinedAt: m.joinedAt || channel.createdAt
        }));

        
        const userIds = channelMembers.map(m => m.userId);
        const users = await identity.users.findManyByIds(userIds);
        const userMap = new Map([...users.values()].map(u => [String(u._id), u.username]));

        const populatedMembers = channelMembers.map(member => ({
            ...member,
            username: userMap.get(member.userId) || 'Unknown'
        }));

        return res.json({
            ...result,
            userJoinedAt,
            channelMembers: populatedMembers
        });
    } catch (err) {
        return handleError(res, err, 'GET CHANNEL ERROR');
    }
};

exports.forwardMessage = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: forwardMessage');
    try {
        const userId = req.user.sub;
        const { messageId, targets } = req.body;

        
        if (!messageId || !targets || !Array.isArray(targets) || targets.length === 0) {
            return res.status(400).json({
                message: 'messageId and targets array are required'
            });
        }

        
        const Message = require('./message.model');
        const originalMessage = await Message.findById(messageId);

        if (!originalMessage) {
            return res.status(404).json({ message: 'Original message not found' });
        }

        
        
        if (originalMessage.channel) {
            const channel = await Channel.findById(originalMessage.channel);
            if (!channel || !channel.isMember(userId)) {
                return res.status(403).json({ message: 'Not authorized to access this message' });
            }
        } else if (originalMessage.dm) {
            const dmSession = await DMSession.findById(originalMessage.dm);
            if (!dmSession || !dmSession.participants.some(p => String(p) === String(userId))) {
                return res.status(403).json({ message: 'Not authorized to access this message' });
            }
        }

        // A photo/voice/file message is forwarded as the same kind of message (it has no
        // encrypted text); anything else is forwarded as its encrypted text.
        const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
        const forwardType = ATTACHMENT_TYPES.includes(originalMessage.type) ? originalMessage.type : 'message';

        let forwardedCount = 0;
        const errors = [];

        
        for (const target of targets) {
            try {
                const { type, id } = target;

                if (type === 'channel') {
                    
                    const channel = await Channel.findById(id);
                    if (!channel) {
                        errors.push({ target, error: 'Channel not found' });
                        continue;
                    }
                    if (!channel.isMember(userId)) {
                        errors.push({ target, error: 'Not a member of target channel' });
                        continue;
                    }

                    
                    const srcCiphertext = originalMessage.payload?.ciphertext || originalMessage.ciphertext;
                    const srcMessageIv = originalMessage.payload?.messageIv || originalMessage.messageIv;

                    await messagesService.createMessage({
                        type: forwardType,
                        company: channel.company,
                        workspace: channel.workspace,
                        channel: id,
                        sender: userId,
                        ciphertext: srcCiphertext,
                        messageIv: srcMessageIv,
                        isEncrypted: true,
                        attachments: originalMessage.payload?.attachments || originalMessage.attachments || [],
                        forwardedFrom: messageId
                    }, req.io);

                    forwardedCount++;

                } else if (type === 'dm') {
                    
                    const dmSession = await DMSession.findById(id);
                    if (!dmSession) {
                        errors.push({ target, error: 'DM session not found' });
                        continue;
                    }
                    if (!dmSession.participants.some(p => String(p) === String(userId))) {
                        errors.push({ target, error: 'Not a participant in target DM' });
                        continue;
                    }

                    
                    const srcCiphertext = originalMessage.payload?.ciphertext || originalMessage.ciphertext;
                    const srcMessageIv = originalMessage.payload?.messageIv || originalMessage.messageIv;

                    await messagesService.createMessage({
                        type: forwardType,
                        company: dmSession.company,
                        workspace: dmSession.workspace,
                        dm: id,
                        sender: userId,
                        ciphertext: srcCiphertext,
                        messageIv: srcMessageIv,
                        isEncrypted: true,
                        attachments: originalMessage.payload?.attachments || originalMessage.attachments || [],
                        forwardedFrom: messageId
                    }, req.io);

                    forwardedCount++;
                } else {
                    errors.push({ target, error: 'Invalid target type (must be channel or dm)' });
                }
            } catch (targetError) {
                logger.error(`Error forwarding to ${target.type}:${target.id}:`, targetError);
                errors.push({ target, error: targetError.message });
            }
        }

        return res.json({
            success: true,
            forwardedCount,
            totalTargets: targets.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        return handleError(res, err, 'FORWARD MESSAGE ERROR');
    }
};

exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { text, ciphertext, messageIv } = req.body || {};

        const io = req.app?.get('io');
        const message = await messagesService.editMessage(
            messageId,
            userId,
            { text, ciphertext, messageIv },
            io
        );

        return res.json({ message });
    } catch (err) {
        return sendError(res, err, 'EDIT MESSAGE ERROR');
    }
};

exports.restoreMessageVersion = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { versionIndex } = req.body || {};
        if (versionIndex === undefined || versionIndex === null || versionIndex === '') {
            return res.status(400).json({ message: 'versionIndex is required' });
        }
        const io = req.app?.get('io');
        const message = await messagesService.restoreMessageVersion(messageId, req.user.sub, versionIndex, io);
        return res.json({ message });
    } catch (err) {
        return sendError(res, err, 'RESTORE MESSAGE VERSION ERROR');
    }
};

exports.getMessageVersions = async (req, res) => {
    try {
        const result = await messagesService.getMessageVersions(req.params.messageId, req.user.sub);
        return res.json(result);
    } catch (err) {
        return sendError(res, err, 'GET MESSAGE VERSIONS ERROR');
    }
};

exports.toggleBookmark = async (req, res) => {
    try {
        const result = await messagesService.toggleBookmark(req.params.messageId, req.user.sub);
        return res.json(result);
    } catch (err) {
        return sendError(res, err, 'TOGGLE BOOKMARK ERROR');
    }
};

exports.getBookmarks = async (req, res) => {
    try {
        const { limit, skip } = req.query;
        const messages = await messagesService.getBookmarks(req.user.sub, { limit, skip });
        return res.json({ messages });
    } catch (err) {
        return sendError(res, err, 'GET BOOKMARKS ERROR');
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { scope = 'everyone' } = req.body;
        const io = req.app?.get('io');
        
        const socketId = req.headers['x-socket-id'] || null;

        await messagesService.deleteMessage(messageId, userId, io, scope, socketId);

        return res.json({ success: true, messageId, scope });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

exports.addReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { emoji } = req.body;

        logger.info(`[REACT] Adding reaction: messageId=${messageId} userId=${userId} emoji=${JSON.stringify(emoji)}`);

        if (!emoji) {
            return res.status(400).json({ message: 'emoji is required' });
        }

        
        
        if (/^[0-9a-f]{24}$/i.test(emoji)) {
            logger.error(`[REACT] ❌ Rejected invalid emoji (looks like ObjectId): ${emoji}`);
            return res.status(400).json({ message: 'Invalid emoji: received an ID instead of emoji character' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.addReaction(messageId, userId, emoji, io);

        return res.json({ message });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

exports.removeReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ message: 'emoji is required' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.removeReaction(messageId, userId, emoji, io);

        return res.json({ message });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

exports.pinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const body = req.body || {};
        const pin = body.pin === undefined ? true : !(body.pin === false || body.pin === 'false');

        let message;
        try {
            message = await loadAccessibleMessage(Message, messageId, userId);
        } catch (e) {
            if (e.status === 403) return res.status(403).json({ message: 'You must be a member of this conversation to pin messages' });
            throw e;
        }
        if (message.isDeleted || message.isDeletedUniversally) {
            return res.status(400).json({ message: 'Cannot pin a deleted message' });
        }
        if (message.type === 'system') {
            return res.status(400).json({ message: 'System messages cannot be pinned' });
        }

        // Idempotent: nothing to change, no events or system messages.
        if (!!message.isPinned === pin) {
            return res.json({ message, changed: false });
        }

        message.isPinned = pin;
        message.pinnedBy = pin ? userId : null;
        message.pinnedAt = pin ? new Date() : null;
        await message.save();

        if (message.channel) {
            await Channel.updateOne(
                { _id: message.channel },
                pin ? { $addToSet: { pinnedMessages: message._id } } : { $pull: { pinnedMessages: message._id } }
            ).catch(e => logger.warn('[PIN] channel pinnedMessages sync failed:', e.message));
        }

        const pinner = await identity.users.findById(userId).catch(() => null);
        const pinnedByName = pinner?.username || null;

        const io = req.app?.get('io');
        const pinRoom = message.channel ? `channel:${message.channel}` : `dm:${message.dm}`;
        if (io) {
            io.to(pinRoom).emit(pin ? 'message-pinned' : 'message-unpinned', {
                messageId: String(message._id),
                // Content fields included so clients that merge this into the
                // message's `payload` keep the ciphertext needed to decrypt it.
                ciphertext: message.payload?.ciphertext,
                messageIv: message.payload?.messageIv,
                isEncrypted: message.payload?.isEncrypted,
                isPinned: pin,
                pinnedBy: pin ? String(userId) : null,
                pinnedByName: pin ? pinnedByName : null,
                pinnedAt: message.pinnedAt,
                channelId: message.channel ? String(message.channel) : null,
                dmId: message.dm ? String(message.dm) : null,
            });
        }

        // Timeline system event. Message content is E2EE, so no snippet is available server-side
        // except for legacy plaintext messages.
        try {
            const snippet = message.payload?.ciphertext ? '' : (message.text || '');
            const messageSnippet = snippet.length > 60 ? snippet.slice(0, 57) + '…' : snippet;
            const systemMsg = await Message.create({
                type: 'system',
                systemEvent: message.channel
                    ? (pin ? 'message_pinned' : 'message_unpinned')
                    : (pin ? 'dm_message_pinned' : 'dm_message_unpinned'),
                sender: userId,
                channel: message.channel || null,
                dm: message.channel ? null : message.dm,
                workspace: message.workspace,
                company: message.company || null,
                systemData: {
                    userId,
                    userName: pinnedByName || 'Someone',
                    messageSnippet,
                    pinnedMessageId: String(message._id),
                },
            });
            if (io) io.to(pinRoom).emit('new-message', systemMsg);
        } catch (sysErr) {
            logger.error('[SYSTEM MSG] pin system message failed:', sysErr);
        }

        return res.json({ message, changed: true });
    } catch (err) {
        return sendError(res, err, 'PIN MESSAGE ERROR');
    }
};

exports.createPollMessage = async (req, res) => {
    try {
        const senderId = req.user.sub;
        const { channelId, dmId, poll } = req.body;

        
        if (!channelId && !dmId) {
            return res.status(400).json({ message: 'channelId or dmId is required' });
        }
        if (!poll || !poll.question || !Array.isArray(poll.options) || poll.options.length < 2) {
            return res.status(400).json({ message: 'poll.question and at least 2 options are required' });
        }
        if (poll.options.length > 10) {
            return res.status(400).json({ message: 'Maximum 10 poll options allowed' });
        }

        
        const pollDoc = {
            question: poll.question.trim(),
            options: poll.options.map(opt => ({
                text: (typeof opt === 'string' ? opt : opt.text).trim(),
                votes: [],
            })),
            allowMultiple: poll.allowMultiple || false,
            anonymous: poll.anonymous || false,
            createdBy: senderId,
            endDate: poll.endDate || null,
            isActive: true,
            totalVotes: 0,
        };

        let messagePayload;

        if (channelId) {
            
            const channel = await Channel.findById(channelId);
            if (!channel) return res.status(404).json({ message: 'Channel not found' });
            if (!channel.isMember(senderId)) {
                return res.status(403).json({ message: 'Not a channel member' });
            }
            if (channel.postingPolicy === 'admins') {
                const { canManageChannel } = require('../../features/channels/channelMute.controller');
                if (!(await canManageChannel(channel, senderId))) {
                    return res.status(403).json({ code: 'POSTING_RESTRICTED', message: 'Only channel admins can post in this channel.' });
                }
            }

            messagePayload = {
                type: 'poll',
                company: channel.company,
                workspace: channel.workspace,
                channel: channelId,
                sender: senderId,
                poll: pollDoc,
            };
        } else {
            
            const DMSession = require('../../../models/DMSession');
            const dmSession = await DMSession.findById(dmId).select('participants workspace company').lean();
            if (!dmSession) return res.status(404).json({ message: 'DM session not found' });

            const isParticipant = dmSession.participants.some(p => String(p) === String(senderId));
            if (!isParticipant) {
                return res.status(403).json({ message: 'Not a participant in this DM' });
            }

            messagePayload = {
                type: 'poll',
                company: dmSession.company || null,
                workspace: dmSession.workspace,
                dm: dmId,
                sender: senderId,
                poll: pollDoc,
            };
        }

        
        const message = await messagesService.createMessage(messagePayload, req.io);

        return res.status(201).json({ message });
    } catch (err) {
        return handleError(res, err, 'CREATE POLL MESSAGE ERROR');
    }
};


// ── Poll helpers ────────────────────────────────────────────────────────────

/** Poll with voter ids replaced by { _id, username } so clients can show who voted. */
async function enrichPollVoters(message) {
    try {
        const ids = new Set();
        message.poll.options.forEach(opt => opt.votes.forEach(v => ids.add(v.toString())));
        const users = ids.size ? [...(await identity.users.findManyByIds([...ids])).values()] : [];
        const names = Object.fromEntries(users.map(u => [u._id.toString(), u.username]));
        const plain = message.poll.toObject ? message.poll.toObject() : message.poll;
        return {
            ...plain,
            options: plain.options.map(opt => ({
                ...opt,
                votes: (opt.votes || []).map(v => ({ _id: v.toString(), username: names[v.toString()] || 'Unknown' })),
            })),
        };
    } catch (err) {
        logger.warn('[poll] voter name enrichment failed:', err.message);
        return message.poll.toObject ? message.poll.toObject() : message.poll;
    }
}

/** Push the new poll state to everyone in the conversation (channel or DM). */
function broadcastPollUpdate(req, message, poll) {
    const io = req.io || req.app?.get('io');
    if (!io) return;
    const room = message.channel ? `channel:${message.channel}` : message.dm ? `dm:${message.dm}` : null;
    if (room) io.to(room).emit('poll:vote_updated', { messageId: String(message._id), poll });
}

exports.closePoll = async (req, res) => {
    try {
        const userId = req.user.sub;
        const Message = require('./message.model');
        const message = await Message.findById(req.params.messageId);
        if (!message || message.type !== 'poll' || !message.poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }
        const creator = String(message.poll.createdBy || message.sender);
        if (creator !== String(userId)) {
            return res.status(403).json({ message: 'Only the poll creator can end this poll' });
        }
        if (!message.poll.isActive) {
            return res.status(400).json({ message: 'Poll is already closed' });
        }
        message.poll.isActive = false;
        message.markModified('poll');
        await message.save();

        const poll = await enrichPollVoters(message);
        broadcastPollUpdate(req, message, poll);
        return res.json({ message: { ...message.toObject(), poll } });
    } catch (err) {
        return handleError(res, err, 'CLOSE POLL ERROR');
    }
};

exports.voteOnPoll = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;
        const { optionIndices } = req.body; 

        
        
        if (!Array.isArray(optionIndices)) {
            return res.status(400).json({ message: 'optionIndices must be an array' });
        }

        const Message = require('./message.model');
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        if (message.type !== 'poll') {
            return res.status(400).json({ message: 'Message is not a poll' });
        }

        const poll = message.poll;
        if (!poll || !poll.isActive) {
            return res.status(400).json({ message: 'Poll is closed or not found' });
        }

        
        if (!(await canAccessMessage(message, userId))) {
            return res.status(403).json({ message: 'You are not part of this conversation' });
        }

        
        if (optionIndices.length > 0 && optionIndices.some(i => i < 0 || i >= poll.options.length)) {
            return res.status(400).json({ message: 'Invalid option index' });
        }

        
        if (!poll.allowMultiple && optionIndices.length > 1) {
            return res.status(400).json({ message: 'This poll only allows one selection' });
        }

        
        const userIdStr = userId.toString();
        poll.options.forEach(opt => {
            opt.votes = opt.votes.filter(v => v.toString() !== userIdStr);
        });

        
        optionIndices.forEach(idx => {
            const opt = poll.options[idx];
            if (opt && !opt.votes.some(v => v.toString() === userIdStr)) {
                opt.votes.push(userId);
            }
        });

        
        const allVoters = new Set();
        poll.options.forEach(opt => opt.votes.forEach(v => allVoters.add(v.toString())));
        poll.totalVotes = allVoters.size;

        
        message.markModified('poll');
        await message.save();

        
        const pollWithVoterNames = await enrichPollVoters(message);
        broadcastPollUpdate(req, message, pollWithVoterNames);

        return res.json({ message: { ...message.toObject(), poll: pollWithVoterNames } });
    } catch (err) {
        return handleError(res, err, 'VOTE ON POLL ERROR');
    }
};

exports.getMessageInfo = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;

        const message = await loadAccessibleMessage(Message, messageId, userId, { lean: true });
        const CARD = { type: 'user', fields: ['username', 'profilePicture'] };
        await hydrate(message, { sender: CARD, readBy: CARD, pinnedBy: CARD });

        let channelMembers = [];
        const toMember = (u) => ({
            _id: String(u?._id || u),
            username: u?.username || 'Unknown',
            profilePicture: u?.profilePicture || null,
        });

        if (message.channel) {
            const channel = await Channel.findById(message.channel).lean();
            if (!channel) return res.status(404).json({ message: 'Channel not found' });
            await hydrate(channel, { 'members.user': CARD });

            if (channel.isDefault && (!channel.members || channel.members.length === 0)) {
                const workspace = await identity.workspaces.findById(channel.workspace);
                if (workspace) await hydrate(workspace, { 'members.user': CARD });
                channelMembers = (workspace?.members || [])
                    .filter(m => m.user && m.status !== 'removed')
                    .map(m => toMember(m.user));
            } else {
                channelMembers = (channel.members || []).map(m => toMember(m.user || m));
            }
        } else if (message.dm) {
            const dmSession = await DMSession.findById(message.dm).lean();
            if (dmSession) await hydrate(dmSession, { participants: CARD });
            channelMembers = (dmSession?.participants || []).map(toMember);
        }

        let readByUsers = (message.readBy || [])
            .filter(Boolean)
            .map(toMember);
        // Readers who turned read receipts off stay hidden from others.
        try {
            const hidden = await readersHidingReceipts(readByUsers.map(u => u._id).filter(id => id !== String(userId)));
            if (hidden.size) readByUsers = readByUsers.filter(u => u._id === String(userId) || !hidden.has(u._id));
        } catch (err) {
            logger.warn({ err: err.message }, '[PRIVACY] read-receipt lookup failed');
        }
        const readByIds = [...new Set(readByUsers.map(u => u._id))];

        const editCount = (message.editHistory || []).length;
        const pinnedBy = message.pinnedBy
            ? { _id: String(message.pinnedBy._id || message.pinnedBy), username: message.pinnedBy.username || null }
            : null;

        const info = {
            _id: message._id,
            text: message.text,
            isEncrypted: !!(message.payload?.ciphertext || message.isEncrypted),
            payload: message.payload,
            createdAt: message.createdAt,
            sender: message.sender,
            reactions: message.reactions || [],
            readBy: readByIds,
            readByUsers,
            editedAt: message.editedAt || null,
            version: message.version || 1,
            editCount,
            restoredFromVersion: message.restoredFromVersion ?? null,
            isPinned: !!message.isPinned,
            pinnedBy: pinnedBy ? pinnedBy.username : null,
            pinnedById: pinnedBy ? pinnedBy._id : null,
            pinnedAt: message.pinnedAt || null,
        };

        return res.json({
            message: info,
            members: channelMembers,
            readBy: readByIds,
            readByUsers,
            editedAt: info.editedAt,
            version: info.version,
            editCount,
            restoredFromVersion: info.restoredFromVersion,
            isPinned: info.isPinned,
            pinnedBy: info.pinnedBy,
            pinnedAt: info.pinnedAt,
        });
    } catch (err) {
        return sendError(res, err, 'GET MESSAGE INFO ERROR');
    }
};

const reminderService = require('./messageReminder.service');

exports.scheduleReminder = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId } = req.params;
        const { remindAt, note = '' } = req.body;

        if (!remindAt) return res.status(400).json({ message: 'remindAt is required' });

        const reminder = await reminderService.scheduleReminder(userId, messageId, remindAt, typeof note === 'string' ? note : '');
        return res.status(201).json({ success: true, reminder });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

exports.getUserReminders = async (req, res) => {
    try {
        const userId = req.user.sub;
        const reminders = await reminderService.getUserReminders(userId);
        return res.json({ reminders });
    } catch (err) {
        return handleError(res, err, 'GET REMINDERS ERROR');
    }
};

exports.cancelReminder = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { reminderId } = req.params;
        await reminderService.cancelReminder(reminderId, userId);
        return res.json({ success: true });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

exports.checklistToggle = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId, itemIdx } = req.params;
        const io = req.app?.get('io');

        const checklist = await messagesService.checklistToggle(
            messageId,
            parseInt(itemIdx, 10),
            userId,
            io
        );
        return res.json({ checklist });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

exports.getMessageDiff = async (req, res) => {
    try {
        const diff = await messagesService.getMessageDiff(req.params.messageId, req.user.sub);
        return res.json(diff);
    } catch (err) {
        return sendError(res, err, 'GET MESSAGE DIFF ERROR');
    }
};

exports.convertToTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;
        // workspaceId / projectId from the client are deliberately not forwarded.
        const { title, description, priority, dueDate, assigneeIds } = req.body || {};
        if (!title || !String(title).trim()) return res.status(400).json({ message: 'title is required' });

        const io = req.app?.get('io');
        const task = await messagesService.convertToTask(
            messageId, userId, { title, description, priority, dueDate, assigneeIds }, io
        );
        return res.status(201).json({
            task: {
                _id: task._id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate || null,
                workspace: task.workspace || null,
            },
        });
    } catch (err) {
        return sendError(res, err, 'CONVERT TO TASK ERROR');
    }
};

const aiMessagingService = require('../../modules/ai/ai-messaging.service');

exports.getSmartReplies = async (req, res) => {
    try {
        const { messageText, messageId, contextMessages = [] } = req.body;
        if (!messageText) return res.status(400).json({ message: 'messageText is required' });

        const suggestions = await aiMessagingService.getSmartReplies(
            messageText,
            messageId || null,
            contextMessages,
            aiGatewayContext(req)
        );
        return res.json({ suggestions });
    } catch (err) {
        return res.status(500).json({ message: 'AI suggestions unavailable', error: err.message });
    }
};

const MAX_TRANSLATE_CHARS = 5000;

/** Gateway context: the caller, and the workspace's own AI provider/model when one was resolved. */
function aiGatewayContext(req) {
    return { userId: req.user.sub, workspaceId: req.aiWorkspace?.id || null, ...(req.aiContext || {}) };
}

exports.translateMessage = async (req, res) => {
    try {
        const { text, targetLang } = req.body || {};
        if (typeof text !== 'string' || !text.trim() || typeof targetLang !== 'string' || !targetLang.trim()) {
            return res.status(400).json({ message: 'text and targetLang are required' });
        }
        if (text.length > MAX_TRANSLATE_CHARS) {
            return res.status(400).json({ message: `text must be at most ${MAX_TRANSLATE_CHARS} characters` });
        }
        if (targetLang.length > 40) return res.status(400).json({ message: 'Invalid targetLang' });

        const result = await aiMessagingService.translateMessage(text, targetLang.trim(), aiGatewayContext(req));
        return res.json(result);
    } catch (err) {
        logger.warn('[AI translate] failed:', err.message);
        return res.status(503).json({ message: 'Translation unavailable', error: err.message });
    }
};

exports.getThreadSummary = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { parentMessageId, replies = [], parentText = '' } = req.body || {};
        if (!parentMessageId) return res.status(400).json({ message: 'parentMessageId is required' });
        if (!Array.isArray(replies)) return res.status(400).json({ message: 'replies must be an array' });

        await loadAccessibleMessage(Message, parentMessageId, userId, { select: 'channel dm', lean: true });

        const summary = await aiMessagingService.summarizeThread(
            parentMessageId,
            replies.slice(-200),
            typeof parentText === 'string' ? parentText : '',
            aiGatewayContext(req)
        );
        return res.json({ summary });
    } catch (err) {
        if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message });
        logger.warn('[AI thread summary] failed:', err.message);
        return res.status(503).json({ message: 'Thread summary unavailable', error: err.message });
    }
};

exports.getJumpAnchor = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: getJumpAnchor');
    try {
        const userId = req.user.sub;
        const { channelId } = req.params;
        const { dayStart, dayEnd } = req.query;

        if (!dayStart || !dayEnd) {
            return res.status(400).json({ message: 'dayStart and dayEnd query parameters are required' });
        }

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const isUserMember = channel.isMember(userId);
        if (!isUserMember) {
            return res.status(403).json({ message: 'Not a channel member' });
        }

        const userJoinedAt = channel.getUserJoinDate(userId);
        const dayStartDate = new Date(dayStart);
        const dayEndDate = new Date(dayEnd);

        const queryBase = {
            channel: channelId,
            parentId: null,
            hiddenFor: { $nin: [userId] }
        };

        if (userJoinedAt) {
            queryBase.createdAt = { $gte: userJoinedAt };
        }

        // 1. Try to find oldest message in [dayStart, dayEnd]
        const dateQuery = {
            ...queryBase,
            createdAt: {
                $gte: dayStartDate,
                $lte: dayEndDate
            }
        };
        if (userJoinedAt && userJoinedAt > dayStartDate) {
            dateQuery.createdAt.$gte = userJoinedAt;
        }

        let anchorMsg = await Message.findOne(dateQuery)
            .sort({ createdAt: 1 })
            .select('_id createdAt')
            .lean();

        if (anchorMsg) {
            return res.json({
                anchorMessageId: anchorMsg._id,
                date: anchorMsg.createdAt,
                isFallback: false
            });
        }

        // 2. Search for nearest message before dayStart
        const beforeQuery = {
            ...queryBase,
            createdAt: {
                $lt: dayStartDate
            }
        };
        if (userJoinedAt) {
            beforeQuery.createdAt.$gte = userJoinedAt;
        }

        anchorMsg = await Message.findOne(beforeQuery)
            .sort({ createdAt: -1 })
            .select('_id createdAt')
            .lean();

        if (anchorMsg) {
            return res.json({
                anchorMessageId: anchorMsg._id,
                date: anchorMsg.createdAt,
                isFallback: true
            });
        }

        // 3. Fallback to very first message (oldest)
        const fallbackQuery = { ...queryBase };
        anchorMsg = await Message.findOne(fallbackQuery)
            .sort({ createdAt: 1 })
            .select('_id createdAt')
            .lean();

        if (anchorMsg) {
            return res.json({
                anchorMessageId: anchorMsg._id,
                date: anchorMsg.createdAt,
                isFallback: true
            });
        }

        // 4. Empty channel
        return res.json({
            anchorMessageId: null,
            date: null,
            isFallback: false
        });

    } catch (err) {
        return handleError(res, err, 'GET JUMP ANCHOR ERROR');
    }
};

/** Pinned messages of one channel or DM, newest pin first (ciphertext; the client decrypts). */
exports.getPinnedMessages = async (req, res) => {
    try {
        const { channelId, dmId } = req.query;
        if (!channelId && !dmId) return res.status(400).json({ message: 'channelId or dmId required' });
        const { checkConversationAccess } = require('../threads/threadAccess');
        const access = await checkConversationAccess({ channel: channelId, dm: channelId ? null : dmId }, req.user.sub);
        if (!access.ok) return res.status(access.status).json({ message: access.error });

        const Message = require('./message.model');
        const messages = await Message.find({
            ...(channelId ? { channel: channelId } : { dm: dmId }),
            isPinned: true,
            isDeletedUniversally: { $ne: true },
            hiddenFor: { $nin: [req.user.sub] },
        })
            .sort({ pinnedAt: -1 })
            .limit(100)
            .lean();
        await hydrate(messages, { sender: { type: 'user', fields: ['username', 'profilePicture'] }, pinnedBy: { type: 'user', fields: ['username'] } });
        return res.json({ messages });
    } catch (err) {
        return handleError(res, err, 'GET PINNED MESSAGES ERROR');
    }
};
