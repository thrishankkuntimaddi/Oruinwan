'use strict';

/**
 * Home → Activity: the conversations that need the user's attention in one
 * workspace — DMs and channels with unread top-level messages, with the
 * newest unread message of each as a preview.
 *
 * End-to-end encryption: previews are returned as ciphertext + IV only (the
 * client decrypts them with its own conversation key). Attachments come back
 * as a kind label ("📷 Photo"); plaintext message text is never returned.
 *
 * Unread counts use the same rules as the DM list and the channel list
 * (`getUserDMSessions`, `getChannelUnreadCounts`) so the Activity rows, the
 * panel badges and the rail badges agree.
 */

const mongoose = require('mongoose');
const Message = require('./message.model.js');
const DMSession = require('../../../models/DMSession');
const Channel = require('../../features/channels/channel.model.js');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');

const KIND_LABELS = {
    image: '📷 Photo', video: '🎬 Video', voice: '🎵 Voice note', file: '📎 File',
    poll: '📊 Poll', contact: '👤 Contact', meeting: '📅 Meeting', checklist: '☑️ Checklist',
};

const MAX_ITEMS = 50;

function httpError(status, message) {
    return Object.assign(new Error(message), { status });
}

const idOf = (v) => String(v?._id || v?.user?._id || v?.user || v || '');
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/** The unread-message rules shared with the list endpoints. */
function unreadMatch(userId) {
    const me = toObjectId(userId);
    return {
        sender: { $ne: me },
        readBy: { $ne: me },
        parentId: null,
        type: { $ne: 'system' },
        isDeleted: { $ne: true },
    };
}

/** Group unread messages per conversation: count, direct mentions, newest one. */
function unreadPipeline(match, field, userId) {
    const me = toObjectId(userId);
    return [
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: `$${field}`,
                unread: { $sum: 1 },
                mentions: { $sum: { $cond: [{ $in: [me, { $ifNull: ['$mentions', []] }] }, 1, 0] } },
                lastId: { $first: '$_id' },
                lastType: { $first: '$type' },
                lastSender: { $first: '$sender' },
                lastCreatedAt: { $first: '$createdAt' },
                lastCiphertext: { $first: '$payload.ciphertext' },
                lastIv: { $first: '$payload.messageIv' },
                lastHiddenFor: { $first: '$hiddenFor' },
                lastGone: { $first: '$isDeletedUniversally' },
            },
        },
    ];
}

/** The newest unread message as { id, senderId, type, kindLabel, preview, createdAt }. */
function lastMessageOf(row, userId) {
    const hidden = (row.lastHiddenFor || []).some(u => String(u) === String(userId));
    const gone = !!row.lastGone || hidden;
    const type = row.lastType || 'message';
    const isText = type === 'message' || type === 'integration';
    return {
        id: String(row.lastId),
        senderId: row.lastSender ? String(row.lastSender) : null,
        type,
        kindLabel: gone ? null : (KIND_LABELS[type] || null),
        preview: !gone && isText && row.lastCiphertext
            ? { ciphertext: row.lastCiphertext, messageIv: row.lastIv || null }
            : null,
        createdAt: row.lastCreatedAt || null,
    };
}

async function assertActiveMember(userId, workspaceId) {
    if (!mongoose.Types.ObjectId.isValid(String(workspaceId))) throw httpError(400, 'Invalid workspace id');
    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) throw httpError(404, 'Workspace not found');
    const member = (workspace.members || []).find(m => idOf(m.user || m) === String(userId));
    if (!member || (member.status && member.status !== 'active')) throw httpError(403, 'Not a member of this workspace');
}

async function dmActivity(userId, workspaceId) {
    const sessions = await DMSession.find({
        workspace: workspaceId,
        participants: { $in: [userId] },
        'hiddenFor.user': { $ne: userId },
    })
        .select('participants mutedBy')
        .lean();
    if (!sessions.length) return [];
    await hydrate(sessions, { participants: { type: 'user', fields: ['username', 'profilePicture', 'isOnline', 'userStatus'] } });

    const rows = await Message.aggregate(unreadPipeline(
        { dm: { $in: sessions.map(s => toObjectId(s._id)) }, ...unreadMatch(userId) },
        'dm',
        userId,
    ));
    const byId = new Map(sessions.map(s => [String(s._id), s]));
    return rows.map((row) => {
        const session = byId.get(String(row._id));
        if (!session) return null;
        const other = (session.participants || []).find(p => idOf(p) !== String(userId)) || null;
        return {
            type: 'dm',
            id: String(row._id),
            unread: row.unread,
            mentioned: false,
            muted: (session.mutedBy || []).some(m => idOf(m.user) === String(userId)),
            otherUser: other ? {
                id: idOf(other),
                username: other.username || 'User',
                profilePicture: other.profilePicture || null,
                status: other.isOnline ? (other.userStatus || 'active') : 'offline',
            } : null,
            lastMessage: lastMessageOf(row, userId),
        };
    }).filter(Boolean);
}

async function channelActivity(userId, workspaceId) {
    const channels = await Channel.find({
        workspace: workspaceId,
        'members.user': userId,
    })
        .select('name isPrivate members mutedBy')
        .lean();
    const clauses = [];
    for (const ch of channels) {
        const me = (ch.members || []).find(m => idOf(m?.user ?? m) === String(userId));
        if (!me) continue;
        const clause = { channel: toObjectId(ch._id) };
        if (me.joinedAt) clause.createdAt = { $gte: new Date(me.joinedAt) };
        clauses.push(clause);
    }
    if (!clauses.length) return [];

    const rows = await Message.aggregate(unreadPipeline({ $or: clauses, ...unreadMatch(userId) }, 'channel', userId));
    const byId = new Map(channels.map(c => [String(c._id), c]));
    return rows.map((row) => {
        const ch = byId.get(String(row._id));
        if (!ch) return null;
        return {
            type: 'channel',
            id: String(row._id),
            name: ch.name,
            isPrivate: !!ch.isPrivate,
            unread: row.unread,
            mentioned: row.mentions > 0,
            muted: (ch.mutedBy || []).some(m => idOf(m.user) === String(userId)),
            lastMessage: lastMessageOf(row, userId),
        };
    }).filter(Boolean);
}

/**
 * Unread conversations for `userId` in `workspaceId`, newest first.
 * Returns { items: [...] } (at most MAX_ITEMS).
 */
async function getWorkspaceActivity(userId, workspaceId) {
    await assertActiveMember(userId, workspaceId);
    const [dms, channels] = await Promise.all([
        dmActivity(userId, workspaceId),
        channelActivity(userId, workspaceId),
    ]);
    const items = [...dms, ...channels]
        .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0))
        .slice(0, MAX_ITEMS);

    // Channel previews name the sender.
    const senderIds = [...new Set(items.filter(i => i.type === 'channel').map(i => i.lastMessage?.senderId).filter(Boolean))];
    if (senderIds.length) {
        const users = [...(await identity.users.findManyByIds(senderIds)).values()];
        const names = new Map(users.map(u => [String(u._id), u]));
        for (const item of items) {
            const u = item.type === 'channel' ? names.get(item.lastMessage?.senderId) : null;
            if (u && item.lastMessage) {
                item.lastMessage.senderUsername = u.username || null;
                item.lastMessage.senderAvatar = u.profilePicture || null;
            }
        }
    }
    return { items };
}

module.exports = { getWorkspaceActivity, MAX_ITEMS };
