const { recordAdminAction } = require('../../shared/adminAudit');
const identity = require('../../identity');
const { handleError } = require('../../../utils/responseHelpers');

// Defaults the old Mongo model filled in; PostgreSQL stores only what was set.
const DEFAULT_TOGGLES = { tasks: true, notes: true, polls: true, ai: true, huddles: true, fileUploads: true, reactions: true, threads: true, bookmarks: true, reminders: true };
const ROLES = ['owner', 'admin', 'member'];

/** The permissions record as clients knew it: every toggle present, ids as strings. */
function present(perms, workspace) {
  const p = perms || {};
  return {
    workspace: String(p.workspace || workspace._id),
    company: p.company || workspace.company || null,
    channelPermissions: p.channelPermissions || [],
    featureToggles: { ...DEFAULT_TOGGLES, ...(p.featureToggles || {}) },
    invitePermission: p.invitePermission || 'admin',
    channelCreationPermission: p.channelCreationPermission || 'member',
    updatedBy: p.updatedBy || null,
    updatedAt: p.updatedAt || null,
  };
}

exports.getPermissions = async (req, res) => {
  try {
    const workspaceId = req.params.id;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // Access was checked by the route (workspace member or company admin).
    if (!req.workspaceRole) return res.status(403).json({ message: 'Not a workspace member' });

    let perms = await identity.workspacePermissions.get(workspaceId);
    if (!perms) {
      perms = await identity.workspacePermissions.upsert(workspaceId, { company: workspace.company || null });
    }

    return res.json({ permissions: present(perms, workspace) });
  } catch (err) {
    return handleError(res, err, 'GET PERMISSIONS ERROR');
  }
};

exports.updatePermissions = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    if (!['admin', 'owner'].includes(req.workspaceRole)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { channelPermissions, featureToggles, invitePermission, channelCreationPermission } = req.body;

    // The Mongo schema enforced these enums (runValidators); keep rejecting bad values.
    if (invitePermission !== undefined && !ROLES.includes(invitePermission)) {
      return res.status(400).json({ message: 'invitePermission must be owner, admin or member' });
    }
    if (channelCreationPermission !== undefined && !ROLES.includes(channelCreationPermission)) {
      return res.status(400).json({ message: 'channelCreationPermission must be owner, admin or member' });
    }
    if (channelPermissions !== undefined && !Array.isArray(channelPermissions)) {
      return res.status(400).json({ message: 'channelPermissions must be an array' });
    }
    if (featureToggles !== undefined && (featureToggles === null || typeof featureToggles !== 'object')) {
      return res.status(400).json({ message: 'featureToggles must be an object' });
    }

    const updatedRow = await identity.workspacePermissions.upsert(workspaceId, {
      company: workspace.company || null,
      ...(channelPermissions !== undefined && { channelPermissions }),
      ...(featureToggles !== undefined && { featureToggles }),
      ...(invitePermission !== undefined && { invitePermission }),
      ...(channelCreationPermission !== undefined && { channelCreationPermission }),
      updatedBy: userId,
    });
    if (featureToggles !== undefined) require('../../shared/workspaceFeatures').invalidateWorkspaceFeatures(workspaceId);
    const updated = present(updatedRow, workspace);

    const io = req.app?.get('io');
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('workspace-permissions-updated', {
        workspaceId,
        permissions: updated
      });
    }

    await recordAdminAction({
      userId, companyId: workspace.company, action: 'workspace.permissions_updated', category: 'permissions', severity: 'warning',
      resourceType: 'Workspace', resourceId: workspace._id, resourceName: workspace.name,
      details: { fields: Object.keys(req.body || {}) }, req,
    });

    return res.json({ message: 'Permissions updated', permissions: updated });
  } catch (err) {
    return handleError(res, err, 'UPDATE PERMISSIONS ERROR');
  }
};

exports.getFeatureToggles = async (req, res) => {
  try {
    const workspaceId = req.params.id;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // Access was checked by the route (workspace member or company admin).
    if (!req.workspaceRole) return res.status(403).json({ message: 'Not a workspace member' });

    const perms = await identity.workspacePermissions.get(workspaceId);
    return res.json({ featureToggles: { ...DEFAULT_TOGGLES, ...(perms?.featureToggles || {}) } });
  } catch (err) {
    return handleError(res, err, 'GET FEATURE TOGGLES ERROR');
  }
};

exports.updateFeatureToggles = async (req, res) => {
  try {
    require('../../shared/workspaceFeatures').invalidateWorkspaceFeatures(req.params.workspaceId || req.params.id);
    const workspaceId = req.params.id;
    const userId = req.user?.sub;

    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    if (!['admin', 'owner'].includes(req.workspaceRole)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { featureToggles } = req.body;
    if (!featureToggles || typeof featureToggles !== 'object') {
      return res.status(400).json({ message: 'featureToggles object is required' });
    }

    const updatedRow = await identity.workspacePermissions.upsert(workspaceId, {
      company: workspace.company || null,
      featureToggles,
      updatedBy: userId,
    });
    const toggles = { ...DEFAULT_TOGGLES, ...(updatedRow?.featureToggles || {}) };

    const io = req.app?.get('io');
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('workspace-features-updated', {
        workspaceId,
        featureToggles: toggles
      });
    }

    await recordAdminAction({
      userId, companyId: workspace.company, action: 'workspace.features_updated', category: 'permissions', severity: 'warning',
      resourceType: 'Workspace', resourceId: workspace._id, resourceName: workspace.name,
      details: { featureToggles }, req,
    });

    return res.json({ message: 'Feature toggles updated', featureToggles: toggles });
  } catch (err) {
    return handleError(res, err, 'UPDATE FEATURE TOGGLES ERROR');
  }
};
