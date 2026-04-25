const _Workspace = require('../../../models/Workspace');

const taskPermissionsLegacy = require('../../../utils/taskPermissions');

async function isWorkspaceManager(userId, workspaceId) {
    
    return await taskPermissionsLegacy.isWorkspaceManager(userId, workspaceId);
}

function canEditTask(task, userId, isManager) {
    return taskPermissionsLegacy.canEditTask(task, userId, isManager);
}

function canChangeStatus(task, userId, isManager) {
    return taskPermissionsLegacy.canChangeStatus(task, userId, isManager);
}

function canManageAssignees(task, userId, isManager) {
    return taskPermissionsLegacy.canManageAssignees(task, userId, isManager);
}

function canDelete(task, userId, isManager) {
    return taskPermissionsLegacy.canDelete(task, userId, isManager);
}

function canAddSubtask(task, userId, isManager) {
    return taskPermissionsLegacy.canAddSubtask(task, userId, isManager);
}

function canRequestTransfer(task, userId) {
    return taskPermissionsLegacy.canRequestTransfer(task, userId);
}

function canHandleTransfer(task, userId, isManager) {
    return taskPermissionsLegacy.canHandleTransfer(task, userId, isManager);
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
