'use strict';

/**
 * Account-level notification preferences stored on User.preferences.notifications.
 *   GET /api/auth/me/preferences/notifications -> { emailDigest, marketingEmails, desktopPush, sound, mentionsOnly, dmNotifications }
 *   PUT /api/auth/me/preferences/notifications  (partial; booleans only, 400 otherwise) -> same object
 */

const logger = require('../../../utils/logger');

const NOTIFICATION_PREF_DEFAULTS = Object.freeze({
    emailDigest: true,
    marketingEmails: false,
    desktopPush: true,
    sound: true,
    mentionsOnly: false,
    dmNotifications: true,
});
const FIELDS = Object.keys(NOTIFICATION_PREF_DEFAULTS);

function withDefaults(stored) {
    const out = { ...NOTIFICATION_PREF_DEFAULTS };
    for (const k of FIELDS) {
        if (stored && typeof stored[k] === 'boolean') out[k] = stored[k];
    }
    return out;
}

async function getNotificationPreferences(req, res) {
    try {
        const User = require('../../../models/User');
        const user = await User.findById(req.user.sub).select('preferences.notifications').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(withDefaults(user.preferences?.notifications));
    } catch (err) {
        logger.error({ err: err.message }, 'GET NOTIFICATION PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to load notification preferences' });
    }
}

async function updateNotificationPreferences(req, res) {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ message: 'Request body must be an object' });
        }
        const $set = {};
        for (const k of FIELDS) {
            if (body[k] === undefined) continue;
            if (typeof body[k] !== 'boolean') {
                return res.status(400).json({ message: `${k} must be a boolean` });
            }
            $set[`preferences.notifications.${k}`] = body[k];
        }
        if (!Object.keys($set).length) {
            return res.status(400).json({ message: `Provide at least one of: ${FIELDS.join(', ')}` });
        }
        const User = require('../../../models/User');
        const user = await User.findByIdAndUpdate(req.user.sub, { $set }, { new: true })
            .select('preferences.notifications')
            .lean();
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(withDefaults(user.preferences?.notifications));
    } catch (err) {
        logger.error({ err: err.message }, 'UPDATE NOTIFICATION PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to update notification preferences' });
    }
}

module.exports = { NOTIFICATION_PREF_DEFAULTS, getNotificationPreferences, updateNotificationPreferences };
