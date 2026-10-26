const logger = require('../../../utils/logger');
const messagesService = require('./messages.service');
const Channel = require("../../features/channels/channel.model.js");
const Message = require("./message.model.js");
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const DMSession = require('../../../models/DMSession');
const { handleError } = require('../../../utils/responseHelpers');
const mongoose = require('mongoose');
const { canAccessMessage, loadAccessibleMessage } = require('./messageAccess');
const { redactReadBy, readersHidingReceipts } = require('../../features/auth/privacy.service');
const { withReadTimes } = require('./readReceipts.service');

// 201 for a new message; 200 + duplicate:true when an offline-queue resend
// (same clientMessageId) matched a message that was already stored.
function sentResponse(res, message) {
    const { isDuplicateSend } = require('./clientMessageId');
    if (isDuplicateSend(message)) return res.status(200).json({ message, duplicate: true });
    return res.status(201).json({ message });
}

function sendError(res, err, label) {
    if (require('../../shared/plans').sendPlanLimit(res, err)) return res;
    if (err && err.status && err.status < 500) {
        return res.status(err.status).json({ message: err.message });
    }
    return handleError(res, err, label);
}

/** Body fields both send endpoints accept. */
function sendBody(body = {}) {
    const {
        attachments, replyTo, parentId, quotedMessageId, ciphertext, messageIv, isEncrypted,
        clientTempId, clientMessageId, mentionText = '', type = 'message', poll = null,
        contact = null, meeting = null, checklistCount = 0, linkPreview = null,
    } = body;
    return {
        attachments, parentId: parentId || replyTo || null, quotedMessageId: quotedMessageId || null,
        ciphertext, messageIv, isEncrypted, clientTempId, clientMessageId, mentionText, type, poll,
        contact, meeting, checklistCount, linkPreview,
    };
}

// Structured messages (files, polls, contacts, meetings) may skip the encrypted body; text may not.
const STRUCTURED_TYPES = ['image', 'video', 'file', 'voice', 'poll', 'contact', 'meeting'];

/**
 * One send for both endpoints: the shared rules (sendRules.prepareSend), then createMessage,
 * which stores the message and tells the conversation (or the thread, for a reply).
 */
async function sendTo(req, res, target, label) {
    try {
        const senderId = req.user.sub;
        // Scheduled sends (scheduledMessages.service) pass io through req.app.
        const io = req.io || req.app?.get?.('io') || null;
        const b = sendBody(req.body);
        if (!STRUCTURED_TYPES.includes(b.type) && (!b.ciphertext || !b.messageIv || !b.isEncrypted)) {
            return res.status(400).json({ message: 'E2EE required: ciphertext and messageIv must be provided' });
        }
        const { prepareSend } = require('./sendRules');
        const prepared = await prepareSend(senderId, { ...target, parentId: b.parentId, quotedMessageId: b.quotedMessageId, attachments: b.attachments }, io);
        if (['image', 'video', 'file', 'voice'].includes(b.type) && prepared.attachments.length === 0) {
            return res.status(400).json({ message: 'An attachment message needs a file' });
        }
        const { target: t, parent } = prepared;
        const message = await messagesService.createMessage({
            type: b.type,
            company: t.company,
            workspace: t.workspace,
            channel: t.channel,
            dm: t.dm,
            participants: t.participants,
            sender: senderId,
            attachments: prepared.attachments,
            parentId: parent ? parent._id : null,
            parent,
            quotedMessageId: b.quotedMessageId,
            ciphertext: b.ciphertext,
            messageIv: b.messageIv,
            isEncrypted: b.isEncrypted,
            clientTempId: b.clientTempId,
            clientMessageId: b.clientMessageId,
            mentionText: b.mentionText,
            poll: b.poll,
            contact: b.contact,
            meeting: b.meeting,
            checklistCount: b.checklistCount,
            linkPreview: b.linkPreview,
        }, io);
        return sentResponse(res, message);
    } catch (err) {
        if (err && err.status && err.status < 500) {
            return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
        }
        return handleError(res, err, label);
    }
}

exports.sendDirectMessage = (req, res) => {
    const { dmSessionId, receiverId, workspaceId } = req.body || {};
    return sendTo(req, res, dmSessionId ? { dmSessionId } : { receiverId, workspaceId }, 'SEND DM ERROR');
};

