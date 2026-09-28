'use strict';

/**
 * Workspace membership checks shared by feature routes.
 *
 *   isValidId(id)                          -> boolean (24-hex ObjectId)
 *   getWorkspaceMembership(wsId, userId)   -> { workspace, member, role, isAdmin } | { workspace, member:null } | null
 *   assertWorkspaceMember(wsId, userId, { adminOnly }) -> same as above, throws HttpError(400/403/404)
 *   requireWorkspaceAccess({ from, adminOnly, optional }) -> express middleware; sets
 *       req.workspaceAccess = { workspaceId, workspace, role, isAdmin }
 *
 * Only members whose status is 'active' count. Errors are always { message }.
 */

const mongoose = require('mongoose');

function isValidId(id) {
    if (id == null) return false;
    const s = String(id);
    return /^[a-f0-9]{24}$/i.test(s) && mongoose.Types.ObjectId.isValid(s);
}

class HttpError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.statusCode = status;
        if (code) this.code = code;
    }
}

function userIdOf(reqUser) {
    if (!reqUser) return null;
    if (typeof reqUser === 'string') return reqUser;
    return String(reqUser.sub || reqUser._id || reqUser.id || '');
}

function memberUserId(m) {
    return String(m?.user?._id || m?.user || '');
}

async function getWorkspaceMembership(workspaceId, userId) {
    const Workspace = require('../../../models/Workspace');
    const ws = await Workspace.findOne({ _id: workspaceId, isActive: { $ne: false } })
        .select('name members settings createdBy company')
        .lean();
    if (!ws) return null;
    const uid = String(userId);
    const member = (ws.members || []).find(m => memberUserId(m) === uid && (m.status || 'active') === 'active') || null;
    const role = member ? member.role : null;
    return { workspace: ws, member, role, isAdmin: role === 'owner' || role === 'admin' };
}

async function assertWorkspaceMember(workspaceId, userId, { adminOnly = false } = {}) {
    if (!workspaceId) throw new HttpError(400, 'workspaceId is required');
    if (!isValidId(workspaceId)) throw new HttpError(400, 'Invalid workspaceId');
    const access = await getWorkspaceMembership(workspaceId, userId);
    if (!access) throw new HttpError(404, 'Workspace not found');
    if (!access.member) throw new HttpError(403, 'You are not a member of this workspace', 'WORKSPACE_ACCESS_DENIED');
    if (adminOnly && !access.isAdmin) throw new HttpError(403, 'Workspace admin or owner required', 'INSUFFICIENT_WORKSPACE_ROLE');
    return access;
}

/** Ids of active workspaces the user is an active member of. */
async function memberWorkspaceIds(userId) {
    const Workspace = require('../../../models/Workspace');
    const rows = await Workspace.find({
        isActive: { $ne: false },
        members: { $elemMatch: { user: userId, status: 'active' } },
    }).select('_id').lean();
    return rows.map(r => String(r._id));
}

function defaultFrom(req) {
    return req.params?.workspaceId || req.body?.workspaceId || req.query?.workspaceId || null;
}

function requireWorkspaceAccess({ from = defaultFrom, adminOnly = false, optional = false } = {}) {
    return async (req, res, next) => {
        try {
            const workspaceId = from(req);
            if (!workspaceId && optional) return next();
            const access = await assertWorkspaceMember(workspaceId, userIdOf(req.user), { adminOnly });
            req.workspaceAccess = { workspaceId: String(workspaceId), ...access };
            return next();
        } catch (err) {
            return sendAccessError(res, err, next);
        }
    };
}

function sendAccessError(res, err, next) {
    if (err instanceof HttpError) {
        const body = { message: err.message };
        if (err.code) body.code = err.code;
        return res.status(err.status).json(body);
    }
    if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
    if (next) return next(err);
    return res.status(500).json({ message: 'An unexpected error occurred' });
}

/** Personal socket room used by chatHandlers (`user_<id>`). */
function userRoom(userId) {
    return `user_${userId}`;
}

module.exports = {
    isValidId,
    HttpError,
    userIdOf,
    getWorkspaceMembership,
    assertWorkspaceMember,
    memberWorkspaceIds,
    requireWorkspaceAccess,
    sendAccessError,
    userRoom,
};
