'use strict';

const ComplianceLog = require('../../../models/ComplianceLog');
const { hydrate, userSelect } = require('../../identity/hydrate');
const crypto = require('crypto');
const { handleError } = require('../../../utils/responseHelpers');
const { scopedCompanyId } = require('../../shared/middleware/requireCompanyAdmin');

exports.getComplianceLogs = async (req, res) => {
    try {
        const {
            category, severity, actorId,
            page = 1, limit = 50, from, to, verify = false
        } = req.query;
        const companyId = scopedCompanyId(req, res, req.query.companyId);
        if (res.headersSent) return undefined;

        // Always scoped to one company (platform admins may pick which).
        const filter = {};
        if (companyId) filter.companyId = companyId;
        else if (!req.isPlatformAdmin) return res.json({ logs: [], total: 0, page: 1, pages: 0 });

        if (category) filter.category = category;
        if (severity) filter.severity = severity;
        if (actorId) filter.actorId = actorId;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const cap = Math.min(parseInt(limit), 200);
        const skip = (parseInt(page) - 1) * cap;

        const [logs, total] = await Promise.all([
            ComplianceLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(cap)
                .lean()
                .then((rows) => hydrate(rows, { actorId: userSelect('username email profilePicture') })),
            ComplianceLog.countDocuments(filter)
        ]);

        
        let verifiedLogs = logs;
        if (verify === 'true' || verify === true) {
            verifiedLogs = logs.map(log => {
                const ts = log.createdAt instanceof Date ? log.createdAt.getTime() : new Date(log.createdAt).getTime();
                const raw = `${log.companyId}|${log.actorId?._id || log.actorId}|${log.action}|${String(log.resourceId || '')}|${ts}`;
                const recomputed = crypto.createHash('sha256').update(raw).digest('hex');
                return {
                    ...log,
                    _hashValid: recomputed === log.hash
                };
            });
        }

        return res.json({
            logs: verifiedLogs,
            pagination: {
                page: parseInt(page),
                limit: cap,
                total,
                pages: Math.ceil(total / cap)
            }
        });
    } catch (err) {
        return handleError(res, err, 'GET COMPLIANCE LOGS ERROR');
    }
};

exports.getComplianceLog = async (req, res) => {
    try {
        const log = await ComplianceLog.findById(req.params.id).lean();
        if (log) await hydrate(log, { actorId: userSelect('username email') });

        // Another company's entry looks the same as a missing one.
        if (!log || (!req.isPlatformAdmin && String(log.companyId) !== req.companyId)) {
            return res.status(404).json({ message: 'Compliance log not found' });
        }

        const ts = log.createdAt instanceof Date ? log.createdAt.getTime() : new Date(log.createdAt).getTime();
        const raw = `${log.companyId}|${log.actorId?._id || log.actorId}|${log.action}|${String(log.resourceId || '')}|${ts}`;
        const recomputed = crypto.createHash('sha256').update(raw).digest('hex');

        return res.json({
            log: { ...log, _hashValid: recomputed === log.hash }
        });
    } catch (err) {
        return handleError(res, err, 'GET COMPLIANCE LOG ERROR');
    }
};
