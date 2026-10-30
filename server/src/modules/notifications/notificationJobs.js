'use strict';

/**
 * Background notification jobs (registered in notifications.cron.js):
 *
 *   sendMeetingReminders   every minute  in-app + push "starts in 10 min" for scheduled meetings
 *   sendAiSuggestions      hourly        rule-based nudges: overdue tasks, meeting and huddle action items
 *   sendOfflineEmails      every 5 min   email for unread mentions/DMs when the user is offline
 *   sendDigestEmails       hourly        daily / weekly digest email (counts + links only)
 *
 * Everything that must happen once is guarded by a NotificationClaim key, so
 * several instances, retries or overlapping runs never double-send. Messages are
 * end-to-end encrypted: no job ever reads or sends message content.
 */

const logger = require('../../../utils/logger');
const Notification = require('./notification.model');
const { claim } = require('./notificationClaim.model');

const getNotifService = () => require('./notificationService');
const getPrefs = () => require('./notificationPreferenceService');
const getEmail = () => require('./emailNotificationService');
const getTemplates = () => require('../../../utils/emailTemplates');
const getIdentity = () => require('../../identity');
const getPresence = () => require('../../features/presence/presence.service');
const getScheduledMeeting = () => require('../../models/ScheduledMeeting');
const getTask = () => require('../../../models/Task');
const getNote = () => require('../../../models/Note');
const getHuddleSession = () => require('../huddles/huddleSession.model');
const getHuddleNotes = () => require('../huddles/huddleNotes');
const getAccountPrefs = () => require('../../features/auth/notificationPreferences');
const appUrl = () => require('../../shared/utils/webAppUrl').webAppUrl();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const config = (env = process.env) => ({
    reminderLeadMinutes: num(env.MEETING_REMINDER_MINUTES, 10),
    offlineEmailMinutes: num(env.OFFLINE_EMAIL_MINUTES, 15),
    digestHourUtc: Math.min(23, Math.max(0, parseInt(env.DIGEST_EMAIL_HOUR_UTC ?? '8', 10) || 0)),
});

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const idStr = (v) => (v == null ? null : String(v._id || v));

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
function weekKey(d) {
    const x = new Date(d);
    const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
    x.setUTCDate(x.getUTCDate() - dow);
    return dayKey(x);
}

// ── Meeting reminders ────────────────────────────────────────────────────────

/**
 * Remind every invitee (organizer + participants) once, `reminderLeadMinutes`
 * before a scheduled meeting. The claim key includes the start time, so a
 * rescheduled meeting is reminded again for its new time. Category preference
 * `meeting` is honoured by notificationService.create.
 */
async function sendMeetingReminders(io, { now = new Date() } = {}) {
    const { reminderLeadMinutes } = config();
    const ScheduledMeeting = getScheduledMeeting();
    const until = new Date(now.getTime() + reminderLeadMinutes * MINUTE);
    const meetings = await ScheduledMeeting.find({
        status: 'scheduled',
        startTime: { $gt: now, $lte: until },
    }).select('_id workspaceId title startTime participants createdBy').lean();

    let sent = 0;
    for (const m of meetings) {
        const start = new Date(m.startTime);
        if (!(await claim(`meeting-reminder:${m._id}:${start.getTime()}`))) continue;
        const recipients = [...new Set([m.createdBy, ...(m.participants || [])].map(idStr).filter(Boolean))];
        const minutes = Math.max(1, Math.round((start.getTime() - now.getTime()) / MINUTE));
        const startsIn = `${minutes} min`;
        await getNotifService().createMany(io, recipients, {
            workspaceId: idStr(m.workspaceId),
            type: 'meeting_reminder',
            title: `Meeting starting in ${startsIn}`,
            body: m.title,
            link: `/meetings/${m._id}`,
            meta: {
                meetingId: String(m._id),
                scheduledMeetingId: String(m._id),
                meetingTitle: m.title,
                startTime: start.toISOString(),
                startsIn,
            },
        });
        sent += 1;
    }
    return { meetings: sent };
}

// ── Rule-based suggestions ───────────────────────────────────────────────────

const OVERDUE_LOOKBACK_MS = 60 * DAY;

