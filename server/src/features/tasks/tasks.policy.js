// server/src/features/tasks/tasks.policy.js
/**
 * Tasks Policy - Permission & Access Control Layer
 * 
 * STEP 2: Wraps legacy taskPermissions.js to prevent cross-layer coupling.
 * 
 * This layer provides a clean interface for the service layer without
 * directly exposing legacy utility functions. As we migrate other features
 * (Workspaces, Channels), we can update these implementations without
 * breaking the service layer.
 * 
 * @module features/tasks/tasks.policy
 */

const _Workspace = require('../../../models/Workspace');

// Import legacy permission utilities (to be gradually replaced)
const taskPermissionsLegacy = require('../../../utils/taskPermissions');

// ============================================================================
// WORKSPACE-LEVEL POLICIES
// ============================================================================

/**
 * Check if user is workspace manager (admin or owner)
 * 
 * @param {string} userId - User ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<boolean>}
 */
async function isWorkspaceManager(userId, workspaceId) {
    // Delegate to legacy for now
    return await taskPermissionsLegacy.isWorkspaceManager(userId, workspaceId);
}

// ============================================================================
// TASK-LEVEL POLICIES
// ============================================================================

/**
 * Check if user can edit task metadata (title, description, etc.)
 * 
 * Permission Rule:
 * - Creator: YES
 * - Workspace Manager: YES
 * - Assignee: NO
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canEditTask(task, userId, isManager) {
    return taskPermissionsLegacy.canEditTask(task, userId, isManager);
}

/**
 * Check if user can change task status
 * 
 * Permission Rule:
 * - Creator: YES (via assignee if self-assigned)
 * - Workspace Manager: YES
 * - ANY Assignee: YES (multi-assignee aware)
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canChangeStatus(task, userId, isManager) {
    return taskPermissionsLegacy.canChangeStatus(task, userId, isManager);
}

/**
 * Check if user can manage assignees (add/remove)
 * 
 * Permission Rule:
 * - Creator: YES
 * - Workspace Manager: YES
 * - Assignee: NO
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canManageAssignees(task, userId, isManager) {
    return taskPermissionsLegacy.canManageAssignees(task, userId, isManager);
}

/**
 * Check if user can delete task
 * 
 * Permission Rule:
 * - Creator: YES (global soft delete)
 * - Workspace Manager: YES (global soft delete)
 * - Assignee: CONDITIONAL (only if task.status === 'done', self-only delete)
 * 
 * Note: This is for basic permission check. The service layer implements
 * the full 3-tier deletion logic.
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canDelete(task, userId, isManager) {
    return taskPermissionsLegacy.canDelete(task, userId, isManager);
}

/**
 * Check if user can add subtask
 * 
 * Permission Rule:
 * - Creator: YES
 * - Workspace Manager: YES
 * - ANY Assignee: YES (multi-assignee aware)
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canAddSubtask(task, userId, isManager) {
    return taskPermissionsLegacy.canAddSubtask(task, userId, isManager);
}

/**
 * Check if user can request transfer
 * 
 * Permission Rule:
 * - Assignee: YES
 * - Others: NO
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function canRequestTransfer(task, userId) {
    return taskPermissionsLegacy.canRequestTransfer(task, userId);
}

/**
 * Check if user can approve/reject transfer
 * 
 * Permission Rule:
 * - Creator: YES
 * - Workspace Manager: YES
 * - Others: NO
 * 
 * @param {Object} task - Task document
 * @param {string} userId - User ID
 * @param {boolean} isManager - Is user a workspace manager?
 * @returns {boolean}
 */
function canHandleTransfer(task, userId, isManager) {
    return taskPermissionsLegacy.canHandleTransfer(task, userId, isManager);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Workspace-level
    isWorkspaceManager,

    // Task-level
    canEditTask,
    canChangeStatus,
    canManageAssignees,
    canDelete,
    canAddSubtask,
    canRequestTransfer,
    canHandleTransfer
};
