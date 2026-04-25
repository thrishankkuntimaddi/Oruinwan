const mongoose = require('mongoose');

async function checkDatabaseHealth() {
    try {
        const state = mongoose.connection.readyState;
        
        if (state === 1) {
            
            await mongoose.connection.db.admin().ping();
            return { status: 'operational', responseTime: 10 };
        }
        return { status: 'outage', responseTime: 0 };
    } catch (error) {
        return { status: 'outage', responseTime: 0 };
    }
}

function checkAPIHealth() {
    
    return { status: 'operational', responseTime: 5 };
}

async function getSystemHealth() {
    const startTime = Date.now();

    
    const [dbHealth, apiHealth] = await Promise.all([
        checkDatabaseHealth(),
        Promise.resolve(checkAPIHealth())
    ]);

    const services = [
        {
            name: 'API Server',
            status: apiHealth.status,
            responseTime: apiHealth.responseTime,
            uptime: 99.98 
        },
        {
            name: 'Database',
            status: dbHealth.status,
            responseTime: dbHealth.responseTime,
            uptime: dbHealth.status === 'operational' ? 99.95 : 0
        },
        {
            name: 'Web App',
            status: 'operational', 
            responseTime: 8,
            uptime: 99.99
        },
        {
            name: 'Mobile App',
            status: apiHealth.status, 
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

    
    const hasOutage = services.some(s => s.status === 'outage');
    const hasDegraded = services.some(s => s.status === 'degraded');

    let overallStatus = 'operational';
    if (hasOutage) overallStatus = 'outage';
    else if (hasDegraded) overallStatus = 'degraded';

    return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
        incidents: [], 
        responseTime: Date.now() - startTime
    };
}

module.exports = {
    getSystemHealth
};
