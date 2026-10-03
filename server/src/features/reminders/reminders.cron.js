const MessageReminder = require('../../modules/messages/messageReminder.model');
require('../../modules/messages/message.model'); // registers the Message model so populate('messageId') works
const logger = require('../../../utils/logger');
const { scheduleJob } = require('../../shared/jobs/scheduler');
const { hydrate, USER_MIN } = require('../../identity/hydrate');

const INTERVAL_MS = 60 * 1000;

async function checkDueReminders(io) {
  const now = new Date();

  const dueReminders = await MessageReminder.find({
    delivered: false,
    remindAt: { $lte: now }
  })
    .populate('messageId')
    .lean();
  // Senders live in PostgreSQL now; populate cannot reach them.
  await hydrate(dueReminders, { 'messageId.sender': USER_MIN });

  if (dueReminders.length === 0) return;

  logger.debug(`[REMINDERS] Firing ${dueReminders.length} due reminder(s)`);

  const ids = dueReminders.map(r => r._id);

  await MessageReminder.updateMany(
    { _id: { $in: ids } },
    { delivered: true, deliveredAt: now }
  );

  for (const reminder of dueReminders) {
    const room = `user_${reminder.userId}`;
    io.to(room).emit('reminder-fired', {
      reminderId: reminder._id,
      message: reminder.messageId,
      note: reminder.note,
      remindAt: reminder.remindAt
    });
  }
}

/**
 * Fires due message reminders. Runs on one instance per minute fleet-wide
 * (see shared/jobs/scheduler.js); the emit reaches every instance through
 * the Socket.IO Redis adapter.
 */
function startRemindersCron(io) {
  const stop = scheduleJob({
    name: 'reminders',
    intervalMs: INTERVAL_MS,
    run: () => checkDueReminders(io),
  });
  logger.info('✅ [REMINDERS] Cron started (60s interval)');
  return stop;
}

module.exports = { startRemindersCron, checkDueReminders };
