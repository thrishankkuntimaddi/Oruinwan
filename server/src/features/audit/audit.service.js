const HistoryLog = require('../../../models/HistoryLog');

async function getCompanyAuditLogs(companyId, filters = {}) {
    const {
        page = 1,
        limit = 20,
        userId,
        action,
        startDate,
        endDate
    } = filters;

    
    const query = { company: companyId };

    if (userId) query.user = userId;
    if (action) query.action = action;

    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    
    const logs = await HistoryLog.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('user', 'username email profilePicture')
        .lean();

    const total = await HistoryLog.countDocuments(query);

    return {
        logs,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    };
}

async function exportAuditLogs(companyId, format) {
    const logs = await HistoryLog.find({ company: companyId })
        .sort({ timestamp: -1 })
        .populate('user', 'username email')
        .lean();

    if (format === 'csv') {
        const fields = ['Timestamp', 'User', 'Action', 'Description', 'IP Address'];
        const rows = logs.map(log => [
            new Date(log.timestamp).toISOString(),
            log.user?.username || 'System',
            log.action,
            `"${log.description}"`, 
            log.ipAddress || ''
        ]);

        const csvContent = [
            fields.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        return {
            csvContent,
            filename: `audit-logs-${companyId}.csv`
        };
    }

    
    return { logs };
}

const COMPLIANCE_ACTIONS = [
  'member_removed', 'member_suspended', 'member_restored',
  'role_changed', 'workspace_deleted', 'workspace_created',
  'employee_invited', 'bulk_onboarding_complete',
  'security_setting_changed', 'permission_updated',
  'channel_deleted', 'channel_access_changed',
  'login_failed', 'password_changed', 'data_exported'
];

async function getComplianceLogs(companyId, filters = {}) {
    const {
        page = 1,
        limit = 20,
        userId,
        startDate,
        endDate
    } = filters;

    const query = {
        company: companyId,
        action: { $in: COMPLIANCE_ACTIONS }
    };

    if (userId) query.user = userId;

    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await HistoryLog.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('user', 'username email profilePicture')
        .lean();

    const total = await HistoryLog.countDocuments(query);

    return {
        logs,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) },
        complianceActions: COMPLIANCE_ACTIONS
    };
}

module.exports = {
    getCompanyAuditLogs,
    exportAuditLogs,
    getComplianceLogs
};
