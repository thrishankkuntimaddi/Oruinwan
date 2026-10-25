'use strict';

const Message = require('./message.model.js');
const DMSession = require('../../../models/DMSession');
const _Channel = require('../../features/channels/channel.model.js');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const {} = require('../../../utils/memberHelpers');
const conversationKeysService = require('../conversations/conversationKeys.service');
const logger = require('../../shared/utils/logger');
const mongoose = require('mongoose');
const { loadAccessibleMessage } = require('./messageAccess');
const { normalizeClientMessageId, findByClientMessageId, markDuplicate, isDuplicateKeyError } = require('./clientMessageId');

// Users live in PostgreSQL: message user refs are attached with hydrate() instead of populate().
const SENDER = { type: 'user', fields: ['username', 'email', 'profilePicture'] };
const SENDER_MIN = { type: 'user', fields: ['username', 'profilePicture'] };
const MESSAGE_REFS = {
    sender: SENDER,
    'readBy.user': { type: 'user', fields: ['username'] },
    // Who reacted, by name, so everyone can see it (not only a count).
    'reactions.userId': SENDER_MIN,
    'parentId.sender': SENDER_MIN,
    'quotedMessageId.sender': SENDER_MIN,
};

/** Polls show who voted (by name) from the first load, not only after a live vote. Anonymous polls keep ids only. */
async function withPollVoters(messages) {
    const polls = (messages || []).filter((m) => m?.poll?.options?.length && !m.poll.anonymous);
    if (polls.length) await hydrate(polls, { 'poll.options.votes': { type: 'user', fields: ['username'] } });
}

/**
 * What a reaction change tells everyone in the conversation: the message's reactions with
 * each person's name, and where the message is (so phones refresh the right conversation or
 * thread instead of waiting for the next reload).
 */
async function reactionEvent(message, { messageId, userId, emoji }) {
    const plain = { reactions: (message.reactions || []).map((r) => ({ userId: r.userId, emoji: r.emoji })) };
    await hydrate(plain, { 'reactions.userId': SENDER_MIN });
    return {
        messageId: String(messageId),
        userId: String(userId),
        emoji,
        reactions: plain.reactions,
        channelId: message.channel ? String(message.channel) : null,
        dmSessionId: message.dm ? String(message.dm) : null,
        parentId: message.parentId ? String(message.parentId) : null,
    };
}

/** Plain copy of a message document with its user references filled in. */
async function messageForClient(message, refs = { sender: SENDER }) {
    const obj = message && typeof message.toObject === 'function' ? message.toObject() : message;
    if (obj) await hydrate(obj, refs);
    return obj;
}

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
        checklistCount = 0,
        linkPreview = null,
        // Integration cards (type 'integration') are created only by the integrations
        // feature; the controllers never forward this field from a client request.
        integration = null,
        
        mentionText = '',
        clientMessageId: rawClientMessageId = null,
    } = messageData;

    // Offline-queue resend of a message this sender already stored: hand back the
    // stored copy without broadcasting or notifying a second time.
    const clientMessageId = normalizeClientMessageId(rawClientMessageId);
    if (clientMessageId) {
        const existing = await findByClientMessageId(Message, sender, clientMessageId);
        if (existing) return markDuplicate(await messageForClient(existing));
    }

    
    
    
    
    
    
    // Checklists are encrypted too: their title and items live in the ciphertext.
    const TEXT_TYPES = ['message', 'checklist', 'integration'];
    if (TEXT_TYPES.includes(type) && (!ciphertext || !messageIv)) {
        throw new Error('E2EE required for text messages: missing ciphertext or messageIv');
    }
    if (type === 'integration' && !integration) {
        throw Object.assign(new Error('Integration messages can only be posted by an integration'), { statusCode: 400, status: 400 });
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
        
        payload: TEXT_TYPES.includes(type) ? {
            ciphertext,
            messageIv,
            isEncrypted: true,
        } : undefined,
        
        attachments: attachments || [],
    };

    
    if (poll) messageDoc.poll = poll;
    if (contact) messageDoc.contact = contact;
    if (meeting) messageDoc.meeting = meeting;
    // Checklist item text is inside the encrypted body; the server keeps only the
    // checked state of each item.
    if (messageDoc.type === 'checklist') {
        const n = Math.min(Math.max(parseInt(checklistCount, 10) || 0, 1), 50);
        messageDoc.checklist = Array.from({ length: n }, (_, order) => ({ order, checked: false }));
    }
    if (linkPreview) messageDoc.linkPreview = linkPreview;
    if (type === 'integration') messageDoc.integration = integration;
    if (clientMessageId) messageDoc.clientMessageId = clientMessageId;

    logger.debug({ type }, `Creating message${type === 'message' ? ' 🔐' : ''}`);

    let message;
    try {
        message = await Message.create(messageDoc);
    } catch (err) {
        // Two resends raced: the other one stored it first.
        if (clientMessageId && isDuplicateKeyError(err)) {
            const existing = await findByClientMessageId(Message, sender, clientMessageId);
            if (existing) return markDuplicate(await messageForClient(existing));
        }
        throw err;
    }

    
    if (message.quotedMessageId) {
        await message.populate('quotedMessageId');
    }
    // Sender (and the quoted message's sender) from PostgreSQL.
    const hydratedMessage = await messageForClient(message, { sender: SENDER, 'quotedMessageId.sender': SENDER_MIN });



    
    
    
    
    
    if (io) {
        const room = channel ? `channel:${channel}` : `dm:${dm}`;
        const messageObject = { ...hydratedMessage };

        
        messageObject.replyCount = 0;
        messageObject.reactions = messageObject.reactions || [];
        messageObject.isPinned = messageObject.isPinned || false;

        io.to(room).emit('new-message', messageObject);
    }

    
    
    
    
    
    // Badges, toasts and notifications for everyone else in the conversation.
    // Runs after the response; failures here never fail the send.
    // Pass the hydrated copy: the raw document's `sender` is only an id, so
    // toasts and notifications would name the sender "Someone".
    fanOutMessage(hydratedMessage, { channel, dm, workspace, sender, type, parentId, mentionText }, io)
        .catch(err => logger.error({ err }, '[createMessage] fan-out error (non-fatal)'));

    fireMessageSentWebhook(message, { channel, workspace, sender, type, parentId })
        .catch(err => logger.warn({ err: err?.message }, '[createMessage] message.sent webhook error (non-fatal)'));

    emitMessageSentAutomation(hydratedMessage, { channel, workspace, sender, type, parentId, fromAutomation: messageData.fromAutomation }, io)
        .catch(err => logger.warn({ err: err?.message }, '[createMessage] message.sent automation error (non-fatal)'));

    // Plain object with `sender` filled in (what clients and callers read).
    return hydratedMessage;
}

