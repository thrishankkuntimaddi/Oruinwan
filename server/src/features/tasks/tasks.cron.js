const Task = require('../../../models/Task');
const logger = require('../../../utils/logger');
const { scheduleJob } = require('../../shared/jobs/scheduler');
const { tasksStore } = require('./tasks.store');
const { planNextRun } = require('./tasks.recurrence');

const onPg = () => tasksStore() === 'pg';
const repo = () => require('./tasks.repository');

// Storage for the generator: MongoDB by default, PostgreSQL with TASKS_STORE=pg.
const store = {
    findDue(now) {
        if (onPg()) return repo().findRecurringDue(now);
        return Task.find({ 'recurring.isRecurring': true, 'recurring.nextDue': { $lte: now }, deleted: { $ne: true } }).lean();
    },
    /**
     * Move the rule forward only if nobody else did (several instances, or an
     * overlapping run): true when this run owns the occurrence.
     */
    async claim(task, recurring) {
        if (onPg()) return repo().claimRecurring(task._id, task.recurring.nextDue, recurring);
        const res = await Task.updateOne(
            { _id: task._id, 'recurring.nextDue': task.recurring.nextDue },
            { $set: { recurring } }
        );
        return (res.modifiedCount ?? res.nModified ?? 0) > 0;
    },
    async create(data) {
        if (onPg()) {
            return repo().insert({ ...data, issueKey: data.workspace ? await repo().nextIssueKey(data.workspace) : null });
        }
        const IssueKeyCounter = require('./issue-key-counter.model');
        let issueKey = null;
        if (data.workspace) {
            try { issueKey = await IssueKeyCounter.nextKey(data.workspace, 'TSK'); } catch { issueKey = null; }
        }
        return new Task({ ...data, issueKey }).save();
    },
    /** Live subtasks of the series' template task, copied onto each occurrence. */
    async subtasksOf(task) {
        if (onPg()) return repo().findMany({ parentTask: task._id, deleted: false, sort: { createdAt: 1 } });
        return Task.find({ parentTask: task._id, deleted: { $ne: true } }).sort({ createdAt: 1 }).lean();
    },
    async linkSubtasks(parent, subtaskIds) {
        if (onPg() || !subtaskIds.length) return;
        await Task.updateOne({ _id: parent._id }, { $push: { subtasks: { $each: subtaskIds } } });
    },
};

const NOT_RECURRING = { isRecurring: false, pattern: null, interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, nextDue: null };

/** Fields of a new occurrence of `task`, due at `dueDate`. */
function occurrenceOf(task, dueDate) {
    return {
        company: task.company,
        workspace: task.workspace,
        project: task.project,
        type: task.type === 'subtask' ? 'task' : task.type,
        taskType: task.taskType,
        title: task.title,
        description: task.description,
        createdBy: task.createdBy,
        assignedTo: task.assignedTo || [],
        visibility: task.visibility,
        channel: task.channel,
        status: 'todo',
        priority: task.priority,
        dueDate,
        estimatedHours: task.estimatedHours ?? null,
        storyPoints: task.storyPoints ?? null,
        milestoneId: task.milestoneId || null,
        sprintId: null,
        tags: task.tags || [],
        labels: task.labels || [],
        source: 'manual',
        recurring: { ...NOT_RECURRING },
    };
}

/** Generate one occurrence for a due recurring task. Returns the new task or null. */
async function generateOccurrence(task, now = new Date()) {
    const { occurrenceDue, recurring } = planNextRun(task.recurring, now);
    // Claim first so two runs never generate the same occurrence.
    const claimed = await store.claim(task, recurring);
    if (!claimed || !occurrenceDue) return null;

    const created = await store.create(occurrenceOf(task, occurrenceDue));
    const subtasks = await store.subtasksOf(task);
    const subIds = [];
    for (const sub of subtasks || []) {
        const copy = await store.create({
            ...occurrenceOf(sub, occurrenceDue),
            type: 'subtask',
            parentTask: created._id,
            dueDate: sub.dueDate ? occurrenceDue : null,
        });
        subIds.push(copy._id);
    }
    await store.linkSubtasks(created, subIds);
    return created;
}

async function runRecurringTaskJob(now = new Date()) {
    logger.info('[TASKS_CRON] Running recurring task generator...');
    let count = 0;
    try {
        const recurringTasks = await store.findDue(now);
        for (const task of recurringTasks || []) {
            try {
                if (await generateOccurrence(task, now)) count++;
            } catch (taskErr) {
                logger.error(`[TASKS_CRON] Error processing task ${task._id}:`, taskErr.message);
            }
        }
        logger.info(`[TASKS_CRON] Processed ${count} recurring task(s).`);
    } catch (err) {
        logger.error('[TASKS_CRON] Job failed:', err.message);
    }
    return count;
}

/**
 * Generates the next occurrence of recurring tasks. Hourly so a task due
 * today is created on the day it is due; claims keep it to one per occurrence
 * fleet-wide.
 */
function startRecurringTasksCron() {
    logger.info('[TASKS_CRON] Recurring task generator scheduled (runs hourly).');
    return scheduleJob({
        name: 'recurring-tasks',
        intervalMs: 60 * 60 * 1000,
        run: () => runRecurringTaskJob(),
    });
}

module.exports = { startRecurringTasksCron, runRecurringTaskJob, generateOccurrence, occurrenceOf };
