'use strict';
const logger = require('../../../utils/logger');
const { scheduleJob } = require('../../shared/jobs/scheduler');

const securityQueries = require('../../identity/queries/security');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Personal message retention. For every user with retentionDays set and no legal hold:
 *   - chat messages they SENT (channels, DMs, thread replies) older than the cutoff are
 *     deleted the same way "delete for everyone" does it: the content (E2EE ciphertext,
 *     text, attachments, poll, contact, link preview, edit history) is wiped and the message
 *     becomes a tombstone, so thread structure and reply counts stay intact.
 *   - their internal (company) messages older than the cutoff are removed.
 * Messages other people sent are never touched. System messages are skipped.
 *
 * Workspace retention (set by workspace admins, workspaces.settings.retention.days):
 * every chat message in that workspace older than the cutoff is tombstoned the same
 * way, except messages sent by a user under legal hold and messages in a DM with a
 * user under legal hold. Each run that purges anything writes an audit log entry.
 *
 * Scheduled from server.js after the DB connects (startRetentionCron).
 */

const TOMBSTONE = (deletedBy) => ({
  $set: {
    isDeletedUniversally: true,
    deletedBy,
    deletedByName: 'Retention policy',
    deletedAt: new Date(),
    text: '',
    payload: { ciphertext: null, messageIv: null, isEncrypted: false },
    attachments: [],
    editHistory: [],
    checklist: [],
    reactions: [],
  },
  $unset: { poll: 1, contact: 1, meeting: 1, linkPreview: 1 },
});

const LIVE_CHAT = { type: { $ne: 'system' }, isDeletedUniversally: { $ne: true } };

async function purgeChatMessages(Message, userId, cutoffDate) {
  const result = await Message.updateMany(
    { sender: userId, createdAt: { $lt: cutoffDate }, ...LIVE_CHAT },
    TOMBSTONE(userId)
  );
  return result.modifiedCount || 0;
}

/** Mongo filter for one workspace's expired messages, sparing legal-hold users and their DMs. */
function workspacePurgeFilter(workspaceId, cutoffDate, heldUserIds = [], heldDmIds = []) {
  const filter = { workspace: workspaceId, createdAt: { $lt: cutoffDate }, ...LIVE_CHAT };
  if (heldUserIds.length) filter.sender = { $nin: heldUserIds };
  if (heldDmIds.length) filter.dm = { $nin: heldDmIds };
  return filter;
}

async function purgeWorkspaceMessages({ Message, DMSession, workspaceId, days, heldUserIds = [] }) {
  const cutoffDate = new Date(Date.now() - days * DAY_MS);
  const heldDmIds = heldUserIds.length && DMSession
    ? (await DMSession.find({ workspace: workspaceId, participants: { $in: heldUserIds } }).select('_id').lean()).map((d) => d._id)
    : [];
  const result = await Message.updateMany(workspacePurgeFilter(workspaceId, cutoffDate, heldUserIds, heldDmIds), TOMBSTONE(null));
  return { purged: result.modifiedCount || 0, cutoffDate, sparedDms: heldDmIds.length };
}