/**
 * `message.sent` for channel messages: on the bus (Redis) or straight to the
 * webhooks (single box), via webhook.trigger.fire. Messages are end-to-end
 * encrypted, so the payload carries ids and metadata only — never text,
 * ciphertext, attachments or poll/contact contents. Private channels are skipped
 * so their activity does not leave the workspace. Never throws into the caller.
 */
async function fireMessageSentWebhook(message, { channel, workspace, sender, type, parentId }) {
    if (!channel || type === 'system') return;
    const channelId = String(channel?._id || channel);
    if (!/^[a-f0-9]{24}$/i.test(channelId)) return;
    const Channel = require('../../features/channels/channel.model.js');
    const ch = await Channel.findById(channelId).select('workspace isPrivate').lean();
    if (!ch || ch.isPrivate) return;
    const workspaceId = workspace || ch.workspace;
    if (!workspaceId) return;
    const webhookTrigger = require('../../features/integrations/webhook.trigger');
    webhookTrigger.fire(workspaceId, 'message.sent', {
        messageId: String(message._id),
        channelId,
        senderId: String(sender?._id || sender),
        type: message.type,
        parentId: parentId ? String(parentId) : null,
        hasAttachments: Array.isArray(message.attachments) && message.attachments.length > 0,
        createdAt: message.createdAt,
    });
}

/**
 * `message.sent` automation trigger. Metadata only (the text is end-to-end
 * encrypted): ids, channel name, sender username, type and attachment info.
 * Public channels only, like the webhook, so private and direct conversations
 * never feed automations. Messages an automation posted itself are skipped so
 * an automation cannot trigger itself in a loop.
 */
async function emitMessageSentAutomation(message, { channel, workspace, sender, type, parentId, fromAutomation }, io) {
    if (!channel || type === 'system' || fromAutomation) return;
    const channelId = String(channel?._id || channel);
    if (!/^[a-f0-9]{24}$/i.test(channelId)) return;
    const Channel = require('../../features/channels/channel.model.js');
    const ch = await Channel.findById(channelId).select('workspace isPrivate name').lean();
    if (!ch || ch.isPrivate) return;
    const workspaceId = workspace || ch.workspace;
    if (!workspaceId) return;
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    require('../notifications/notificationEventEmitter').emit('message.sent', {
        io,
        automationOnly: true,
        workspaceId: String(workspaceId),
        messageId: String(message._id),
        channelId,
        channelName: ch.name || null,
        senderId: String(sender?._id || sender),
        senderUsername: message.sender?.username || null,
        type: message.type,
        isThreadReply: Boolean(parentId),
        parentId: parentId ? String(parentId) : null,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
        attachmentTypes: [...new Set(attachments.map((a) => a.type).filter(Boolean))],
        createdAt: message.createdAt,
    });
}

const ATTACHMENT_LABELS = {
    image: '📷 Photo', video: '🎬 Video', voice: '🎵 Voice note', file: '📎 File',
    poll: '📊 Poll', contact: '👤 Contact', meeting: '📅 Meeting', checklist: '☑️ Checklist',
};

/**
 * Tell every other participant about a new message:
 *  - `conversation:activity` on their personal room (drives unread badges and
 *    the compact toast; carries the ciphertext so the client can decrypt a
 *    preview with its own conversation key);
 *  - a stored `dm` notification for direct messages;
 *  - `mention` notifications for @user / @here / @channel in channels.
 * Thread replies are left to the threads module.
 */
