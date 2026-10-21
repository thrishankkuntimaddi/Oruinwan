'use strict';

const express = require('express');
const v1 = require('./publicApi.routes');

/**
 * Versioned mount for the public API (mounted at /api/public).
 *
 *   /api/public/v1/*   current version; responses carry `API-Version: v1`
 *   /api/public/*      legacy unversioned alias of v1; responses carry
 *                      `Deprecation`, a `Link: <…/v1/…>; rel="successor-version"`
 *                      and `API-Version: v1`
 *
 * Both paths run the same router, so the per-key rate limit is shared.
 */

const CURRENT_VERSION = 'v1';
// RFC 9745: Deprecation is a structured-field date (@unix seconds) — 2026-10-21T00:00:00Z.
const DEPRECATED_AT = '@1792540800';

const versioned = express.Router();

versioned.use(`/${CURRENT_VERSION}`, (req, res, next) => {
    res.set('API-Version', CURRENT_VERSION);
    next();
}, v1, (req, res) => {
    res.status(404).json({ message: 'Unknown public API endpoint' });
});

// Unknown version segment (e.g. /api/public/v2/…): explicit 404 rather than the legacy alias.
versioned.use((req, res, next) => {
    if (!/^\/v\d+(\/|$)/.test(req.path)) return next();
    res.status(404).json({ message: 'Unsupported public API version. Use /api/public/v1.' });
});

versioned.use((req, res, next) => {
    res.set('API-Version', CURRENT_VERSION);
    res.set('Deprecation', DEPRECATED_AT);
    res.append('Link', `<${req.baseUrl}/${CURRENT_VERSION}${req.path}>; rel="successor-version"`);
    next();
}, v1);

module.exports = versioned;
module.exports.CURRENT_VERSION = CURRENT_VERSION;
module.exports.DEPRECATED_AT = DEPRECATED_AT;
