// server/src/features/audit/audit.service.js
/**
 * Audit Service - Audit Log Management
 * 
 * Behavior-preserving migration from controllers/auditController.js
 * 
 * Provides audit log querying and export functionality.
 * 
 * @module features/audit/audit.service
 */

const HistoryLog = require('../../../models/HistoryLog');

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get audit logs for a company
 * 
 * Business Rules:
 * - Returns logs for specified company
 * - Supports filtering by userId, action, date range
 * - Paginated results (default 20 per page)
 * - Sorted by timestamp descending (newest first)
 * - Populates user details (username, email, profilePicture)
 * 
 * @param {string} companyId - Company ID
 * @param {Object} filters - Query filters
 * @param {number} filters.page - Page number (default 1)
 * @param {number} filters.limit - Results per page (default 20)
 * @param {string} filters.userId - Filter by user ID
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.startDate - Start date filter
 * @param {string} filters.endDate - End date filter
 * @returns {Promise<Object>} { logs: Array, pagination: Object }
 */
async function getCompanyAuditLogs(companyId, filters = {}) {
    const {
        page = 1,
        limit = 20,
        userId,
        action,
        startDate,
        endDate
    } = filters;

    // Build query filter
    const query = { company: companyId };

    if (userId) query.user = userId;
    if (action) query.action = action;

    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Execute query with pagination
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

/**
 * Export audit logs
 * 
 * Business Rules:
 * - Returns all logs for company (no pagination)
 * - Supports CSV export format
 * - CSV includes: Timestamp, User, Action, Description, IP Address
 * - Description field is quoted to handle commas
 * - Default format is JSON
 * 
 * @param {string} companyId - Company ID
 * @param {string} format - Export format ('csv' or default JSON)
 * @returns {Promise<Object>} { logs: Array } or { csvContent: string, filename: string }
 */
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
            `"${log.description}"`, // Escape quotes
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

    // Default: return JSON
    return { logs };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get compliance-relevant audit logs
 *
 * Business Rules:
 * - Filters HistoryLog to security/compliance-critical action types
 * - Supports same pagination + date filtering as getCompanyAuditLogs
 * - Sorted by timestamp descending
 *
 * @param {string} companyId
 * @param {Object} filters
 */
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
