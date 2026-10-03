'use strict';
const logger = require('../../../utils/logger');

const identity = require('../../identity');
const securityQueries = require('../../identity/queries/security');
const { hydrate, USER_MIN } = require('../../identity/hydrate');
const AuditLog = require('../../../models/AuditLog');
const { clearRefreshTokenCookie } = require('../../../utils/cookieHelper');
const { isValidId, assertWorkspaceMember, sendAccessError } = require('../../shared/utils/workspaceAccess');
const { eraseAccount, ErasureError } = require('./accountErasure');

const PLATFORM_ADMIN_ROLES = ['chttrix_admin', 'platform-admin'];
const COMPANY_ADMIN_ROLES = ['owner', 'admin'];
const SECRET_FIELDS = ['passwordHash', 'twoFactorSecret', 'tokens', 'deviceTokens', 'refreshToken'];

function audit(req, fields) {
  return AuditLog.create({
    userId: req.user.sub,
    resource: 'User',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    category: 'security',
    severity: 'info',
    ...fields,
  }).catch((err) => logger.warn({ err: err.message, action: fields.action }, '[GDPR] audit write failed'));
}

/**
 * May `actorId` manage (view/set legal hold on) `target`? Platform staff always; company
 * owners/admins/co-owners only for users of their own company. Loaded from the DB, never the JWT.
 */
async function canManageUser(actorId, target) {
  const actor = await identity.users.findById(actorId);
  if (!actor) return false;
  if (Array.isArray(actor.roles) && actor.roles.some(r => PLATFORM_ADMIN_ROLES.includes(r))) return true;
  if (!actor.companyId || !target?.companyId) return false;
  if (String(actor.companyId) !== String(target.companyId)) return false;
  const isCoOwner = actor.coOwnerOf && String(actor.coOwnerOf) === String(actor.companyId);
  return COMPANY_ADMIN_ROLES.includes(actor.companyRole) || !!isCoOwner;
}

/** User with the flat legal-hold fields and legalHoldSetBy resolved to { _id, username }. */
async function loadWithLegalHold(userId) {
  const user = await identity.users.findById(userId);
  if (!user) return null;
  const flat = { ...user, ...securityQueries.legalHoldOf(user) };
  await hydrate(flat, { legalHoldSetBy: USER_MIN });
  return flat;
}

function legalHoldView(userId, user) {
  return {
    userId: String(userId),
    legalHold: user.legalHold || false,
    reason: user.legalHold ? (user.legalHoldReason || null) : null,
    setBy: user.legalHold && user.legalHoldSetBy
      ? { _id: user.legalHoldSetBy._id || user.legalHoldSetBy, username: user.legalHoldSetBy.username || null }
      : null,
    setAt: user.legalHold ? (user.legalHoldAt || null) : null,
  };
}

// ---------------------------------------------------------------------------
// Personal data export
// ---------------------------------------------------------------------------

/**
 * GET /api/compliance/export-user -> JSON download:
 *   { exportedAt, format, profile, preferences, emails, workspaces[{id,name,role}], tasks, notes,
 *     aiMemories, notificationPreferences{account,workspaces}, auditLogs (last 500) }
 */
