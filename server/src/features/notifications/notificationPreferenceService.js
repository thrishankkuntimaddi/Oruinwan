const NotificationPreference = require('../../models/NotificationPreference');

async function getUserPreferences(userId, workspaceId) {
    let prefs = await NotificationPreference.findOne({ userId, workspaceId }).lean();
    if (!prefs) {
        
        prefs = await NotificationPreference.findOneAndUpdate(
            { userId, workspaceId },
            { $setOnInsert: { userId, workspaceId } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
    }
    return prefs;
}

async function updateUserPreferences(userId, workspaceId, updates) {
    const allowedFields = ['message', 'threadReply', 'task', 'meeting', 'email', 'push'];
    const sanitized = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) sanitized[key] = Boolean(updates[key]);
    }

    const prefs = await NotificationPreference.findOneAndUpdate(
        { userId, workspaceId },
        { $set: sanitized },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return prefs;
}

module.exports = { getUserPreferences, updateUserPreferences };
