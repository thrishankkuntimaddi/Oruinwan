'use strict';

/**
 * Workspace insights: how work is moving. Built from tasks only. Conversations are private
 * (end-to-end encrypted), so nothing here counts, ranks or compares people's messages.
 */
const Tasks = require('../../tasks/tasks.query');

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

const OPEN = { $nin: ['done', 'completed', 'cancelled'] };
const DONE = { $in: ['done', 'completed'] };

async function getProductivityInsights(workspaceId, days = 7) {
    const since = daysAgo(days);
    const [tasksCreated, tasksCompleted] = await Promise.all([
        Tasks.countDocuments({ workspace: workspaceId, createdAt: { $gte: since } }).catch(() => 0),
        Tasks.countDocuments({ workspace: workspaceId, status: DONE, updatedAt: { $gte: since } }).catch(() => 0),
    ]);
    return {
        period: `Last ${days} days`,
        tasksCreated,
        tasksCompleted,
        completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
    };
}

async function detectAnomalies(workspaceId) {
    const now = new Date();
    const week1 = daysAgo(7);
    const week2 = daysAgo(14);

    const [overdue, open, doneRecent, donePrior] = await Promise.all([
        Tasks.countDocuments({ workspace: workspaceId, status: OPEN, dueDate: { $lt: now } }).catch(() => 0),
        Tasks.countDocuments({ workspace: workspaceId, status: OPEN }).catch(() => 0),
        Tasks.countDocuments({ workspace: workspaceId, status: DONE, updatedAt: { $gte: week1 } }).catch(() => 0),
        Tasks.countDocuments({ workspace: workspaceId, status: DONE, updatedAt: { $gte: week2, $lt: week1 } }).catch(() => 0),
    ]);

    const anomalies = [];
    if (open > 0 && overdue / open >= 0.5 && overdue >= 3) {
        anomalies.push({ type: 'overdue_tasks', severity: 'high', message: `${overdue} of ${open} open tasks are past their due date`, data: { overdue, open } });
    } else if (overdue >= 3) {
        anomalies.push({ type: 'overdue_tasks', severity: 'medium', message: `${overdue} open tasks are past their due date`, data: { overdue, open } });
    }
    if (donePrior >= 4 && doneRecent < donePrior / 2) {
        const change = Math.round(((doneRecent - donePrior) / donePrior) * 100);
        anomalies.push({ type: 'completion_drop', severity: 'medium', message: `Tasks finished this week fell by ${Math.abs(change)}% compared with last week`, data: { doneRecent, donePrior, changePercent: change } });
    }

    return {
        anomalies,
        summary: anomalies.length === 0 ? 'Nothing unusual: work is moving as expected' : `${anomalies.length} thing${anomalies.length === 1 ? '' : 's'} to look at`,
    };
}

module.exports = { getProductivityInsights, detectAnomalies };
