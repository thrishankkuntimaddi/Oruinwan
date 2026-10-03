const Task = require('../../../models/Task');
const logger = require('../../../utils/logger');
const { scheduleJob } = require('../../shared/jobs/scheduler');
const { tasksStore } = require('./tasks.store');

// Storage for the generator: MongoDB by default, PostgreSQL with TASKS_STORE=pg.
const store = {
    findDue(now) {
        if (tasksStore() === 'pg') return require('./tasks.repository').findRecurringDue(now);
        return Task.find({ 'recurring.isRecurring': true, 'recurring.nextDue': { $lte: now }, deleted: false }).lean();
    },
    async create(data) {
        if (tasksStore() === 'pg') {
            const repo = require('./tasks.repository');
            return repo.insert({ ...data, issueKey: data.workspace ? await repo.nextIssueKey(data.workspace) : null });
        }
        return new Task(data).save();
    },
    setNextDue(task, nextDue) {
        if (tasksStore() === 'pg') return require('./tasks.repository').update(task._id, { recurring: { ...task.recurring, nextDue } });
        return Task.findByIdAndUpdate(task._id, { 'recurring.nextDue': nextDue });
    },
};

async function runRecurringTaskJob() {
    logger.info('[TASKS_CRON] Running recurring task generator...');
    const now = new Date();

    try {
        
        const recurringTasks = await store.findDue(now);

        let count = 0;
        for (const task of recurringTasks) {
            try {
                
                await store.create({
                    company: task.company,
                    workspace: task.workspace,
                    project: task.project,
                    type: task.type,
                    taskType: task.taskType,
                    title: task.title,
                    description: task.description,
                    createdBy: task.createdBy,
                    assignedTo: task.assignedTo,
                    visibility: task.visibility,
                    channel: task.channel,
                    status: 'todo',
                    priority: task.priority,
                    dueDate: task.recurring.nextDue,
                    tags: task.tags || [],
                    labels: task.labels || [],
                    source: 'manual',
                    recurring: {
                        isRecurring: false, 
                        pattern: null,
                        interval: 1,
                        nextDue: null
                    }
                });

                
                const intervalDays = task.recurring.interval || 1;
                let nextDue;
                if (task.recurring.pattern === 'daily') {
                    nextDue = new Date(new Date(task.recurring.nextDue).getTime() + intervalDays * 86400000);
                } else if (task.recurring.pattern === 'weekly') {
                    nextDue = new Date(new Date(task.recurring.nextDue).getTime() + 7 * 86400000);
                } else {
                    
                    nextDue = new Date(new Date(task.recurring.nextDue).getTime() + intervalDays * 86400000);
                }

                await store.setNextDue(task, nextDue);
                count++;
            } catch (taskErr) {
                logger.error(`[TASKS_CRON] Error processing task ${task._id}:`, taskErr.message);
            }
        }
        logger.info(`[TASKS_CRON] Processed ${count} recurring task(s).`);
    } catch (err) {
        logger.error('[TASKS_CRON] Job failed:', err.message);
    }
}

/** Generates the next occurrence of recurring tasks. One run per day fleet-wide. */
function startRecurringTasksCron() {
    logger.info('[TASKS_CRON] Recurring task generator scheduled (runs every 24h).');
    return scheduleJob({
        name: 'recurring-tasks',
        intervalMs: 24 * 60 * 60 * 1000,
        run: runRecurringTaskJob,
    });
}

module.exports = { startRecurringTasksCron, runRecurringTaskJob };
