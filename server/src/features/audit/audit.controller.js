// server/src/features/audit/audit.controller.js
/**
 * Audit Controller - HTTP Request/Response Layer
 * 
 * Thin wrappers for audit log endpoints.
 * 
 * @module features/audit/audit.controller
 */

const auditService = require('./audit.service');

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/v2/audit/:companyId
 * Get audit logs for a company
 */
async function getCompanyAuditLogs(req, res) {
    try {
        const { companyId } = req.params;
        const filters = {
            page: req.query.page,
            limit: req.query.limit,
            userId: req.query.userId,
            action: req.query.action,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const result = await auditService.getCompanyAuditLogs(companyId, filters);
        return res.json(result);
    } catch (_error) {
        console.error('Get Audit Logs Error:', error);
        return res.status(500).json({ message: 'Server error fetching audit logs' });
    }
}

/**
 * GET /api/v2/audit/:companyId/export
 * Export audit logs (CSV or JSON)
 */
async function exportAuditLogs(req, res) {
    try {
        const { companyId } = req.params;
        const { format } = req.query;

        const result = await auditService.exportAuditLogs(companyId, format);

        // Handle CSV export
        if (result.csvContent) {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
            return res.send(result.csvContent);
        }

        // Handle JSON export
        return res.json(result.logs);
    } catch (_error) {
        console.error('Export Audit Logs Error:', error);
        return res.status(500).json({ message: 'Server error exporting logs' });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getCompanyAuditLogs,
    exportAuditLogs
};
