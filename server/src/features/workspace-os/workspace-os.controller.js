// server/src/features/workspace-os/workspace-os.controller.js
'use strict';

const workspaceOsService = require('./workspace-os.service');
const Workspace = require('../../../models/Workspace');
const { handleError } = require('../../../utils/responseHelpers');

const getIp = req => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
const getUa = req => req.headers['user-agent'] || '';

/**
 * POST /api/workspace-os/:id/clone
 */
exports.cloneWorkspace = async (req, res) => {
    try {
        const sourceId = req.params.id;
        const userId = req.user?.sub;
        const { name, includeMembers } = req.body;
        const companyId = req.companyId || req.user?._dbUser?.companyId || null;

        // Verify caller is in the source workspace
        const source = await Workspace.findById(sourceId).lean();
        if (!source) return res.status(404).json({ message: 'Source workspace not found' });

        const isMember = (source.members || []).some(m => String(m.user) === String(userId));
        if (!isMember) return res.status(403).json({ message: 'You are not a member of this workspace' });

        const cloned = await workspaceOsService.cloneWorkspace({
            sourceId,
            userId,
            name,
            includeMembers: !!includeMembers,
            companyId,
            ipAddress: getIp(req),
            userAgent: getUa(req)
        });

        // Realtime: notify workspace members
        const io = req.app?.get('io');
        if (io && source.company) {
            io.to(`company:${source.company}`).emit('workspace:cloned', {
                clonedId: cloned._id,
                clonedName: cloned.name,
                sourceId,
                clonedBy: userId
            });
        }

        return res.status(201).json({
            message: 'Workspace cloned successfully',
            workspace: {
                id: cloned._id,
                name: cloned.name,
                icon: cloned.icon,
                color: cloned.color,
                clonedFrom: sourceId
            }
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        return handleError(res, err, 'CLONE WORKSPACE ERROR');
    }
};

/**
 * GET /api/workspace-os/:id/export
 */
exports.exportWorkspace = async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const userId = req.user?.sub;
        const companyId = req.companyId || req.user?._dbUser?.companyId || null;

        const bundle = await workspaceOsService.exportWorkspace({
            workspaceId, userId, companyId,
            ipAddress: getIp(req), userAgent: getUa(req)
        });

        return res.json({ bundle });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        return handleError(res, err, 'EXPORT WORKSPACE ERROR');
    }
};

/**
 * POST /api/workspace-os/import
 */
exports.importWorkspace = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const companyId = req.companyId || req.user?._dbUser?.companyId || null;
        const { bundle } = req.body;

        if (!bundle) return res.status(400).json({ message: 'bundle is required in request body' });

        const imported = await workspaceOsService.importWorkspace({
            bundle, userId, companyId,
            ipAddress: getIp(req), userAgent: getUa(req)
        });

        return res.status(201).json({
            message: 'Workspace imported successfully',
            workspace: {
                id: imported._id,
                name: imported.name,
                icon: imported.icon,
                color: imported.color
            }
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        return handleError(res, err, 'IMPORT WORKSPACE ERROR');
    }
};

/**
 * GET /api/workspace-os/:id/analytics
 */
exports.getWorkspaceAnalytics = async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const userId = req.user?.sub;
        const range = Math.min(parseInt(req.query.range) || 30, 90); // cap at 90 days

        // Verify membership (already done by middleware, but keep for safety)
        const workspace = await Workspace.findById(workspaceId).select('members company').lean();
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const analytics = await workspaceOsService.getWorkspaceAnalytics({
            workspaceId,
            companyId: workspace.company,
            range
        });

        return res.json({ analytics, workspaceId });
    } catch (err) {
        return handleError(res, err, 'WORKSPACE ANALYTICS ERROR');
    }
};
