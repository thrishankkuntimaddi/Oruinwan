// server/src/features/workspace-permissions/workspace-permissions.controller.js
const WorkspacePermission = require('../../models/WorkspacePermission');
const Workspace = require('../../../models/Workspace');
const { handleError } = require('../../../utils/responseHelpers');

/**
 * GET /api/workspaces/:id/permissions
 * Retrieve the permission config for a workspace.
 * Creates a default record if one doesn't exist yet.
 */
exports.getPermissions = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    let perms = await WorkspacePermission.findOne({ workspace: workspaceId });

    if (!perms) {
      // Auto-create defaults on first access
      perms = await WorkspacePermission.create({
        workspace: workspaceId,
        company: workspace.company || null
      });
    }

    return res.json({ permissions: perms });
  } catch (err) {
    return handleError(res, err, 'GET PERMISSIONS ERROR');
  }
};

/**
 * PUT /api/workspaces/:id/permissions
 * Update workspace permissions (admin/owner only).
 */
exports.updatePermissions = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { channelPermissions, featureToggles, invitePermission, channelCreationPermission } = req.body;

    const updated = await WorkspacePermission.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          ...(channelPermissions !== undefined    && { channelPermissions }),
          ...(featureToggles !== undefined        && { featureToggles }),
          ...(invitePermission !== undefined      && { invitePermission }),
          ...(channelCreationPermission !== undefined && { channelCreationPermission }),
          updatedBy: userId
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Emit real-time event to all workspace members
    const io = req.app?.get('io');
    if (io) {
      io.to(`workspace_${workspaceId}`).emit('workspace-permissions-updated', {
        workspaceId,
        permissions: updated
      });
    }

    return res.json({ message: 'Permissions updated', permissions: updated });
  } catch (err) {
    return handleError(res, err, 'UPDATE PERMISSIONS ERROR');
  }
};

/**
 * GET /api/workspaces/:id/features
 * Get feature toggle state for a workspace.
 */
exports.getFeatureToggles = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const isMember = workspace.members.some(m => String(m.user) === String(userId));
    if (!isMember) return res.status(403).json({ message: 'Not a workspace member' });

    const perms = await WorkspacePermission.findOne({ workspace: workspaceId }).select('featureToggles');
    const defaultToggles = { tasks: true, notes: true, polls: true, ai: true, huddles: true, fileUploads: true, reactions: true, threads: true, bookmarks: true, reminders: true };

    return res.json({ featureToggles: perms?.featureToggles || defaultToggles });
  } catch (err) {
    return handleError(res, err, 'GET FEATURE TOGGLES ERROR');
  }
};

/**
 * PUT /api/workspaces/:id/features
 * Update feature toggles for a workspace (admin/owner only).
 */
exports.updateFeatureToggles = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const member = workspace.members.find(m => String(m.user) === String(userId));
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { featureToggles } = req.body;
    if (!featureToggles || typeof featureToggles !== 'object') {
      return res.status(400).json({ message: 'featureToggles object is required' });
    }

    const updated = await WorkspacePermission.findOneAndUpdate(
      { workspace: workspaceId },
      { $set: { featureToggles, updatedBy: userId } },
      { new: true, upsert: true }
    );

    const io = req.app?.get('io');
    if (io) {
      io.to(`workspace_${workspaceId}`).emit('workspace-features-updated', {
        workspaceId,
        featureToggles: updated.featureToggles
      });
    }

    return res.json({ message: 'Feature toggles updated', featureToggles: updated.featureToggles });
  } catch (err) {
    return handleError(res, err, 'UPDATE FEATURE TOGGLES ERROR');
  }
};