exports.exportUser = async (req, res) => {
  try {
    const userId = req.user.sub;
    const ident = await securityQueries.identityExport(userId);
    if (!ident) return res.status(404).json({ message: 'User not found' });
    const user = ident.user;

    const Tasks = require('../tasks/tasks.query');
    const Note = require('../../../models/Note');
    const AIMemory = require('../../models/AIMemory');
    const NotificationPreference = require('../../modules/notifications/notificationPreference.model');
    const { serializePreferences } = require('../auth/auth.controller');

    const [tasks, notes, aiMemories, workspaceNotificationPrefs, auditLogs] = await Promise.all([
      Tasks.find({ $or: [{ createdBy: userId }, { assignedTo: userId }] }),
      Note.find({ owner: userId }).lean(),
      AIMemory.find({ user: userId }).select('text workspace source createdAt updatedAt').lean(),
      NotificationPreference.find({ userId }).lean(),
      AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    ]);

    const profile = { ...user };
    for (const f of SECRET_FIELDS) delete profile[f];
    delete profile.preferences;
    if (profile.encryption) profile.encryption = { publicKey: profile.encryption.publicKey || null };

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: 'oruinwan-personal-export-v1',
      profile,
      preferences: serializePreferences(user.preferences),
      emails: ident.emails,
      workspaces: ident.workspaces,
      departments: ident.departments,
      teams: ident.teams,
      sessions: ident.sessions,
      devices: ident.devices,
      identityKey: ident.identityKey,
      tasks,
      notes,
      aiMemories,
      notificationPreferences: {
        account: serializePreferences(user.preferences).notifications,
        workspaces: workspaceNotificationPrefs,
      },
      auditLogs,
    };

    await audit(req, {
      action: 'compliance.export_user',
      resourceId: userId,
      description: 'User requested personal data export',
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="oruinwan-data-export-${Date.now()}.json"`);
    return res.json(exportData);
  } catch (err) {
    logger.error('[GDPR] export-user error:', err);
    return res.status(500).json({ message: 'Failed to export user data' });
  }
};

// ---------------------------------------------------------------------------
// Erasure
// ---------------------------------------------------------------------------

/**
 * Shared by DELETE /api/compliance/delete-user and DELETE /api/users/me.
 * 200 { message, erased: true } and the auth cookie is cleared;
 * 403 { message, code: 'COMPANY_MANAGED' | 'LEGAL_HOLD', reason? }; 404 when the user is gone.
 */
async function eraseAndRespond(req, res) {
  try {
    await eraseAccount(req.user.sub, { req });
    clearRefreshTokenCookie(res);
    return res.json({ message: 'Your account and personal data have been erased.', erased: true });
  } catch (err) {
    if (err instanceof ErasureError) {
      return res.status(err.status).json({ message: err.message, ...err.extra });
    }
    logger.error('[GDPR] delete-user error:', err);
    return res.status(500).json({ message: 'Failed to delete account' });
  }
}

exports.eraseAndRespond = eraseAndRespond;
exports.deleteUser = eraseAndRespond;

// ---------------------------------------------------------------------------
// Workspace export (admins/owners only)
// ---------------------------------------------------------------------------

/**
 * GET /api/compliance/export?workspaceId=<id> -> JSON download
 *   { exportedAt, workspace{id,name,members[{userId,username,role}]}, channels, tasks, notes }
 * Notes: public workspace notes and the caller's own. Messages are end-to-end encrypted and
 * are not included.
 */
exports.exportWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const userId = req.user.sub;
    let access;
    try {
      access = await assertWorkspaceMember(workspaceId, userId, { adminOnly: true });
    } catch (err) {
      return sendAccessError(res, err);
    }

    const Tasks = require('../tasks/tasks.query');
    const Note = require('../../../models/Note');
    const Channel = require('../channels/channel.model');

    const [workspace, channels, tasks, notes] = await Promise.all([
      identity.workspaces.findById(workspaceId).then((ws) => hydrate(ws, { 'members.user': USER_MIN })),
      Channel.find({ workspace: workspaceId }).select('name description isPrivate isDefault members.user createdAt').lean(),
      Tasks.find({ workspace: workspaceId, deleted: { $ne: true } }),
      Note.find({ workspace: workspaceId, $or: [{ isPublic: true }, { owner: userId }] }).lean(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: 'oruinwan-workspace-export-v1',
      workspace: {
        id: String(workspaceId),
        name: workspace?.name || access.workspace?.name,
        members: (workspace?.members || []).map(m => ({
          userId: String(m.user?._id || m.user || ''),
          username: m.user?.username || null,
          role: m.role,
          status: m.status || 'active',
        })),
      },
      channels: channels.map(c => ({
        id: String(c._id),
        name: c.name,
        description: c.description || '',
        isPrivate: !!c.isPrivate,
        isDefault: !!c.isDefault,
        memberCount: (c.members || []).length,
        createdAt: c.createdAt,
      })),
      tasks,
      notes,
    };

    await audit(req, {
      action: 'compliance.export_workspace',
      resource: 'Workspace',
      resourceId: workspaceId,
      description: 'Workspace data export by admin',
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-export-${workspaceId}-${Date.now()}.json"`);
    return res.json(exportData);
  } catch (err) {
    logger.error('[GDPR] export-workspace error:', err);
    return res.status(500).json({ message: 'Failed to export workspace data' });
  }
};

// ---------------------------------------------------------------------------
// Legal hold
// ---------------------------------------------------------------------------

/** GET /api/compliance/legal-hold/me -> { userId, legalHold, reason, setBy, setAt } */
exports.getMyLegalHold = async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await loadWithLegalHold(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(legalHoldView(userId, user));
  } catch (err) {
    logger.error('[GDPR] get-my-legal-hold error:', err);
    return res.status(500).json({ message: 'Failed to fetch legal hold status' });
  }
};

