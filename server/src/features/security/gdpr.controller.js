// server/src/features/security/gdpr.controller.js
// GDPR & Compliance: user data export, right-to-be-forgotten, legal holds, workspace export.

'use strict';

const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');

// ── Helper: safely require optional models ────────────────────────────────────
function tryRequire(path) {
  try { return require(path); } catch { return null; }
}

// ── GET /api/compliance/export-user ──────────────────────────────────────────
// GDPR Article 20: Right to data portability. Returns all data for current user.
exports.exportUser = async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await User.findById(userId)
      .select('-passwordHash -twoFactorSecret -refreshTokens -verificationTokenHash -resetPasswordTokenHash -inviteToken')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Gather associated data from other models (best-effort)
    const Task = tryRequire('../tasks/task.model');
    const Note = tryRequire('../../../models/Note');

    const [tasks, notes, auditLogs] = await Promise.all([
      Task ? Task.find({ assignedTo: userId }).lean() : [],
      Note ? Note.find({ owner: userId }).lean() : [],
      AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      userData: user,
      tasks,
      notes,
      auditLogs,
    };

    // Audit the export itself
    await AuditLog.create({
      userId,
      action: 'compliance.export_user',
      resource: 'User',
      resourceId: userId,
      description: 'User requested personal data export (GDPR Art. 20)',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'info',
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chttrix-data-export-${Date.now()}.json"`);
    return res.json(exportData);
  } catch (err) {
    console.error('[GDPR] export-user error:', err);
    return res.status(500).json({ message: 'Failed to export user data' });
  }
};

// ── DELETE /api/compliance/delete-user ───────────────────────────────────────
// GDPR Article 17: Right to erasure ("right to be forgotten").
// Blocked if user is under legal hold.
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await User.findById(userId).select('legalHold legalHoldReason email username');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.legalHold) {
      return res.status(403).json({
        message: 'Account is under legal hold and cannot be deleted.',
        reason: user.legalHoldReason || 'Legal hold active',
      });
    }

    // Audit before deleting (write to a preserved compliance log)
    await AuditLog.create({
      userId,
      action: 'compliance.delete_user',
      resource: 'User',
      resourceId: userId,
      description: `GDPR deletion request — email: ${user.email}, username: ${user.username}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'critical',
    });

    // Anonymize instead of hard-delete to preserve referential integrity
    await User.findByIdAndUpdate(userId, {
      email: `deleted_${userId}@deleted.chttrix`,
      username: `[Deleted User]`,
      passwordHash: null,
      phone: null,
      profilePicture: null,
      profile: {},
      preferences: {},
      refreshTokens: [],
      devices: [],
      twoFactorSecret: null,
      twoFactorEnabled: false,
      ssoId: null,
      ssoProvider: null,
      accountStatus: 'removed',
      isActive: false,
      deactivatedAt: new Date(),
    });

    return res.json({ message: 'Account data erased successfully (GDPR Art. 17)' });
  } catch (err) {
    console.error('[GDPR] delete-user error:', err);
    return res.status(500).json({ message: 'Failed to delete user data' });
  }
};

// ── GET /api/compliance/export ────────────────────────────────────────────────
// Workspace-level export: messages, tasks, files metadata (admin only).
exports.exportWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    const Task = tryRequire('../tasks/task.model');
    const Note = tryRequire('../../../models/Note');

    const [tasks, notes] = await Promise.all([
      Task ? Task.find({ workspaceId }).lean() : [],
      Note ? Note.find({ workspaceId }).lean() : [],
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      workspaceId,
      tasks,
      notes,
    };

    await AuditLog.create({
      userId: req.user.sub,
      action: 'compliance.export_workspace',
      resource: 'Workspace',
      resourceId: workspaceId,
      description: `Workspace data export by admin`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'info',
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-export-${workspaceId}-${Date.now()}.json"`);
    return res.json(exportData);
  } catch (err) {
    console.error('[GDPR] export-workspace error:', err);
    return res.status(500).json({ message: 'Failed to export workspace data' });
  }
};

