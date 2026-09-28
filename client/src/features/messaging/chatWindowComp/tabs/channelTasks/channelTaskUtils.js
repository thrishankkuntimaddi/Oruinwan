/**
 * Helpers for the channel Tasks tab: server task → board task mapping,
 * channel membership of a task and the client mirror of the server's task
 * permission rules (server/utils/taskPermissions.js + tasks.service deleteTask).
 */
import { mapTask, toStatus } from '../../../../../utils/taskMeta';
import { taskAbilities, isCreator, isAssignee } from '../../../../../utils/taskPermissions';
import { formatDate as formatUserDate, isDateOnly } from '../../../../../utils/userDateFormat';
import { getUserPreferences } from '../../../../../hooks/useUserPreferences';

export const FONT = 'Inter, system-ui, -apple-system, sans-serif';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

function mapSubtask(s) {
    if (s && typeof s === 'object') {
        return {
            id: idOf(s),
            title: s.title || '',
            status: toStatus(s.status),
            assigneeIds: (s.assignedTo || []).map(idOf).filter(Boolean),
            deleted: !!s.deleted,
        };
    }
    return { id: String(s), title: '', status: 'todo', assigneeIds: [] };
}

/** mapTask + subtasks that keep their assignees (needed for the status permission). */
export function mapChannelTask(t) {
    const m = mapTask(t);
    if (!m) return null;
    m.subtasks = (t.subtasks || []).map(mapSubtask).filter((s) => s.id && !s.deleted);
    return m;
}

/** Tasks shown as cards on this channel's board: top-level, not deleted, linked to the channel. */
export const isBoardTask = (t, channelId) =>
    !!t && !t.isSubtask && !t.deleted && !!channelId && t.channelId === String(channelId);

/**
 * Older servers return subtasks as raw ids and list subtasks as top-level
 * tasks; fill the missing titles/statuses from the rest of the list.
 */
export function resolveSubtasks(task, byId) {
    if (!task.subtasks.some((s) => !s.title)) return task;
    return {
        ...task,
        subtasks: task.subtasks.map((s) => {
            if (s.title) return s;
            const full = byId.get(s.id);
            return full ? { id: s.id, title: full.title, status: full.status, assigneeIds: full.assigneeIds } : s;
        }),
    };
}

/**
 * What the viewer may do with a task (utils/taskPermissions mirrors the
 * server policy). The server also lets a task's creator change its status.
 */
export function taskPerms(task, userId, isManager) {
    const ctx = { userId: String(userId || ''), role: isManager ? 'admin' : 'member' };
    const can = taskAbilities(task, ctx);
    const creator = isCreator(task, ctx.userId);
    return {
        edit: can.edit,
        status: can.status || creator,
        assignees: can.assignees,
        delete: can.del,
        subtask: creator || isAssignee(task, ctx.userId) || isManager,
    };
}

/** Populated subtasks carry their assignees only, so the creator rule can't be checked here. */
export const canToggleSubtask = (sub, userId, isManager) =>
    isManager || sub.assigneeIds.includes(String(userId || ''));

/** Apply an update locally (optimistic). `memberById` resolves new assignee ids. */
export function applyLocalUpdate(task, updates, memberById) {
    const next = { ...task };
    ['status', 'priority', 'title', 'description', 'dueDate', 'blockedReason'].forEach((k) => {
        if (updates[k] !== undefined) next[k] = updates[k];
    });
    if (updates.status && updates.status !== 'blocked') next.blockedReason = null;
    if (updates.status && updates.status !== task.status) next.previousStatus = task.status;
    if (Array.isArray(updates.assignedTo)) {
        const ids = updates.assignedTo.map(String);
        next.assigneeIds = ids;
        next.assignees = ids.map((id) => task.assignees.find((a) => a.id === id) || memberById.get(id) || { id, username: 'Unknown', profilePicture: null });
    }
    return next;
}

export function initials(u) {
    const name = u?.username || u?.name || '';
    return name.slice(0, 2).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#b59cff', '#6ea8fe', '#5aba8a', '#f39a6b', '#f5c46b', '#7fd1c7', '#e59bc4'];
export function avatarColor(u) {
    const name = u?.username || u?.name || '';
    return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

/** Compact due date in the user's format; date-only (UTC midnight) values keep their calendar day. */
export function fmtDate(d) {
    if (!d) return '';
    return formatUserDate(d, getUserPreferences().region, { year: false, dateOnly: isDateOnly(d) });
}

export const isOverdue = (task) =>
    !!task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && task.status !== 'cancelled';

/** yyyy-mm-dd for <input type="date"> in local time. */
export function dateInputValue(d) {
    if (!d) return '';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
