'use strict';

/**
 * Audit-log entries for connecting and disconnecting agents and tools, personal or workspace-wide.
 * Written to the admin audit log (and the company compliance log for company workspaces).
 * Never records a key or token: only who, what provider, and how. Never throws.
 */

const logger = require('../../../utils/logger');

async function record(req, workspaceId, action, details = {}) {
  try {
    const identity = require('../../identity');
    const ws = await identity.workspaces.findById(workspaceId).catch(() => null);
    await require('../../shared/adminAudit').recordAdminAction({
      userId: req.user.sub,
      companyId: ws?.company || null,
      action,
      category: 'security',
      resourceType: 'workspace',
      resourceId: workspaceId,
      resourceName: ws?.name,
      details: { workspaceId: String(workspaceId), ...details },
      req,
    });
  } catch (err) {
    logger.warn({ err: err.message, action }, '[connections] audit write failed (non-fatal)');
  }
}

module.exports = { record };
