const { logAction } = require('../../../utils/historyLogger');

async function logNoteCreated(userId, note, companyId, metadata, req) {
    await logAction({
        userId,
        action: 'note_created',
        description: `Created note: ${note.title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId,
        metadata,
        req
    });
}

async function logNoteShared(userId, note, userIds, req) {
    await logAction({
        userId,
        action: 'note_shared',
        description: `Shared note: ${note.title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId: note.company,
        metadata: { sharedWith: userIds },
        req
    });
}

module.exports = {
    logNoteCreated,
    logNoteShared
};
