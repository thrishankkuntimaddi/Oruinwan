'use strict';

const identity = require('../../identity');
const requireWorkspaceMember = require('./requireWorkspaceMember');
const { isValidId } = require('../utils/workspaceAccess');

/**
 * Workspace members pass exactly as with requireWorkspaceMember. In addition,
 * an owner / admin / co-owner of the company that owns the workspace passes
 * with req.workspaceRole = 'admin' (and req.viaCompanyAdmin = true), so the
 * company console can manage workspaces its admins haven't joined.
 */
async function requireWorkspaceMemberOrCompanyAdmin(req, res, next) {
    try {
        const workspaceId = req.params.workspaceId || req.params.id;
        const userId = String(req.user._id || req.user.sub);
        if (workspaceId && isValidId(workspaceId)) {
            const found = await identity.workspaces.findById(workspaceId, { activeOnly: true });
            const workspace = found && !found.isArchived ? found : null;
            if (workspace && workspace.company) {
                const isMember = (workspace.members || []).some((m) => m.user && String(m.user) === userId && m.status === 'active');
                if (!isMember) {
                    const u = await identity.users.findById(userId);
                    const coOwner = u && u.coOwnerOf && String(u.coOwnerOf) === String(u.companyId);
                    const companyAdmin = u && u.companyId && String(u.companyId) === String(workspace.company) &&
                        (['owner', 'admin'].includes(u.companyRole) || coOwner);
                    if (companyAdmin) {
                        req.workspace = workspace;
                        req.workspaceRole = 'admin';
                        req.viaCompanyAdmin = true;
                        return next();
                    }
                }
            }
        }
        return requireWorkspaceMember(req, res, next);
    } catch (err) {
        return next(err);
    }
}

module.exports = requireWorkspaceMemberOrCompanyAdmin;
