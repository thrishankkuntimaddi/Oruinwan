'use strict';

/**
 * Group DMs: a DM with 3 or more people (DMSession with isGroup: true).
 *
 * The rules (docs/CONVERSATIONS.md):
 * - A 1:1 DM never changes its people. Adding someone starts a new group; the DM stays as it is.
 * - Creating a group with exactly the same people as an unnamed group reopens that group;
 *   giving the new group a name always makes a new one.
 * - Anyone in the group can rename it, add people and leave. The group's admin (its creator)
 *   can remove someone else; when the admin leaves, the longest-standing member takes over.
 * - Whoever adds people chooses how much they see (`history`):
 *     'from_now' (default): messages from when they joined. The group gets a new key that the
 *                new people hold, and they never get the earlier ones.
 *     'earlier': also the earlier messages the person adding them can see: the same join date
 *                and the earlier keys from then on. A period whose key the server has no copy of
 *                can't be shared; their history then starts after it (the reply says so).
 *   The server enforces the join date on every read (conversations/conversationAccess.js) and
 *   the keys make it hold for encrypted content too (conversations/keyEpochs.js).
 * - "Start a new group" (createGroup with newGroup: true) always makes a separate group; the
 *   original keeps its people and history.
 * - People who leave or are removed lose their copies of the keys, their access on the server
 *   and their live connection to the conversation at once, and the group gets a new key.
 */

const DMSession = require('../../../models/DMSession');
const Message = require('./message.model.js');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const conversationKeysService = require('../conversations/conversationKeys.service');
const keyEpochs = require('../conversations/keyEpochs');
const logger = require('../../shared/utils/logger');
const mongoose = require('mongoose');

const MAX_MEMBERS = DMSession.MAX_GROUP_DM_MEMBERS;
const PARTICIPANT_FIELDS = ['username', 'email', 'profilePicture', 'isOnline', 'userStatus'];
const HISTORY = ['from_now', 'earlier'];

