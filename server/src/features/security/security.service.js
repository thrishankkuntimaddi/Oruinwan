// server/src/features/security/security.service.js
//
// Phase 3 — Company Security Layer
//
// Responsible for:
//   logSecurityEvent()    — write a SecurityEvent record (non-fatal, never throws)
//   getSecurityEvents()   — query events for the owner/admin dashboard
//   getSummary()          — aggregate counts by eventType + severity

const SecurityEvent = require('../../../models/SecurityEvent');

// ============================================================================
// SEVERITY CLASSIFICATION
// ============================================================================

const SEVERITY_MAP = {
    login_success: 'info',
    login_failure: 'warning',
    logout: 'info',
    invite_accepted: 'info',
    password_changed: 'info',
    password_reset_requested: 'warning',
    role_changed: 'warning',
    account_suspended: 'critical',
    account_reactivated: 'info',
    sso_login: 'info',
    api_key_created: 'warning',
    api_key_revoked: 'warning',
    bulk_import_started: 'info',
    bulk_import_completed: 'info',
};

// ============================================================================
// LOG EVENT
// ============================================================================

/**
 * Write a SecurityEvent record.
 *
 * NEVER throws — security logging is non-fatal.
 * Failed writes are console.warn'd only.
 *
 * @param {Object} params
 * @param {string}  params.companyId
 * @param {string}  [params.actorId]   — userId who triggered the event
 * @param {string}  params.eventType   — see SecurityEventSchema enum
 * @param {string}  [params.outcome]   — 'success' | 'failure' (default 'success')
 * @param {Object}  [params.metadata]  — any extra context
 * @param {Object}  [params.req]       — Express req for IP + userAgent extraction
 */
async function logSecurityEvent({ companyId, actorId, eventType, outcome, metadata, req }) {
    try {
        const ipAddress = req
            ? (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || null)
            : null;
        const userAgent = req ? (req.headers['user-agent'] || null) : null;

        await SecurityEvent.create({
            companyId,
            actorId: actorId || null,
            eventType,
            severity: SEVERITY_MAP[eventType] || 'info',
            outcome: outcome || 'success',
            ipAddress,
            userAgent,
            metadata: metadata || {},
        });
    } catch (err) {
        console.warn('[SECURITY] Failed to log event:', eventType, err.message);
    }
}

// ============================================================================
// QUERY EVENTS
// ============================================================================

/**
 * Get security events for a company — paginated, filterable.
 *
 * @param {string}  companyId
 * @param {Object}  filters
 * @param {string}  [filters.eventType]
 * @param {string}  [filters.severity]    — 'info' | 'warning' | 'critical'
 * @param {string}  [filters.outcome]     — 'success' | 'failure'
 * @param {string}  [filters.actorId]
 * @param {string}  [filters.startDate]
 * @param {string}  [filters.endDate]
 * @param {number}  [filters.page=1]
 * @param {number}  [filters.limit=50]
 * @returns {Promise<{ events, total, page, pages }>}
 */
async function getSecurityEvents(companyId, filters = {}) {
    const {
        eventType,
        severity,
        outcome,
        actorId,
        startDate,
        endDate,
        page = 1,
        limit = 50,
    } = filters;

    const query = { companyId };
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (outcome) query.outcome = outcome;
    if (actorId) query.actorId = actorId;

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [events, total] = await Promise.all([
        SecurityEvent.find(query)
            .populate('actorId', 'username email profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        SecurityEvent.countDocuments(query),
    ]);

    return {
        events,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
    };
}

/**
 * Get a high-level summary of security events for the dashboard.
 * Aggregates counts by eventType over the last 30 days.
 */
async function getSecuritySummary(companyId) {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const mongoose = require('mongoose');
    const cid = mongoose.Types.ObjectId.createFromHexString(companyId.toString());

    const [byType, bySeverity, failedLogins] = await Promise.all([
        SecurityEvent.aggregate([
            { $match: { companyId: cid, createdAt: { $gte: from } } },
            { $group: { _id: '$eventType', count: { $sum: 1 } } },
            { $project: { _id: 0, eventType: '$_id', count: 1 } },
            { $sort: { count: -1 } },
        ]),
        SecurityEvent.aggregate([
            { $match: { companyId: cid, createdAt: { $gte: from } } },
            { $group: { _id: '$severity', count: { $sum: 1 } } },
            { $project: { _id: 0, severity: '$_id', count: 1 } },
        ]),
        // Failed login count in last 24h
        SecurityEvent.countDocuments({
            companyId,
            eventType: 'login_failure',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
    ]);

    return {
        period: { from, to: new Date() },
        byType,
        bySeverity,
        failedLoginsLast24h: failedLogins,
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    logSecurityEvent,
    getSecurityEvents,
    getSecuritySummary,
};
