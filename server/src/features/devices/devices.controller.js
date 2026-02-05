// server/src/features/devices/devices.controller.js

const deviceSessionService = require('../../services/deviceSession.service');

/**
 * Get all device sessions for current user
 * GET /api/v2/devices
 */
exports.getDevices = async (req, res) => {
    try {
        const userId = req.user.sub;
        const currentDeviceId = req.deviceId;

        const sessions = await deviceSessionService.getDeviceSessions(userId, false);

        // Transform sessions for client response
        const devices = sessions.map(session => ({
            deviceId: session.deviceId,
            deviceName: session.deviceName,
            platform: session.platform,
            createdAt: session.createdAt,
            lastActiveAt: session.lastActiveAt,
            trustLevel: session.trustLevel,
            isCurrent: session.deviceId === currentDeviceId
        }));

        return res.json({
            devices,
            totalCount: devices.length
        });

    } catch (error) {
        console.error('❌ [getDevices] Error:', error);
        return res.status(500).json({
            message: 'Failed to fetch devices'
        });
    }
};

/**
 * Revoke a device session
 * POST /api/v2/devices/revoke
 */
exports.revokeDevice = async (req, res) => {
    try {
        const userId = req.user.sub;
        const currentDeviceId = req.deviceId;
        const { deviceId: targetDeviceId } = req.body;

        if (!targetDeviceId) {
            return res.status(400).json({
                message: 'deviceId is required'
            });
        }

        // Revoke the device
        const result = await deviceSessionService.revokeDeviceSession(userId, targetDeviceId);

        const isCurrentDevice = targetDeviceId === currentDeviceId;

        console.log(`✅ [revokeDevice] Device ${targetDeviceId.substring(0, 8)}... revoked`);
        console.log(`   - Is current device: ${isCurrentDevice}`);
        console.log(`   - Refresh tokens revoked: ${result.tokensRevoked}`);

        // PHASE 4A: Log device revocation (best-effort, non-blocking)
        try {
            const securityAudit = require('../../services/securityAudit.service');
            securityAudit.logSecurityEvent({
                userId,
                eventType: 'DEVICE_REVOKED',
                req,
                deviceSession: result.session,
                metadata: {
                    revokedDeviceId: targetDeviceId,
                    isCurrentDevice
                }
            });
        } catch (auditError) {
            // Silent fail (non-critical)
        }

        return res.json({
            message: 'Device revoked successfully',
            revokedDeviceId: targetDeviceId,
            isCurrentDevice,
            tokensRevoked: result.tokensRevoked
        });

    } catch (error) {
        console.error('❌ [revokeDevice] Error:', error);

        if (error.message === 'Device session not found') {
            return res.status(404).json({ message: error.message });
        }

        if (error.message === 'Device session already revoked') {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({
            message: 'Failed to revoke device'
        });
    }
};

/**
 * Revoke all other device sessions
 * POST /api/v2/devices/revoke-others
 */
exports.revokeOtherDevices = async (req, res) => {
    try {
        const userId = req.user.sub;
        const currentDeviceId = req.deviceId;

        if (!currentDeviceId) {
            return res.status(400).json({
                message: 'Current device ID not found'
            });
        }

        const revokedCount = await deviceSessionService.revokeAllOtherSessions(userId, currentDeviceId);

        console.log(`✅ [revokeOtherDevices] Revoked ${revokedCount} other device(s) for user ${userId}`);

        // PHASE 4A: Log revoke all others (best-effort, non-blocking)
        try {
            const securityAudit = require('../../services/securityAudit.service');
            securityAudit.logSecurityEvent({
                userId,
                eventType: 'ALL_DEVICES_REVOKED',
                req,
                metadata: {
                    revokedCount,
                    currentDeviceId
                }
            });
        } catch (auditError) {
            // Silent fail (non-critical)
        }

        // PHASE 4B: Send notification for all devices revoked (best-effort, non-blocking)
        try {
            const User = require('../../models/User');
            const securityNotification = require('../../services/securityNotification.service');

            // Fetch user for email
            const user = await User.findById(userId).lean();

            if (user) {
                securityNotification.sendSecurityNotification({
                    user,
                    eventType: 'ALL_DEVICES_REVOKED',
                    auditEvent: {
                        deviceName: req.headers['user-agent'],
                        metadata: {
                            revokedCount
                        },
                        createdAt: new Date()
                    }
                });
            }
        } catch (notificationError) {
            // Silent fail (non-critical)
        }

        return res.json({
            message: 'All other devices revoked successfully',
            revokedCount
        });

    } catch (error) {
        console.error('❌ [revokeOtherDevices] Error:', error);
        return res.status(500).json({
            message: 'Failed to revoke other devices'
        });
    }
};
