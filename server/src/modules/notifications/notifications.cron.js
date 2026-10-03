const Notification = require('./notification.model');
const logger = require('../../../utils/logger');
const notifEmitter = require('./notificationEventEmitter');
const { scheduleJob } = require('../../shared/jobs/scheduler');

const getTask = () => require('../../../models/Task');

async function generateDigest(io) {
    try {
        logger.info('[NotifCron] Running daily digest...');

        
        const pipeline = [
            { $match: { read: false, type: { $ne: 'digest' } } },
            {
                $group: {
                    _id: { recipient: '$recipient', workspaceId: '$workspaceId' },
                    count: { $sum: 1 },
                    types: { $addToSet: '$type' },
                }
            },
            { $match: { count: { $gte: 2 } } }, 
        ];

        const groups = await Notification.aggregate(pipeline);
        logger.info(`[NotifCron] Digest: ${groups.length} user-workspace groups to notify`);

        const notifService = require('./notificationService');

        for (const g of groups) {
            const { recipient, workspaceId } = g._id;
            const count = g.count;
            const typeLabels = g.types.join(', ');

            try {
                await notifService.create(io, {
                    recipient,
                    workspaceId,
                    type: 'digest',
                    title: `📬 You have ${count} unread notification${count === 1 ? '' : 's'}`,
                    body: `Topics: ${typeLabels.replace(/_/g, ' ')}`,
                    link: '/notifications',
                    meta: { count, types: g.types },
                });
            } catch (err) {
                
                logger.warn(`[NotifCron] Digest failed for ${recipient}:`, err.message);
            }
        }

        logger.info('[NotifCron] Daily digest complete');
    } catch (err) {
        logger.error('[NotifCron] generateDigest error:', err.message);
    }
}

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

const DIGEST_INTERVAL_MS   = 24 * 60 * 60 * 1000; 
const DUE_SOON_INTERVAL_MS =  1 * 60 * 60 * 1000; 

/** Daily digest and due-soon reminders; each runs on one instance per interval. */
function startNotificationsCron(io) {
    logger.info('[NotifCron] Starting notification cron jobs...');
    const stops = [
        scheduleJob({ name: 'notifications-digest', intervalMs: DIGEST_INTERVAL_MS, initialDelayMs: 30_000, run: () => generateDigest(io) }),
        scheduleJob({ name: 'notifications-due-soon', intervalMs: DUE_SOON_INTERVAL_MS, initialDelayMs: DUE_SOON_INTERVAL_MS, run: () => checkDueSoonTasks(io) }),
    ];
    logger.info('[NotifCron] Notification cron jobs registered ✔');
    return () => stops.forEach((stop) => stop());
}

module.exports = { startNotificationsCron, generateDigest, checkDueSoonTasks };
