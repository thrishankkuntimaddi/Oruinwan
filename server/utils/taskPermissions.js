/**
 * Task Permission Helpers
 * 
 * Enforces permission matrix for task operations
 * Multi-assignee aware
 */

const Workspace = require('../models/Workspace');

/**
 * Check if user is workspace manager (admin or owner)
 * @param {string} userId - User ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<boolean>}
 */
async function isWorkspaceManager(userId, workspaceId) {
    try {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return false;

        const member = workspace.members.find(m =>
            m.user.toString() === userId.toString()
        );

        return member && (member.role === 'owner' || member.role === 'admin');
    } catch (err) {
        console.error('Error checking workspace manager status:', err);
        return false;
    }
}

/**
 * Check if user can edit task metadata (title, description, etc.)
 * Rule: Only creator or workspace manager
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canEditTask(task, userId, isManager) {
    // Creator can edit
    if (task.isCreator(userId)) return true;

    // Workspace manager can edit
    if (isManager) return true;

    return false;
}

/**
 * Check if user can change task status
 * Rule: ANY assignee or workspace manager
 * Multi-assignee aware: ANY assigned user can change status
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canChangeStatus(task, userId, isManager) {
    // ANY assignee can change status
    if (task.isAssignee(userId)) return true;

    // Workspace manager can change status
    if (isManager) return true;

    return false;
}

/**
 * Check if user can manage assignees (add/remove)
 * Rule: Only creator or workspace manager
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canManageAssignees(task, userId, isManager) {
    // Creator can manage
    if (task.isCreator(userId)) return true;

    // Workspace manager can manage
    if (isManager) return true;

    return false;
}

/**
 * Check if user can delete task
 * Rule: Only creator or workspace manager
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canDelete(task, userId, isManager) {
    return canEditTask(task, userId, isManager);
}

/**
 * Check if user can add subtask
 * Rule: Creator, any assignee, or workspace manager
 * Multi-assignee aware: ANY assigned user can add subtasks
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canAddSubtask(task, userId, isManager) {
    // Creator can add subtasks
    if (task.isCreator(userId)) return true;

    // ANY assignee can add subtasks
    if (task.isAssignee(userId)) return true;

    // Workspace manager can add subtasks
    if (isManager) return true;

    return false;
}

/**
 * Check if user can request transfer
 * Rule: Only assignees
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function canRequestTransfer(task, userId) {
    return task.isAssignee(userId);
}

/**
 * Check if user can approve/reject transfer
 * Rule: Only creator or workspace manager
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canHandleTransfer(task, userId, isManager) {
    // Creator can handle transfer
    if (task.isCreator(userId)) return true;

    // Workspace manager can handle transfer
    if (isManager) return true;

    return false;
}

module.exports = {
    isWorkspaceManager,
    canEditTask,
    canChangeStatus,
    canManageAssignees,
    canDelete,
    canAddSubtask,
    canRequestTransfer,
    canHandleTransfer
};
