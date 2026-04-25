const SecurityAuditEvent = require('../models/SecurityAuditEvent');

exports.logSecurityEvent = async ({
    userId,
    eventType,
    req = null,
    deviceSession = null,
    metadata = {}
}) => {
    try {
        
        if (!userId || !eventType) {
            console.warn('⚠️ [AUDIT] Missing required fields (userId or eventType), skipping log');
            return;
        }

        
        let deviceId = null;
        let deviceName = null;
        let platform = null;

        if (deviceSession) {
            deviceId = deviceSession.deviceId || null;
            deviceName = deviceSession.deviceName || null;
            platform = deviceSession.platform || null;
        }

        
        let ipAddress = null;
        let userAgent = null;

        if (req) {
            ipAddress = req.ip || req.connection?.remoteAddress || null;
            userAgent = req.headers?.['user-agent'] || null;

            
            if (!deviceId && req.deviceId) {
                deviceId = req.deviceId;
            }
        }

        
        const auditEvent = new SecurityAuditEvent({
            userId,
            eventType,
            deviceId,
            deviceName,
            platform,
            ipAddress,
            userAgent,
            metadata
        });

        
        await auditEvent.save();

        console.log(`✅ [AUDIT] ${eventType} logged for user ${userId.substring(0, 8)}...`);

    } catch (error) {
        
        console.warn('⚠️ [AUDIT] Failed to log security event (non-critical):', error.message);
        
    }
};

exports.getSecurityEvents = async (userId, options = {}) => {
    try {
        const limit = Math.min(options.limit || 100, 100); 
        const daysBack = options.daysBack || 30;

        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        const events = await SecurityAuditEvent.find({
            userId,
            createdAt: { $gte: cutoffDate }
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return events;

    } catch (error) {
        console.error('❌ [AUDIT] Failed to fetch security events:', error);
        throw error;
    }
};
