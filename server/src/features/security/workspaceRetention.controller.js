'use strict';

/**
 * Workspace-wide message retention, set by workspace owners/admins.
 *
 *   GET   /api/compliance/workspaces/:workspaceId/retention-policy   any member
 *     -> { workspaceId, retentionDays: number|null, setBy, setAt, legalHoldRespected: true }
 *   PATCH /api/compliance/workspaces/:workspaceId/retention-policy   owner/admin
 *     { retentionDays: 1..3650 | null } -> same shape
 *
 * Enforced daily by retention.cron.js (users under legal hold are always spared).
 */

const logger = require('../../../utils/logger');
const securityQueries = require('../../identity/queries/security');
const AuditLog = require('../../../models/AuditLog');
const { assertWorkspaceMember, sendAccessError } = require('../../shared/utils/workspaceAccess');

const MIN_DAYS = 1;
const MAX_DAYS = 3650;

function view(workspaceId, retention) {
  return {
    workspaceId: String(workspaceId),
    retentionDays: retention?.days || null,
    setBy: retention?.setBy || null,
    setAt: retention?.setAt || null,
    legalHoldRespected: true,
  };
}

exports.getWorkspaceRetention = async (req, res) => {
  const { workspaceId } = req.params;
  try {
    await assertWorkspaceMember(workspaceId, req.user.sub);
  } catch (err) {
    return sendAccessError(res, err);
  }
  try {
    const retention = await securityQueries.workspaceRetention(workspaceId);
    if (retention === undefined) return res.status(404).json({ message: 'Workspace not found' });
    return res.json(view(workspaceId, retention));
  } catch (err) {
    logger.error('[Retention] get workspace policy error:', err);
    return res.status(500).json({ message: 'Failed to fetch retention policy' });
  }
};

exports.setWorkspaceRetention = async (req, res) => {
  const { workspaceId } = req.params;
  let access;
  try {
    access = await assertWorkspaceMember(workspaceId, req.user.sub, { adminOnly: true });
  } catch (err) {
    return sendAccessError(res, err);
  }
  const { retentionDays } = req.body || {};
  if (retentionDays !== null && !(Number.isInteger(retentionDays) && retentionDays >= MIN_DAYS && retentionDays <= MAX_DAYS)) {
    return res.status(400).json({ message: `retentionDays must be a whole number from ${MIN_DAYS} to ${MAX_DAYS}, or null to keep messages forever` });
  }
  try {
    const previous = await securityQueries.workspaceRetention(workspaceId);
    const value = retentionDays === null ? null : { days: retentionDays, setBy: String(req.user.sub), setAt: new Date().toISOString() };
    const stored = await securityQueries.setWorkspaceRetention(workspaceId, value);
    if (stored === undefined) return res.status(404).json({ message: 'Workspace not found' });

    await AuditLog.create({
      userId: req.user.sub,
      companyId: access.workspace?.companyId || access.workspace?.company || null,
      action: 'compliance.workspace_retention_updated',
      resource: 'Workspace',
      resourceId: workspaceId,
      description: `Workspace retention set to ${retentionDays ? `${retentionDays} days` : 'disabled (no limit)'}`,
      details: { previousDays: previous?.days || null, retentionDays },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'warning',
    }).catch((err) => logger.warn({ err: err.message }, '[Retention] audit write failed'));

    return res.json(view(workspaceId, stored));
  } catch (err) {
    logger.error('[Retention] set workspace policy error:', err);
    return res.status(500).json({ message: 'Failed to update retention policy' });
  }
};
