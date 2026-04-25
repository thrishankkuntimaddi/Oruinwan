const Notification = require('../../models/Notification');
const logger = require('../../../utils/logger');
const notifEmitter = require('./notificationEventEmitter');

const getTask = () => require('../../models/Task');
const getUser = () => require('../../models/User');

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

async function checkDueSoonTasks(io) {
    try {
        const Task = getTask();
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const tasks = await Task.find({
            deleted: { $ne: true },
            status: { $nin: ['done', 'cancelled'] },
            dueDate: { $gte: now, $lte: in24h },
        }).lean();

        if (tasks.length === 0) return;

        logger.info(`[NotifCron] ${tasks.length} due-soon task(s) found`);

        for (const task of tasks) {
            const assignees = task.assignedTo || [];
            for (const assigneeId of assignees) {
                const hoursUntilDue = Math.ceil((new Date(task.dueDate) - now) / (60 * 60 * 1000));
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

function startNotificationsCron(io) {
    logger.info('[NotifCron] Starting notification cron jobs...');

    
    setTimeout(() => generateDigest(io), 30_000);

    
    setInterval(() => generateDigest(io), DIGEST_INTERVAL_MS);

    
    setInterval(() => checkDueSoonTasks(io), DUE_SOON_INTERVAL_MS);

    logger.info('[NotifCron] Notification cron jobs registered ✔');
}

module.exports = { startNotificationsCron, generateDigest, checkDueSoonTasks };
