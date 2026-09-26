'use strict';

const permissionsService = require('./permissions.service');
const WorkspacePermission = require('../../models/WorkspacePermission');
const AuditLog = require('../../../models/AuditLog');
const { handleError } = require('../../../utils/responseHelpers');
const { scopedCompanyId } = require('../../shared/middleware/requireCompanyAdmin');

exports.getMatrix = async (req, res) => {
    try {
        // Members read their own company's matrix; the query parameter is only a hint.
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'companyId is required' });
        if (req.query.companyId && String(req.query.companyId) !== companyId) {
            return res.status(403).json({ message: 'Access denied: that company is not yours' });
        }

        const matrix = await permissionsService.getMatrix(companyId);
        return res.json({ matrix, companyId });
    } catch (err) {
        return handleError(res, err, 'GET PERMISSION MATRIX ERROR');
    }
};

exports.updateMatrix = async (req, res) => {
    try {
        const { updates } = req.body;
        const userId = req.user?.sub;
        const companyId = scopedCompanyId(req, res, req.body.companyId);
        if (res.headersSent) return undefined;

        if (!companyId || !updates || typeof updates !== 'object') {
            return res.status(400).json({ message: 'companyId and updates object are required' });
        }

        // Admins manage the roles below them; only the owner changes what admins may do.
        const touchesPrivileged = Object.keys(updates).some(role => ['owner', 'admin'].includes(role));
        if (touchesPrivileged && !req.isPlatformAdmin) {
            const actor = await require('../../../models/User').findById(userId).select('companyRole coOwnerOf companyId').lean();
            const isOwner = actor?.companyRole === 'owner'
                || (actor?.coOwnerOf && String(actor.coOwnerOf) === String(actor.companyId));
            if (!isOwner) {
                return res.status(403).json({ message: 'Only the company owner can change admin permissions' });
            }
        }

        const matrix = await permissionsService.updateMatrix(companyId, updates, userId);
        require('../../shared/companyPermissions').invalidateCompanyPermissions(companyId);

        await require('../../shared/adminAudit').recordAdminAction({
            userId, companyId, action: 'permissions.matrix.updated', category: 'permissions', severity: 'warning',
            resourceType: 'Permission', details: { rolesUpdated: Object.keys(updates) }, req,
        });

        return res.json({ message: 'Permission matrix updated', matrix });
    } catch (err) {
        return handleError(res, err, 'UPDATE PERMISSION MATRIX ERROR');
    }
};

exports.getFeatureToggles = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        let perms = await WorkspacePermission.findOne({ workspace: workspaceId }).lean();

        if (!perms) {
            
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

exports.updateFeatureToggles = async (req, res) => {
    try {
        require('../../shared/workspaceFeatures').invalidateWorkspaceFeatures(req.params.workspaceId || req.params.id);
        const { workspaceId } = req.params;
        const { featureToggles, invitePermission, channelCreationPermission } = req.body;
        const userId = req.user?.sub;
        const companyId = req.workspace?.company || null;

        const updateData = { updatedBy: userId };
        if (featureToggles) updateData.featureToggles = featureToggles;
        if (invitePermission) updateData.invitePermission = invitePermission;
        if (channelCreationPermission) updateData.channelCreationPermission = channelCreationPermission;

        const updated = await WorkspacePermission.findOneAndUpdate(
            { workspace: workspaceId },
            { $set: updateData },
            { upsert: true, new: true, runValidators: true }
        );

        
        await AuditLog.create({
            companyId, userId,
            action: 'permissions.features.updated',
            resource: 'WorkspacePermission', resourceId: workspaceId,
            details: { featureToggles, invitePermission, channelCreationPermission },
            category: 'permissions', severity: 'info', status: 'success'
        }).catch(() => {});

        
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

exports.getAuditLogs = async (req, res) => {
    try {
        const AuditLog = require('../../../models/AuditLog');
        const { category, severity, actorId, page = 1, limit = 50, from, to } = req.query;
        const companyId = scopedCompanyId(req, res, req.query.companyId);
        if (res.headersSent) return undefined;

        // Always scoped: a company admin only ever sees their own company's log.
        const filter = {};
        if (companyId) filter.companyId = companyId;
        else if (!req.isPlatformAdmin) return res.json({ logs: [], total: 0, page: 1, pages: 0 });
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
