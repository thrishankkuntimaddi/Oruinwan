'use strict';

/**
 * Owner and admin controls that the workspace data model always had but no API exposed:
 *
 *   POST /api/workspaces/:id/transfer-ownership  { userId }      owner only
 *   POST /api/workspaces/:id/archive                              owner only
 *   POST /api/workspaces/:id/unarchive                            owner only (works while archived)
 *   PUT  /api/workspaces/:workspaceId/channels/:channelId/default { isDefault }   owner/admin
 *
 * plus `requireInviteRight`, which makes the "Invite members" setting
 * (settings.membersMayInvite) real: members may invite when it is on, admins always.
 */

const logger = require('../../../utils/logger');
const identity = require('../../identity');
const Channel = require('../channels/channel.model.js');
const { recordAdminAction } = require('../../shared/adminAudit');
const { isValidId, userRoom } = require('../../shared/utils/workspaceAccess');

const rooms = (id) => [`workspace:${id}`, `workspace_${id}`];
const activeMember = (ws, userId) => (ws?.members || []).find((m) => String(m.user) === String(userId) && (m.status || 'active') === 'active') || null;

function emit(req, target, event, payload) {
    const io = req.app?.get?.('io');
    if (io) io.to(target).emit(event, payload);
}

function fail(res, status, message, code) {
    return res.status(status).json({ message, ...(code ? { code } : {}) });
}

/**
 * Members may invite only when an owner or admin has turned "Members can invite people" on
 * (settings.membersMayInvite === true; their invites are always 'member'). It is off by default:
 * before this switch was enforced only admins could invite, and existing workspaces keep that.
 * Unlimited (enterprise) workspaces let everyone invite.
 */
function membersMayInvite(ws) {
    return ws?.plan === 'enterprise' || ws?.settings?.membersMayInvite === true;
}

function requireInviteRight(req, res, next) {
    const role = req.workspaceRole;
    if (role === 'owner' || role === 'admin') return next();
    if (!membersMayInvite(req.workspace)) {
        return fail(res, 403, 'Only admins can invite people to this workspace.', 'MEMBER_INVITES_OFF');
    }
    if (req.body && typeof req.body === 'object') req.body.role = 'member';
    return next();
}

exports.transferOwnership = async (req, res) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.sub;
        const targetId = String(req.body?.userId || '');
        if (!isValidId(id) || !isValidId(targetId)) return fail(res, 400, 'A valid userId is required');
        if (targetId === String(actorId)) return fail(res, 400, 'You already own this workspace');

        const workspace = await identity.workspaces.findById(id);
        if (!workspace) return fail(res, 404, 'Workspace not found');
        const actor = activeMember(workspace, actorId);
        if (!actor || actor.role !== 'owner') return fail(res, 403, 'Only the workspace owner can transfer ownership');
        if (workspace.type === 'personal') return fail(res, 400, 'A personal workspace can’t be given away');

        const target = activeMember(workspace, targetId);
        if (!target) return fail(res, 400, 'The new owner must be an active member of this workspace');

        // Owning another free workspace may be over the new owner's plan (company workspaces never count).
        if (!workspace.company) {
            try {
                await require('../../shared/plans/planService').assertCanCreateWorkspace(targetId);
            } catch (err) {
                if (err?.code === 'PLAN_LIMIT') {
                    const user = await identity.users.findById(targetId).catch(() => null);
                    return fail(res, 403, `${user?.username || 'That person'} already owns as many workspaces as their plan allows.`, 'TARGET_PLAN_LIMIT');
                }
                throw err;
            }
        }

        await identity.workspaces.updateMember(id, targetId, { role: 'owner' });
        await identity.workspaces.updateMember(id, actorId, { role: 'admin' });
        await identity.workspaces.update(id, { createdBy: targetId });

        for (const [userId, role] of [[targetId, 'owner'], [String(actorId), 'admin']]) {
            emit(req, userRoom(userId), 'workspace:role-updated', { workspaceId: String(id), userId, role });
        }
        emit(req, rooms(id), 'workspace-updated', { workspaceId: String(id), ownerId: targetId });

        await recordAdminAction({
            userId: actorId, companyId: workspace.company, action: 'workspace.ownership_transferred', category: 'workspace', severity: 'critical',
            resourceType: 'Workspace', resourceId: workspace._id, resourceName: workspace.name,
            details: { from: String(actorId), to: targetId }, req,
        });

        return res.json({ message: 'Ownership transferred', workspaceId: String(id), ownerId: targetId, yourRole: 'admin' });
    } catch (err) {
        logger.error({ err }, 'TRANSFER OWNERSHIP ERROR');
        return fail(res, 500, 'Server error');
    }
};

