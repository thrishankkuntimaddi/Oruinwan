// server/src/features/reminders/reminders.cron.js
// Phase 1 — Message Reminders cron job
// Runs every 60 seconds; fires socket event to user for due reminders.

const MessageReminder = require('../messages/MessageReminder');
const Message = require('../messages/message.model');
const logger = require('../../../utils/logger');

/**
 * Start the reminders cron job.
 * Call this AFTER the HTTP server is listening and `io` is available.
 *
 * @param {import('socket.io').Server} io — Socket.IO server instance
 */
function startRemindersCron(io) {
  const INTERVAL_MS = 60 * 1000; // 1 minute

  async function checkDueReminders() {
    try {
      const now = new Date();

      // Find all undelivered reminders whose remindAt <= now
      const dueReminders = await MessageReminder.find({
        delivered: false,
        remindAt: { $lte: now }
      })
        .populate({
          path: 'messageId',
          populate: { path: 'sender', select: 'username profilePicture' }
        })
        .lean();

      if (dueReminders.length === 0) return;

      logger.debug(`[REMINDERS] Firing ${dueReminders.length} due reminder(s)`);

      const ids = dueReminders.map(r => r._id);

      // Mark all as delivered atomically before emitting (idempotent)
      await MessageReminder.updateMany(
        { _id: { $in: ids } },
        { delivered: true, deliveredAt: now }
      );

      // Emit to each user's private socket room
      for (const reminder of dueReminders) {
        const room = `user_${reminder.userId}`;
        io.to(room).emit('reminder-fired', {
          reminderId: reminder._id,
          message: reminder.messageId,
          note: reminder.note,
          remindAt: reminder.remindAt
        });
      }
    } catch (err) {
      logger.error('[REMINDERS] Cron error:', err.message);
    }
  }

  // Fire immediately on start, then on every interval
  checkDueReminders();
  const intervalHandle = setInterval(checkDueReminders, INTERVAL_MS);

  logger.info('✅ [REMINDERS] Cron started (60s interval)');

  // Return a stop handle for graceful shutdown
  return () => clearInterval(intervalHandle);
}

module.exports = { startRemindersCron };
