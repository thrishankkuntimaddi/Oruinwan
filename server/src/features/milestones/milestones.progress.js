'use strict';

/**
 * Pure progress maths shared by milestones and roadmap items.
 *
 * Task progress: cancelled tasks are left out; percent = done / counted.
 * Milestone progress: tasks under the milestone, or — when it has none — 100
 * for status 'completed' and 0 otherwise.
 */

const DONE = 'done';
const IGNORED = new Set(['cancelled']);

function taskProgress(tasks) {
    const counted = (tasks || []).filter((t) => !IGNORED.has(t.status));
    const done = counted.filter((t) => t.status === DONE).length;
    const total = counted.length;
    const estimatedHours = counted.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
    const remainingHours = counted.filter((t) => t.status !== DONE).reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
    return {
        total,
        done,
        open: total - done,
        percent: total ? Math.round((done / total) * 100) : 0,
        estimatedHours,
        remainingHours,
    };
}

function milestoneProgress(milestone, tasksOfMilestone) {
    const tasks = taskProgress(tasksOfMilestone);
    const percent = tasks.total ? tasks.percent : (milestone.status === 'completed' ? 100 : 0);
    const complete = milestone.status === 'completed' || (tasks.total > 0 && tasks.done === tasks.total);
    return { ...tasks, percent, complete };
}

/**
 * Roadmap item progress from its linked milestones and tasks (deduplicated).
 * `allTasks` holds every task reachable from the item (direct, via milestones, via project).
 */
function itemProgress(item, milestones, allTasks) {
    const byMilestone = new Map();
    for (const t of allTasks) {
        if (!t.milestoneId) continue;
        if (!byMilestone.has(t.milestoneId)) byMilestone.set(t.milestoneId, []);
        byMilestone.get(t.milestoneId).push(t);
    }
    const ms = milestones.map((m) => {
        const id = String(m._id);
        return { _id: id, name: m.name, status: m.status, dueDate: m.dueDate || null, ...milestoneProgress(m, byMilestone.get(id) || []) };
    });
    const tasks = taskProgress(allTasks);
    const milestonesDone = ms.filter((m) => m.complete).length;
    let percent;
    if (tasks.total) percent = tasks.percent;
    else if (ms.length) percent = Math.round((milestonesDone / ms.length) * 100);
    else percent = item.status === 'done' ? 100 : 0;
    return {
        percent,
        tasks,
        milestones: { total: ms.length, completed: milestonesDone, items: ms },
    };
}

module.exports = { taskProgress, milestoneProgress, itemProgress };
