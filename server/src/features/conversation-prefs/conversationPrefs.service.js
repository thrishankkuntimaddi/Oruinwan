'use strict';

// Pinned and archived conversations in a person's chat list (docs/api/conversation-prefs.md).
// Pins are capped at MAX_PINS per workspace; pinning a chat un-archives it and archiving unpins it.

const mongoose = require('mongoose');
const ConversationPref = require('../../../models/ConversationPref');
const Channel = require('../channels/channel.model.js');
const DMSession = require('../../../models/DMSession');

const MAX_PINS = 3;

function fail(status, message, code) {
    const err = new Error(message);
    err.statusCode = status;
    if (code) err.code = code;
    return err;
}

const shape = (p) => ({
    kind: p.kind,
    id: String(p.conversation),
    pinnedAt: p.pinnedAt || null,
    archivedAt: p.archivedAt || null,
});

async function listPrefs(userId, workspaceId) {
    if (!mongoose.isValidObjectId(workspaceId)) throw fail(400, 'Invalid workspace');
    const rows = await ConversationPref.find({
        user: userId,
        workspace: workspaceId,
        $or: [{ pinnedAt: { $ne: null } }, { archivedAt: { $ne: null } }],
    }).lean();
    return rows.map(shape);
}

async function canSee(userId, workspaceId, kind, id) {
    if (kind === 'channel') return Boolean(await Channel.exists({ _id: id, workspace: workspaceId, 'members.user': userId }));
    return Boolean(await DMSession.exists({ _id: id, workspace: workspaceId, participants: userId }));
}

/** body: { workspaceId, kind: 'channel'|'dm', id, pinned?: boolean, archived?: boolean } */
async function setPref(userId, body = {}) {
    const { workspaceId, kind, id } = body;
    if (!['channel', 'dm'].includes(kind)) throw fail(400, 'kind must be channel or dm');
    if (!mongoose.isValidObjectId(workspaceId) || !mongoose.isValidObjectId(id)) throw fail(400, 'Invalid id');
    const hasPinned = typeof body.pinned === 'boolean';
    const hasArchived = typeof body.archived === 'boolean';
    if (!hasPinned && !hasArchived) throw fail(400, 'Nothing to change');
    if (!(await canSee(userId, workspaceId, kind, id))) throw fail(404, 'Conversation not found');

    const now = new Date();
    const set = {};
    if (hasPinned) {
        if (body.pinned) {
            const others = await ConversationPref.countDocuments({
                user: userId,
                workspace: workspaceId,
                conversation: { $ne: id },
                pinnedAt: { $ne: null },
            });
            if (others >= MAX_PINS) throw fail(409, `You can pin up to ${MAX_PINS} chats. Unpin one first.`, 'PIN_LIMIT');
            set.pinnedAt = now;
            set.archivedAt = null;
        } else set.pinnedAt = null;
    }
    if (hasArchived) {
        set.archivedAt = body.archived ? now : null;
        if (body.archived) set.pinnedAt = null;
    }
    const doc = await ConversationPref.findOneAndUpdate(
        { user: userId, conversation: id },
        { $set: { ...set, workspace: workspaceId, kind } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return shape(doc);
}

module.exports = { listPrefs, setPref, MAX_PINS };
