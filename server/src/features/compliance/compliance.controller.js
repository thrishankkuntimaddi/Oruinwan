'use strict';

const ComplianceLog = require('../../../models/ComplianceLog');
const crypto = require('crypto');
const { handleError } = require('../../../utils/responseHelpers');

exports.getComplianceLogs = async (req, res) => {
    try {
        const {
            companyId, category, severity, actorId,
            page = 1, limit = 50, from, to, verify = false
        } = req.query;

        const filter = {};
        if (companyId) filter.companyId = companyId;
        else if (req.user?._dbUser?.companyId) filter.companyId = req.user._dbUser.companyId;

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
                .populate('actorId', 'username email profilePicture')
                .lean(),
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
        const log = await ComplianceLog.findById(req.params.id)
            .populate('actorId', 'username email')
            .lean();

        if (!log) return res.status(404).json({ message: 'Compliance log not found' });

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