async function fanOutMessage(message, { channel, dm, workspace, sender, type, parentId, mentionText }, io) {
    if (parentId || type === 'system') return;

    const Channel = require('../../features/channels/channel.model.js');
    const notificationService = require('../notifications/notificationService');
    const senderId = String(sender);
    const senderUsername = message.sender?.username || 'Someone';
    const senderAvatar = message.sender?.profilePicture || null;

    let recipientIds = [];
    let channelName = null;
    let mutedIds = new Set();
    let channelPolicy = null;
    if (dm) {
        const session = await DMSession.findById(dm).select('participants mutedBy').lean();
        recipientIds = (session?.participants || []).map(String).filter(id => id !== senderId);
        mutedIds = new Set((session?.mutedBy || []).map(m => String(m.user)));
    } else if (channel) {
        const channelDoc = await Channel.findById(channel).select('name members mutedBy broadcastMentions admins workspace').lean();
        channelPolicy = channelDoc;
        channelName = channelDoc?.name || null;
        recipientIds = (channelDoc?.members || [])
            .map(m => String(m?.user?._id || m?.user || m))
            .filter(id => id && id !== senderId);
        mutedIds = new Set((channelDoc?.mutedBy || []).map(m => String(m.user)));
    }
    if (recipientIds.length === 0) return;

    const isText = type === 'message' || type === 'integration';
    const preview = isText && message.payload?.ciphertext
        ? { ciphertext: message.payload.ciphertext, messageIv: message.payload.messageIv }
        : null;
    const kindLabel = ATTACHMENT_LABELS[type] || null;

    // @handles resolve against the channel's own members (works for personal
    // workspaces without a company too); @here / @channel address everyone.
    let mentionedUserIds = [];
    let everyone = false;
    let hereIds = null;
    if (mentionText && channel) {
        try {
            const { parseMentionHandles } = require('../../utils/mentionParser');
            const { userHandles, isHere, isChannel } = parseMentionHandles(mentionText);
            // @channel / @here may be limited to channel admins.
            let broadcastAllowed = isHere || isChannel;
            if (broadcastAllowed && channelPolicy?.broadcastMentions === 'admins') {
                const { canManageChannel } = require('../../features/channels/channelMute.controller');
                broadcastAllowed = await canManageChannel(channelPolicy, senderId);
            }
            if (broadcastAllowed && isChannel) {
                everyone = true;
            } else if (broadcastAllowed && isHere) {
                // @here reaches only people who are online right now.
                const { getBulkPresenceAsync } = require('../../features/presence/presence.service');
                const live = await getBulkPresenceAsync(recipientIds);
                hereIds = new Set(recipientIds.filter(id => live[String(id)] && live[String(id)].status !== 'offline'));
            }
            if (userHandles.length > 0) {
                const handles = new Set(userHandles.map(h => String(h).toLowerCase()));
                const users = await identity.users.findManyByIds(recipientIds);
                mentionedUserIds = [...users.values()]
                    .filter(u => handles.has(String(u.username || '').toLowerCase()))
                    .map(u => String(u._id));
            }
            if (mentionedUserIds.length > 0) {
                await Message.findByIdAndUpdate(message._id, { $set: { mentions: mentionedUserIds } });
            }
        } catch (mentionErr) {
            logger.error({ err: mentionErr }, '[fanOutMessage] mention parsing failed');
        }
    }
    const mentionedSet = new Set(mentionedUserIds);
    const broadcastTo = (id) => everyone || (hereIds ? hereIds.has(id) : false);

    const activity = {
        workspaceId: String(workspace),
        conversationType: dm ? 'dm' : 'channel',
        conversationId: String(dm || channel),
        channelName,
        messageId: String(message._id),
        senderId,
        senderUsername,
        senderAvatar,
        type,
        kindLabel,
        preview,
        createdAt: message.createdAt,
    };
    for (const recipientId of recipientIds) {
        // Unread counts still update for muted conversations; the flag tells the
        // client not to alert.
        notificationService.emitToUser(io, recipientId, 'conversation:activity', {
            ...activity,
            isMention: broadcastTo(recipientId) || mentionedSet.has(recipientId),
            isDirectMention: mentionedSet.has(recipientId),
            muted: mutedIds.has(recipientId),
        });
    }

    if (dm) {
        await Promise.allSettled(recipientIds.filter(id => !mutedIds.has(id)).map(recipientId => notificationService.dmReceived(io, {
            recipientId,
            senderId,
            senderUsername,
            senderAvatar,
            workspaceId: workspace,
            dmSessionId: String(dm),
            snippet: kindLabel || null,
            preview,
            kind: type,
        })));
        return;
    }

    const snippet = mentionText
        ? (mentionText.length > 60 ? `${mentionText.slice(0, 57)}...` : mentionText)
        : null;
    // A muted channel still notifies for a direct @mention, never for @channel/@here.
    const mentionTargets = recipientIds
        .filter(id => mentionedSet.has(id) || (broadcastTo(id) && !mutedIds.has(id)));
    if (mentionTargets.length > 0) {
        await Promise.allSettled(mentionTargets.map(userId => notificationService.mention(io, {
            mentionedUserId: userId,
            senderUsername,
            workspaceId: workspace,
            channelName: channelName || 'a channel',
            channelId: String(channel),
            snippet,
            preview,
            isEveryone: broadcastTo(userId) && !mentionedSet.has(userId),
        })));
    }
}

