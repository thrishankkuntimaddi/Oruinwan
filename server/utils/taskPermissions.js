const Workspace = require('../models/Workspace');

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
