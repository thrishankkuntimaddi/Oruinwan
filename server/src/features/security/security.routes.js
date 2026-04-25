const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const {
    logSecurityEvent,
    getSecurityEvents,
    getSecuritySummary,
} = require('./security.service');

const AuditLog = require('../../../models/AuditLog');

const gate = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

function handleError(res, err) {
    console.error('[SECURITY ROUTES]', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
}

function validationGuard(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    return null;
}

const eventQueryValidation = [
    query('eventType').optional().isString(),
    query('severity').optional().isIn(['info', 'warning', 'critical']),
    query('outcome').optional().isIn(['success', 'failure']),
    query('actorId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
];

router.get('/security/events', ...gate, eventQueryValidation, async (req, res) => {
    if (validationGuard(req, res)) return;
    try {
        const result = await getSecurityEvents(req.companyId.toString(), req.query);
        return res.json({ success: true, ...result });
    } catch (err) {
        return handleError(res, err);
    }
});

router.get('/security/summary', ...gate, async (req, res) => {
    try {
        const summary = await getSecuritySummary(req.companyId.toString());
        return res.json({ success: true, summary });
    } catch (err) {
        return handleError(res, err);
    }
});

const auditQueryValidation = [
    query('actorId').optional().isMongoId(),
    query('action').optional().isString(),
    query('targetType').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
];

router.get('/audit-logs', ...gate, auditQueryValidation, async (req, res) => {
    if (validationGuard(req, res)) return;
    try {
        const {
            actorId,
            action,
            targetType,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = req.query;

        const filter = { companyId: req.companyId };
        if (actorId) filter.userId = actorId;
        if (action) filter.action = action;
        if (targetType) filter.resource = targetType;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .populate('userId', 'username email profilePicture')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            AuditLog.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            logs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        return handleError(res, err);
    }
});

router.get('/audit-logs/export', ...gate, async (req, res) => {
    try {
        const { format = 'json' } = req.query;

        const logs = await AuditLog.find({ companyId: req.companyId })
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .lean();

        if (format === 'csv') {
            const header = 'Timestamp,Actor,Action,Resource,ResourceId,Description,IP\n';
            const rows = logs.map(l => [
                l.createdAt?.toISOString() || '',
                l.userId?.username || 'System',
                l.action || '',
                l.resource || '',
                l.resourceId || '',
                `"${(l.description || '').replace(/"/g, '""')}"`,
                l.ipAddress || '',
            ].join(',')).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="audit-${req.companyId}-${Date.now()}.csv"`
            );
            return res.send(header + rows);
        }

        return res.json({ success: true, logs });
    } catch (err) {
        return handleError(res, err);
    }
});

module.exports = router;