async function findOverdueTasks(now) {
    const onPg = require('../../features/tasks/tasks.store').tasksStore() === 'pg';
    if (onPg) {
        return require('../../features/tasks/tasks.repository').findMany({
            deleted: false,
            statusNotIn: ['done', 'cancelled'],
            dueBefore: now,
            dueAfter: new Date(now.getTime() - OVERDUE_LOOKBACK_MS),
            limit: 5000,
        });
    }
    return getTask().find({
        deleted: { $ne: true },
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $lt: now, $gte: new Date(now.getTime() - OVERDUE_LOOKBACK_MS) },
    }).select('_id title dueDate assignedTo workspace').limit(5000).lean();
}

/** Group overdue tasks by assignee+workspace: [{ userId, workspaceId, count, oldest }]. */
function groupOverdue(tasks) {
    const groups = new Map();
    for (const t of tasks || []) {
        const ws = idStr(t.workspace);
        if (!ws) continue;
        for (const a of t.assignedTo || []) {
            const uid = idStr(a);
            if (!uid) continue;
            const key = `${uid}:${ws}`;
            const g = groups.get(key) || { userId: uid, workspaceId: ws, count: 0, oldest: null };
            g.count += 1;
            if (!g.oldest || new Date(t.dueDate) < new Date(g.oldest.dueDate)) g.oldest = t;
            groups.set(key, g);
        }
    }
    return [...groups.values()];
}

/**
 * Two modest rules, each at most once:
 *  - overdue tasks: one nudge per user per workspace per day;
 *  - a scheduled meeting that ended in the last 24h with open action items not
 *    yet turned into tasks: one nudge to the organizer, one to each assignee.
 * Preference `aiSuggestions` (workspace prefs) is honoured by notificationService.create.
 */
async function sendAiSuggestions(io, { now = new Date() } = {}) {
    const notif = getNotifService();
    const today = dayKey(now);
    let overdue = 0;
    let meetings = 0;

    for (const g of groupOverdue(await findOverdueTasks(now))) {
        if (!(await claim(`ai:overdue:${g.userId}:${g.workspaceId}:${today}`))) continue;
        const oldestTitle = g.oldest?.title ? `"${String(g.oldest.title).slice(0, 80)}"` : 'one task';
        await notif.aiSuggestion(io, {
            userId: g.userId,
            workspaceId: g.workspaceId,
            title: g.count === 1 ? 'You have an overdue task' : `You have ${g.count} overdue tasks`,
            body: g.count === 1
                ? `${oldestTitle} is past due — finish it or pick a new date.`
                : `Oldest: ${oldestTitle}. Review them or reschedule.`,
            link: notif.taskLink(g.workspaceId, g.count === 1 ? idStr(g.oldest) : null),
            meta: { kind: 'overdue_tasks', count: g.count },
        });
        overdue += 1;
    }

    const ended = await getScheduledMeeting().find({
        status: 'completed',
        updatedAt: { $gte: new Date(now.getTime() - DAY) },
        'actionItems.0': { $exists: true },
    }).select('_id workspaceId title createdBy actionItems').lean();

    for (const m of ended) {
        const open = (m.actionItems || []).filter((a) => a.status !== 'done' && !a.taskId);
        if (!open.length) continue;
        if (!(await claim(`ai:meeting-actions:${m._id}`))) continue;
        const workspaceId = idStr(m.workspaceId);
        const link = `/meetings/${m._id}`;
        const organizer = idStr(m.createdBy);
        if (organizer) {
            await notif.aiSuggestion(io, {
                userId: organizer,
                workspaceId,
                title: `"${String(m.title).slice(0, 80)}" ended with ${open.length} action item${open.length === 1 ? '' : 's'}`,
                body: 'Turn them into tasks so nothing slips.',
                link,
                meta: { kind: 'meeting_action_items', meetingId: String(m._id), count: open.length },
            });
        }
        const assignees = [...new Set(open.map((a) => idStr(a.assignedTo)).filter((u) => u && u !== organizer))];
        for (const uid of assignees) {
            await notif.aiSuggestion(io, {
                userId: uid,
                workspaceId,
                title: 'You have an action item from a meeting',
                body: String(m.title).slice(0, 200),
                link,
                meta: { kind: 'meeting_action_items', meetingId: String(m._id) },
            });
        }
        meetings += 1;
    }

    const huddles = await sendHuddleActionSuggestions(io, notif, now);
    return { overdue, meetings, huddles };
}

/**
 * Huddles that ended in the last 24h whose shared notes still have open action items (not done,
 * not turned into a task): one nudge to whoever started the huddle and one to each assignee,
 * once per huddle run. Huddles that held a scheduled meeting ("meeting-<id>") are covered by
 * the meeting rule above. Only the notes' action-item checklist is read, never messages.
 */
