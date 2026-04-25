const Task = require('../../../models/Task');
const logger = require('../../../utils/logger');

async function runRecurringTaskJob() {
    logger.info('[TASKS_CRON] Running recurring task generator...');
    const now = new Date();

    try {
        
        const recurringTasks = await Task.find({
            'recurring.isRecurring': true,
            'recurring.nextDue': { $lte: now },
            deleted: false
        }).lean();

        let count = 0;
        for (const task of recurringTasks) {
            try {
                
                const newTask = new Task({
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
                await newTask.save();

                
                const intervalDays = task.recurring.interval || 1;
                let nextDue;
                if (task.recurring.pattern === 'daily') {
                    nextDue = new Date(task.recurring.nextDue.getTime() + intervalDays * 86400000);
                } else if (task.recurring.pattern === 'weekly') {
                    nextDue = new Date(task.recurring.nextDue.getTime() + 7 * 86400000);
                } else {
                    
                    nextDue = new Date(task.recurring.nextDue.getTime() + intervalDays * 86400000);
                }

                await Task.findByIdAndUpdate(task._id, { 'recurring.nextDue': nextDue });
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

function startRecurringTasksCron() {
    logger.info('[TASKS_CRON] Recurring task generator scheduled (runs every 24h).');
    
    runRecurringTaskJob();
    
    setInterval(runRecurringTaskJob, 24 * 60 * 60 * 1000);
}

module.exports = { startRecurringTasksCron };
