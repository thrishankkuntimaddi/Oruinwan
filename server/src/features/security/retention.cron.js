'use strict';

const User = require('../../../models/User');

function tryRequire(path) {
  try { return require(path); } catch { return null; }
}

async function runRetentionCleanup() {
  console.log('[Retention] Starting message retention cleanup...');

  try {
    
    const usersWithPolicy = await User.find({
      retentionDays: { $ne: null, $gt: 0 },
      legalHold: { $ne: true },
    }).select('_id retentionDays').lean();

    if (usersWithPolicy.length === 0) {
      console.log('[Retention] No retention policies active. Skipping.');
      return { deleted: 0 };
    }

    
    
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
        
        
        const result = await MessageModel.deleteMany({
          sender: user._id,
          createdAt: { $lt: cutoffDate },
          
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

function startRetentionCron() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; 

  console.log('[Retention] Retention cron scheduled (runs every 24h).');

  
  setTimeout(async () => {
    await runRetentionCleanup();
    setInterval(runRetentionCleanup, INTERVAL_MS);
  }, 30 * 1000); 
}

module.exports = { startRetentionCron, runRetentionCleanup };