function fail(status, message, code) {
    return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

const idOf = (p) => String(p?._id || p);

/** "Ben, Chen and 2 others" — the group's title when nobody has named it. */
function groupDisplayName(session, viewerId) {
    if (session.name) return session.name;
    const others = (session.participants || []).filter((p) => idOf(p) !== String(viewerId));
    const names = others.map((p) => p?.username || 'Someone');
    if (names.length === 0) return 'Just you';
    // Short however big the group is: two names, then a count ("Ana, Ben and 3 others").
    if (names.length <= 2) return names.join(' and ');
    const more = names.length - 2;
    return `${names.slice(0, 2).join(', ')} and ${more} ${more === 1 ? 'other' : 'others'}`;
}

async function activeMemberIds(workspaceId) {
    const ws = await identity.workspaces.findById(workspaceId);
    if (!ws) throw fail(404, 'Workspace not found');
    return { ws, ids: new Set((ws.members || []).filter((m) => m.status !== 'removed').map((m) => String(m.user?._id || m.user))) };
}

async function usernameOf(userId) {
    const user = await identity.users.findById(userId).catch(() => null);
    return user?.username || 'Someone';
}

async function loadGroup(dmId, userId) {
    if (!mongoose.isValidObjectId(String(dmId))) throw fail(404, 'Conversation not found');
    const session = await DMSession.findById(dmId);
    if (!session) throw fail(404, 'Conversation not found');
    if (!session.isGroup) throw fail(400, 'This is not a group conversation', 'NOT_A_GROUP');
    if (!session.participants.some((p) => String(p) === String(userId))) throw fail(403, 'You are not in this conversation');
    const { isActiveWorkspaceMember } = require('../conversations/conversationAccess');
    if (!(await isActiveWorkspaceMember(session.workspace, userId))) throw fail(403, 'You are no longer a member of this workspace', 'WORKSPACE_ACCESS_DENIED');
    return session;
}

/** Joins (or leaves) the conversation's socket room on every device of these people. */
function moveSockets(io, userIds, dmId, join) {
    if (!io) return;
    for (const id of userIds) {
        for (const room of [`user:${id}`, `user_${id}`]) {
            if (join) io.in(room).socketsJoin(`dm:${dmId}`);
            else io.in(room).socketsLeave(`dm:${dmId}`);
        }
    }
}

function tellPeople(io, userIds, dmId) {
    if (!io) return;
    for (const id of userIds) io.to(`user:${id}`).emit('new-dm-session', { dmSessionId: String(dmId), isGroup: true });
}

/** A plain-text line in the conversation, e.g. "Asha added Ben". */
async function systemLine(io, session, { event, text, data }) {
    try {
        const msg = await Message.create({
            dm: session._id,
            workspace: session.workspace,
            company: session.company || null,
            type: 'system',
            systemEvent: event,
            systemData: data,
            text,
            sender: data.userId || null,
        });
        if (io) io.to(`dm:${session._id}`).emit('new-message', msg.toObject ? msg.toObject() : msg);
        return msg;
    } catch (err) {
        logger.warn({ err, dmSessionId: String(session._id) }, '[GROUP_DM] Could not post system line');
        return null;
    }
}

async function membersUpdated(io, session) {
    if (!io) return;
    const view = await describe(session, null);
    io.to(`dm:${session._id}`).emit('dm:members_updated', {
        dmSessionId: String(session._id),
        name: session.name || null,
        participants: view.participants,
    });
}

/** The group as the apps show it. */
async function describe(sessionDoc, viewerId) {
    const session = sessionDoc.toObject ? sessionDoc.toObject() : { ...sessionDoc };
    await hydrate(session, { participants: { type: 'user', fields: PARTICIPANT_FIELDS } });
    return {
        id: String(session._id),
        isGroup: !!session.isGroup,
        name: session.name || null,
        displayName: session.isGroup ? groupDisplayName(session, viewerId) : null,
        createdBy: session.createdBy ? String(session.createdBy) : null,
        workspaceId: String(session.workspace),
        participants: (session.participants || []).map((p) => ({
            _id: idOf(p),
            username: p?.username || null,
            email: p?.email || null,
            profilePicture: p?.profilePicture || null,
            isOnline: !!p?.isOnline,
            userStatus: p?.userStatus || null,
        })),
    };
}

/**
 * Creates a group DM, or reopens the one these exact people already have.
 * `memberIds` are the other people; the creator is added.
 */
async function createGroup({ creatorId, workspaceId, memberIds, name, newGroup = false }, io) {
    if (!mongoose.isValidObjectId(String(workspaceId))) throw fail(400, 'workspaceId is required');
    const ids = [...new Set([String(creatorId), ...(Array.isArray(memberIds) ? memberIds : []).map(String)])];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw fail(400, 'Invalid person');
    if (ids.length < 3) throw fail(400, 'A group needs at least 2 other people. For one person, start a direct message.', 'TOO_FEW');
    if (ids.length > MAX_MEMBERS) throw fail(400, `A group can have up to ${MAX_MEMBERS} people.`, 'GROUP_FULL');

    const { ws, ids: members } = await activeMemberIds(workspaceId);
    if (!ids.every((id) => members.has(id))) throw fail(403, 'Everyone must be a member of this workspace');

    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : null;
    const existing = await DMSession.findOne({ workspace: workspaceId, isGroup: true, participants: { $all: ids, $size: ids.length } });
    if (existing && !cleanName && !newGroup) {
        // Same people again: bring it back for the creator instead of making a duplicate.
        existing.hiddenFor = (existing.hiddenFor || []).filter((h) => String(h.user) !== String(creatorId));
        await existing.save();
        return { session: existing, created: false };
    }

    const now = new Date();
    const session = await DMSession.create({
        workspace: workspaceId,
        company: ws.company || null,
        participants: ids,
        isGroup: true,
        name: cleanName,
        createdBy: creatorId,
        memberSince: ids.map((user) => ({ user, at: now, fromKeyVersion: 1 })),
        lastMessageAt: now,
    });

    try {
        await conversationKeysService.ensureDMConversationKey(session._id);
    } catch (err) {
        logger.error({ err, dmSessionId: String(session._id) }, '[GROUP_DM][E2EE] Could not create the conversation key');
    }

    moveSockets(io, ids, session._id, true);
    const creatorName = await usernameOf(creatorId);
    await systemLine(io, session, {
        event: 'group_created',
        text: `${creatorName} created this group`,
        data: { userId: String(creatorId), userName: creatorName, name: cleanName },
    });
    tellPeople(io, ids, session._id);
    return { session, created: true };
}

/** A person's row in the group: when they joined and the first key version they may hold. */
function sinceRow(session, userId) {
    return (session.memberSince || []).find((m) => String(m.user) === String(userId)) || null;
}

/** Gives the conversation a new key held by `memberIds` (`keepOld` keep the current one). */
async function newKey(session, memberIds, keepOld, actorId) {
    const r = await keyEpochs.rotate(session._id, 'dm', { memberIds, keepOld, createdBy: actorId });
    return r.status === 'ROTATED' ? r.version : null;
}

/**
 * Adds people. `history`: 'from_now' (default) or 'earlier' (see the top of this file).
 * Returns { session, added, history: { [userId]: { since, limited } } }.
 */
async function addMembers({ dmId, actorId, userIds, history = 'from_now' }, io) {
    if (!HISTORY.includes(history)) throw fail(400, "history must be 'from_now' or 'earlier'", 'BAD_HISTORY');
    const session = await loadGroup(dmId, actorId);
    const current = new Set(session.participants.map(String));
    const toAdd = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter((id) => !current.has(id));
    if (toAdd.length === 0) return { session, added: [], history: {} };
    if (toAdd.some((id) => !mongoose.isValidObjectId(id))) throw fail(400, 'Invalid person');
    if (current.size + toAdd.length > MAX_MEMBERS) throw fail(400, `A group can have up to ${MAX_MEMBERS} people.`, 'GROUP_FULL');

    const { ids: members } = await activeMemberIds(session.workspace);
    if (!toAdd.every((id) => members.has(id))) throw fail(403, 'Everyone must be a member of this workspace');

    const now = new Date();
    let since = now;
    let fromKeyVersion = 1;
    let rotatedTo = null;
    if (history === 'earlier') {
        // What the person adding them can see: their join date and keys from then on.
        const mine = sinceRow(session, actorId);
        since = mine?.at ? new Date(mine.at) : new Date(0); // founding members of old groups: everything
        fromKeyVersion = Number(mine?.fromKeyVersion) || 1;
    } else {
        // A new key first: if that fails, nobody is added (they must not get the current key).
        try {
            rotatedTo = await newKey(session, [...current, ...toAdd], [...current], actorId);
        } catch (err) {
            logger.error({ err, dmSessionId: String(session._id) }, '[GROUP_DM][E2EE] Could not make a new key; nobody added');
            throw fail(503, "Couldn't add them securely right now. Try again in a moment.", 'KEY_ROTATION_FAILED');
        }
        fromKeyVersion = rotatedTo || 1;
    }

    session.participants.push(...toAdd);
    session.memberSince = (session.memberSince || []).filter((m) => !toAdd.includes(String(m.user)));
    session.memberSince.push(...toAdd.map((user) => ({ user, at: since, fromKeyVersion })));
    session.hiddenFor = (session.hiddenFor || []).filter((h) => !toAdd.includes(String(h.user)));
    // Someone who left and is added back starts fresh.
    session.clearedAt = (session.clearedAt || []).filter((c) => !toAdd.includes(String(c.user)));
    try {
        await session.save();
    } catch (err) {
        // Not added after all: take back the new key copies they were given.
        for (const id of toAdd) {
            await conversationKeysService.removeParticipant(session._id, 'dm', id).catch(() => {});
            await keyEpochs.removeUser(session._id, 'dm', id).catch(() => {});
        }
        throw err;
    }

    // The current key for anyone still without a copy (or a first key for the group), then the
    // earlier keys their place allows. A period whose key can't be shared moves their start later.
    try {
        await conversationKeysService.ensureDMConversationKey(session._id);
    } catch (err) {
        logger.error({ err, dmSessionId: String(session._id) }, '[GROUP_DM][E2EE] Could not share the key with new members');
    }
    const result = {};
    for (const id of toAdd) result[id] = { since, limited: false };
    if (history === 'earlier') {
        const epochs = await keyEpochs.list(session._id, 'dm').catch(() => []);
        const wanted = new Set(epochs.map((e) => e.version).filter((v) => v >= fromKeyVersion));
        let changed = false;
        for (const id of toAdd) {
            const g = await keyEpochs.grant(session._id, 'dm', id, { versions: wanted }).catch(() => ({ unavailable: [...wanted] }));
            // No public key yet: they get the keys when they set up encryption (grantEntitled).
            const hasKey = await conversationKeysService.publicKeys.findByUserId(id).then((k) => Boolean(k?.publicKey)).catch(() => false);
            if (!g.unavailable.length || !hasKey) continue;
            const last = Math.max(...g.unavailable);
            const lost = epochs.find((e) => e.version === last);
            const row = sinceRow(session, id);
            const after = lost?.retiredAt ? new Date(lost.retiredAt) : now;
            if (row && after > row.at) {
                row.at = after;
                row.fromKeyVersion = last + 1;
                result[id] = { since: after, limited: true };
                changed = true;
            }
        }
        if (changed) await session.save();
    }

    if (rotatedTo) keyEpochs.announce(io, session._id, 'dm', rotatedTo);
    moveSockets(io, toAdd, session._id, true);
    const actorName = await usernameOf(actorId);
    for (const id of toAdd) {
        const addedName = await usernameOf(id);
        await systemLine(io, session, {
            event: 'group_member_added',
            text: `${actorName} added ${addedName}`,
            data: { userId: String(actorId), userName: actorName, addedUserId: id, addedUserName: addedName, history },
        });
    }
    tellPeople(io, toAdd, session._id);
    await membersUpdated(io, session);
    return { session, added: toAdd, history: result };
}

/** Removes `userId` from the group; `actorId === userId` means they left. */
async function removeMember({ dmId, actorId, userId }, io) {
    const session = await loadGroup(dmId, actorId);
    const target = String(userId);
    const leaving = target === String(actorId);
    if (!session.participants.some((p) => String(p) === target)) throw fail(404, 'That person is not in this conversation');
    if (!leaving && String(session.createdBy) !== String(actorId)) {
        throw fail(403, 'Only the person who created the group can remove people', 'NOT_CREATOR');
    }

    const actorName = await usernameOf(actorId);
    const targetName = leaving ? actorName : await usernameOf(target);
    // The line is posted before they leave, so their last view shows it too.
    await systemLine(io, session, leaving
        ? { event: 'group_member_left', text: `${actorName} left`, data: { userId: String(actorId), userName: actorName } }
        : { event: 'group_member_removed', text: `${actorName} removed ${targetName}`, data: { userId: String(actorId), userName: actorName, removedUserId: target, removedUserName: targetName } });

    session.participants = session.participants.filter((p) => String(p) !== target);
    session.memberSince = (session.memberSince || []).filter((m) => String(m.user) !== target);
    session.mutedBy = (session.mutedBy || []).filter((m) => String(m.user) !== target);
    // The admin left: the person who has been in the group longest takes over.
    let newAdmin = null;
    if (String(session.createdBy) === target && session.participants.length > 0) {
        const since = (id) => {
            const row = (session.memberSince || []).find((m) => String(m.user) === String(id));
            return row?.at ? new Date(row.at).getTime() : 0; // founding members of old groups: 0
        };
        newAdmin = [...session.participants].map(String).sort((a, b) => since(a) - since(b))[0];
        session.createdBy = newAdmin;
    }
    await session.save();

    // No more keys on the server for them; the server also refuses their requests from now on.
    // The group gets a new key, so what is said next can't be opened with a key they kept.
    await require('../conversations/conversationRooms').rotateWithout(io, session._id, 'dm', target);
    try {
        await conversationKeysService.removeParticipant(session._id, 'dm', target);
    } catch (err) {
        logger.warn({ err, dmSessionId: String(session._id) }, '[GROUP_DM][E2EE] Could not remove the key copy');
    }

    if (newAdmin) {
        const adminName = await usernameOf(newAdmin);
        await systemLine(io, session, {
            event: 'group_admin_changed',
            text: `${adminName} now manages the group`,
            data: { userId: String(newAdmin), userName: adminName },
        });
    }

    moveSockets(io, [target], session._id, false);
    if (io) io.to(`user:${target}`).emit('dm:removed', { dmSessionId: String(session._id), left: leaving });
    tellPeople(io, [target], session._id);
    await membersUpdated(io, session);
    return { session };
}

async function rename({ dmId, actorId, name }, io) {
    const session = await loadGroup(dmId, actorId);
    const clean = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : null;
    if ((session.name || null) === clean) return { session };
    session.name = clean;
    await session.save();
    const actorName = await usernameOf(actorId);
    await systemLine(io, session, {
        event: 'group_renamed',
        text: clean ? `${actorName} named the group “${clean}”` : `${actorName} removed the group name`,
        data: { userId: String(actorId), userName: actorName, name: clean },
    });
    await membersUpdated(io, session);
    return { session };
}

/** When this person joined the group (null for 1:1 DMs or founding members of old data). */
function memberSinceFor(session, userId) {
    if (!session?.isGroup) return null;
    const row = (session.memberSince || []).find((m) => String(m.user) === String(userId));
    return row?.at || null;
}

module.exports = {
    MAX_MEMBERS,
    groupDisplayName,
    describe,
    createGroup,
    addMembers,
    removeMember,
    rename,
    memberSinceFor,
};
