'use strict';

/**
 * Team workload & delivery report (company admins).
 *
 * Built from tasks only — never messages. Per team, over the last N weeks:
 *   completedPerWeek  tasks completed in each Monday-based UTC week
 *   overduePerWeek    tasks that were open past their due date at the end of each week
 *   cycle time        hours from creation to completion (average and median)
 *   open / openOverdue  current workload
 *
 * A task counts for a team when at least one of its assignees is a member of
 * that team (a task shared by two teams counts once for each). Tasks with no
 * assignee in any team are reported under `unassigned` so totals add up.
 * Results are team aggregates only; no per-person rows.
 */

const Tasks = require('../tasks/tasks.query');
const identity = require('../../identity');
const { weekStartKey } = require('./activeDays');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_TASKS = 20000;
const CLOSED = ['done', 'cancelled'];

/** Monday-based UTC week windows, oldest first, the last one containing `now`. */
function weekWindows(weeks, now = new Date()) {
    const lastStart = Date.parse(`${weekStartKey(now)}T00:00:00Z`);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const start = lastStart - i * WEEK_MS;
        out.push({ weekStart: new Date(start).toISOString().slice(0, 10), start, end: start + WEEK_MS });
    }
    return out;
}

const ms = (d) => (d ? new Date(d).getTime() : null);
const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

function emptyRow(windows) {
    return {
        completedPerWeek: windows.map(() => 0),
        overduePerWeek: windows.map(() => 0),
        cycles: [],
        open: 0,
        openOverdue: 0,
    };
}

function addTask(row, task, windows, nowMs) {
    const created = ms(task.createdAt);
    const completed = task.status === 'done' ? ms(task.completedAt) : null;
    const due = ms(task.dueDate);
    const cancelled = task.status === 'cancelled';
    // When the task stopped being open (completed, or cancelled at its last update).
    const closedAt = completed ?? (cancelled ? ms(task.updatedAt) ?? created : null);

    windows.forEach((w, i) => {
        if (completed != null && completed >= w.start && completed < w.end) row.completedPerWeek[i] += 1;
        const at = Math.min(w.end, nowMs);
        const openAt = created != null && created <= at && (closedAt == null || closedAt > at);
        if (openAt && due != null && due < at) row.overduePerWeek[i] += 1;
    });
    if (completed != null && created != null && completed >= windows[0].start && completed >= created) {
        row.cycles.push((completed - created) / 3600000);
    }
    if (!CLOSED.includes(task.status)) {
        row.open += 1;
        if (due != null && due < nowMs) row.openOverdue += 1;
    }
}

function finish(row) {
    const { cycles, ...rest } = row;
    return {
        ...rest,
        completed: row.completedPerWeek.reduce((a, b) => a + b, 0),
        avgCycleHours: cycles.length ? round1(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null,
        medianCycleHours: round1(median(cycles)),
    };
}

/**
 * Pure report builder (tests). teams: [{ _id, name, members: [{ user }] }].
 * tasks: lean tasks with assignedTo, status, createdAt, completedAt, dueDate, updatedAt.
 */
function buildTeamDelivery(teams, tasks, { weeks = 8, now = new Date() } = {}) {
    const windows = weekWindows(weeks, now);
    const nowMs = now.getTime();
    const teamOf = new Map(); // userId -> Set(teamId)
    const rows = new Map();
    for (const t of teams) {
        const id = String(t._id);
        rows.set(id, { teamId: id, name: t.name, memberCount: (t.members || []).length, ...emptyRow(windows) });
        for (const m of t.members || []) {
            const uid = String(m.user?._id || m.user);
            if (!teamOf.has(uid)) teamOf.set(uid, new Set());
            teamOf.get(uid).add(id);
        }
    }
    const unassigned = emptyRow(windows);
    const total = emptyRow(windows);

    for (const task of tasks) {
        const hit = new Set();
        for (const a of task.assignedTo || []) {
            for (const tid of teamOf.get(String(a?._id || a)) || []) hit.add(tid);
        }
        if (hit.size) hit.forEach((tid) => addTask(rows.get(tid), task, windows, nowMs));
        else addTask(unassigned, task, windows, nowMs);
        addTask(total, task, windows, nowMs);
    }

    return {
        weeks: windows.map((w) => w.weekStart),
        teams: [...rows.values()].map(finish).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name)),
        unassigned: finish(unassigned),
        total: finish(total),
    };
}

/** Load the company's teams and relevant tasks, then build the report. */
async function getTeamDelivery(companyId, { weeks = 8, now = new Date() } = {}) {
    const span = Math.max(1, Math.min(Number(weeks) || 8, 26));
    const from = new Date(weekWindows(span, now)[0].start);
    const base = { company: companyId, deleted: false };
    const select = 'assignedTo status createdAt completedAt dueDate updatedAt';
    const [teams, completed, open] = await Promise.all([
        identity.teams.listForCompany(companyId),
        // Completed in the window (throughput, cycle time, and late completions for the overdue trend).
        Tasks.find({ ...base, completedAt: { $gte: from } }, { select, limit: MAX_TASKS }),
        // Still open (overdue trend and current workload). Tasks cancelled earlier drop out of the trend.
        Tasks.find({ ...base, status: { $nin: CLOSED } }, { select, limit: MAX_TASKS }),
    ]);
    const byId = new Map();
    for (const t of [...completed, ...open]) byId.set(String(t._id), t);
    return { ...buildTeamDelivery(teams || [], [...byId.values()], { weeks: span, now }), truncated: completed.length >= MAX_TASKS || open.length >= MAX_TASKS };
}

module.exports = { buildTeamDelivery, getTeamDelivery, weekWindows };
