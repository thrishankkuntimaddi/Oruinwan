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
 * - People who are added see messages from the moment they joined (memberSince), never
 *   earlier ones. The server enforces that on every read (conversations/conversationAccess.js).
 * - People who leave or are removed lose their copy of the key, their access on the server and
 *   their live connection to the conversation at once.
 */

const DMSession = require('../../../models/DMSession');
const Message = require('./message.model.js');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const conversationKeysService = require('../conversations/conversationKeys.service');
const logger = require('../../shared/utils/logger');
const mongoose = require('mongoose');

const MAX_MEMBERS = DMSession.MAX_GROUP_DM_MEMBERS;
const PARTICIPANT_FIELDS = ['username', 'email', 'profilePicture', 'isOnline', 'userStatus'];

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
async function createGroup({ creatorId, workspaceId, memberIds, name }, io) {
    if (!mongoose.isValidObjectId(String(workspaceId))) throw fail(400, 'workspaceId is required');
    const ids = [...new Set([String(creatorId), ...(Array.isArray(memberIds) ? memberIds : []).map(String)])];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw fail(400, 'Invalid person');
    if (ids.length < 3) throw fail(400, 'A group needs at least 2 other people. For one person, start a direct message.', 'TOO_FEW');
    if (ids.length > MAX_MEMBERS) throw fail(400, `A group can have up to ${MAX_MEMBERS} people.`, 'GROUP_FULL');

    const { ws, ids: members } = await activeMemberIds(workspaceId);
    if (!ids.every((id) => members.has(id))) throw fail(403, 'Everyone must be a member of this workspace');

    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : null;
    const existing = await DMSession.findOne({ workspace: workspaceId, isGroup: true, participants: { $all: ids, $size: ids.length } });
    if (existing && !cleanName) {
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
        memberSince: ids.map((user) => ({ user, at: now })),
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

async function addMembers({ dmId, actorId, userIds }, io) {
    const session = await loadGroup(dmId, actorId);
    const current = new Set(session.participants.map(String));
    const toAdd = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter((id) => !current.has(id));
    if (toAdd.length === 0) return { session, added: [] };
    if (toAdd.some((id) => !mongoose.isValidObjectId(id))) throw fail(400, 'Invalid person');
    if (current.size + toAdd.length > MAX_MEMBERS) throw fail(400, `A group can have up to ${MAX_MEMBERS} people.`, 'GROUP_FULL');

    const { ids: members } = await activeMemberIds(session.workspace);
    if (!toAdd.every((id) => members.has(id))) throw fail(403, 'Everyone must be a member of this workspace');

    const now = new Date();
    session.participants.push(...toAdd);
    session.memberSince = (session.memberSince || []).filter((m) => !toAdd.includes(String(m.user)));
    session.memberSince.push(...toAdd.map((user) => ({ user, at: now })));
    session.hiddenFor = (session.hiddenFor || []).filter((h) => !toAdd.includes(String(h.user)));
    // Someone who left and is added back starts fresh.
    session.clearedAt = (session.clearedAt || []).filter((c) => !toAdd.includes(String(c.user)));
    await session.save();

    // New members get the existing key (like joining a channel); they only see messages from now.
    try {
        await conversationKeysService.ensureDMConversationKey(session._id);
    } catch (err) {
        logger.error({ err, dmSessionId: String(session._id) }, '[GROUP_DM][E2EE] Could not share the key with new members');
    }

    moveSockets(io, toAdd, session._id, true);
    const actorName = await usernameOf(actorId);
    for (const id of toAdd) {
        const addedName = await usernameOf(id);
        await systemLine(io, session, {
            event: 'group_member_added',
            text: `${actorName} added ${addedName}`,
            data: { userId: String(actorId), userName: actorName, addedUserId: id, addedUserName: addedName },
        });
    }
    tellPeople(io, toAdd, session._id);
    await membersUpdated(io, session);
    return { session, added: toAdd };
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

    // No more key on the server for them; the server also refuses their requests from now on.
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
