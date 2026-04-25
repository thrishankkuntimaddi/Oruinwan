const statusService = require('./status.service');

async function getSystemHealth(req, res) {
    try {
        const result = await statusService.getSystemHealth();
        return res.json(result);
    } catch (error) {
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

module.exports = {
    getSystemHealth
};