// ── GET /api/compliance/legal-hold/:userId ─────────────────────────────────
// Get legal hold status for a user (admin only).
exports.getLegalHold = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .select('legalHold legalHoldReason legalHoldSetBy legalHoldAt username email')
      .populate('legalHoldSetBy', 'username email')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({
      userId,
      legalHold: user.legalHold || false,
      reason: user.legalHoldReason,
      setBy: user.legalHoldSetBy,
      setAt: user.legalHoldAt,
    });
  } catch (err) {
    console.error('[GDPR] get-legal-hold error:', err);
    return res.status(500).json({ message: 'Failed to fetch legal hold status' });
  }
};

// ── PATCH /api/compliance/legal-hold/:userId ──────────────────────────────────
// Set or unset legal hold on a user (admin only).
exports.setLegalHold = async (req, res) => {
  try {
    const { userId } = req.params;
    const { legalHold, reason } = req.body;
    if (typeof legalHold !== 'boolean') {
      return res.status(400).json({ message: 'legalHold must be a boolean' });
    }

    const update = {
      legalHold,
      legalHoldReason: legalHold ? (reason || 'Legal hold active') : null,
      legalHoldSetBy: legalHold ? req.user.sub : null,
      legalHoldAt: legalHold ? new Date() : null,
    };
    const user = await User.findByIdAndUpdate(userId, update, { new: true })
      .select('username email legalHold');
    if (!user) return res.status(404).json({ message: 'User not found' });

    await AuditLog.create({
      userId: req.user.sub,
      action: legalHold ? 'compliance.legal_hold_set' : 'compliance.legal_hold_removed',
      resource: 'User',
      resourceId: userId,
      description: `Legal hold ${legalHold ? 'set' : 'removed'} on user ${user.email}${reason ? `: ${reason}` : ''}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: legalHold ? 'warning' : 'info',
    });

    return res.json({ message: `Legal hold ${legalHold ? 'set' : 'removed'}`, legalHold: user.legalHold });
  } catch (err) {
    console.error('[GDPR] set-legal-hold error:', err);
    return res.status(500).json({ message: 'Failed to update legal hold' });
  }
};

// ── GET /api/compliance/audit-logs ───────────────────────────────────────────
// Returns audit logs for the current user (own events), or all logs for admins.
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, from, to } = req.query;
    const cap = Math.min(parseInt(limit), 200);
    const skip = (parseInt(page) - 1) * cap;

    const filter = { userId: req.user.sub };
    if (action) filter.action = action;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(cap).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / cap),
    });
  } catch (err) {
    console.error('[GDPR] audit-logs error:', err);
    return res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

// ── GET /api/compliance/retention-policy ─────────────────────────────────────
// Get current user's retention policy.
exports.getRetentionPolicy = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('retentionDays').lean();
    return res.json({ retentionDays: user?.retentionDays || null });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch retention policy' });
  }
};

// ── PATCH /api/compliance/retention-policy ────────────────────────────────────
// Update workspace/user retention policy (admin only).
exports.setRetentionPolicy = async (req, res) => {
  try {
    const { retentionDays } = req.body;
    if (retentionDays !== null && (typeof retentionDays !== 'number' || retentionDays < 1)) {
      return res.status(400).json({ message: 'retentionDays must be a positive number or null' });
    }
    await User.findByIdAndUpdate(req.user.sub, { retentionDays: retentionDays || null });

    await AuditLog.create({
      userId: req.user.sub,
      action: 'compliance.retention_policy_updated',
      resource: 'User',
      resourceId: req.user.sub,
      description: `Retention policy set to ${retentionDays || 'disabled (no limit)'} days`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'info',
    });

    return res.json({ message: 'Retention policy updated', retentionDays: retentionDays || null });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update retention policy' });
  }
};
