'use strict';
const logger = require('../../../utils/logger');

const User = require('../../../models/User');

/**
 * Personal message retention. For every user with retentionDays set and no legal hold:
 *   - chat messages they SENT (channels, DMs, thread replies) older than the cutoff are
 *     deleted the same way "delete for everyone" does it: the content (E2EE ciphertext,
 *     text, attachments, poll, contact, link preview, edit history) is wiped and the message
 *     becomes a tombstone, so thread structure and reply counts stay intact.
 *   - their internal (company) messages older than the cutoff are removed.
 * Messages other people sent are never touched. System messages are skipped.
 * Scheduled from server.js after the DB connects (startRetentionCron).
 */

async function purgeChatMessages(Message, userId, cutoffDate) {
  const result = await Message.updateMany(
    {
      sender: userId,
      createdAt: { $lt: cutoffDate },
      type: { $ne: 'system' },
      isDeletedUniversally: { $ne: true },
    },
    {
      $set: {
        isDeletedUniversally: true,
        deletedBy: userId,
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
    }
  );
  return result.modifiedCount || 0;
}

async function runRetentionCleanup() {
  logger.info('[Retention] Starting message retention cleanup...');

  try {
    const usersWithPolicy = await User.find({
      retentionDays: { $ne: null, $gt: 0 },
      legalHold: { $ne: true },
      accountStatus: { $ne: 'removed' },
    }).select('_id retentionDays').lean();

    if (usersWithPolicy.length === 0) {
      logger.info('[Retention] No retention policies active. Skipping.');
      return { deleted: 0, usersProcessed: 0 };
    }

    const Message = require('../../modules/messages/message.model');
    let InternalMessage = null;
    try { InternalMessage = require('../../../models/InternalMessage'); } catch { /* optional */ }

    let chatPurged = 0;
    let internalDeleted = 0;

    for (const user of usersWithPolicy) {
      const days = Number(user.retentionDays);
      if (!Number.isFinite(days) || days < 1) continue;
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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

    const deleted = chatPurged + internalDeleted;
    logger.info(`[Retention] Cleanup complete. Purged ${chatPurged} chat and ${internalDeleted} internal messages across ${usersWithPolicy.length} users.`);
    return { deleted, chatPurged, internalDeleted, usersProcessed: usersWithPolicy.length };
  } catch (err) {
    logger.error('[Retention] Cleanup failed:', err);
    return { error: err.message };
  }
}

let started = false;

function startRetentionCron() {
  if (started) return;
  started = true;
  const INTERVAL_MS = 24 * 60 * 60 * 1000;

  logger.info('[Retention] Retention cron scheduled (runs every 24h).');

  const first = setTimeout(async () => {
    await runRetentionCleanup();
    const every = setInterval(runRetentionCleanup, INTERVAL_MS);
    if (every.unref) every.unref();
  }, 30 * 1000);
  if (first.unref) first.unref();
}

module.exports = { startRetentionCron, runRetentionCleanup, purgeChatMessages };
