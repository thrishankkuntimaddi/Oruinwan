const NotificationPreference = require('./notificationPreference.model');

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
        if (typeof updates[key] === "boolean") sanitized[key] = updates[key];
    }

    const prefs = await NotificationPreference.findOneAndUpdate(
        { userId, workspaceId },
        { $set: sanitized },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return prefs;
}

module.exports = { getUserPreferences, updateUserPreferences };