async function setArchived(req, res, archived) {
    try {
        const { id } = req.params;
        const actorId = req.user?.sub;
        if (!isValidId(id)) return fail(res, 400, 'Invalid workspaceId');
        const workspace = await identity.workspaces.findById(id);
        if (!workspace || workspace.isActive === false) return fail(res, 404, 'Workspace not found');
        const actor = activeMember(workspace, actorId);
        if (!actor || actor.role !== 'owner') return fail(res, 403, `Only the workspace owner can ${archived ? 'archive' : 'restore'} it`);
        if (archived && workspace.type === 'personal') return fail(res, 400, 'A personal workspace can’t be archived');
        if (!!workspace.isArchived === archived) return fail(res, 400, archived ? 'This workspace is already archived' : 'This workspace isn’t archived');

        await identity.workspaces.update(id, { isArchived: archived, archivedAt: archived ? new Date() : null });
        emit(req, rooms(id), archived ? 'workspace-archived' : 'workspace-unarchived', { workspaceId: String(id) });

        await recordAdminAction({
            userId: actorId, companyId: workspace.company, action: archived ? 'workspace.archived' : 'workspace.unarchived', category: 'workspace', severity: 'warning',
            resourceType: 'Workspace', resourceId: workspace._id, resourceName: workspace.name, req,
        });
        return res.json({ message: archived ? 'Workspace archived' : 'Workspace restored', workspaceId: String(id), isArchived: archived });
    } catch (err) {
        logger.error({ err }, archived ? 'ARCHIVE WORKSPACE ERROR' : 'UNARCHIVE WORKSPACE ERROR');
        return fail(res, 500, 'Server error');
    }
}

exports.archiveWorkspace = (req, res) => setArchived(req, res, true);
exports.unarchiveWorkspace = (req, res) => setArchived(req, res, false);

/**
 * Default channels: everyone who joins is added to them and they can't be left. Turning one on
 * adds the current active members too (keys are shared the way joining does it).
 */
exports.setDefaultChannel = async (req, res) => {
    try {
        const { workspaceId, channelId } = req.params;
        const isDefault = req.body?.isDefault;
        if (!isValidId(workspaceId) || !isValidId(channelId)) return fail(res, 400, 'Invalid id');
        if (typeof isDefault !== 'boolean') return fail(res, 400, 'isDefault must be a boolean');

        const channel = await Channel.findOne({ _id: channelId, workspace: workspaceId });
        if (!channel || channel.isArchived) return fail(res, 404, 'Channel not found');
        if (isDefault && channel.isPrivate) return fail(res, 400, 'Only public channels can be default channels');
        if (!!channel.isDefault === isDefault) return res.json({ channelId: String(channel._id), isDefault, added: 0 });

        if (!isDefault) {
            const others = await Channel.countDocuments({ workspace: workspaceId, isDefault: true, _id: { $ne: channel._id } });
            if (others === 0) return fail(res, 400, 'Keep at least one default channel so new members land somewhere');
        }

        channel.isDefault = isDefault;
        let added = 0;
        const newMembers = [];
        if (isDefault) {
            const inChannel = new Set((channel.members || []).map((m) => String(m.user || m)));
            const workspace = req.workspace || await identity.workspaces.findById(workspaceId);
            for (const m of workspace?.members || []) {
                const uid = String(m.user);
                if ((m.status || 'active') !== 'active' || inChannel.has(uid)) continue;
                channel.members.push({ user: uid, joinedAt: new Date() });
                newMembers.push(uid);
            }
            added = newMembers.length;
        }
        await channel.save();

        if (newMembers.length) {
            try {
                const keys = require('../../modules/conversations/conversationKeys.service');
                if (await keys.hasConversationKeys(channel._id, 'channel')) {
                    for (const uid of newMembers) await keys.distributeKeyToNewMember(channel._id, 'channel', uid);
                }
            } catch (err) {
                logger.warn({ err: err.message, channel: String(channel._id) }, '[Workspace] key share deferred until first unlock');
            }
        }

        const ids = await identity.workspaces.findById(workspaceId).then((w) => (w?.defaultChannels || []).map(String)).catch(() => []);
        const next = new Set(ids);
        if (isDefault) next.add(String(channel._id)); else next.delete(String(channel._id));
        await identity.workspaces.update(workspaceId, { defaultChannels: [...next] });

        emit(req, rooms(workspaceId), 'channel-updated', { channelId: String(channel._id), isDefault });
        await recordAdminAction({
            userId: req.user?.sub, companyId: req.workspace?.company || null, action: isDefault ? 'channel.default_on' : 'channel.default_off', category: 'workspace', severity: 'info',
            resourceType: 'Channel', resourceId: channel._id, resourceName: channel.name, details: { added }, req,
        });
        return res.json({ channelId: String(channel._id), isDefault, added });
    } catch (err) {
        logger.error({ err }, 'SET DEFAULT CHANNEL ERROR');
        return fail(res, 500, 'Server error');
    }
};

exports.requireInviteRight = requireInviteRight;
exports.membersMayInvite = membersMayInvite;
