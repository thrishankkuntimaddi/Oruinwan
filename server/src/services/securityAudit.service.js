// server/src/services/securityAudit.service.js

const SecurityAuditEvent = require('../models/SecurityAuditEvent');

/**
 * Log a security-related event
 * 
 * CRITICAL RULES:
 * - NEVER throw errors
 * - NEVER block request flow
 * - Fail silently with console warning
 * - NO secrets, keys, passwords, or ciphertext in metadata
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID (required)
 * @param {string} params.eventType - Event type (required)
 * @param {Object} params.req - Express request object (optional)
 * @param {Object} params.deviceSession - Device session object (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @returns {Promise<void>}
 */
exports.logSecurityEvent = async ({
    userId,
    eventType,
    req = null,
    deviceSession = null,
    metadata = {}
}) => {
    try {
        // Validate required fields
        if (!userId || !eventType) {
            console.warn('⚠️ [AUDIT] Missing required fields (userId or eventType), skipping log');
            return;
        }

        // Extract device info from deviceSession if available
        let deviceId = null;
        let deviceName = null;
        let platform = null;

        if (deviceSession) {
            deviceId = deviceSession.deviceId || null;
            deviceName = deviceSession.deviceName || null;
            platform = deviceSession.platform || null;
        }

        // Extract IP and user agent from request if available
        let ipAddress = null;
        let userAgent = null;

        if (req) {
            ipAddress = req.ip || req.connection?.remoteAddress || null;
            userAgent = req.headers?.['user-agent'] || null;

            // If device info not in deviceSession, try to get from request
            if (!deviceId && req.deviceId) {
                deviceId = req.deviceId;
            }
        }

        // Create audit event
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

        // Save to database (non-blocking, best-effort)
        await auditEvent.save();

        console.log(`✅ [AUDIT] ${eventType} logged for user ${userId.substring(0, 8)}...`);

    } catch (error) {
        // CRITICAL: Never throw, never block execution
        console.warn('⚠️ [AUDIT] Failed to log security event (non-critical):', error.message);
        // Continue silently
    }
};

/**
 * Get security audit events for a user
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max events to return (default 100)
 * @param {number} options.daysBack - Days to look back (default 30)
 * @returns {Promise<Array>}
 */
exports.getSecurityEvents = async (userId, options = {}) => {
    try {
        const limit = Math.min(options.limit || 100, 100); // Max 100
        const daysBack = options.daysBack || 30;

        // Calculate cutoff date
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