/**
 * Live thread info for each message: replyCount and lastReplyAt counted from replies that
 * still exist (deleted replies drop out), plus up to three recent repliers (threadParticipants).
 */
async function attachThreadInfo(messages) {
    if (!messages.length) return messages;
    const ids = messages.map(m => m._id);
    const rows = await Message.aggregate([
        { $match: { parentId: { $in: ids }, type: { $ne: 'system' }, isDeletedUniversally: { $ne: true }, isDeleted: { $ne: true } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$parentId', replyCount: { $sum: 1 }, lastReplyAt: { $first: '$createdAt' }, senders: { $push: '$sender' } } },
    ]);
    const byParent = new Map(rows.map(r => {
        const recent = [];
        for (const sid of r.senders || []) {
            const key = String(sid);
            if (!recent.includes(key)) recent.push(key);
            if (recent.length === 3) break;
        }
        return [String(r._id), { replyCount: r.replyCount, lastReplyAt: r.lastReplyAt || null, threadParticipants: recent }];
    }));
    const out = messages.map(m => {
        const info = byParent.get(String(m._id));
        return info ? { ...m, ...info } : { ...m, replyCount: 0, threadParticipants: [] };
    });
    await hydrate(out, { threadParticipants: SENDER_MIN });
    return out;
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
        // The anchor must be a message of this conversation that the reader can see
        // (same scope as the page itself), not any message id.
        if (!mongoose.isValidObjectId(String(around))) {
            return { messages: [], hasMore: false, hasMoreNewer: false };
        }
        const anchorMsg = await Message.findOne({ ...finalQuery, _id: around })
            .populate('parentId')
            .populate('quotedMessageId');

        if (!anchorMsg) {
            return { messages: [], hasMore: false, hasMoreNewer: false };
        }

        const halfLimit = Math.floor(parseInt(limit) / 2);

        // Fetch older messages (fetch halfLimit + 1)
        const olderQuery = { ...finalQuery, _id: { $lt: anchorMsg._id } };
        const older = await Message.find(olderQuery)
            .sort({ _id: -1 })
            .limit(halfLimit + 1)
            .populate('parentId')
            .populate('quotedMessageId');

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
            .populate('parentId')
            .populate('quotedMessageId');

        const hasMoreNewer = newer.length > halfLimit;
        if (hasMoreNewer) {
            newer.pop();
        }

        const combined = [...older, anchorMsg, ...newer];

        let messagesWithCounts = combined.map(m => m.toObject ? m.toObject() : m);
        await hydrate(messagesWithCounts, MESSAGE_REFS);
        await withPollVoters(messagesWithCounts);
        if (populateReplies) messagesWithCounts = await attachThreadInfo(messagesWithCounts);

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
            .populate('parentId')
            .populate('quotedMessageId');

        const hasMoreNewer = messages.length > parseInt(limit);
        if (hasMoreNewer) {
            messages.pop();
        }

        let messagesWithCounts = messages.map(m => m.toObject ? m.toObject() : m);
        await hydrate(messagesWithCounts, MESSAGE_REFS);
        await withPollVoters(messagesWithCounts);
        if (populateReplies) messagesWithCounts = await attachThreadInfo(messagesWithCounts);

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
            .populate('parentId')
            .populate('quotedMessageId');

        const hasMore = messages.length > parseInt(limit);
        if (hasMore) {
            messages.pop();
        }

        messages.reverse();

        let messagesWithCounts = messages.map(m => m.toObject ? m.toObject() : m);
        await hydrate(messagesWithCounts, MESSAGE_REFS);
        await withPollVoters(messagesWithCounts);
        if (populateReplies) messagesWithCounts = await attachThreadInfo(messagesWithCounts);

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
        participants: { $all: sortedParticipants, $size: 2 }, isGroup: { $ne: true }
    });

    if (!dmSession) {
        
        const workspace = await identity.workspaces.findById(workspaceId);
        if (!workspace) {
            throw new Error('Workspace not found');
        }

        
        
        
        
        try {
            dmSession = await DMSession.findOneAndUpdate(
                {
                    workspace: workspaceId,
                    participants: { $all: sortedParticipants, $size: 2 }, isGroup: { $ne: true }
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
                    participants: { $all: sortedParticipants, $size: 2 }, isGroup: { $ne: true }
                });
                if (!dmSession) throw upsertErr;
            } else {
                throw upsertErr;
            }
        }

    } else {
        dmSession.lastMessageAt = new Date();
        await dmSession.save();
    }

    // Every call (not only creation) makes sure the key exists and both
    // participants hold it; a key hiccup must not block resolving the session.
    try {
        await conversationKeysService.ensureDMConversationKey(dmSession._id);
    } catch (keyError) {
        logger.error({ err: keyError, dmSessionId: dmSession._id }, '[DM][E2EE] Could not ensure conversation key');
    }

    return dmSession;
}

