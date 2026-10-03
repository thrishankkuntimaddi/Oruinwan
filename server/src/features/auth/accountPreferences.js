'use strict';

/**
 * Account privacy and region preferences stored on User.preferences.
 *   GET /api/auth/me/preferences/privacy -> { readReceipts, typingIndicators, allowDiscovery }
 *   PUT /api/auth/me/preferences/privacy  (partial; booleans only, 400 otherwise) -> same object
 *   GET /api/auth/me/preferences/region  -> { language, timezone, dateFormat, timeFormat }
 *   PUT /api/auth/me/preferences/region   (partial; validated, 400 otherwise) -> same object
 */

const logger = require('../../../utils/logger');
const {
    PRIVACY_FIELDS,
    privacyWithDefaults,
    rememberPrivacy,
} = require('./privacy.service');

const REGION_DEFAULTS = Object.freeze({
    language: 'en',
    timezone: 'auto',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
});
const REGION_FIELDS = Object.keys(REGION_DEFAULTS);
const LANGUAGES = ['en'];
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];
const TIME_FORMATS = ['12h', '24h'];

function isValidTimezone(tz) {
    if (tz === 'auto') return true;
    if (typeof tz !== 'string' || !tz.trim() || tz.length > 64) return false;
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

function regionWithDefaults(stored) {
    const out = { ...REGION_DEFAULTS };
    for (const k of REGION_FIELDS) {
        if (stored && typeof stored[k] === 'string' && stored[k]) out[k] = stored[k];
    }
    return out;
}

/** Returns { $set } or { error } for a partial region update body. */
function validateRegionUpdate(body) {
    const $set = {};
    if (body.language !== undefined) {
        if (!LANGUAGES.includes(body.language)) return { error: `language must be one of: ${LANGUAGES.join(', ')}` };
        $set['preferences.region.language'] = body.language;
    }
    if (body.timezone !== undefined) {
        if (!isValidTimezone(body.timezone)) return { error: "timezone must be 'auto' or a valid IANA time zone (e.g. Europe/London)" };
        $set['preferences.region.timezone'] = body.timezone;
    }
    if (body.dateFormat !== undefined) {
        if (!DATE_FORMATS.includes(body.dateFormat)) return { error: `dateFormat must be one of: ${DATE_FORMATS.join(', ')}` };
        $set['preferences.region.dateFormat'] = body.dateFormat;
    }
    if (body.timeFormat !== undefined) {
        if (!TIME_FORMATS.includes(body.timeFormat)) return { error: `timeFormat must be one of: ${TIME_FORMATS.join(', ')}` };
        $set['preferences.region.timeFormat'] = body.timeFormat;
    }
    if (!Object.keys($set).length) return { error: `Provide at least one of: ${REGION_FIELDS.join(', ')}` };
    return { $set };
}

function isPlainObject(body) {
    return body && typeof body === 'object' && !Array.isArray(body);
}

async function getPrivacyPreferences(req, res) {
    try {
        const user = await require('../../identity').users.findById(req.user.sub);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(privacyWithDefaults(user.preferences?.privacy));
    } catch (err) {
        logger.error({ err: err.message }, 'GET PRIVACY PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to load privacy preferences' });
    }
}

async function updatePrivacyPreferences(req, res) {
    try {
        const body = req.body;
        if (!isPlainObject(body)) return res.status(400).json({ message: 'Request body must be an object' });
        const $set = {};
        for (const k of PRIVACY_FIELDS) {
            if (body[k] === undefined) continue;
            if (typeof body[k] !== 'boolean') return res.status(400).json({ message: `${k} must be a boolean` });
            $set[`preferences.privacy.${k}`] = body[k];
        }
        if (!Object.keys($set).length) {
            return res.status(400).json({ message: `Provide at least one of: ${PRIVACY_FIELDS.join(', ')}` });
        }
        const user = await require('../../identity/queries/auth').setUserPaths(req.user.sub, $set);
        if (!user) return res.status(404).json({ message: 'User not found' });
        const privacy = privacyWithDefaults(user.preferences?.privacy);
        // Apply at once to typing / read-receipt / discovery enforcement on this instance.
        rememberPrivacy(req.user.sub, privacy);
        return res.json(privacy);
    } catch (err) {
        logger.error({ err: err.message }, 'UPDATE PRIVACY PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to update privacy preferences' });
    }
}

async function getRegionPreferences(req, res) {
    try {
        const user = await require('../../identity').users.findById(req.user.sub);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(regionWithDefaults(user.preferences?.region));
    } catch (err) {
        logger.error({ err: err.message }, 'GET REGION PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to load region preferences' });
    }
}

async function updateRegionPreferences(req, res) {
    try {
        const body = req.body;
        if (!isPlainObject(body)) return res.status(400).json({ message: 'Request body must be an object' });
        const { $set, error } = validateRegionUpdate(body);
        if (error) return res.status(400).json({ message: error });
        const user = await require('../../identity/queries/auth').setUserPaths(req.user.sub, $set);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(regionWithDefaults(user.preferences?.region));
    } catch (err) {
        logger.error({ err: err.message }, 'UPDATE REGION PREFERENCES ERROR');
        return res.status(500).json({ message: 'Failed to update region preferences' });
    }
}

module.exports = {
    REGION_DEFAULTS,
    DATE_FORMATS,
    TIME_FORMATS,
    isValidTimezone,
    regionWithDefaults,
    validateRegionUpdate,
    getPrivacyPreferences,
    updatePrivacyPreferences,
    getRegionPreferences,
    updateRegionPreferences,
};
