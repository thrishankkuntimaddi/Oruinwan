'use strict';

/**
 * Account-level notification preferences stored on User.preferences.notifications.
 *   GET /api/auth/me/preferences/notifications
 *     -> { emailDigest, marketingEmails, desktopPush, sound, mentionsOnly, dmNotifications, digestFrequency }
 *   PUT /api/auth/me/preferences/notifications  (partial; booleans, digestFrequency one of
 *     'daily' | 'weekly' | 'off'; 400 otherwise) -> same object
 *
 * The digest email goes out only while emailDigest is true and digestFrequency is not 'off'
 * (emailDigest alone keeps its old meaning: true = daily digest).
 */

const logger = require('../../../utils/logger');

const NOTIFICATION_PREF_DEFAULTS = Object.freeze({
    emailDigest: true,
    marketingEmails: false,
    desktopPush: true,
    sound: true,
    mentionsOnly: false,
    dmNotifications: true,
    digestFrequency: 'daily',
});
const FIELDS = Object.keys(NOTIFICATION_PREF_DEFAULTS);
const DIGEST_FREQUENCIES = ['daily', 'weekly', 'off'];

function validValue(key, value) {
    if (key === 'digestFrequency') return DIGEST_FREQUENCIES.includes(value);
    return typeof value === 'boolean';
}

function withDefaults(stored) {
    const out = { ...NOTIFICATION_PREF_DEFAULTS };
    for (const k of FIELDS) {
        if (stored && validValue(k, stored[k])) out[k] = stored[k];
    }
    return out;
}

/** 'daily' | 'weekly' | 'off' — the effective digest email cadence for stored prefs. */
function digestCadence(stored) {
    const p = withDefaults(stored);
    return p.emailDigest ? p.digestFrequency : 'off';
}

async function getNotificationPreferences(req, res) {
    try {
        const user = await require('../../identity').users.findById(req.user.sub);
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
            if (!validValue(k, body[k])) {
                const expected = k === 'digestFrequency' ? `one of ${DIGEST_FREQUENCIES.join(', ')}` : 'a boolean';
                return res.status(400).json({ message: `${k} must be ${expected}` });
            }
            $set[`preferences.notifications.${k}`] = body[k];
        }
        if (!Object.keys($set).length) {
            return res.status(400).json({ message: `Provide at least one of: ${FIELDS.join(', ')}` });
        }
        const user = await require('../../identity/queries/auth').setUserPaths(req.user.sub, $set);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(withDefaults(user.preferences?.notifications));
    } catch (err) {
        logger.error({ err: err.message }, 'UPDATE NOTIFICATION PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to update notification preferences' });
    }
}

module.exports = {
    NOTIFICATION_PREF_DEFAULTS,
    DIGEST_FREQUENCIES,
    withDefaults,
    digestCadence,
    getNotificationPreferences,
    updateNotificationPreferences,
};