/** GET /api/compliance/legal-hold/:userId — self, or an admin who manages that user. */
exports.getLegalHold = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === 'me' || String(userId) === String(req.user.sub)) return exports.getMyLegalHold(req, res);
    if (!isValidId(userId)) return res.status(400).json({ message: 'Invalid user id' });

    const user = await loadWithLegalHold(userId);
    // Same 403 for "not found" and "not yours" so ids cannot be probed.
    if (!user || !(await canManageUser(req.user.sub, user))) {
      return res.status(403).json({ message: 'Access denied: only an administrator who manages this user can view their legal hold' });
    }
    return res.json(legalHoldView(userId, user));
  } catch (err) {
    logger.error('[GDPR] get-legal-hold error:', err);
    return res.status(500).json({ message: 'Failed to fetch legal hold status' });
  }
};

/** PATCH /api/compliance/legal-hold/:userId { legalHold: boolean, reason? } — admins who manage that user only. */
exports.setLegalHold = async (req, res) => {
  try {
    const { userId } = req.params;
    const { legalHold, reason } = req.body || {};
    if (!isValidId(userId)) return res.status(400).json({ message: 'Invalid user id' });
    if (typeof legalHold !== 'boolean') {
      return res.status(400).json({ message: 'legalHold must be a boolean' });
    }
    if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 500)) {
      return res.status(400).json({ message: 'reason must be a string of at most 500 characters' });
    }

    const target = await identity.users.findById(userId);
    if (!target || !(await canManageUser(req.user.sub, target))) {
      return res.status(403).json({ message: 'Access denied: only an administrator who manages this user can set a legal hold' });
    }

    const updated = await securityQueries.setLegalHold(userId, { enabled: legalHold, reason, setBy: req.user.sub });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    const user = await loadWithLegalHold(userId);

    await audit(req, {
      action: legalHold ? 'compliance.legal_hold_set' : 'compliance.legal_hold_removed',
      resourceId: userId,
      description: `Legal hold ${legalHold ? 'set' : 'removed'} on user ${userId}${reason ? `: ${reason}` : ''}`,
      severity: legalHold ? 'warning' : 'info',
    });

    return res.json({ message: `Legal hold ${legalHold ? 'set' : 'removed'}`, ...legalHoldView(userId, user) });
  } catch (err) {
    logger.error('[GDPR] set-legal-hold error:', err);
    return res.status(500).json({ message: 'Failed to update legal hold' });
  }
};

// ---------------------------------------------------------------------------
// Own audit log and retention
// ---------------------------------------------------------------------------

exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, from, to } = req.query;
    const cap = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * cap;

    const filter = { userId: req.user.sub };
    if (action && typeof action === 'string') filter.action = action;
    if (from || to) {
      filter.createdAt = {};
      if (from && !isNaN(new Date(from))) filter.createdAt.$gte = new Date(from);
      if (to && !isNaN(new Date(to))) filter.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cap).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      total,
      page: pageNum,
      pages: Math.ceil(total / cap),
    });
  } catch (err) {
    logger.error('[GDPR] audit-logs error:', err);
    return res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

/** GET /api/compliance/retention-policy -> { retentionDays: number | null, legalHold } */
exports.getRetentionPolicy = async (req, res) => {
  try {
    const user = await identity.users.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ retentionDays: user.retentionDays || null, legalHold: securityQueries.legalHoldOf(user).legalHold });
  } catch (err) {
    logger.error('[GDPR] get-retention error:', err);
    return res.status(500).json({ message: 'Failed to fetch retention policy' });
  }
};

/** PATCH /api/compliance/retention-policy { retentionDays: integer 1..3650 | null } -> { message, retentionDays } */
exports.setRetentionPolicy = async (req, res) => {
  try {
    const { retentionDays } = req.body || {};
    if (retentionDays !== null && !(Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 3650)) {
      return res.status(400).json({ message: 'retentionDays must be a whole number from 1 to 3650, or null to keep messages forever' });
    }
    await identity.users.update(req.user.sub, { retentionDays });

    await audit(req, {
      action: 'compliance.retention_policy_updated',
      resourceId: req.user.sub,
      description: `Retention policy set to ${retentionDays ? `${retentionDays} days` : 'disabled (no limit)'}`,
    });

    return res.json({ message: 'Retention policy updated', retentionDays });
  } catch (err) {
    logger.error('[GDPR] set-retention error:', err);
    return res.status(500).json({ message: 'Failed to update retention policy' });
  }
};

exports.canManageUser = canManageUser;
exports.ErasureError = ErasureError;
