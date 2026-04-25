const EventEmitter = require('events');
const logger = require('../../../utils/logger');
const { taskAssignedTemplate, meetingScheduledTemplate } = require('../../../utils/emailTemplates');

class NotificationEventEmitter extends EventEmitter {}

const emitter = new NotificationEventEmitter();
emitter.setMaxListeners(50);

const getNotifService = () => require('./notificationService');
const getEmailService = () => require('./emailNotificationService');
const getPrefs = () => require('./notificationPreferenceService');

async function shouldNotify(userId, workspaceId, prefKey) {
    try {
        const prefService = getPrefs();
        const prefs = await prefService.getUserPreferences(userId, workspaceId);
        return prefs[prefKey] !== false; 
    } catch {
        return true; 
    }
}

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

emitter.on('task.assigned', async ({ io, assigneeId, assignerUsername, workspaceId, taskTitle, taskId, assigneeEmail }) => {
    try {
        const notifService = getNotifService();
        if (await shouldNotify(assigneeId, workspaceId, 'task')) {
            await notifService.taskAssigned(io, { assigneeId, assignerUsername, workspaceId, taskTitle, taskId });
        }

        
        const emailService = getEmailService();
        if (await shouldNotify(assigneeId, workspaceId, 'email') && assigneeEmail) {
            const tpl = taskAssignedTemplate(
                null,         
                taskTitle,
                assignerUsername,
                `${process.env.FRONTEND_URL || '#'}/tasks/${taskId || ''}`
            );
            await emailService.sendEmailNotification({
                to: assigneeEmail,
                subject: tpl.subject,
                html: tpl.html,
            });
        }
    } catch (err) {
        logger.error('[NotifEmitter] task.assigned error:', err.message);
    }
});

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

        
        for (let i = 0; i < recipientIds.length; i++) {
            const email = recipientEmails[i];
            if (email && await shouldNotify(recipientIds[i], workspaceId, 'email')) {
                const tpl = meetingScheduledTemplate(null, title, null, `${process.env.FRONTEND_URL || '#'}/huddles`);
                await emailService.sendEmailNotification({
                    to: email,
                    subject: tpl.subject,
                    html: tpl.html,
                });
            }
        }
    } catch (err) {
        logger.error('[NotifEmitter] meeting.scheduled error:', err.message);
    }
});

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

emitter.on('error', (err) => {
    logger.error('[NotificationEventEmitter] Unhandled error:', err.message);
});

const getAutomationService = () => {
    try { return require('../automations/automation.service'); } catch { return null; }
};

emitter.on('task.created', (data) => {
    const svc = getAutomationService();
    if (svc && data.workspaceId) svc.processEvent('task.created', data, data.io);
});

emitter.on('task.completed', (data) => {
    const svc = getAutomationService();
    if (svc && data.workspaceId) svc.processEvent('task.completed', data, data.io);
});

emitter.on('meeting.completed', (data) => {
    const svc = getAutomationService();
    if (svc && data.workspaceId) svc.processEvent('meeting.completed', data, data.io);
});

emitter.on('message.sent', (data) => {
    const svc = getAutomationService();
    if (svc && data.workspaceId) svc.processEvent('message.sent', data, data.io);
});

emitter.on('file.uploaded', (data) => {
    const svc = getAutomationService();
    if (svc && data.workspaceId) svc.processEvent('file.uploaded', data, data.io);
});

module.exports = emitter;