async function sendHuddleActionSuggestions(io, notif, now) {
    const sessions = await getHuddleSession().find({
        endedAt: { $gte: new Date(now.getTime() - DAY), $lte: now },
        workspace: { $ne: null },
        notes: { $ne: null },
        huddleId: { $not: /^meeting-/ },
    }).select('_id huddleId workspace channel dm channelName startedBy notes').lean();
    if (!sessions.length) return 0;

    const notes = await getNote().find({ _id: { $in: sessions.map((s) => s.notes) } }).select('_id content').lean();
    const contentOf = new Map(notes.map((n) => [idStr(n._id), n.content]));
    const { actionItems } = getHuddleNotes();

    let sent = 0;
    for (const s of sessions) {
        const open = actionItems(contentOf.get(idStr(s.notes)) || '[]')
            .filter((a) => !a.done && !a.taskId && String(a.text || '').trim());
        if (!open.length) continue;
        if (!(await claim(`ai:huddle-actions:${s._id}`))) continue;
        const workspaceId = idStr(s.workspace);
        const channelId = idStr(s.channel);
        const dmId = idStr(s.dm);
        const link = channelId ? `/channel/${channelId}` : (dmId ? `/dm/${dmId}` : '/huddles?tab=history');
        const where = s.channelName ? `The huddle in #${String(s.channelName).slice(0, 80)}` : 'Your huddle';
        const meta = { kind: 'huddle_action_items', huddleSessionId: String(s._id), noteId: idStr(s.notes) };
        const starter = idStr(s.startedBy);
        if (starter) {
            await notif.aiSuggestion(io, {
                userId: starter,
                workspaceId,
                title: `${where} ended with ${open.length} open action item${open.length === 1 ? '' : 's'}`,
                body: 'Turn them into tasks from the huddle notes so nothing slips.',
                link,
                meta: { ...meta, count: open.length },
            });
        }
        const assignees = [...new Set(open.map((a) => idStr(a.assigneeId)).filter((u) => u && u !== starter))];
        for (const uid of assignees) {
            await notif.aiSuggestion(io, {
                userId: uid,
                workspaceId,
                title: 'You have an action item from a huddle',
                body: open.filter((a) => idStr(a.assigneeId) === uid).map((a) => String(a.text).slice(0, 120)).join(' · ').slice(0, 200),
                link,
                meta,
            });
        }
        sent += 1;
    }
    return sent;
}

// ── Offline email for mentions / DMs ─────────────────────────────────────────

/** Is the user away long enough? Online/idle → no; offline and last seen >= N minutes ago → yes. */
async function isAwayFor(userId, user, minutes, now) {
    let presence = null;
    try { presence = await getPresence().getPresenceAsync(String(userId)); } catch { presence = null; }
    if (presence && (presence.status === 'online' || presence.status === 'idle')) return false;
    const lastSeen = presence?.lastSeen || user?.lastActivityAt || null;
    if (!lastSeen) return true;
    return now.getTime() - new Date(lastSeen).getTime() >= minutes * MINUTE;
}

function describe(n) {
    const who = n.meta?.senderUsername || 'Someone';
    if (n.type === 'dm') return `${who} sent you a direct message`;
    if (n.meta?.isEveryone) return n.meta?.channelName ? `${who} notified everyone in #${n.meta.channelName}` : `${who} notified everyone`;
    return n.meta?.channelName ? `${who} mentioned you in #${n.meta.channelName}` : `${who} mentioned you in a direct message`;
}

/**
 * Unread mentions / DMs older than OFFLINE_EMAIL_MINUTES whose recipient is
 * offline get ONE summary email per run ("alice mentioned you in #general").
 * Requires the workspace `email` toggle (and `message`), and for DMs the
 * account-level `dmNotifications`. Notifications are marked `emailedAt` once
 * handled; a recipient still online is re-checked on the next run, up to 24h.
 */