async function getUserDMSessions(userId, workspaceId) {
    // Conversations this user deleted stay out of their list until a new message arrives.
    const sessions = await DMSession.find({
        workspace: workspaceId,
        participants: { $in: [userId] },
        'hiddenFor.user': { $ne: userId },
    }).lean();
    await hydrate(sessions, { participants: { type: 'user', fields: ['username', 'email', 'profilePicture', 'isOnline', 'userStatus'] } });

    
    const { groupDisplayName, memberSinceFor } = require('./groupDM.service');
    const sessionList = await Promise.all(
        sessions.map(async (session) => {
            const cleared = (session.clearedAt || []).find(c => String(c.user) === String(userId));
            // A group member only sees messages from when they joined.
            const since = latestDate(cleared?.clearedAt, memberSinceFor(session, userId));
            // The preview is the newest top-level message this user can still see
            // (not deleted for everyone, not hidden with "delete for me", not a system line).
            const lastMsg = await Message.findOne({
                dm: session._id,
                parentId: null,
                type: { $ne: 'system' },
                isDeleted: { $ne: true },
                isDeletedUniversally: { $ne: true },
                hiddenFor: { $ne: userId },
                ...(since ? { createdAt: { $gt: since } } : {}),
            })
                .sort({ createdAt: -1 })
                .select('_id payload type text createdAt sender')
                .lean();
            if (lastMsg) await hydrate(lastMsg, { sender: { type: 'user', fields: ['username'] } });

            
            const otherUser = session.participants.find(
                (p) => {
                    const participantId = p?._id || p;
                    return String(participantId) !== String(userId);
                }
            );

            
            const unreadCount = await Message.countDocuments({
                dm: session._id,
                sender: { $ne: userId },
                readBy: { $ne: userId },
                parentId: null,
                type: { $ne: 'system' },
                isDeleted: { $ne: true },
                ...(since ? { createdAt: { $gt: since } } : {}),
            });

            
            const lastMessageText = messagePreviewLabel(lastMsg);

            const preview = {
                lastMessage: lastMessageText,
                // Encrypted text can only be read by the participants: hand the client
                // the ciphertext so it can show a real preview.
                lastMessagePreview: lastMsg?.type === 'message' && lastMsg.payload?.ciphertext
                    ? { ciphertext: lastMsg.payload.ciphertext, messageIv: lastMsg.payload.messageIv }
                    : null,
                lastMessageId: lastMsg?._id || null,
                lastMessageAt: lastMsg?.createdAt || session.lastMessageAt || session.createdAt,
                lastMessageSender: lastMsg?.sender ? { _id: String(lastMsg.sender._id || lastMsg.sender), username: lastMsg.sender.username || null } : null,
                unreadCount,
            };

            if (session.isGroup) {
                const title = groupDisplayName(session, userId);
                const members = (session.participants || []).map(p => ({
                    _id: String(p?._id || p),
                    username: p?.username || null,
                    profilePicture: p?.profilePicture || null,
                    isOnline: !!p?.isOnline,
                    userStatus: p?.userStatus || null,
                }));
                return {
                    id: session._id,
                    isGroup: true,
                    name: session.name || null,
                    displayName: title,
                    createdBy: session.createdBy ? String(session.createdBy) : null,
                    members,
                    memberCount: members.length,
                    // Older apps only know `otherUser`: they show the group's title.
                    otherUser: { _id: null, username: title, profilePicture: null, isOnline: false },
                    otherUserId: null,
                    ...preview,
                };
            }

            // A DM with an AI agent (Oruinwan AI, Claude, ChatGPT…): the apps list these under Agents.
            const agentEmail = /^assistant(?:-([a-z_]+))?@ai\.oruinwan\.internal$/.exec(String(otherUser?.email || ''));
            return {
                id: session._id,
                otherUser: otherUser || { username: 'Self' },
                otherUserId: otherUser?._id || otherUser,
                ...(agentEmail ? { isAgent: true, agentId: agentEmail[1] || 'default' } : {}),
                lastMessage: lastMessageText,
                // Encrypted text can only be read by the participants: hand the client
                // the ciphertext so it can show a real preview.
                lastMessagePreview: lastMsg?.type === 'message' && lastMsg.payload?.ciphertext
                    ? { ciphertext: lastMsg.payload.ciphertext, messageIv: lastMsg.payload.messageIv }
                    : null,
                lastMessageId: lastMsg?._id || null,
                lastMessageAt: lastMsg?.createdAt || session.createdAt,
                lastMessageSender: lastMsg?.sender ? { _id: String(lastMsg.sender._id || lastMsg.sender), username: lastMsg.sender.username || null } : null,
                unreadCount
            };
        })
    );

    return sessionList;
}

