'use strict';

/**
 * Run after requireWorkspaceMember (which sets req.workspaceRole): only the
 * workspace's owners and admins may continue.
 */
module.exports = function requireWorkspaceAdmin(req, res, next) {
    if (!['owner', 'admin'].includes(req.workspaceRole)) {
        return res.status(403).json({ message: 'Only workspace owners and admins can change this setting' });
    }
    next();
};
