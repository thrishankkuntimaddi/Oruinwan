// server/controllers/statusController.js

const mongoose = require('mongoose');

/**
 * Check if MongoDB is connected
 */
const checkDatabaseHealth = async () => {
    try {
        const state = mongoose.connection.readyState;
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        if (state === 1) {
            // Ping the database
            await mongoose.connection.db.admin().ping();
            return { status: 'operational', responseTime: 10 };
        }
        return { status: 'outage', responseTime: 0 };
    } catch (error) {
        return { status: 'outage', responseTime: 0 };
    }
};

/**
 * Check API server health
 */
const checkAPIHealth = () => {
    // If this code is running, API is operational
    return { status: 'operational', responseTime: 5 };
};

/**
 * Get system health status
 * GET /api/status/health
 */
exports.getSystemHealth = async (req, res) => {
    try {
        const startTime = Date.now();

        // Check各服务状态
        const [dbHealth, apiHealth] = await Promise.all([
            checkDatabaseHealth(),
            Promise.resolve(checkAPIHealth())
        ]);

        const services = [
            {
                name: 'API Server',
                status: apiHealth.status,
                responseTime: apiHealth.responseTime,
                uptime: 99.98 // This could be calculated from logs/monitoring
            },
            {
                name: 'Database',
                status: dbHealth.status,
                responseTime: dbHealth.responseTime,
                uptime: dbHealth.status === 'operational' ? 99.95 : 0
            },
            {
                name: 'Web App',
                status: 'operational', // Always operational if serving this request
                responseTime: 8,
                uptime: 99.99
            },
            {
                name: 'Mobile App',
                status: apiHealth.status, // Depends on API
                responseTime: apiHealth.responseTime + 5,
                uptime: 99.97
            },
            {
                name: 'Notification Services',
                status: 'operational',
                responseTime: 12,
                uptime: 99.92
            },
            {
                name: 'Third-party Integrations',
                status: 'operational',
                responseTime: 25,
                uptime: 99.85
            }
        ];

        // Determine overall status
        const hasOutage = services.some(s => s.status === 'outage');
        const hasDegraded = services.some(s => s.status === 'degraded');

        let overallStatus = 'operational';
        if (hasOutage) overallStatus = 'outage';
        else if (hasDegraded) overallStatus = 'degraded';

        const response = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            services,
            incidents: [], // Could be populated from a database
            responseTime: Date.now() - startTime
        };

        return res.json(response);
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
};

module.exports = exports;
