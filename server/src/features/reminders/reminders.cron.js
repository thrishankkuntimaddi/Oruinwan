const MessageReminder = require('../messages/MessageReminder');
const Message = require('../messages/message.model');
const logger = require('../../../utils/logger');

function startRemindersCron(io) {
  const INTERVAL_MS = 60 * 1000; 

  async function checkDueReminders() {
    try {
      const now = new Date();

      
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
    } catch (err) {
      logger.error('[REMINDERS] Cron error:', err.message);
    }
  }

  
  checkDueReminders();
  const intervalHandle = setInterval(checkDueReminders, INTERVAL_MS);

  logger.info('✅ [REMINDERS] Cron started (60s interval)');

  
  return () => clearInterval(intervalHandle);
}

module.exports = { startRemindersCron };
