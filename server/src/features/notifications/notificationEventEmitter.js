/**
 * notificationEventEmitter.js
 *
 * Singleton centralized EventEmitter for the Chttrix notification system.
 * Modules emit named events; this file subscribes and calls notificationService.
 *
 * USAGE — in any module:
 *   const notifEmitter = require('../notifications/notificationEventEmitter');
 *   notifEmitter.emit('task.assigned', { io, assigneeId, assignerUsername, workspaceId, taskTitle, taskId });
 *
 * EVENTS HANDLED:
 *   message.sent         → mention / dm notification
 *   thread.reply         → thread follower notification
 *   task.assigned        → task_assigned notification + email
 *   task.due_soon        → task_due_soon notification
 *   meeting.scheduled    → schedule_created notification + email
 *   meeting.reminder     → meeting_reminder notification
 *   integration.webhook_failed → integration_alert notification
 *   ai.suggestion        → ai_suggestion notification
 */

const EventEmitter = require('events');
const logger = require('../../../utils/logger');

class NotificationEventEmitter extends EventEmitter {}

const emitter = new NotificationEventEmitter();
emitter.setMaxListeners(50);

// Lazy-load to avoid circular dependency issues
const getNotifService = () => require('./notificationService');
const getEmailService = () => require('./emailNotificationService');
const getPrefs = () => require('./notificationPreferenceService');

// ─── Helper: check user pref before creating notification ─────────────────────
async function shouldNotify(userId, workspaceId, prefKey) {
    try {
        const prefService = getPrefs();
        const prefs = await prefService.getUserPreferences(userId, workspaceId);
        return prefs[prefKey] !== false; // default true if not set
    } catch {
        return true; // fail-open: always notify if prefs unavailable
    }
}

// ─── message.sent ─────────────────────────────────────────────────────────────
emitter.on('message.sent', async ({ io, mentionedUserIds = [], senderUsername, workspaceId, channelName, channelId, snippet, recipientId, dmSessionId, isMention }) => {
    try {
        const notifService = getNotifService();

        if (isMention && mentionedUserIds.length > 0) {
            for (const userId of mentionedUserIds) {
                if (await shouldNotify(userId, workspaceId, 'message')) {
                    await notifService.mention(io, { mentionedUserId: userId, senderUsername, workspaceId, channelName, channelId, snippet });
                }
            }
        } else if (recipientId) {
            if (await shouldNotify(recipientId, workspaceId, 'message')) {
                await notifService.dmReceived(io, { recipientId, senderUsername, workspaceId, dmSessionId, snippet });
            }
        }
    } catch (err) {
        logger.error('[NotifEmitter] message.sent error:', err.message);
    }
});

// ─── thread.reply ─────────────────────────────────────────────────────────────
emitter.on('thread.reply', async ({ io, followerIds = [], senderUsername, workspaceId, channelId, channelName, parentMessageId }) => {
    try {
        const notifService = getNotifService();
        const allowed = [];
        for (const id of followerIds) {
            if (await shouldNotify(id, workspaceId, 'threadReply')) allowed.push(id);
        }
        if (allowed.length > 0) {
            await notifService.threadReply(io, { followerIds: allowed, senderUsername, workspaceId, channelId, channelName, parentMessageId });
        }
    } catch (err) {
        logger.error('[NotifEmitter] thread.reply error:', err.message);
    }
});

// ─── task.assigned ────────────────────────────────────────────────────────────
emitter.on('task.assigned', async ({ io, assigneeId, assignerUsername, workspaceId, taskTitle, taskId, assigneeEmail }) => {
    try {
        const notifService = getNotifService();
        if (await shouldNotify(assigneeId, workspaceId, 'task')) {
            await notifService.taskAssigned(io, { assigneeId, assignerUsername, workspaceId, taskTitle, taskId });
        }

        // Email notification
        const emailService = getEmailService();
        if (await shouldNotify(assigneeId, workspaceId, 'email') && assigneeEmail) {
            await emailService.sendEmailNotification({
                to: assigneeEmail,
                subject: `[Chttrix] New task assigned: ${taskTitle}`,
                html: `
                    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
                        <h2 style="color:#4f46e5">📋 Task Assigned</h2>
                        <p><strong>${assignerUsername}</strong> assigned you a task:</p>
                        <p style="font-size:16px;font-weight:600;color:#111">${taskTitle}</p>
                        <a href="${process.env.FRONTEND_URL || '#'}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">View Task</a>
                    </div>
                `,
            });
        }
    } catch (err) {
        logger.error('[NotifEmitter] task.assigned error:', err.message);
    }
});

