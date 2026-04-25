const messagesService = require('./messages.service');
const Channel = require("../../features/channels/channel.model.js");
const User = require('../../../models/User');
const DMSession = require('../../../models/DMSession');
const { handleError } = require('../../../utils/responseHelpers');
const conversationKeysService = require('../conversations/conversationKeys.service');
const mongoose = require('mongoose');

exports.sendDirectMessage = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: sendDirectMessage');
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
            
            console.log('📨 [sendDirectMessage] Using DM session ID:', dmSessionId);

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

            console.log('✅ [sendDirectMessage] DM session verified, participants:',
                dmSession.participants.map(p => String(p)));

        } else if (receiverId) {
            
            console.log('📨 [sendDirectMessage] Using receiver ID:', receiverId);

            
            if (!workspaceId) {
                return res.status(400).json({ message: 'workspaceId required when using receiverId' });
            }

            
            const receiver = await User.findById(receiverId);
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }

            
            dmSession = await messagesService.findOrCreateDMSession(
                senderId,
                receiverId,
                workspaceId
            );

            console.log('✅ [sendDirectMessage] DM session resolved:', dmSession._id);
        } else {
            return res.status(400).json({
                message: 'Either dmSessionId or receiverId must be provided'
            });
        }

        
        const message = await messagesService.createMessage(
            {
                type,
                company: dmSession.company,
                workspace: dmSession.workspace,
                dm: dmSession._id,
                sender: senderId,
                attachments,
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
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: getDMs');
    try {
        const userId = req.user.sub;
        const { workspaceId, dmSessionId, dmId } = req.params;
        const { limit, before } = req.query;

        console.log('🔍 [getDMs] DEBUG:', {
            userId,
            workspaceId,
            dmSessionId,
            dmId,
            allParams: req.params,
            fullPath: req.path,
            originalUrl: req.originalUrl
        });

        
        const sessionId = dmSessionId || dmId;

        console.log('🔍 [getDMs] Looking up DM session:', {
            sessionId,
            sessionIdType: typeof sessionId,
            sessionIdLength: sessionId?.length
        });

        
        let dmSession = await DMSession.findById(sessionId);

        console.log('🔍 [getDMs] DM session lookup result:', {
            found: !!dmSession,
            sessionId,
            dmSessionData: dmSession ? {
                _id: dmSession._id,
                workspace: dmSession.workspace,
                participants: dmSession.participants
            } : null
        });

        
        
        
        
        if (!dmSession) {
            console.log('⚠️ [getDMs] DM session not found, attempting to resolve as userId...');
            console.log('🔄 [getDMs] Treating sessionId as otherUserId and creating DM session');

            try {
                
                dmSession = await messagesService.findOrCreateDMSession(
                    userId,           
                    sessionId,        
                    workspaceId
                );

                console.log('✅ [getDMs] DM session resolved/created:', {
                    newSessionId: dmSession._id,
                    originalIdWasUserId: true
                });
            } catch (resolveError) {
                console.error('❌ [getDMs] Failed to resolve DM session:', resolveError.message);
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

        
        const result = await messagesService.fetchMessages(
            { dm: dmSession._id },  
            {
                limit: parseInt(limit) || 50,
                before,
                populateReplies: true,
                userId   
            }
        );

        
        
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
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: getWorkspaceDMList');
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const sessions = await messagesService.getUserDMSessions(userId, workspaceId);

        return res.json({ sessions });
    } catch (err) {
        return handleError(res, err, 'GET WORKSPACE DM LIST ERROR');
    }
};

exports.resolveDMSession = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: resolveDMSession');
    try {
        const { workspaceId, userId: otherUserId } = req.params;
        const currentUserId = req.user.sub;

        
        
        const Workspace = require('../../../models/Workspace');
        const workspace = await Workspace.findById(workspaceId).select('company members').lean();

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        
        const memberIds = workspace.members.map(m => String(m.user || m));
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

        
        
        if (isNewSession) {
            try {
                await conversationKeysService.bootstrapConversationKey({
                    conversationId: dmSession._id,
                    conversationType: 'dm',
                    workspaceId: workspaceId,
                    members: [String(currentUserId), String(otherUserId)]
                });
                console.log(`✅ [MESSAGES:MODULAR][RESOLVE_DM] Created new DM session ${dmSession._id} with keys`);
            } catch (keyErr) {
                
                
                console.error(`⚠️ [MESSAGES:MODULAR][RESOLVE_DM] Key bootstrap failed (non-fatal):`, keyErr.message);
            }
        } else {
            console.log(`✅ [MESSAGES:MODULAR][RESOLVE_DM] Found existing DM session ${dmSession._id}`);
        }

        return res.json({
            success: true,
            dmSessionId: dmSession._id,
            otherUserId: otherUserId,
            workspaceId: dmSession.workspace,
            participants: dmSession.participants
        });
    } catch (err) {
        console.error('[MESSAGES:MODULAR][RESOLVE_DM] ERROR:', err);
        return handleError(res, err, 'RESOLVE DM SESSION ERROR');
    }
};

exports.sendChannelMessage = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: sendChannelMessage');
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

        
        const message = await messagesService.createMessage(
            {
                type,
                company: channel.company,
                workspace: channel.workspace,
                channel: channelId,
                sender: senderId,
                attachments,
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
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: getChannelMessages');
    try {
        const userId = req.user.sub;
        const { channelId } = req.params;
        const { limit, before } = req.query;

        
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
                populateReplies: true,
                userJoinedAt,
                userId   
            }
        );

        
        const channelMembers = channel.members.map((m) => ({
            userId: m.user ? m.user.toString() : m.toString(),
            joinedAt: m.joinedAt || channel.createdAt
        }));

        
        const populatedMembers = await Promise.all(
            channelMembers.map(async (member) => {
                const user = await User.findById(member.userId).select('username');
                return {
                    ...member,
                    username: user?.username || 'Unknown'
                };
            })
        );

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
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: forwardMessage');
    try {
        const userId = req.user.sub;
        const { messageId, targets } = req.body;

        
        if (!messageId || !targets || !Array.isArray(targets) || targets.length === 0) {
            return res.status(400).json({
                message: 'messageId and targets array are required'
            });
        }

        
        const Message = require('../../features/messages/message.model');
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
                        type: 'message',
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
                        type: 'message',
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
                console.error(`Error forwarding to ${target.type}:${target.id}:`, targetError);
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
        const { text, ciphertext, messageIv } = req.body;

        if (!text && !ciphertext) {
            return res.status(400).json({ message: 'text or ciphertext is required' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.editMessage(
            messageId,
            userId,
            { text, ciphertext, messageIv },
            io
        );

        return res.json({ message });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
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

        console.log(`[REACT] Adding reaction: messageId=${messageId} userId=${userId} emoji=${JSON.stringify(emoji)}`);

        if (!emoji) {
            return res.status(400).json({ message: 'emoji is required' });
        }

        
        
        if (/^[0-9a-f]{24}$/i.test(emoji)) {
            console.error(`[REACT] ❌ Rejected invalid emoji (looks like ObjectId): ${emoji}`);
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
        const { pin = true } = req.body;

        const Message = require('../../features/messages/message.model');
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        
        
        const isSender = String(message.sender) === String(userId);
        let isChannelAdmin = false;
        let isDMParticipant = false;

        if (message.dm) {
            
            const DMSession = require('../../../models/DMSession');
            const dmSession = await DMSession.findById(message.dm).select('participants').lean();
            if (dmSession) {
                isDMParticipant = dmSession.participants.some(p => String(p) === String(userId));
            }
        } else if (message.channel) {
            
            const Channel = require('../../features/channels/channel.model');
            const channel = await Channel.findById(message.channel).select('members admins createdBy isDefault').lean();
            if (channel) {
                isChannelAdmin = channel.isDefault || 
                    (channel.members || []).some(m => {
                        const memberId = m.user?.toString() || m.toString();
                        return memberId === userId.toString();
                    }) ||
                    (channel.admins || []).map(id => id.toString()).includes(userId.toString()) ||
                    channel.createdBy?.toString() === userId.toString();
            }
        }

        if (!isSender && !isChannelAdmin && !isDMParticipant) {
            return res.status(403).json({ message: 'You must be a channel member to pin messages' });
        }

        message.isPinned = pin;
        message.pinnedBy = pin ? userId : null;
        message.pinnedAt = pin ? new Date() : null;
        await message.save();

        const io = req.app?.get('io');

        
        if (io) {
            const pinRoom = message.channel
                ? `channel:${message.channel}`
                : `dm:${message.dm}`;

            
            let pinnedByName = null;
            try {
                const User = require('../../../models/User');
                const pinner = await User.findById(userId).select('username').lean();
                pinnedByName = pinner?.username || null;
            } catch (_e) {  }

            io.to(pinRoom).emit(pin ? 'message-pinned' : 'message-unpinned', {
                messageId,
                pinnedBy: userId,
                pinnedByName,
                pinnedAt: message.pinnedAt
            });
        }

        
        if (message.channel) {
            
            try {
                const User = require('../../../models/User');
                const pinner = await User.findById(userId).select('username').lean();

                
                const snippet = message.payload?.text || message.text || message.decryptedContent || '';
                const messageSnippet = snippet.length > 60 ? snippet.slice(0, 57) + '…' : snippet;

                const systemMsg = await Message.create({
                    type: 'system',
                    systemEvent: pin ? 'message_pinned' : 'message_unpinned',
                    sender: userId,
                    channel: message.channel,
                    workspace: message.workspace,
                    systemData: {
                        userId,
                        userName: pinner?.username || 'Someone',
                        messageSnippet,
                        pinnedMessageId: messageId,
                    },
                });
                if (io) io.to(`channel:${message.channel}`).emit('new-message', systemMsg);
            } catch (sysErr) {
                console.error('[SYSTEM MSG] pin system message failed:', sysErr);
            }
        } else if (message.dm) {
            
            try {
                const User = require('../../../models/User');
                const pinner = await User.findById(userId).select('username').lean();

                const snippet = message.payload?.text || message.text || '';
                const messageSnippet = snippet.length > 60 ? snippet.slice(0, 57) + '…' : snippet;

                const systemMsg = await Message.create({
                    type: 'system',
                    systemEvent: pin ? 'dm_message_pinned' : 'dm_message_unpinned',
                    sender: userId,
                    dm: message.dm,
                    workspace: message.workspace,
                    systemData: {
                        userId,
                        userName: pinnedByName || pinner?.username || 'Someone',
                        messageSnippet,
                        pinnedMessageId: messageId,
                    },
                });
                if (io) io.to(`dm:${message.dm}`).emit('new-message', systemMsg);
            } catch (sysErr) {
                console.error('[SYSTEM MSG] DM pin system message failed:', sysErr);
            }
        }
        

        return res.json({ message });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Server error' });
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

exports.voteOnPoll = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;
        const { optionIndices } = req.body; 

        
        
        if (!Array.isArray(optionIndices)) {
            return res.status(400).json({ message: 'optionIndices must be an array' });
        }

        const Message = require('../../features/messages/message.model');
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        if (message.type !== 'poll') {
            return res.status(400).json({ message: 'Message is not a poll' });
        }

        const poll = message.poll;
        if (!poll || !poll.isActive) {
            return res.status(400).json({ message: 'Poll is closed or not found' });
        }

        
        if (message.channel) {
            const channel = await Channel.findById(message.channel);
            if (!channel || !channel.isMember(userId)) {
                return res.status(403).json({ message: 'Not a channel member' });
            }
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

        
        let pollWithVoterNames;
        try {
            await message.populate('sender', 'username profilePicture');
            const User = require('../../../models/User');
            const allVoterIds = new Set();
            message.poll.options.forEach(opt => opt.votes.forEach(v => allVoterIds.add(v.toString())));
            const voterDocs = allVoterIds.size > 0
                ? await User.find({ _id: { $in: [...allVoterIds] } }).select('_id username').lean()
                : [];
            const voterMap = {};
            voterDocs.forEach(u => { voterMap[u._id.toString()] = u.username; });
            pollWithVoterNames = {
                ...message.poll.toObject(),
                options: message.poll.options.map(opt => ({
                    ...opt.toObject(),
                    votes: opt.votes.map(v => ({
                        _id: v.toString(),
                        username: voterMap[v.toString()] || '?'
                    }))
                }))
            };
        } catch (enrichErr) {
            console.warn('[voteOnPoll] Voter name enrichment failed (vote saved OK):', enrichErr.message);
            pollWithVoterNames = message.poll.toObject();
        }

        
        const io = req.io || req.app?.get('io');
        if (io && message.channel) {
            io.to(`channel:${message.channel}`).emit('poll:vote_updated', {
                messageId: message._id,
                poll: pollWithVoterNames,
            });
        }

        return res.json({ message: { ...message.toObject(), poll: pollWithVoterNames } });
    } catch (err) {
        return handleError(res, err, 'VOTE ON POLL ERROR');
    }
};

exports.getMessageInfo = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;

        const Message = require('../../features/messages/message.model');
        const Workspace = require('../../../models/Workspace');

        
        const message = await Message.findById(messageId)
            .populate('sender', 'username profilePicture')
            .populate('readBy', 'username profilePicture')
            .lean();

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        let channelMembers = [];

        if (message.channel) {
            const channel = await Channel.findById(message.channel)
                .populate('members.user', 'username profilePicture')
                .lean();

            if (!channel) return res.status(404).json({ message: 'Channel not found' });

            
            const isMember = channel.isDefault || channel.members?.some(m =>
                String(m.user?._id || m.user) === String(userId)
            );
            if (!isMember) return res.status(403).json({ message: 'Not authorized' });

            
            if (channel.isDefault && (!channel.members || channel.members.length === 0)) {
                const workspace = await Workspace.findById(channel.workspace)
                    .populate('members.user', 'username profilePicture')
                    .lean();
                channelMembers = (workspace?.members || []).map(m => ({
                    _id: String(m.user?._id || m.user),
                    username: m.user?.username || 'Unknown',
                    profilePicture: m.user?.profilePicture || null
                }));
            } else {
                channelMembers = (channel.members || []).map(m => ({
                    _id: String(m.user?._id || m.user),
                    username: m.user?.username || 'Unknown',
                    profilePicture: m.user?.profilePicture || null
                }));
            }

        } else if (message.dm) {
            const dmSession = await DMSession.findById(message.dm)
                .populate('participants', 'username profilePicture')
                .lean();
            const isParticipant = dmSession?.participants?.some(
                p => String(p._id || p) === String(userId)
            );
            if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });
            channelMembers = (dmSession?.participants || []).map(p => ({
                _id: String(p._id || p),
                username: p.username || 'Unknown',
                profilePicture: p.profilePicture || null
            }));
        }

        
        const readByIds = new Set(
            (message.readBy || []).map(u => String(u._id || u))
        );

        console.log(`[MESSAGE INFO] msgId=${messageId} members=${channelMembers.length} readBy=${readByIds.size}`);

        return res.json({
            message: {
                _id: message._id,
                text: message.text,
                isEncrypted: !!(message.payload?.ciphertext || message.isEncrypted),
                payload: message.payload,
                createdAt: message.createdAt,
                sender: message.sender,
                reactions: message.reactions || [],
                readBy: [...readByIds]
            },
            members: channelMembers,
            readBy: [...readByIds]
        });

    } catch (err) {
        return handleError(res, err, 'GET MESSAGE INFO ERROR');
    }
};

const reminderService = require('../../features/messages/reminder.service');

exports.scheduleReminder = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId } = req.params;
        const { remindAt, note = '' } = req.body;

        if (!remindAt) return res.status(400).json({ message: 'remindAt is required' });

        const reminder = await reminderService.scheduleReminder(userId, messageId, remindAt, note);
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
        const userId = req.user.sub;
        const { messageId } = req.params;
        const diff = await messagesService.getMessageDiff(messageId, userId);
        return res.json(diff);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

exports.convertToTask = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId } = req.params;
        const taskData   = req.body || {};
        const io = req.app?.get('io');

        const task = await messagesService.convertToTask(messageId, userId, taskData, io);
        return res.status(201).json({ task });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
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
            contextMessages
        );
        return res.json({ suggestions });
    } catch (err) {
        return res.status(500).json({ message: 'AI suggestions unavailable', error: err.message });
    }
};

exports.translateMessage = async (req, res) => {
    try {
        const { text, targetLang, messageId } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({ message: 'text and targetLang are required' });
        }
        const result = await aiMessagingService.translateMessage(text, targetLang, messageId);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ message: 'Translation unavailable', error: err.message });
    }
};

exports.getThreadSummary = async (req, res) => {
    try {
        const { parentMessageId, replies = [], parentText = '' } = req.body;
        if (!parentMessageId) return res.status(400).json({ message: 'parentMessageId is required' });

        const summary = await aiMessagingService.summarizeThread(
            parentMessageId,
            replies,
            parentText
        );
        return res.json({ summary });
    } catch (err) {
        return res.status(500).json({ message: 'Thread summary unavailable', error: err.message });
    }
};