/** Enforce every workspace-wide retention policy. */
async function runWorkspaceRetention({ Message, DMSession, AuditLog } = {}) {
  Message = Message || require('../../modules/messages/message.model');
  if (DMSession === undefined) { try { DMSession = require('../../../models/DMSession'); } catch { DMSession = null; } }
  AuditLog = AuditLog || require('../../../models/AuditLog');

  const workspaces = await securityQueries.workspacesWithRetention();
  if (!workspaces.length) return { workspacesProcessed: 0, purged: 0 };
  const heldUserIds = await securityQueries.legalHoldUserIds();

  let purged = 0;
  for (const ws of workspaces) {
    const days = Number(ws.retention?.days);
    if (!Number.isInteger(days) || days < 1) continue;
    try {
      const r = await purgeWorkspaceMessages({ Message, DMSession, workspaceId: ws._id, days, heldUserIds });
      purged += r.purged;
      if (r.purged > 0 && ws.retention?.setBy) {
        await AuditLog.create({
          userId: ws.retention.setBy,
          companyId: ws.companyId || null,
          action: 'compliance.workspace_retention_enforced',
          resource: 'Workspace',
          resourceId: ws._id,
          description: `Workspace retention (${days} days) removed ${r.purged} message(s) older than ${r.cutoffDate.toISOString()}`,
          details: { days, purged: r.purged, legalHoldUsersSpared: heldUserIds.length, legalHoldDmsSpared: r.sparedDms },
          ipAddress: 'system',
          category: 'security',
          severity: 'info',
        }).catch((err) => logger.warn(`[Retention] audit write failed for workspace ${ws._id}: ${err.message}`));
      }
    } catch (err) {
      logger.warn(`[Retention] Workspace cleanup failed for ${ws._id}: ${err.message}`);
    }
  }
  logger.info(`[Retention] Workspace policies: purged ${purged} messages across ${workspaces.length} workspace(s).`);
  return { workspacesProcessed: workspaces.length, purged };
}

async function runRetentionCleanup() {
  logger.info('[Retention] Starting message retention cleanup...');

  try {
    let workspaceResult = { workspacesProcessed: 0, purged: 0 };
    try {
      workspaceResult = await runWorkspaceRetention();
    } catch (err) {
      logger.error('[Retention] Workspace retention failed:', err.message);
    }

    const usersWithPolicy = await securityQueries.usersWithRetention();

    if (usersWithPolicy.length === 0) {
      logger.info('[Retention] No personal retention policies active.');
      return { deleted: workspaceResult.purged, usersProcessed: 0, workspace: workspaceResult };
    }

    const Message = require('../../modules/messages/message.model');
    let InternalMessage = null;
    try { InternalMessage = require('../../../models/InternalMessage'); } catch { /* optional */ }

    let chatPurged = 0;
    let internalDeleted = 0;

    for (const user of usersWithPolicy) {
      const days = Number(user.retentionDays);
      if (!Number.isFinite(days) || days < 1) continue;
      const cutoffDate = new Date(Date.now() - days * DAY_MS);

      try {
        chatPurged += await purgeChatMessages(Message, user._id, cutoffDate);
      } catch (err) {
        logger.warn(`[Retention] Chat cleanup failed for user ${user._id}: ${err.message}`);
      }

      if (InternalMessage) {
        try {
          const r = await InternalMessage.deleteMany({ sender: user._id, createdAt: { $lt: cutoffDate } });
          internalDeleted += r.deletedCount || 0;
        } catch (err) {
          logger.warn(`[Retention] Internal-message cleanup failed for user ${user._id}: ${err.message}`);
        }
      }
    }

    const deleted = chatPurged + internalDeleted + workspaceResult.purged;
    logger.info(`[Retention] Cleanup complete. Purged ${chatPurged} chat and ${internalDeleted} internal messages across ${usersWithPolicy.length} users.`);
    return { deleted, chatPurged, internalDeleted, usersProcessed: usersWithPolicy.length, workspace: workspaceResult };
  } catch (err) {
    logger.error('[Retention] Cleanup failed:', err);
    return { error: err.message };
  }
}

/** Personal retention cleanup: one run per day fleet-wide, 30s after boot. */
function startRetentionCron() {
  logger.info('[Retention] Retention cron scheduled (runs every 24h).');
  return scheduleJob({
    name: 'retention',
    intervalMs: 24 * 60 * 60 * 1000,
    initialDelayMs: 30 * 1000,
    run: runRetentionCleanup,
  });
}

module.exports = { startRetentionCron, runRetentionCleanup, purgeChatMessages, runWorkspaceRetention, purgeWorkspaceMessages, workspacePurgeFilter };
