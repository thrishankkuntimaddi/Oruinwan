/**
 * notificationPreferenceService.js
 *
 * CRUD helpers for NotificationPreference documents.
 * Used by the event emitter and REST routes.
 */

const NotificationPreference = require('../../models/NotificationPreference');

/**
 * Get (or create with defaults) user preferences for a workspace.
 * @param {string} userId
 * @param {string} workspaceId
 * @returns {Promise<NotificationPreference>}
 */
async function getUserPreferences(userId, workspaceId) {
    let prefs = await NotificationPreference.findOne({ userId, workspaceId }).lean();
    if (!prefs) {
        // Create defaults — do not wait on upsert conflicts
        prefs = await NotificationPreference.findOneAndUpdate(
            { userId, workspaceId },
            { $setOnInsert: { userId, workspaceId } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
    }
    return prefs;
}

/**
 * Update user preferences for a workspace.
 * @param {string} userId
 * @param {string} workspaceId
 * @param {Object} updates - Partial preference flags
 * @returns {Promise<NotificationPreference>}
 */
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