async function sendOfflineEmails(_io, { now = new Date() } = {}) {
    const { offlineEmailMinutes } = config();
    const pending = await Notification.find({
        type: { $in: ['mention', 'dm'] },
        read: false,
        emailedAt: null,
        createdAt: { $lte: new Date(now.getTime() - offlineEmailMinutes * MINUTE), $gte: new Date(now.getTime() - DAY) },
    }).select('_id recipient workspaceId type link meta createdAt').sort({ createdAt: 1 }).limit(2000).lean();
    if (!pending.length) return { emails: 0 };

    const byUser = new Map();
    for (const n of pending) {
        const uid = String(n.recipient);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push(n);
    }

    const users = await getIdentity().users.findManyByIds([...byUser.keys()]);
    let emails = 0;
    for (const [uid, items] of byUser) {
        try {
            const user = users.get(uid);
            if (!user) { await markEmailed(items, now); continue; }
            if (!(await isAwayFor(uid, user, offlineEmailMinutes, now))) continue; // re-check next run

            // Claim before sending: a concurrent run that loses the update sends nothing.
            const claimed = await markEmailed(items, now);
            if (!claimed || !user.email) continue;

            const account = getAccountPrefs().withDefaults(user.preferences?.notifications);
            const allowed = [];
            const prefsByWs = new Map();
            for (const n of items) {
                const ws = String(n.workspaceId);
                if (!prefsByWs.has(ws)) {
                    let p = null;
                    try { p = await getPrefs().getUserPreferences(uid, ws); } catch { p = null; }
                    prefsByWs.set(ws, p || {});
                }
                const p = prefsByWs.get(ws);
                if (p.email !== true || p.message === false) continue;
                if (n.type === 'dm' && account.dmNotifications === false) continue;
                allowed.push(n);
            }
            if (!allowed.length) continue;

            // Collapse repeats: "alice mentioned you in #general" ×3.
            const lines = new Map();
            for (const n of allowed) {
                const text = describe(n);
                const line = lines.get(text) || { text, count: 0, url: n.link ? `${appUrl()}${n.link}` : appUrl() };
                line.count += 1;
                lines.set(text, line);
            }
            const tpl = getTemplates().offlineActivityTemplate(user.firstName || user.username, [...lines.values()], appUrl());
            await getEmail().sendEmailNotification({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
            emails += 1;
        } catch (err) {
            logger.warn(`[NotifJobs] offline email failed for ${uid}: ${err.message}`);
        }
    }
    return { emails };
}

async function markEmailed(items, now) {
    const res = await Notification.updateMany(
        { _id: { $in: items.map((n) => n._id) }, emailedAt: null },
        { $set: { emailedAt: now } }
    );
    return (res?.modifiedCount ?? res?.nModified ?? 0) > 0;
}

// ── Digest email ─────────────────────────────────────────────────────────────

const DIGEST_LABELS = {
    mention: 'Mentions',
    dm: 'Direct messages',
    thread_reply: 'Thread replies',
    reaction: 'Reactions',
    task_assigned: 'Tasks assigned to you',
    task_comment: 'Task comments',
    task_status: 'Task status changes',
    task_updated: 'Task updates',
    task_due_soon: 'Tasks due soon',
    schedule_created: 'Meeting invitations',
    meeting_reminder: 'Meeting reminders',
    note_shared: 'Notes shared with you',
    ai_suggestion: 'Suggestions',
};

// Unread items that make a "smart" digest worth sending on a weekday.
const IMPORTANT_TYPES = new Set(['mention', 'dm', 'thread_reply', 'task_assigned', 'task_due_soon']);
const SMART_STALE_MS = 6 * 60 * 60 * 1000;

/**
 * Digest emails go out once the UTC hour reaches DIGEST_EMAIL_HOUR_UTC (default 8). Cadence comes
 * from the account prefs (emailDigest + digestFrequency):
 *   daily  — every day with something new;
 *   weekly — Mondays;
 *   smart  — (the default) a daily email only when there are unread mentions, DMs or tasks older
 *            than 6 hours and the person hasn't been active in any app today; otherwise one
 *            weekly roundup on Mondays.
 * Only notification counts per type and workspace links are sent — never message content.
 * Grouped chat rows count every message they hold. Users with nothing new get nothing.
 */
/** True when the person turned off every kind of notification in this workspace. */
async function workspaceMuted(uid, ws) {
    try {
        const p = await getPrefs().getUserPreferences(uid, ws);
        return Boolean(p) && ['message', 'threadReply', 'task', 'meeting'].every((k) => p[k] === false);
    } catch {
        return false;
    }
}

async function sendDigestEmails(_io, { now = new Date() } = {}) {
    const { digestHourUtc } = config();
    if (now.getUTCHours() < digestHourUtc) return { emails: 0 };
    const isMonday = now.getUTCDay() === 1;
    const dayStart = new Date(now.getTime() - DAY);
    const weekStart = new Date(now.getTime() - 7 * DAY);

    const rows = await Notification.aggregate([
        { $match: { updatedAt: { $gte: weekStart }, type: { $ne: 'digest' } } },
        { $addFields: { n: { $ifNull: ['$meta.count', 1] } } },
        {
            $group: {
                _id: { recipient: '$recipient', workspaceId: '$workspaceId', type: '$type' },
                week: { $sum: '$n' },
                day: { $sum: { $cond: [{ $gte: ['$updatedAt', dayStart] }, '$n', 0] } },
                unread: { $sum: { $cond: [{ $eq: ['$read', false] }, '$n', 0] } },
                oldestUnread: { $min: { $cond: [{ $eq: ['$read', false] }, '$createdAt', null] } },
            },
        },
    ]);
    if (!rows.length) return { emails: 0 };

    const byUser = new Map();
    for (const r of rows) {
        const uid = String(r._id.recipient);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push(r);
    }

    const identity = getIdentity();
    const users = await identity.users.findManyByIds([...byUser.keys()]);
    const wsNames = new Map();
    let emails = 0;

    for (const [uid, groups] of byUser) {
        try {
            const user = users.get(uid);
            if (!user || !user.email) continue;
            const pref = getAccountPrefs().digestCadence(user.preferences?.notifications);
            const cadence = pref === 'smart' ? smartCadence(groups, user, now, isMonday) : pref;
            if (!cadence || cadence === 'off' || (cadence === 'weekly' && !isMonday)) continue;
            // A smart daily email lists what is still unread; the others list what is new.
            const field = cadence === 'weekly' ? 'week' : pref === 'smart' ? 'unread' : 'day';

            const sections = new Map();
            const muted = new Map();
            for (const g of groups) {
                const count = g[field];
                if (!count) continue;
                const ws = String(g._id.workspaceId);
                // A workspace whose notifications are all switched off stays out of the digest too.
                if (!muted.has(ws)) muted.set(ws, await workspaceMuted(uid, ws));
                if (muted.get(ws)) continue;
                if (!sections.has(ws)) sections.set(ws, { workspaceId: ws, lines: [], unread: 0 });
                const s = sections.get(ws);
                s.lines.push({ label: DIGEST_LABELS[g._id.type] || g._id.type.replace(/_/g, ' '), count });
                s.unread += g.unread;
            }
            if (!sections.size) continue;

            // One digest per person per day at most (a smart daily email on a Monday replaces the weekly one).
            const key = pref === 'smart' ? `digest:s:${uid}:${dayKey(now)}`
                : cadence === 'weekly' ? `digest:w:${uid}:${weekKey(now)}` : `digest:d:${uid}:${dayKey(now)}`;
            if (!(await claim(key))) continue;

            const out = [];
            for (const s of sections.values()) {
                if (!wsNames.has(s.workspaceId)) {
                    let ws = null;
                    try { ws = await identity.workspaces.findById(s.workspaceId); } catch { ws = null; }
                    wsNames.set(s.workspaceId, ws?.name || 'Workspace');
                }
                s.lines.sort((a, b) => b.count - a.count);
                if (s.unread && field !== 'unread') s.lines.push({ label: 'Still unread', count: s.unread, unread: true });
                out.push({ workspaceName: wsNames.get(s.workspaceId), lines: s.lines });
            }
            const tpl = getTemplates().notificationDigestTemplate(user.firstName || user.username, cadence, out, appUrl());
            await getEmail().sendEmailNotification({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
            emails += 1;
        } catch (err) {
            logger.warn(`[NotifJobs] digest email failed for ${uid}: ${err.message}`);
        }
    }
    return { emails };
}

/**
 * What a "smart" digest does today: 'daily' when unread mentions/DMs/tasks have waited 6+ hours
 * and the person hasn't been active today, 'weekly' on Mondays, otherwise nothing (null).
 */
function smartCadence(groups, user, now, isMonday) {
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lastActive = user.lastActivityAt ? new Date(user.lastActivityAt) : null;
    const activeToday = !!(lastActive && lastActive >= startOfDay);
    const waiting = groups.some((g) => IMPORTANT_TYPES.has(g._id.type) && g.unread > 0
        && g.oldestUnread && now.getTime() - new Date(g.oldestUnread).getTime() >= SMART_STALE_MS);
    if (waiting && !activeToday) return 'daily';
    return isMonday ? 'weekly' : null;
}

module.exports = {
    config,
    smartCadence,
    weekKey,
    groupOverdue,
    describe,
    sendMeetingReminders,
    sendAiSuggestions,
    sendOfflineEmails,
    sendDigestEmails,
};