// ─── task.due_soon ────────────────────────────────────────────────────────────
emitter.on('task.due_soon', async ({ io, assigneeId, workspaceId, taskTitle, taskId, dueDate }) => {
    try {
        const notifService = getNotifService();
        if (await shouldNotify(assigneeId, workspaceId, 'task')) {
            await notifService.create(io, {
                recipient: assigneeId,
                workspaceId,
                type: 'task_due_soon',
                title: '⏰ Task due soon',
                body: `"${taskTitle}" is due ${dueDate}`,
                link: taskId ? `/tasks/${taskId}` : null,
                meta: { taskTitle, taskId, dueDate },
            });
        }
    } catch (err) {
        logger.error('[NotifEmitter] task.due_soon error:', err.message);
    }
});

// ─── meeting.scheduled ────────────────────────────────────────────────────────
emitter.on('meeting.scheduled', async ({ io, recipientIds = [], workspaceId, title, meetingId, recipientEmails = [] }) => {
    try {
        const notifService = getNotifService();
        const emailService = getEmailService();

        const allowed = [];
        for (const id of recipientIds) {
            if (await shouldNotify(id, workspaceId, 'meeting')) allowed.push(id);
        }
        if (allowed.length > 0) {
            await notifService.scheduleCreated(io, { recipientIds: allowed, workspaceId, title, scheduledMeetingId: meetingId });
        }

        // Email to recipients who have email enabled
        for (let i = 0; i < recipientIds.length; i++) {
            const email = recipientEmails[i];
            if (email && await shouldNotify(recipientIds[i], workspaceId, 'email')) {
                await emailService.sendEmailNotification({
                    to: email,
                    subject: `[Chttrix] Meeting scheduled: ${title}`,
                    html: `
                        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
                            <h2 style="color:#4f46e5">📅 Meeting Scheduled</h2>
                            <p>You have a new meeting: <strong>${title}</strong></p>
                            <a href="${process.env.FRONTEND_URL || '#'}/huddles" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">View Meeting</a>
                        </div>
                    `,
                });
            }
        }
    } catch (err) {
        logger.error('[NotifEmitter] meeting.scheduled error:', err.message);
    }
});

// ─── meeting.reminder ─────────────────────────────────────────────────────────
emitter.on('meeting.reminder', async ({ io, recipientIds = [], workspaceId, title, meetingId, startsIn }) => {
    try {
        const notifService = getNotifService();
        const allowed = [];
        for (const id of recipientIds) {
            if (await shouldNotify(id, workspaceId, 'meeting')) allowed.push(id);
        }
        if (allowed.length > 0) {
            await notifService.createMany(io, allowed, {
                workspaceId,
                type: 'meeting_reminder',
                title: `🔔 Meeting starting in ${startsIn}`,
                body: title,
                link: '/huddles',
                meta: { meetingId, title, startsIn },
            });
        }
    } catch (err) {
        logger.error('[NotifEmitter] meeting.reminder error:', err.message);
    }
});

// ─── integration.webhook_failed ──────────────────────────────────────────────
emitter.on('integration.webhook_failed', async ({ io, adminIds = [], workspaceId, integrationName, errorMessage }) => {
    try {
        const notifService = getNotifService();
        if (adminIds.length > 0) {
            await notifService.createMany(io, adminIds, {
                workspaceId,
                type: 'integration_alert',
                title: `⚠️ Webhook failed: ${integrationName}`,
                body: errorMessage || 'Delivery failed — check integration settings',
                link: '/integrations',
                meta: { integrationName, errorMessage },
            });
        }
    } catch (err) {
        logger.error('[NotifEmitter] integration.webhook_failed error:', err.message);
    }
});

// ─── ai.suggestion ───────────────────────────────────────────────────────────
emitter.on('ai.suggestion', async ({ io, userId, workspaceId, title, body, link }) => {
    try {
        const notifService = getNotifService();
        if (await shouldNotify(userId, workspaceId, 'message')) {
            await notifService.create(io, {
                recipient: userId,
                workspaceId,
                type: 'ai_suggestion',
                title: title || '🤖 AI Insight',
                body: body || '',
                link: link || null,
                meta: {},
            });
        }
    } catch (err) {
        logger.error('[NotifEmitter] ai.suggestion error:', err.message);
    }
});

// ─── Error handler ────────────────────────────────────────────────────────────
emitter.on('error', (err) => {
    logger.error('[NotificationEventEmitter] Unhandled error:', err.message);
});

module.exports = emitter;