/**
 * Unread top-level messages per channel for `userId`, counted from the moment
 * they joined each channel. Returns a Map of channelId → count (only >0).
 */
/** The chat list's one-line label for a message ("📷 Photo", its plain text, …). */
function messagePreviewLabel(lastMsg) {
    if (!lastMsg) return 'No messages yet';
    const t = lastMsg.type;
    if (t === 'image') return '📷 Photo';
    if (t === 'video') return '🎬 Video';
    if (t === 'voice' || t === 'audio') return '🎵 Voice note';
    if (t === 'file') return '📎 File';
    if (t === 'poll') return '📊 Poll';
    if (t === 'contact') return '👤 Contact';
    if (t === 'meeting') return '📅 Meeting';
    if (t === 'checklist') return '☑️ Checklist';
    if (lastMsg.text) return lastMsg.text;
    if (lastMsg.payload?.isEncrypted || lastMsg.payload?.ciphertext) return '🔒 Encrypted message';
    return 'Message';
}

const memberIdOf = (m) => String(m?.user?._id || m?.user || m);

/**
 * The newest top-level message of each channel `userId` is in, for the chat list: a label for
 * media, the ciphertext for text (members decrypt it), who sent it and when.
 * Returns a Map of channelId → { id, label, preview, senderId, senderName, at }.
 */
async function getChannelLastMessages(userId, channels) {
    const out = new Map();
    const mine = (channels || []).filter(ch => (ch.members || []).some(m => memberIdOf(m) === String(userId)));
    await Promise.all(mine.map(async (ch) => {
        const last = await Message.findOne({
            channel: ch._id,
            parentId: null,
            type: { $ne: 'system' },
            isDeleted: { $ne: true },
            isDeletedUniversally: { $ne: true },
            hiddenFor: { $ne: userId },
        })
            .sort({ createdAt: -1 })
            .select('_id payload type text createdAt sender')
            .lean();
        if (!last) return;
        await hydrate(last, { sender: { type: 'user', fields: ['username', 'profile'] } });
        out.set(String(ch._id), {
            id: String(last._id),
            label: messagePreviewLabel(last),
            preview: last.type === 'message' && last.payload?.ciphertext ? { ciphertext: last.payload.ciphertext, messageIv: last.payload.messageIv } : null,
            senderId: last.sender ? String(last.sender._id || last.sender) : null,
            senderName: last.sender?.profile?.name || last.sender?.username || null,
            at: last.createdAt,
        });
    }));
    return out;
}

async function getChannelUnreadCounts(userId, channels) {
    const clauses = [];
    for (const ch of channels || []) {
        const me = (ch.members || []).find(m => String(m?.user?._id || m?.user || m) === String(userId));
        if (!me) continue;
        const clause = { channel: ch._id };
        if (me.joinedAt) clause.createdAt = { $gte: new Date(me.joinedAt) };
        clauses.push(clause);
    }
    const counts = new Map();
    if (clauses.length === 0) return counts;

    const rows = await Message.aggregate([
        {
            $match: {
                $or: clauses,
                sender: { $ne: new mongoose.Types.ObjectId(String(userId)) },
                readBy: { $ne: new mongoose.Types.ObjectId(String(userId)) },
                parentId: null,
                type: { $ne: 'system' },
                isDeleted: { $ne: true },
            },
        },
        { $group: { _id: '$channel', n: { $sum: 1 } } },
    ]);
    for (const row of rows) counts.set(String(row._id), row.n);
    return counts;
}

/**
 * Unread top-level messages per workspace for `userId`: the same counts the channel list
 * (getChannelUnreadCounts, muted channels left out) and the DM list (getUserDMSessions) show,
 * added up. Four queries for any number of workspaces. Returns a Map of workspaceId → count (only >0).
 */
async function getWorkspaceUnreadCounts(userId, workspaceIds) {
    const totals = new Map();
    const ids = (workspaceIds || []).map(String).filter(id => mongoose.isValidObjectId(id));
    if (ids.length === 0) return totals;
    const add = (ws, n) => { if (ws && n) totals.set(String(ws), (totals.get(String(ws)) || 0) + n); };
    const me = new mongoose.Types.ObjectId(String(userId));

    const channels = await _Channel.find({ workspace: { $in: ids }, 'members.user': userId, 'mutedBy.user': { $ne: userId } })
        .select('_id workspace members.user members.joinedAt')
        .lean();
    const channelWorkspace = new Map(channels.map(c => [String(c._id), c.workspace]));
    for (const [channelId, n] of await getChannelUnreadCounts(userId, channels)) add(channelWorkspace.get(channelId), n);

    const sessions = await DMSession.find({ workspace: { $in: ids }, participants: userId, 'hiddenFor.user': { $ne: userId } })
        .select('_id workspace isGroup memberSince')
        .lean();
    if (sessions.length) {
        const dmWorkspace = new Map(sessions.map(d => [String(d._id), d.workspace]));
        const { memberSinceFor } = require('./groupDM.service');
        const plain = [];
        const late = [];
        for (const d of sessions) {
            const since = memberSinceFor(d, userId);
            if (since) late.push({ dm: d._id, createdAt: { $gt: new Date(since) } });
            else plain.push(d._id);
        }
        const scope = late.length === 0
            ? { dm: { $in: plain } }
            : { $or: [...(plain.length ? [{ dm: { $in: plain } }] : []), ...late] };
        const rows = await Message.aggregate([
            {
                $match: {
                    ...scope,
                    sender: { $ne: me },
                    readBy: { $ne: me },
                    parentId: null,
                    type: { $ne: 'system' },
                    isDeleted: { $ne: true },
                },
            },
            { $group: { _id: '$dm', n: { $sum: 1 } } },
        ]);
        for (const row of rows) add(dmWorkspace.get(String(row._id)), row.n);
    }
    return totals;
}

