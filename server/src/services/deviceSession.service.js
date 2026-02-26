// server/src/services/deviceSession.service.js

const UserDeviceSession = require('../models/UserDeviceSession');
const User = require('../../models/User');

/**
 * Create or update device session
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.deviceId - Device ID (UUID v4)
 * @param {string} params.deviceName - Device name
 * @param {string} params.platform - Platform (web|ios|android)
 * @param {string} params.userAgent - User agent string
 * @param {string} params.ipAddress - IP address
 * @param {string} params.trustLevel - Trust level (trusted|untrusted)
 * @returns {Promise<UserDeviceSession>}
 */
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
        // Upsert device session
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

        // PHASE 4A: Log new device login (best-effort, non-blocking)
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
            // Silent fail (non-critical)
        }

        // PHASE 4B: Send notification for new device (best-effort, non-blocking)
        if (wasNewDevice) {
            try {
                const User = require('../models/User');
                const securityNotification = require('./securityNotification.service');

                // Fetch user for email
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
                // Silent fail (non-critical)
            }
        }

        return session;
    } catch (error) {
        console.error('Error creating/updating device session:', error);
        throw error;
    }
};

/**
 * Get all device sessions for a user
 * 
 * @param {string} userId - User ID
 * @param {boolean} includeRevoked - Include revoked sessions
 * @returns {Promise<Array>}
 */
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

/**
 * Revoke a device session
 * 
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID to revoke
 * @returns {Promise<Object>}
 */
exports.revokeDeviceSession = async (userId, deviceId) => {
    try {
        // Find session
        const session = await UserDeviceSession.findOne({ userId, deviceId });

        if (!session) {
            throw new Error('Device session not found');
        }

        if (session.isRevoked()) {
            throw new Error('Device session already revoked');
        }

        // Mark as revoked
        await session.revoke();

        // Invalidate all refresh tokens for this device
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

/**
 * Revoke all device sessions except current
 * 
 * @param {string} userId - User ID
 * @param {string} currentDeviceId - Current device ID to keep active
 * @returns {Promise<number>}
 */
exports.revokeAllOtherSessions = async (userId, currentDeviceId) => {
    try {
        // Mark all other sessions as revoked
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

        // Delete refresh tokens for revoked sessions
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

/**
 * Update device session activity
 * 
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<void>}
 */
exports.updateSessionActivity = async (userId, deviceId) => {
    try {
        // Non-blocking update (fire and forget)
        UserDeviceSession.updateOne(
            { userId, deviceId },
            { $set: { lastActiveAt: new Date() } }
        ).exec();
    } catch (error) {
        // Silently fail (non-critical)
        console.warn('Failed to update session activity:', error.message);
    }
};

/**
 * Check if device session is revoked
 * 
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>}
 */
exports.isSessionRevoked = async (userId, deviceId) => {
    try {
        const session = await UserDeviceSession.findOne({ userId, deviceId });

        if (!session) {
            return false; // Session doesn't exist, not revoked
        }

        return session.isRevoked();
    } catch (error) {
        console.error('Error checking session revocation:', error);
        return false;
    }
};
