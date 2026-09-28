/**
 * Single source of truth for tasks on the client: statuses, priorities, the
 * status workflow and how a server task maps to what the UI renders.
 * The server's values are used as-is everywhere (no "Completed"/"Emergency"
 * aliases); only labels are for display.
 *
 * Keep TRANSITIONS in sync with server/utils/workflowValidator.js.
 */

export const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

export const STATUS_META = {
    backlog:     { label: 'Backlog',     color: 'var(--text-muted)' },
    todo:        { label: 'To do',       color: 'var(--text-secondary)' },
    in_progress: { label: 'In progress', color: '#6ea8fe' },
    review:      { label: 'In review',   color: '#b59cff' },
    blocked:     { label: 'Blocked',     color: 'var(--state-danger, #e05252)' },
    done:        { label: 'Done',        color: 'var(--state-success, #5aba8a)' },
    cancelled:   { label: 'Cancelled',   color: 'var(--text-muted)' },
};

/** Board columns, left to right. */
export const BOARD_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done'];

export const OPEN_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked'];
export const CLOSED_STATUSES = ['done', 'cancelled'];

const others = (s) => OPEN_STATUSES.filter((x) => x !== s);
export const TRANSITIONS = {
    backlog:     [...others('backlog'), 'done', 'cancelled'],
    todo:        [...others('todo'), 'done', 'cancelled'],
    in_progress: [...others('in_progress'), 'done', 'cancelled'],
    review:      [...others('review'), 'done', 'cancelled'],
    blocked:     [...others('blocked'), 'done', 'cancelled'],
    done:        ['todo', 'in_progress', 'review'],
    cancelled:   ['backlog', 'todo'],
};

export const canTransition = (from, to) => from === to || (TRANSITIONS[from] || []).includes(to);
export const statusLabel = (s) => STATUS_META[s]?.label || String(s || '').replace(/_/g, ' ');
export const isClosed = (s) => CLOSED_STATUSES.includes(s);

export const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
export const PRIORITY_META = {
    highest: { label: 'Highest', color: '#e05252' },
    high:    { label: 'High',    color: '#f39a6b' },
    medium:  { label: 'Medium',  color: '#f5c46b' },
    low:     { label: 'Low',     color: '#6ea8fe' },
    lowest:  { label: 'Lowest',  color: 'var(--text-muted)' },
};
export const priorityLabel = (p) => PRIORITY_META[p]?.label || 'Medium';

/** Normalise legacy/UI values ("Completed", "In Progress", "Emergency", …) to server values. */
export function toStatus(value) {
    const v = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (STATUSES.includes(v)) return v;
    if (v === 'completed' || v === 'complete') return 'done';
    if (v === 'to_do') return 'todo';
    if (v === 'in_review') return 'review';
    if (v === 'canceled') return 'cancelled';
    return 'todo';
}
export function toPriority(value) {
    const v = String(value || '').trim().toLowerCase();
    if (PRIORITIES.includes(v)) return v;
    if (v === 'emergency' || v === 'urgent' || v === 'critical') return 'highest';
    return 'medium';
}

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');
const person = (u) => (u && typeof u === 'object'
    ? { id: idOf(u), username: u.username || u.name || 'Unknown', profilePicture: u.profilePicture || null }
    : u ? { id: String(u), username: 'Unknown', profilePicture: null } : null);

/**
 * Map a server task document to the shape every Tasks screen uses. Server
 * field names are kept (status, priority, assignedTo…) with a few derived
 * helpers; nothing is dropped.
 */
export function mapTask(t) {
    if (!t) return null;
    const assignees = (t.assignedTo || []).map(person).filter(Boolean);
    const channel = t.channel && typeof t.channel === 'object' ? { id: idOf(t.channel), name: t.channel.name || '' } : t.channel ? { id: String(t.channel), name: '' } : null;
    return {
        ...t,
        id: idOf(t),
        _id: idOf(t),
        title: t.title || '',
        description: t.description || '',
        status: toStatus(t.status),
        priority: toPriority(t.priority),
        assignees,
        assigneeIds: assignees.map((a) => a.id),
        creator: person(t.createdBy),
        creatorId: idOf(t.createdBy),
        channel,
        channelId: channel?.id || null,
        dueDate: t.dueDate || null,
        deleted: !!t.deleted,
        isSubtask: t.type === 'subtask' || !!t.parentTask,
        parentTaskId: idOf(t.parentTask) || null,
        subtasks: (t.subtasks || []).map((s) => (s && typeof s === 'object'
            ? { id: idOf(s), title: s.title || '', status: toStatus(s.status), assignees: (s.assignedTo || []).map(person).filter(Boolean) }
            : { id: String(s), title: '', status: 'todo', assignees: [] })),
        watchers: (t.watchers || []).map(idOf),
        attachments: t.attachments || [],
        labels: t.labels || [],
        timeTracking: t.timeTracking || null,
        dependencies: (t.dependencies || []).map((d) => (d && typeof d === 'object' ? { id: idOf(d), title: d.title || '', status: d.status ? toStatus(d.status) : null } : { id: String(d), title: '', status: null })),
        sprintId: idOf(t.sprintId || t.sprint) || null,
        blockedReason: t.blockedReason || null,
        completionNote: t.completionNote || '',
        linkedIssues: t.linkedIssues || [],
        transferRequest: t.transferRequest || null,
        issueKey: t.issueKey || null,
        issueType: t.issueType || t.type || 'task',
    };
}

/** Add or replace a task in a list by id (socket events and API responses can race). */
export function upsertTask(list, task) {
    if (!task?.id) return list;
    const i = list.findIndex((x) => x.id === task.id);
    if (i === -1) return [task, ...list];
    const next = list.slice();
    next[i] = { ...list[i], ...task };
    return next;
}

/** Human message from an API error (server message first). */
/** yyyy-mm-dd for <input type="date"> in local time (not UTC, so "today" stays today). */
export function toDateInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    // Date-only values are stored as UTC midnight: keep their calendar day.
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const taskErrorMessage = (err, fallback = 'Something went wrong with that task.') =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