/** The later of two optional dates (null when both are empty). */
function latestDate(a, b) {
    const times = [a, b].filter(Boolean).map(d => new Date(d).getTime());
    return times.length ? new Date(Math.max(...times)) : null;
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

    const message = await Message.findById(messageId);
    if (!message) throw httpError(404, 'Message not found');

    if (String(message.sender?._id || message.sender) !== userId.toString()) {
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
        io.to(room).emit('message:edited', await messageForClient(message));
    }

    return message;
}

/**
 * Restore an older version of a message. The current content is pushed into
 * editHistory first, so no version is ever lost.
 */
async function restoreMessageVersion(messageId, userId, versionIndex, io) {
    const message = await Message.findById(messageId);
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
        io.to(room).emit('message:edited', await messageForClient(message));
    }

    return message;
}

async function deleteMessage(messageId, userId, io, scope = 'everyone', socketId = null) {
    const message = await Message.findById(messageId);
    if (!message) throw httpError(404, 'Message not found');

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

    
    const isSender = String(message.sender?._id || message.sender) === userId.toString();

    
    // Channel admins, the channel's creator and workspace owners/admins moderate a channel
    // (same rule as the socket path and thread locks: threads/threadControls.canModerateThread).
    let isChannelAdmin = false;
    if (!isSender && message.channel) {
        isChannelAdmin = await require('../threads/threadControls').canModerateThread(message, userId).catch(() => false);
    }

    if (!isSender && !isChannelAdmin) {
        const err = new Error('Unauthorized: only the sender or a channel admin can delete this message for everyone');
        err.status = 403;
        throw err;
    }

    // Who deleted it, by name, so "Message deleted by …" reads right after a reload too.
    let deleter = null;
    try { deleter = await identity.users.findById(userId); } catch (_) { /* name is optional */ }
    message.isDeleted = true;
    message.isDeletedUniversally = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    message.deletedByName = deleter?.username || null;
    await message.save();

    // Ids only on the bus (content is end-to-end encrypted); a bus failure never fails the delete.
    require('../../shared/events/bus').publish('message.deleted', {
        messageId: String(message._id),
        channelId: message.channel ? String(message.channel) : null,
        dmId: message.dm ? String(message.dm) : null,
        deletedBy: String(userId),
    }, { workspaceId: message.workspace, companyId: message.company, actorId: userId }).catch(() => {});

    if (io) {
        io.to(room).emit('message:deleted', {
            messageId,
            dm: message.dm || null,
            channel: message.channel || null,
            // Set for thread replies, so an open thread panel can drop the reply.
            parentId: message.parentId ? String(message.parentId) : null,
            deletedBy: userId,
            deletedByName: message.deletedByName,
            deletedAt: message.deletedAt
        });
    }

    // A deleted reply no longer counts: recount the thread and update the parent everywhere.
    if (message.parentId) {
        try {
            const threads = require('../threads/threads.service');
            const counters = await threads.recountThread(message.parentId);
            threads.emitThreadCounters(io, { _id: message.parentId, channel: message.channel, dm: message.dm }, counters);
        } catch (err) {
            logger.warn('[deleteMessage] thread recount failed:', err.message);
        }
    }

    return message;
}

async function addReaction(messageId, userId, emoji, io) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');

    // Several reactions per person (each emoji once); DELETE /react removes one.
    const already = message.reactions.some(
        r => r.userId.toString() === userId.toString() && r.emoji === emoji
    );
    if (!already) {
        message.reactions.push({ userId, emoji });
        await message.save();
    }

    const room = message.channel
        ? `channel:${message.channel}`
        : `dm:${message.dm}`;

    if (io) {
        io.to(room).emit('message:reaction_added', await reactionEvent(message, { messageId, userId, emoji }));
    }

    if (message.sender && String(message.sender) !== String(userId) && message.workspace) {
        (async () => {
            const notificationService = require('../notifications/notificationService');
            const reactor = await identity.users.findById(userId);
            await notificationService.reaction(io, {
                recipientId: String(message.sender),
                reactorUsername: reactor?.username || 'Someone',
                emoji,
                workspaceId: message.workspace,
                channelId: message.channel ? String(message.channel) : null,
                dmSessionId: message.dm ? String(message.dm) : null,
            });
        })().catch(err => logger.warn({ err }, '[addReaction] notification failed'));
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
        io.to(room).emit('message:reaction_removed', await reactionEvent(message, { messageId, userId, emoji }));
    }

    return message;
}

