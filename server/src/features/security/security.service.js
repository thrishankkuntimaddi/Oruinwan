const SecurityEvent = require('../../../models/SecurityEvent');

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

module.exports = {
    logSecurityEvent,
    getSecurityEvents,
    getSecuritySummary,
};
