// server/src/features/security/security.controller.js

const securityAuditService = require('../../services/securityAudit.service');

/**
 * Get security audit events for current user
 * GET /api/v2/security/audit
 * 
 * PHASE 4A: Read-only audit log access
 */
exports.getAuditLog = async (req, res) => {
    try {
        const userId = req.user.sub;

        // Optional query params
        const limit = parseInt(req.query.limit) || 100;
        const daysBack = parseInt(req.query.daysBack) || 30;

        // Fetch events
        const events = await securityAuditService.getSecurityEvents(userId, {
            limit,
            daysBack
        });

        return res.json({
            events,
            totalCount: events.length,
            daysBack,
            limit
        });

    } catch (error) {
        console.error('❌ [getAuditLog] Error:', error);
        return res.status(500).json({
            message: 'Failed to fetch audit log'
        });
    }
};