async function checklistToggle(messageId, itemIndex, userId, io) {
    const message = await Message.findById(messageId);
    if (!message) throw Object.assign(new Error('Message not found'), { status: 404 });
    // Only people in the conversation may tick items (this had no access check).
    const { checkConversationAccess } = require('../threads/threadAccess');
    const access = await checkConversationAccess({ channel: message.channel, dm: message.dm }, userId, { forWrite: true });
    if (!access.ok) throw Object.assign(new Error(access.error), { status: access.status });
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
        select: 'channel dm workspace company sender linkedTaskId isDeletedUniversally parentId',
        lean: true,
    });
    if (message.isDeletedUniversally) throw httpError(400, 'Cannot convert a deleted message');
    if (message.linkedTaskId) throw httpError(409, 'Message is already linked to a task');

    let workspaceId = message.workspace || null;
    if (!workspaceId && message.channel) {
        const ch = await _Channel.findById(message.channel).select('workspace').lean();
        workspaceId = ch?.workspace || null;
    }

    const tasksShared = require('../../features/tasks/tasks.shared');
    const ws = workspaceId ? await identity.workspaces.findById(workspaceId) : null;
    if (workspaceId && !ws) throw httpError(404, 'Workspace not found');

    let assignedTo = [userId];
    if (Array.isArray(taskData.assigneeIds) && taskData.assigneeIds.length) {
        const ids = [...new Set(taskData.assigneeIds.map(String))];
        if (ids.some(id => !mongoose.Types.ObjectId.isValid(id))) throw httpError(400, 'Invalid assigneeIds');
        if (!workspaceId) throw httpError(400, 'Assignees require a workspace message');
        const invalid = ids.filter(id => !tasksShared.isActiveMember(ws, id));
        if (invalid.length) throw httpError(400, `Assignees are not workspace members: ${invalid.join(', ')}`);
        assignedTo = ids;
    }

    let dueDate = null;
    if (taskData.dueDate) {
        dueDate = new Date(taskData.dueDate);
        if (isNaN(dueDate.getTime())) throw httpError(400, 'Invalid dueDate');
    }

    // Same company value as tasks created from the Tasks page.
    const creator = await identity.users.findById(userId);
    const companyId = tasksShared.resolveTaskCompany(ws, creator) || message.company || null;
    if (ws) {
        const plansSvc = require('../../shared/plans/planService');
        await plansSvc.enforce(plansSvc.assertCanCreateTasks(ws, userId, plansSvc.taskAddsFor(userId, assignedTo)));
    }
    // Tasks.create assigns the next issue key on whichever store holds tasks (TASKS_STORE).
    const Tasks = require('../../features/tasks/tasks.query');
    const task = await Tasks.create({
        title,
        description:   typeof taskData.description === 'string' ? taskData.description.slice(0, 10000) : '',
        dueDate,
        priority:      normalizePriority(taskData.priority),
        status:        'todo',
        company:       companyId,
        workspace:     workspaceId,
        channel:       message.channel ? (message.channel._id || message.channel) : null,
        taskType:      workspaceId ? 'workspace' : 'personal',
        visibility:    'private',
        createdBy:     userId,
        assignedTo,
        linkedMessage: message._id,
        linkedDM:      message.dm || null,
        source:        'manual',
    });

    await Message.findByIdAndUpdate(messageId, { $set: { linkedTaskId: task._id } });

    try {
        const Tasks = require('../../features/tasks/tasks.query');
        await Tasks.logActivity({
            task: task._id,
            user: userId,
            action: 'created',
            metadata: { source: 'message', messageId: String(message._id), visibility: 'private' },
        });
    } catch (err) {
        logger.warn({ err }, '[convertToTask] activity not recorded');
    }

    // The thread shows "Task created: …" and the task's discussion links back to the thread.
    require('../../features/tasks/tasks.discussion')
        .linkTaskToThread({ task, message, userId, io })
        .catch(() => {});

    const room = roomFor(message);
    if (io && room) {
        io.to(room).emit('message:task_created', {
            messageId,
            taskId:    task._id,
            taskTitle: task.title,
        });
    }

    if (io) {
        const payload = await tasksShared.loadTaskForClient(task._id).catch(() => null);
        await tasksShared.emitToTaskAudience(io, task, 'task-created', payload || task);
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
        .populate('channel', 'name')
        .lean()
        .then((rows) => hydrate(rows, { sender: SENDER_MIN }));
}

module.exports = {
    createMessage,
    _fireMessageSentWebhook: fireMessageSentWebhook,
    _emitMessageSentAutomation: emitMessageSentAutomation,
    fetchMessages,
    findOrCreateDMSession,
    getUserDMSessions,
    getChannelUnreadCounts,
    getChannelLastMessages,
    messagePreviewLabel,
    getWorkspaceUnreadCounts,
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
