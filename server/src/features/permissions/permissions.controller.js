// server/src/features/permissions/permissions.controller.js
'use strict';

const permissionsService = require('./permissions.service');
const WorkspacePermission = require('../../models/WorkspacePermission');
const AuditLog = require('../../../models/AuditLog');
const { handleError } = require('../../../utils/responseHelpers');

/**
 * GET /api/permissions/matrix?companyId=
 * Returns the full role → permission matrix for a company.
 */
exports.getMatrix = async (req, res) => {
    try {
        const companyId = req.query.companyId || req.user?._dbUser?.companyId || req.companyId;
        if (!companyId) return res.status(400).json({ message: 'companyId is required' });

        const matrix = await permissionsService.getMatrix(companyId);
        return res.json({ matrix, companyId });
    } catch (err) {
        return handleError(res, err, 'GET PERMISSION MATRIX ERROR');
    }
};

/**
 * PUT /api/permissions/matrix
 * Bulk-update the role → permission matrix for a company.
 * Body: { companyId, updates: { admin: { sendMessages: true, ... } } }
 */
exports.updateMatrix = async (req, res) => {
    try {
        const { companyId, updates } = req.body;
        const userId = req.user?.sub;

        if (!companyId || !updates || typeof updates !== 'object') {
            return res.status(400).json({ message: 'companyId and updates object are required' });
        }

        const matrix = await permissionsService.updateMatrix(companyId, updates, userId);

        // Audit log
        await AuditLog.create({
            companyId, userId,
            action: 'permissions.matrix.updated',
            resource: 'Permission', details: { rolesUpdated: Object.keys(updates) },
            category: 'permissions', severity: 'warning', status: 'success'
        }).catch(() => {});

        return res.json({ message: 'Permission matrix updated', matrix });
    } catch (err) {
        return handleError(res, err, 'UPDATE PERMISSION MATRIX ERROR');
    }
};

/**
 * GET /api/permissions/workspace/:workspaceId/features
 * Returns feature toggles for a workspace.
 */
exports.getFeatureToggles = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        let perms = await WorkspacePermission.findOne({ workspace: workspaceId }).lean();

        if (!perms) {
            // Return defaults if no document exists yet
            perms = {
                featureToggles: {
                    tasks: true, notes: true, polls: true, ai: true,
                    huddles: true, fileUploads: true, reactions: true,
                    threads: true, bookmarks: true, reminders: true
                },
                channelPermissions: [],
                invitePermission: 'admin',
                channelCreationPermission: 'member'
            };
        }

        return res.json({
            workspaceId,
            featureToggles: perms.featureToggles,
            channelPermissions: perms.channelPermissions,
            invitePermission: perms.invitePermission,
            channelCreationPermission: perms.channelCreationPermission
        });
    } catch (err) {
        return handleError(res, err, 'GET FEATURE TOGGLES ERROR');
    }
};

/**
 * PUT /api/permissions/workspace/:workspaceId/features
 * Update feature toggles for a workspace.
 * Body: { featureToggles: { tasks: true, polls: false, ... }, invitePermission?, channelCreationPermission? }
 */
exports.updateFeatureToggles = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { featureToggles, invitePermission, channelCreationPermission } = req.body;
        const userId = req.user?.sub;
        const companyId = req.user?._dbUser?.companyId || null;

        const updateData = { updatedBy: userId };
        if (featureToggles) updateData.featureToggles = featureToggles;
        if (invitePermission) updateData.invitePermission = invitePermission;
        if (channelCreationPermission) updateData.channelCreationPermission = channelCreationPermission;

        const updated = await WorkspacePermission.findOneAndUpdate(
            { workspace: workspaceId },
            { $set: updateData },
            { upsert: true, new: true, runValidators: true }
        );

        // Audit log + realtime notification
        await AuditLog.create({
            companyId, userId,
            action: 'permissions.features.updated',
            resource: 'WorkspacePermission', resourceId: workspaceId,
            details: { featureToggles, invitePermission, channelCreationPermission },
            category: 'permissions', severity: 'info', status: 'success'
        }).catch(() => {});

        // Broadcast realtime so all workspace clients re-check toggles
        const io = req.app?.get('io');
        if (io) {
            io.to(`workspace:${workspaceId}`).emit('permissions:updated', {
                workspaceId,
                featureToggles: updated.featureToggles,
                updatedBy: userId
            });
        }

        return res.json({ message: 'Feature toggles updated', permissions: updated });
    } catch (err) {
        return handleError(res, err, 'UPDATE FEATURE TOGGLES ERROR');
    }
};

/**
 * GET /api/permissions/audit-logs
 * Paginated, filtered audit log reader (admins+).
 * Query: companyId, category, severity, userId, page, limit, from, to
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const AuditLog = require('../../../models/AuditLog');
        const { companyId, category, severity, actorId, page = 1, limit = 50, from, to } = req.query;

        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (category) filter.category = category;
        if (severity) filter.severity = severity;
        if (actorId) filter.userId = actorId;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const cap = Math.min(parseInt(limit), 200);
        const skip = (parseInt(page) - 1) * cap;

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(cap)
                .populate('userId', 'username email profilePicture')
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        return res.json({
            logs,
            pagination: { page: parseInt(page), limit: cap, total, pages: Math.ceil(total / cap) }
        });
    } catch (err) {
        return handleError(res, err, 'GET AUDIT LOGS ERROR');
    }
};
