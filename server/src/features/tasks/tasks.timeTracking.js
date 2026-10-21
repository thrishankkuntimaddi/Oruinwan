'use strict';

/**
 * Time tracking on a task (pure; both task stores).
 *
 * task.timeTracking = {
 *   totalTime: seconds of every closed session (kept for older clients),
 *   sessions: [{ start, end, user, source: 'timer'|'manual', note }]
 * }
 * Each member runs their own timer: one open session per user per task.
 * Sessions saved before per-user tracking have no `user`; they count towards
 * the task total and are reported under userId null.
 */

const MAX_MANUAL_SECONDS = 24 * 60 * 60;

function badRequest(message) {
    return Object.assign(new Error(message), { statusCode: 400 });
}

const uid = (v) => (v === null || v === undefined ? null : String(v?._id || v));

/** Plain, mutable copy with Date fields. */
function cloneTimeTracking(tt) {
    return {
        totalTime: Number(tt?.totalTime || 0),
        sessions: (tt?.sessions || []).map((s) => {
            const o = typeof s.toObject === 'function' ? s.toObject() : s;
            return {
                start: o.start ? new Date(o.start) : null,
                end: o.end ? new Date(o.end) : null,
                user: uid(o.user),
                source: o.source || 'timer',
                ...(o.note ? { note: String(o.note) } : {}),
            };
        }),
    };
}

/** The caller's open session; legacy open sessions without a user also count as theirs. */
function findOpenSession(tt, userId) {
    const me = String(userId);
    const open = tt.sessions.filter((s) => s.start && !s.end);
    return open.reverse().find((s) => s.user === me) || open.find((s) => !s.user) || null;
}

function start(tt, userId, now = new Date()) {
    const next = cloneTimeTracking(tt);
    if (findOpenSession(next, userId)) throw badRequest('A timer session is already running. Stop it first.');
    next.sessions.push({ start: now, end: null, user: String(userId), source: 'timer' });
    return next;
}

function stop(tt, userId, now = new Date()) {
    const next = cloneTimeTracking(tt);
    const open = findOpenSession(next, userId);
    if (!open) throw badRequest('No active timer session found');
    open.end = now;
    if (!open.user) open.user = String(userId);
    const elapsed = Math.max(0, Math.floor((now - open.start) / 1000));
    next.totalTime += elapsed;
    return { timeTracking: next, elapsed };
}

/** Log time worked without a timer: { seconds | minutes, start?, note? }. */
function logManual(tt, userId, { seconds, minutes, start: startAt, note } = {}, now = new Date()) {
    const secs = seconds !== undefined ? Number(seconds) : Number(minutes) * 60;
    if (!Number.isFinite(secs) || secs <= 0 || secs > MAX_MANUAL_SECONDS) {
        throw badRequest('Logged time must be between 1 second and 24 hours');
    }
    const end = startAt ? new Date(new Date(startAt).getTime() + secs * 1000) : now;
    if (Number.isNaN(end.getTime())) throw badRequest('Invalid start date');
    const begin = new Date(end.getTime() - Math.floor(secs) * 1000);
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
        throw badRequest('note must be a string of at most 500 characters');
    }
    const next = cloneTimeTracking(tt);
    next.sessions.push({ start: begin, end, user: String(userId), source: 'manual', ...(note ? { note } : {}) });
    next.totalTime += Math.floor(secs);
    return next;
}

/**
 * Totals: { totalSeconds, runningSeconds, byUser: [{ userId, seconds, running, sessions }] }.
 * Running sessions count up to `now` in runningSeconds and per-user seconds.
 */
function totals(tt, now = new Date()) {
    const c = cloneTimeTracking(tt);
    const byUser = new Map();
    let total = 0;
    let running = 0;
    for (const s of c.sessions) {
        if (!s.start) continue;
        const end = s.end || now;
        const secs = Math.max(0, Math.floor((end - s.start) / 1000));
        const key = s.user || null;
        const row = byUser.get(key) || { userId: key, seconds: 0, running: false, sessions: 0 };
        row.seconds += secs;
        row.sessions += 1;
        if (!s.end) { row.running = true; running += secs; } else total += secs;
        byUser.set(key, row);
    }
    return {
        totalSeconds: total,
        runningSeconds: running,
        byUser: [...byUser.values()].sort((a, b) => b.seconds - a.seconds),
    };
}

/** Parse optional report bounds; throws 400 on bad dates. */
function parseRange({ from, to } = {}) {
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    if ((fromD && Number.isNaN(fromD.getTime())) || (toD && Number.isNaN(toD.getTime()))) throw badRequest('Invalid date range');
    return { from: fromD, to: toD };
}

/**
 * Tracked time over many tasks: per user and per task. Only sessions that
 * started inside [from, to] count.
 */
function report(tasks, { from = null, to = null } = {}, now = new Date()) {
    const byUser = new Map();
    const byTask = [];
    for (const task of tasks || []) {
        const sessions = (task.timeTracking?.sessions || []).filter((x) => x.start
            && (!from || new Date(x.start) >= from) && (!to || new Date(x.start) <= to));
        if (!sessions.length) continue;
        const t = totals({ sessions }, now);
        byTask.push({
            taskId: String(task._id), title: task.title, issueKey: task.issueKey || null,
            estimatedHours: task.estimatedHours ?? null, seconds: t.totalSeconds + t.runningSeconds,
        });
        for (const row of t.byUser) {
            const acc = byUser.get(row.userId) || { userId: row.userId, seconds: 0, tasks: 0, running: false };
            acc.seconds += row.seconds;
            acc.tasks += 1;
            acc.running = acc.running || row.running;
            byUser.set(row.userId, acc);
        }
    }
    const users = [...byUser.values()].sort((a, b) => b.seconds - a.seconds);
    byTask.sort((a, b) => b.seconds - a.seconds);
    return { totalSeconds: users.reduce((n, u) => n + u.seconds, 0), byUser: users, byTask };
}

/** Attach { _id, username, profilePicture } as `user` on rows with a userId. */
async function attachUsers(rows, identity) {
    const ids = rows.map((r) => r.userId).filter(Boolean);
    if (!ids.length) return rows;
    const users = await identity.users.findManyByIds(ids);
    const map = {};
    (users || []).forEach((u) => { map[String(u._id)] = { _id: String(u._id), username: u.username, profilePicture: u.profilePicture || null }; });
    rows.forEach((r) => { r.user = r.userId ? map[r.userId] || null : null; });
    return rows;
}

module.exports = { cloneTimeTracking, findOpenSession, start, stop, logManual, totals, parseRange, report, attachUsers, MAX_MANUAL_SECONDS };
