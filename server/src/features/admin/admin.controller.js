// server/src/features/admin/admin.controller.js
/**
 * Admin Controller - HTTP Request/Response Layer
 * 
 * Thin wrappers for admin analytics endpoints.
 * 
 * @module features/admin/admin.controller
 */

const adminService = require('./admin.service');

// ============================================================================
// HELPER: Error Response Handler
// ============================================================================

function handleError(res, error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Server error';
    return res.status(statusCode).json({ message });
}

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/v2/admin/analytics/stats
 * Get analytics stats for company dashboard
 */
async function getAnalyticsStats(req, res) {
    try {
        const companyId = req.user.companyId;
        const result = await adminService.getAnalyticsStats(companyId);
        return res.json(result);
    } catch (error) {
        console.error('STATS ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * GET /api/v2/admin/departments
 * Get departments list with details
 */
async function getDepartments(req, res) {
    try {
        const companyId = req.user.companyId;
        const result = await adminService.getDepartments(companyId);
        return res.json(result);
    } catch (error) {
        console.error('DEPT ERROR:', error);
        return handleError(res, error);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getAnalyticsStats,
    getDepartments
};
