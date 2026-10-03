const logger = require('../../../utils/logger');
const deviceSessionService = require('../../services/deviceSession.service');

exports.getDevices = async (req, res) => {
    try {
        const userId = req.user.sub;
        const currentDeviceId = req.deviceId;

        const sessions = await deviceSessionService.getDeviceSessions(userId, false);

        
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
        logger.error('❌ [getDevices] Error:', error);
        return res.status(500).json({
            message: 'Failed to fetch devices'
        });
    }
};

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

        
        const result = await deviceSessionService.revokeDeviceSession(userId, targetDeviceId);

        const isCurrentDevice = targetDeviceId === currentDeviceId;

        logger.info(`✅ [revokeDevice] Device ${targetDeviceId.substring(0, 8)}... revoked`);
        logger.info(`   - Is current device: ${isCurrentDevice}`);
        logger.info(`   - Refresh tokens revoked: ${result.tokensRevoked}`);

        
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
        } catch (_auditError) {
            
        }

        return res.json({
            message: 'Device revoked successfully',
            revokedDeviceId: targetDeviceId,
            isCurrentDevice,
            tokensRevoked: result.tokensRevoked
        });

    } catch (error) {
        logger.error('❌ [revokeDevice] Error:', error);

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

        logger.info(`✅ [revokeOtherDevices] Revoked ${revokedCount} other device(s) for user ${userId}`);

        
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
        } catch (_auditError) {
            
        }

        
        try {
            const { users } = require('../../identity');
            const securityNotification = require('../../services/securityNotification.service');

            
            const user = await users.findById(userId);

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
        } catch (_notificationError) {
            
        }

        return res.json({
            message: 'All other devices revoked successfully',
            revokedCount
        });

    } catch (error) {
        logger.error('❌ [revokeOtherDevices] Error:', error);
        return res.status(500).json({
            message: 'Failed to revoke other devices'
        });
    }
};
