// server/src/features/tasks/tasks.automation.js
/**
 * Task Automation Rule Executor
 * 
 * Simple event-based rule engine. Called from tasks.service.js after
 * task create/update operations.
 * 
 * Supported triggers: 'on_create', 'on_complete'
 * Supported actions: 'move_to_done', 'assign_creator', 'set_high_priority'
 */

const Task = require('../../../models/Task');
const logger = require('../../../utils/logger');

/**
 * Execute automation rules for a given task and trigger event.
 * Fire-and-forget: never throws — errors are logged and swallowed.
 * 
 * @param {Object} task - Mongoose Task document
 * @param {string} trigger - Event that fired ('on_create' | 'on_complete')
 */
async function executeRules(task, trigger) {
    if (!task.automationRules || task.automationRules.length === 0) return;

    const matchingRules = task.automationRules.filter(r => r.trigger === trigger);
    if (matchingRules.length === 0) return;

    for (const rule of matchingRules) {
        try {
            await applyAction(task, rule.action);
        } catch (err) {
            logger.error(`[AUTOMATION] Rule action "${rule.action}" failed for task ${task._id}:`, err.message);
        }
    }
}

async function applyAction(task, action) {
    switch (action) {
        case 'move_to_done':
            if (task.status !== 'done') {
                await Task.findByIdAndUpdate(task._id, { status: 'done', completedAt: new Date() });
                logger.info(`[AUTOMATION] move_to_done applied to task ${task._id}`);
            }
            break;

        case 'assign_creator':
            if (!task.assignedTo.map(id => id.toString()).includes(task.createdBy.toString())) {
                task.assignedTo.push(task.createdBy);
                await task.save();
                logger.info(`[AUTOMATION] assign_creator applied to task ${task._id}`);
            }
            break;

        case 'set_high_priority':
            if (task.priority !== 'high') {
                await Task.findByIdAndUpdate(task._id, { priority: 'high' });
                logger.info(`[AUTOMATION] set_high_priority applied to task ${task._id}`);
            }
            break;

        default:
            logger.warn(`[AUTOMATION] Unknown action "${action}" for task ${task._id}`);
    }
}

module.exports = { executeRules };
