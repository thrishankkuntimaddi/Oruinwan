const logger = require('./logger');

/** Workspace owner or admin (active membership in PostgreSQL, src/identity). */
async function isWorkspaceManager(userId, workspaceId) {
    try {
        const access = await require('../src/identity').workspaces.membership(workspaceId, userId);
        return !!(access && access.isAdmin);
    } catch (err) {
        logger.error('Error checking workspace manager status:', err);
        return false;
    }
}

function canEditTask(task, userId, isManager) {
    
    if (task.isCreator(userId)) return true;

    
    if (isManager) return true;

    return false;
}

function canChangeStatus(task, userId, isManager) {
    
    if (task.isAssignee(userId)) return true;

    
    if (isManager) return true;

    return false;
}

function canManageAssignees(task, userId, isManager) {
    
    if (task.isCreator(userId)) return true;

    
    if (isManager) return true;

    return false;
}

function canDelete(task, userId, isManager) {
    return canEditTask(task, userId, isManager);
}

function canAddSubtask(task, userId, isManager) {
    
    if (task.isCreator(userId)) return true;

    
    if (task.isAssignee(userId)) return true;

    
    if (isManager) return true;

    return false;
}

function canRequestTransfer(task, userId) {
    return task.isAssignee(userId);
}

function canHandleTransfer(task, userId, isManager) {
    
    if (task.isCreator(userId)) return true;

    
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
