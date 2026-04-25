const Workspace = require('../../../models/Workspace');

function canView(note, userId) {
    const userIdStr = userId.toString();

    
    if (note.owner.toString() === userIdStr) return true;

    
    if (note.isPublic) return true;

    
    if (note.sharedWith.some(id => id.toString() === userIdStr)) return true;

    return false;
}

function canEdit(note, userId) {
    const userIdStr = userId.toString();

    
    if (note.owner.toString() === userIdStr) return true;

    
    if (note.allowEditing && note.sharedWith.some(id => id.toString() === userIdStr)) return true;

    return false;
}

function isNoteOwner(note, userId) {
    return note.owner.toString() === userId.toString();
}

async function isWorkspaceMember(userId, workspaceId) {
    try {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return false;
        return workspace.isMember(userId);
    } catch (err) {
        console.error('Error checking workspace membership:', err);
        return false;
    }
}

module.exports = {
    canView,
    canEdit,
    isNoteOwner,
    isWorkspaceMember
};
