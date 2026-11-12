/**
 * Single source of truth for tasks on the client: statuses, priorities, the
 * status workflow and how a server task maps to what the UI renders.
 * The server's values are used as-is everywhere (no "Completed"/"Emergency"
 * aliases); only labels are for display.
 *
 * Statuses, the workflow and labels come from platform/tasks/taskRules.js (shared with the phone
 * app and checked against server/utils/workflowValidator.js).
 */
import {
    TASK_STATUSES, BOARD_STATUSES as SHARED_BOARD, OPEN_STATUSES as SHARED_OPEN, CLOSED_STATUSES as SHARED_CLOSED,
    TASK_TRANSITIONS, canTransition as sharedCanTransition, statusLabel as sharedStatusLabel,
    isClosedStatus, STATUS_LABELS, priorityLabel as sharedPriorityLabel,
} from '@platform/tasks/taskRules.js';

export const STATUSES = TASK_STATUSES;

export const STATUS_META = {
    backlog:     { label: STATUS_LABELS.backlog,     color: 'var(--text-muted)' },
    todo:        { label: STATUS_LABELS.todo,       color: 'var(--text-secondary)' },
    in_progress: { label: STATUS_LABELS.in_progress, color: '#6ea8fe' },
    review:      { label: STATUS_LABELS.review,   color: '#b59cff' },
    blocked:     { label: STATUS_LABELS.blocked,     color: 'var(--state-danger, #e05252)' },
    done:        { label: STATUS_LABELS.done,        color: 'var(--state-success, #5aba8a)' },
    cancelled:   { label: STATUS_LABELS.cancelled,   color: 'var(--text-muted)' },
};

/** Board columns, left to right. */
export const BOARD_STATUSES = SHARED_BOARD;
export const OPEN_STATUSES = SHARED_OPEN;
export const CLOSED_STATUSES = SHARED_CLOSED;
export const TRANSITIONS = TASK_TRANSITIONS;
export const canTransition = sharedCanTransition;
export const statusLabel = sharedStatusLabel;
export const isClosed = isClosedStatus;

export const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
export const PRIORITY_META = {
    highest: { label: 'Highest', color: '#e05252' },
    high:    { label: 'High',    color: '#f39a6b' },
    medium:  { label: 'Medium',  color: '#f5c46b' },
    low:     { label: 'Low',     color: '#6ea8fe' },
    lowest:  { label: 'Lowest',  color: 'var(--text-muted)' },
};
export const priorityLabel = sharedPriorityLabel;

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
        milestoneId: idOf(t.milestoneId || t.milestone) || null,
        recurring: t.recurring && t.recurring.isRecurring ? t.recurring : null,
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
