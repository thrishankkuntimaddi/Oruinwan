'use strict';

/**
 * Account-level notification preferences stored on User.preferences.notifications.
 *   GET /api/auth/me/preferences/notifications
 *     -> { emailDigest, marketingEmails, desktopPush, sound, mentionsOnly, dmNotifications, digestFrequency, newSignInEmails }
 *   PUT /api/auth/me/preferences/notifications  (partial; booleans, digestFrequency one of
 *     'smart' | 'daily' | 'weekly' | 'off'; 400 otherwise) -> same object
 *
 * The digest email goes out only while emailDigest is true and digestFrequency is not 'off'.
 * 'smart' (the default): a daily email only on days with unread mentions, DMs or tasks that the
 * person hasn't opened the app for, otherwise one weekly roundup on Mondays.
 * Before 2.2 the default was 'daily'; a stored 'daily' the person never picked themselves
 * (no digestChosen flag) counts as the default, so it becomes 'smart'.
 * newSignInEmails turns the "new sign-in" security email on or off; other security emails
 * (password changed, signed out everywhere) always go out.
 */

const logger = require('../../../utils/logger');

const NOTIFICATION_PREF_DEFAULTS = Object.freeze({
    emailDigest: true,
    marketingEmails: false,
    desktopPush: true,
    sound: true,
    mentionsOnly: false,
    dmNotifications: true,
    digestFrequency: 'smart',
    newSignInEmails: true,
});
const FIELDS = Object.keys(NOTIFICATION_PREF_DEFAULTS);
const DIGEST_FREQUENCIES = ['smart', 'daily', 'weekly', 'off'];

function validValue(key, value) {
    if (key === 'digestFrequency') return DIGEST_FREQUENCIES.includes(value);
    return typeof value === 'boolean';
}

function withDefaults(stored) {
    const out = { ...NOTIFICATION_PREF_DEFAULTS };
    for (const k of FIELDS) {
        if (stored && validValue(k, stored[k])) out[k] = stored[k];
    }
    // The old default, never picked by the person: use the new default.
    if (out.digestFrequency === 'daily' && !stored?.digestChosen) out.digestFrequency = NOTIFICATION_PREF_DEFAULTS.digestFrequency;
    return out;
}

/** 'smart' | 'daily' | 'weekly' | 'off' — the effective digest email cadence for stored prefs. */
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
        // Remember that this cadence was the person's own choice (see withDefaults).
        if (body.digestFrequency !== undefined) $set['preferences.notifications.digestChosen'] = true;
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
