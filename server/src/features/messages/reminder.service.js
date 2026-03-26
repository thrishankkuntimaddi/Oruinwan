// server/src/features/messages/reminder.service.js
// Phase-8: Message Reminders — schedule, deliver (cron), list
'use strict';

const MessageReminder = require('./MessageReminder');
const Message         = require('./message.model');

/**
 * Schedule a "Remind me later" for a message.
 * @param {string} userId
 * @param {string} messageId
 * @param {Date|string} remindAt  — must be in the future
 * @param {string} [note]
 * @returns {Promise<Object>} The created reminder document
 */
async function scheduleReminder(userId, messageId, remindAt, note = '') {
  const when = new Date(remindAt);
  if (isNaN(when.getTime())) throw Object.assign(new Error('Invalid remindAt date'), { status: 400 });
  if (when <= new Date()) throw Object.assign(new Error('remindAt must be in the future'), { status: 400 });

  // Verify message exists (lightweight select)
  const msg = await Message.findById(messageId).select('_id').lean();
  if (!msg) throw Object.assign(new Error('Message not found'), { status: 404 });

  const reminder = await MessageReminder.create({ userId, messageId, remindAt: when, note });
  return reminder;
}

/**
 * List all pending (not delivered) reminders for a user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getUserReminders(userId) {
  return MessageReminder.find({ userId, delivered: false })
    .sort({ remindAt: 1 })
    .populate({
      path: 'messageId',
      select: 'text payload attachments type channel dm sender createdAt',
      populate: { path: 'sender', select: 'username profilePicture' },
    })
    .lean();
}

/**
 * Cancel a reminder (delete it).
 * @param {string} reminderId
 * @param {string} userId  — to prevent cross-user cancellation
 */
async function cancelReminder(reminderId, userId) {
  const reminder = await MessageReminder.findOne({ _id: reminderId, userId });
  if (!reminder) throw Object.assign(new Error('Reminder not found'), { status: 404 });
  await reminder.deleteOne();
  return { success: true };
}

/**
 * Cron worker — call every 60 s from server startup.
 * Finds all un-delivered reminders whose remindAt ≤ now,
 * emits `reminder:due` to the user's personal socket room,
 * and marks them delivered.
 *
 * @param {Object} io  — socket.io server instance
 */
async function deliverDueReminders(io) {
  try {
    const now = new Date();
    const due = await MessageReminder.find({
      delivered: false,
      remindAt: { $lte: now },
    })
      .limit(200) // safety cap per tick
      .populate({
        path: 'messageId',
        select: 'text payload attachments type channel dm sender createdAt',
        populate: { path: 'sender', select: 'username profilePicture' },
      })
      .lean();

    if (due.length === 0) return;

    const ids = due.map(r => r._id);

    for (const reminder of due) {
      if (io) {
        // Each connected user joins room `user:<userId>` — see socket setup
        io.to(`user:${reminder.userId.toString()}`).emit('reminder:due', {
          reminderId: reminder._id,
          messageId:  reminder.messageId?._id || reminder.messageId,
          message:    reminder.messageId,
          note:       reminder.note,
          remindAt:   reminder.remindAt,
        });
      }
    }

    // Bulk-mark as delivered
    await MessageReminder.updateMany(
      { _id: { $in: ids } },
      { $set: { delivered: true, deliveredAt: now } }
    );

    console.log(`[reminder.service] ✅ Delivered ${due.length} reminder(s)`);
  } catch (err) {
    console.error('[reminder.service] ❌ Error delivering reminders:', err.message);
  }
}

module.exports = { scheduleReminder, getUserReminders, cancelReminder, deliverDueReminders };
