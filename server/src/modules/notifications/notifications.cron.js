const logger = require('../../../utils/logger');
const notifEmitter = require('./notificationEventEmitter');
const { scheduleJob } = require('../../shared/jobs/scheduler');
const jobs = require('./notificationJobs');

const getTask = () => require('../../../models/Task');

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

async function checkDueSoonTasks(io) {
    try {
        const Task = getTask();
        const now = new Date();
        const in24h = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

        // "Not yet notified for the current due window": never notified, or notified before the
        // 24h window of the (possibly rescheduled) current dueDate started.
        const notNotifiedForCurrentDueDate = {
            $or: [
                { dueSoonNotifiedAt: null },
                { $expr: { $lt: ['$dueSoonNotifiedAt', { $subtract: ['$dueDate', DUE_SOON_WINDOW_MS] }] } },
            ],
        };

        // TASKS_STORE=pg: same query and claim on PostgreSQL (tasks.repository.js).
        const onPg = require('../../features/tasks/tasks.store').tasksStore() === 'pg';
        const repo = onPg ? require('../../features/tasks/tasks.repository') : null;
        const tasks = onPg ? await repo.findDueSoon(now, in24h) : await Task.find({
            deleted: { $ne: true },
            status: { $nin: ['done', 'cancelled'] },
            dueDate: { $gte: now, $lte: in24h },
            ...notNotifiedForCurrentDueDate,
        }).select('_id title dueDate assignedTo workspace').lean();

        if (tasks.length === 0) return;

        logger.info(`[NotifCron] ${tasks.length} due-soon task(s) found`);

        for (const task of tasks) {
            // Atomically claim the reminder so concurrent instances/runs cannot double-send.
            const claimed = onPg
                ? await repo.claimDueSoon(task._id, task.dueDate, now)
                : (await Task.updateOne(
                    { _id: task._id, dueDate: task.dueDate, ...notNotifiedForCurrentDueDate },
                    { $set: { dueSoonNotifiedAt: now } }
                )).modifiedCount > 0;
            if (!claimed) continue;

            const assignees = task.assignedTo || [];
            const hoursUntilDue = Math.ceil((new Date(task.dueDate) - now) / (60 * 60 * 1000));
            for (const assigneeId of assignees) {
                notifEmitter.emit('task.due_soon', {
                    io,
                    assigneeId: assigneeId.toString(),
                    workspaceId: task.workspace?.toString(),
                    taskTitle: task.title,
                    taskId: task._id?.toString(),
                    dueDate: `in ${hoursUntilDue}h`,
                });
            }
        }
    } catch (err) {
        logger.error('[NotifCron] checkDueSoonTasks error:', err.message);
    }
}

const DUE_SOON_INTERVAL_MS =  1 * 60 * 60 * 1000; 
const MINUTE_MS = 60 * 1000;

/** Due-soon reminders and the notification jobs; each runs on one instance per interval.
 * (There is no in-app digest: the bell only holds real notifications.) */
function startNotificationsCron(io) {
    logger.info('[NotifCron] Starting notification cron jobs...');
    // Old "You have N unread" digest items from before 2.2 no longer belong in the bell.
    try { require('./notification.model').deleteMany({ type: 'digest' })?.catch?.(() => {}); } catch { /* not critical */ }
    // Unread "New message from …" rows from before grouping become one row per conversation.
    try {
        require('./notificationService').mergeLegacyChatNotifications()
            .then((n) => { if (n) logger.info(`[NotifCron] Merged ${n} old chat notifications into grouped rows`); })
            .catch((err) => logger.warn('[NotifCron] could not merge old chat notifications:', err.message));
    } catch { /* not critical */ }
    const stops = [
        scheduleJob({ name: 'notifications-due-soon', intervalMs: DUE_SOON_INTERVAL_MS, initialDelayMs: DUE_SOON_INTERVAL_MS, run: () => checkDueSoonTasks(io) }),
        // notificationJobs.js: reminders, suggestions, offline emails, digest emails.
        scheduleJob({ name: 'notifications-meeting-reminders', intervalMs: MINUTE_MS, initialDelayMs: 20_000, run: () => jobs.sendMeetingReminders(io) }),
        scheduleJob({ name: 'notifications-offline-email', intervalMs: 5 * MINUTE_MS, initialDelayMs: 60_000, run: () => jobs.sendOfflineEmails(io) }),
        scheduleJob({ name: 'notifications-ai-suggestions', intervalMs: 60 * MINUTE_MS, initialDelayMs: 5 * MINUTE_MS, run: () => jobs.sendAiSuggestions(io) }),
        scheduleJob({ name: 'notifications-digest-email', intervalMs: 60 * MINUTE_MS, initialDelayMs: 2 * MINUTE_MS, run: () => jobs.sendDigestEmails(io) }),
    ];
    logger.info('[NotifCron] Notification cron jobs registered ✔');
    return () => stops.forEach((stop) => stop());
}

module.exports = { startNotificationsCron, checkDueSoonTasks };