exports.getDMs = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, dmSessionId, dmId } = req.params;
        const { limit, before, after, around } = req.query;
        const sessionId = dmSessionId || dmId;
        if (!mongoose.isValidObjectId(String(sessionId))) return res.status(400).json({ message: 'Invalid conversation id' });

        // Older links carry the other person's user id instead of the conversation id: open
        // (or start) the DM with them, as long as both are members of this workspace.
        let dmSession = await DMSession.findById(sessionId).select('_id').lean();
        if (!dmSession) {
            try {
                dmSession = await messagesService.findOrCreateDMSession(userId, sessionId, workspaceId);
            } catch (resolveError) {
                const status = resolveError.status && resolveError.status < 500 ? resolveError.status : 404;
                return res.status(status === 400 ? 404 : status).json({ message: 'Conversation not found' });
            }
        }

        const { checkConversationAccess, historyFilter } = require('../conversations/conversationAccess');
        const access = await checkConversationAccess({ dm: dmSession._id }, userId);
        if (!access.ok) return res.status(access.status === 404 ? 403 : access.status).json({ message: 'Not a participant in this DM', code: access.code });

        // "Clear chat" hides everything before this user's clear time, for them only. A group
        // member also only sees messages from when they joined.
        const result = await messagesService.fetchMessages(
            { dm: dmSession._id },
            {
                limit: parseInt(limit) || 50,
                before,
                after,
                around,
                populateReplies: true,
                userId,
                userJoinedAt: historyFilter(access).createdAt?.$gte || null,
            }
        );
        // Readers who turned read receipts off are hidden from everyone but themselves.
        result.messages = await redactReadBy(result.messages, userId);

        const wasAutoResolved = String(sessionId) !== String(dmSession._id);
        return res.json({
            ...result,
            dmSessionId: dmSession._id,
            redirectRequired: wasAutoResolved,
            ...(wasAutoResolved && { notice: 'DM session was resolved from user ID to session ID' }),
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
    try {
        const { workspaceId, userId: otherUserId } = req.params;
        // Both people must be active members of the workspace; one DM per pair.
        const dmSession = await messagesService.findOrCreateDMSession(req.user.sub, otherUserId, workspaceId);
        return res.json({
            success: true,
            dmSessionId: dmSession._id,
            otherUserId,
            workspaceId: dmSession.workspace,
            participants: dmSession.participants,
        });
    } catch (err) {
        if (err && err.status && err.status < 500) return res.status(err.status).json({ message: err.message, code: err.code });
        return handleError(res, err, 'RESOLVE DM SESSION ERROR');
    }
};

exports.sendChannelMessage = (req, res) => {
    const { channelId } = req.body || {};
    if (!channelId) return res.status(400).json({ message: 'channelId required' });
    return sendTo(req, res, { channelId }, 'SEND CHANNEL ERROR');
};

exports.getChannelMessages = async (req, res) => {
    logger.info('🔄 [MESSAGES:MODULAR] Function invoked: getChannelMessages');
    try {
        const userId = req.user.sub;
        const { channelId } = req.params;
        const { limit, before, after, around } = req.query;

        
        if (!mongoose.isValidObjectId(String(channelId))) return res.status(400).json({ message: 'Invalid channel id' });
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        // Members only, and only while they're active members of the workspace.
        const { isActiveWorkspaceMember } = require('../conversations/conversationAccess');
        if (!channel.isMember(userId) || !(await isActiveWorkspaceMember(channel.workspace, userId))) {
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
                // Everyone in a channel reads its whole history, however recently they joined
                // (Slack-like). userJoinedAt is still returned below for the "You joined" marker.
                userJoinedAt: null,
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

        
        // The source must be a message the person can see; each target follows the send rules.
        let originalMessage;
        try {
            originalMessage = await loadAccessibleMessage(Message, messageId, userId);
        } catch (e) {
            const status = e.status === 400 ? 400 : e.status === 404 ? 404 : 403;
            return res.status(status).json({ message: status === 403 ? 'Not authorized to access this message' : e.message });
        }

        // A photo/voice/file message is forwarded as the same kind of message (it has no
        // encrypted text); anything else is forwarded as its encrypted text.
        const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
        const forwardType = ATTACHMENT_TYPES.includes(originalMessage.type) ? originalMessage.type : 'message';
        const { prepareSend } = require('./sendRules');

        let forwardedCount = 0;
        const errors = [];
        for (const target of targets) {
            try {
                const { type, id } = target || {};
                if (type !== 'channel' && type !== 'dm') {
                    errors.push({ target, error: 'Invalid target type (must be channel or dm)' });
                    continue;
                }
                // The files stay the original sender's uploads; the forwarder can already read them.
                const { target: t } = await prepareSend(userId, type === 'channel' ? { channelId: id } : { dmSessionId: id }, req.io);
                await messagesService.createMessage({
                    type: forwardType,
                    company: t.company,
                    workspace: t.workspace,
                    channel: t.channel,
                    dm: t.dm,
                    participants: t.participants,
                    sender: userId,
                    ciphertext: originalMessage.payload?.ciphertext || originalMessage.ciphertext,
                    messageIv: originalMessage.payload?.messageIv || originalMessage.messageIv,
                    isEncrypted: true,
                    attachments: originalMessage.attachments || [],
                    forwardedFrom: messageId,
                }, req.io);
                forwardedCount++;
            } catch (targetError) {
                errors.push({ target, error: targetError.status && targetError.status < 500 ? targetError.message : 'Could not forward there' });
                if (!targetError.status || targetError.status >= 500) logger.error({ err: targetError }, '[forward] target failed');
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
        const body = req.body || {};
        const pin = body.pin === undefined ? true : !(body.pin === false || body.pin === 'false');
        const result = await messagesService.setPinned(req.params.messageId, req.user.sub, pin, req.app?.get('io'));
        return res.json(result);
    } catch (err) {
        if (err && err.status === 403 && !err.code) return res.status(403).json({ message: 'You must be a member of this conversation to pin messages' });
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

        // Same rules as any message: membership, blocked DMs, announcement channels.
        const { prepareSend } = require('./sendRules');
        const { target: t } = await prepareSend(senderId, channelId ? { channelId } : { dmSessionId: dmId }, req.io);
        const messagePayload = {
            type: 'poll',
            company: t.company,
            workspace: t.workspace,
            channel: t.channel,
            dm: t.dm,
            participants: t.participants,
            sender: senderId,
            poll: pollDoc,
        };

        const message = await messagesService.createMessage(messagePayload, req.io);

        return res.status(201).json({ message });
    } catch (err) {
        if (err && err.status && err.status < 500) return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
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
                // Anonymous polls: no names (each app only needs to find its own vote).
                votes: (opt.votes || []).map(v => (plain.anonymous
                    ? { _id: v.toString() }
                    : { _id: v.toString(), username: names[v.toString()] || 'Unknown' })),
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

        const message = await loadAccessibleMessage(Message, messageId, userId, { select: '+readReceipts', lean: true });
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
        // Each reader once, with when they first read it (null for reads before read times were kept).
        readByUsers = withReadTimes(readByUsers.filter((u, i, all) => all.findIndex(x => x._id === u._id) === i), message.readReceipts);
        const readByIds = readByUsers.map(u => u._id);

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
        const { remindAt, note = '', forUserId = null } = req.body;

        if (!remindAt) return res.status(400).json({ message: 'remindAt is required' });

        const reminder = await reminderService.scheduleReminder(userId, messageId, remindAt, typeof note === 'string' ? note : '', { forUserId });
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
        if (require('../../shared/plans').sendPlanLimit(res, err)) return;
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

        const { isActiveWorkspaceMember } = require('../conversations/conversationAccess');
        const isUserMember = channel.isMember(userId) && await isActiveWorkspaceMember(channel.workspace, userId);
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
        const { checkConversationAccess, historyFilter } = require('../conversations/conversationAccess');
        const access = await checkConversationAccess({ channel: channelId, dm: channelId ? null : dmId }, req.user.sub);
        if (!access.ok) return res.status(access.status).json({ message: access.error });

        const messages = await Message.find({
            ...(channelId ? { channel: channelId } : { dm: dmId }),
            ...historyFilter(access),
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
