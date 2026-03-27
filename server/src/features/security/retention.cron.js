// server/src/features/security/retention.cron.js
// Message retention policy cron job.
// Runs daily. Auto-deletes messages older than retentionDays for each user/workspace
// that has a retention policy set. Respects legalHold flag — never deletes held data.

'use strict';

const User = require('../../../models/User');

// Safely require message model — returns null if it doesn't exist yet
function tryRequire(path) {
  try { return require(path); } catch { return null; }
}

/**
 * Run retention cleanup.
 * Called once at startup, then scheduled every 24h.
 */
async function runRetentionCleanup() {
  console.log('[Retention] Starting message retention cleanup...');

  try {
    // Find all users with a retention policy
    const usersWithPolicy = await User.find({
      retentionDays: { $ne: null, $gt: 0 },
      legalHold: { $ne: true },
    }).select('_id retentionDays').lean();

    if (usersWithPolicy.length === 0) {
      console.log('[Retention] No retention policies active. Skipping.');
      return { deleted: 0 };
    }

    // Try to load message model for cleanup
    // Supports both common message model paths across Chttrix architecture
    const MessageModel =
      tryRequire('../../../models/InternalMessage') ||
      tryRequire('../../modules/messages/message.model');

    if (!MessageModel) {
      console.warn('[Retention] No message model found — skipping message deletion.');
      return { deleted: 0, skipped: true };
    }

    let totalDeleted = 0;

    for (const user of usersWithPolicy) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - user.retentionDays);

      try {
        // Only delete messages where the user is the sender (not receiver messages)
        // This preserves conversation history for other participants
        const result = await MessageModel.deleteMany({
          sender: user._id,
          createdAt: { $lt: cutoffDate },
          // Respect legal hold at message level if supported
          legalHold: { $ne: true },
        });
        totalDeleted += result.deletedCount || 0;
      } catch (err) {
        console.warn(`[Retention] Error cleaning messages for user ${user._id}:`, err.message);
      }
    }

    console.log(`[Retention] Cleanup complete. Deleted ${totalDeleted} messages across ${usersWithPolicy.length} users.`);
    return { deleted: totalDeleted, usersProcessed: usersWithPolicy.length };
  } catch (err) {
    console.error('[Retention] Cleanup failed:', err);
    return { error: err.message };
  }
}

/**
 * Start the retention cron.
 * Runs immediately then every 24 hours.
 */
function startRetentionCron() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  console.log('[Retention] Retention cron scheduled (runs every 24h).');

  // Small delay on first run to not block server startup
  setTimeout(async () => {
    await runRetentionCleanup();
    setInterval(runRetentionCleanup, INTERVAL_MS);
  }, 30 * 1000); // 30s after startup
}

module.exports = { startRetentionCron, runRetentionCleanup };
