// server/src/features/status/status.controller.js
/**
 * Status Controller - HTTP Request/Response Layer
 * 
 * Thin wrapper for system health status endpoint.
 * 
 * @module features/status/status.controller
 */

const statusService = require('./status.service');

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/v2/status/health
 * Get system health status
 */
async function getSystemHealth(req, res) {
    try {
        const result = await statusService.getSystemHealth();
        return res.json(result);
    } catch (_error) {
        console.error('Status health check error:', error);
        return res.status(500).json({
            status: 'outage',
            timestamp: new Date().toISOString(),
            services: [],
            incidents: [],
            error: 'Failed to fetch system health'
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getSystemHealth
};
