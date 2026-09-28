/**
 * Who may do what with a task, mirroring server/utils/taskPermissions.js and
 * the delete/restore rules in server/src/features/tasks/tasks.service.js.
 * The server stays the authority; these only decide which controls to show.
 *
 * `task` is a mapped task (utils/taskMeta.mapTask); `ctx` is
 * { userId, role } where role is the viewer's workspace role.
 */

export const isManagerRole = (role) => role === 'owner' || role === 'admin';

const same = (a, b) => a != null && b != null && String(a) === String(b);

export const isCreator = (task, userId) => same(task?.creatorId, userId);
export const isAssignee = (task, userId) => (task?.assigneeIds || []).some((id) => same(id, userId));

/** Title, description, priority, due date, attachments. */
export const canEditTask = (task, { userId, role } = {}) => isCreator(task, userId) || isManagerRole(role);

/** Moving between statuses (incl. done / reopen): creator, assignees and managers. */
export const canChangeStatus = (task, { userId, role } = {}) => isCreator(task, userId) || isAssignee(task, userId) || isManagerRole(role);

export const canManageAssignees = (task, { userId, role } = {}) => isCreator(task, userId) || isManagerRole(role);

/** Move to trash (creator / manager) or hide a finished task (assignee). */
export const canDeleteTask = (task, { userId, role } = {}) =>
    isCreator(task, userId) || isManagerRole(role) || (isAssignee(task, userId) && task?.status === 'done');

/** True when deleting only hides the task for this user instead of trashing it. */
export const deleteOnlyHides = (task, { userId, role } = {}) => !isCreator(task, userId) && !isManagerRole(role);

export const canRestoreTask = (task, { userId, role } = {}) => isCreator(task, userId) || isManagerRole(role);
export const canPermanentlyDelete = canRestoreTask;

export const canRequestTransfer = (task, { userId } = {}) =>
    isAssignee(task, userId) && !isCreator(task, userId) && task?.transferRequest?.status !== 'pending';

export const canHandleTransfer = (task, { userId, role } = {}) => isCreator(task, userId) || isManagerRole(role);

export const canAddDependency = (task, { userId } = {}) => isCreator(task, userId) || isAssignee(task, userId);

/** Everything a Tasks screen needs, computed once per task. */
export function taskAbilities(task, ctx) {
    return {
        edit: canEditTask(task, ctx),
        status: canChangeStatus(task, ctx),
        assignees: canManageAssignees(task, ctx),
        del: canDeleteTask(task, ctx),
        restore: canRestoreTask(task, ctx),
        purge: canPermanentlyDelete(task, ctx),
        transfer: canRequestTransfer(task, ctx),
        handleTransfer: canHandleTransfer(task, ctx),
        dependency: canAddDependency(task, ctx),
    };
}
