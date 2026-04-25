const UserDeviceSession = require('../models/UserDeviceSession');
const User = require('../../models/User');

exports.createOrUpdateSession = async ({
    userId,
    deviceId,
    deviceName,
    platform,
    userAgent,
    ipAddress,
    trustLevel = 'trusted'
}) => {
    try {
        
        const session = await UserDeviceSession.findOneAndUpdate(
            { userId, deviceId },
            {
                $set: {
                    deviceName,
                    platform,
                    userAgent,
                    ipAddress,
                    lastActiveAt: new Date(),
                    trustLevel
                },
                $setOnInsert: {
                    createdAt: new Date(),
                    revokedAt: null
                }
            },
            { upsert: true, new: true }
        );

        console.log(`✅ [PHASE 3] Device session created/updated: ${deviceName} (${deviceId.substring(0, 8)}...)`);

        
        let wasNewDevice = false;
        try {
            const securityAudit = require('./securityAudit.service');
            wasNewDevice = session.createdAt && (new Date() - session.createdAt < 1000);

            if (wasNewDevice) {
                securityAudit.logSecurityEvent({
                    userId,
                    eventType: 'LOGIN_NEW_DEVICE',
                    deviceSession: session,
                    metadata: {
                        deviceId,
                        trustLevel
                    }
                });
            }
        } catch (_auditError) {
            
        }

        
        if (wasNewDevice) {
            try {
                const User = require('../models/User');
                const securityNotification = require('./securityNotification.service');

                
                const user = await User.findById(userId).lean();

                if (user) {
                    securityNotification.sendSecurityNotification({
                        user,
                        eventType: 'LOGIN_NEW_DEVICE',
                        auditEvent: {
                            deviceName,
                            platform,
                            ipAddress,
                            createdAt: session.createdAt
                        }
                    });
                }
            } catch (_notificationError) {
                
            }
        }

        return session;
    } catch (error) {
        console.error('Error creating/updating device session:', error);
        throw error;
    }
};

exports.getDeviceSessions = async (userId, includeRevoked = false) => {
    try {
        const query = { userId };

        if (!includeRevoked) {
            query.revokedAt = null;
        }

        const sessions = await UserDeviceSession.find(query)
            .sort({ lastActiveAt: -1 })
            .lean();

        return sessions;
    } catch (error) {
        console.error('Error fetching device sessions:', error);
        throw error;
    }
};

exports.revokeDeviceSession = async (userId, deviceId) => {
    try {
        
        const session = await UserDeviceSession.findOne({ userId, deviceId });

        if (!session) {
            throw new Error('Device session not found');
        }

        if (session.isRevoked()) {
            throw new Error('Device session already revoked');
        }

        
        await session.revoke();

        
        const result = await User.updateOne(
            { _id: userId },
            { $pull: { refreshTokens: { deviceId } } }
        );
        const deletedTokens = { deletedCount: result.modifiedCount };

        console.log(`🔒 [PHASE 3] Device revoked: ${session.deviceName} (${deviceId.substring(0, 8)}...)`);
        console.log(`   - Invalidated ${deletedTokens.deletedCount} refresh token(s)`);

        return {
            session,
            tokensRevoked: deletedTokens.deletedCount
        };
    } catch (error) {
        console.error('Error revoking device session:', error);
        throw error;
    }
};

exports.revokeAllOtherSessions = async (userId, currentDeviceId) => {
    try {
        
        const result = await UserDeviceSession.updateMany(
            {
                userId,
                deviceId: { $ne: currentDeviceId },
                revokedAt: null
            },
            {
                $set: { revokedAt: new Date() }
            }
        );

        
        await User.updateOne(
            { _id: userId },
            { $pull: { refreshTokens: { deviceId: { $ne: currentDeviceId } } } }
        );

        console.log(`🔒 [PHASE 3] Revoked ${result.modifiedCount} other device(s) for user ${userId}`);

        return result.modifiedCount;
    } catch (error) {
        console.error('Error revoking other sessions:', error);
        throw error;
    }
};

exports.updateSessionActivity = async (userId, deviceId) => {
    try {
        
        UserDeviceSession.updateOne(
            { userId, deviceId },
            { $set: { lastActiveAt: new Date() } }
        ).exec();
    } catch (error) {
        
        console.warn('Failed to update session activity:', error.message);
    }
};

exports.isSessionRevoked = async (userId, deviceId) => {
    try {
        const session = await UserDeviceSession.findOne({ userId, deviceId });

        if (!session) {
            return false; 
        }

        return session.isRevoked();
    } catch (error) {
        console.error('Error checking session revocation:', error);
        return false;
    }
};
