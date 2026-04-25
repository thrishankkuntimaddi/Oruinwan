const securityAuditService = require('../../services/securityAudit.service');

exports.getAuditLog = async (req, res) => {
    try {
        const userId = req.user.sub;

        
        const limit = parseInt(req.query.limit) || 100;
        const daysBack = parseInt(req.query.daysBack) || 30;

        
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
