'use strict';
const logger = require('../../../utils/logger');

const MessageReminder = require('./messageReminder.model');
const Message         = require('./message.model');
const { loadAccessibleMessage } = require('./messageAccess');

async function scheduleReminder(userId, messageId, remindAt, note = '', { forUserId = null } = {}) {
  const when = new Date(remindAt);
  if (isNaN(when.getTime())) throw Object.assign(new Error('Invalid remindAt date'), { status: 400 });
  if (when <= new Date()) throw Object.assign(new Error('remindAt must be in the future'), { status: 400 });

  
  // Throws 400/404/403 when the message is missing or the caller cannot read it.
  await loadAccessibleMessage(Message, messageId, userId, { select: '_id channel dm', lean: true });

  // A reminder for someone else (/remind @person): they must be able to read the message too.
  const target = forUserId && String(forUserId) !== String(userId) ? String(forUserId) : null;
  if (target) {
    if (!require('mongoose').Types.ObjectId.isValid(target)) throw Object.assign(new Error('Invalid person'), { status: 400 });
    try {
      await loadAccessibleMessage(Message, messageId, target, { select: '_id channel dm', lean: true });
    } catch {
      throw Object.assign(new Error("They can't see this conversation, so they can't be reminded about it"), { status: 403 });
    }
  }

  const reminder = await MessageReminder.create({
    userId: target || userId,
    messageId,
    remindAt: when,
    note: String(note || '').trim().slice(0, 500),
    ...(target ? { setBy: userId } : {}),
  });
  return reminder;
}

/** Message senders live in PostgreSQL: attach them after the Mongo populate. */
function withSenders(reminders) {
  return require('../../identity/hydrate').hydrate(reminders, {
    'messageId.sender': { type: 'user', fields: ['username', 'profilePicture'] },
  });
}

async function getUserReminders(userId) {
  const { filterReadable } = require('../conversations/conversationAccess');
  const rows = await MessageReminder.find({ userId, delivered: false })
    .sort({ remindAt: 1 })
    .populate({
      path: 'messageId',
      select: 'text payload attachments type channel dm sender createdAt',
    })
    .lean();
  // Only messages they can still read (not after leaving the conversation or the workspace).
  return withSenders(await filterReadable(rows, userId, (r) => r.messageId));
}

async function cancelReminder(reminderId, userId) {
  if (!require('mongoose').Types.ObjectId.isValid(String(reminderId))) {
    throw Object.assign(new Error('Reminder not found'), { status: 404 });
  }
  const reminder = await MessageReminder.findOne({ _id: reminderId, userId });
  if (!reminder) throw Object.assign(new Error('Reminder not found'), { status: 404 });
  await reminder.deleteOne();
  return { success: true };
}

async function deliverDueReminders(io) {
  try {
    const now = new Date();
    const due = await MessageReminder.find({
      delivered: false,
      remindAt: { $lte: now },
    })
      .limit(200) 
      .populate({
        path: 'messageId',
        select: 'text payload attachments type channel dm sender createdAt',
      })
      .lean()
      .then(withSenders);

    if (due.length === 0) return;

    const ids = due.map(r => r._id);

    const { checkMessageAccess } = require('../conversations/conversationAccess');
    for (const reminder of due) {
      const access = reminder.messageId && typeof reminder.messageId === 'object'
        ? await checkMessageAccess(reminder.messageId, String(reminder.userId)).catch(() => ({ ok: false }))
        : { ok: false };
      if (io && access.ok) {
        
        io.to(`user:${reminder.userId.toString()}`).emit('reminder:due', {
          reminderId: reminder._id,
          messageId:  reminder.messageId?._id || reminder.messageId,
          message:    reminder.messageId,
          note:       reminder.note,
          remindAt:   reminder.remindAt,
          setBy:      reminder.setBy || null,
        });
      }
    }

    
    await MessageReminder.updateMany(
      { _id: { $in: ids } },
      { $set: { delivered: true, deliveredAt: now } }
    );

    logger.info(`[reminder.service] ✅ Delivered ${due.length} reminder(s)`);
  } catch (err) {
    logger.error('[reminder.service] ❌ Error delivering reminders:', err.message);
  }
}

module.exports = { scheduleReminder, getUserReminders, cancelReminder, deliverDueReminders };
