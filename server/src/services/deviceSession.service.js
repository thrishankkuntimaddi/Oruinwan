'use strict';

/**
 * Per-device sessions (one row per user + deviceId in user_device_sessions).
 * A revoked device is refused by requireAuth even with a valid access token.
 * Returned objects keep the shape of the old UserDeviceSession documents:
 * { userId, deviceId, deviceName, platform, userAgent, ipAddress, createdAt,
 *   lastActiveAt, revokedAt, trustLevel }.
 */

const logger = require('../../utils/logger');
const { query } = require('../shared/postgres');

function toSession(row) {
    if (!row) return null;
    const meta = row.meta || {};
    return {
        _id: `${row.user_id}:${row.device_id}`,
        userId: row.user_id,
        deviceId: row.device_id,
        deviceName: row.device_name || 'Unknown Device',
        platform: row.platform || 'unknown',
        userAgent: meta.userAgent || null,
        ipAddress: meta.ipAddress || null,
        trustLevel: meta.trustLevel || 'trusted',
        createdAt: row.created_at,
        lastActiveAt: row.last_activity_at,
        revokedAt: row.revoked ? (row.revoked_at || new Date()) : null,
    };
}

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
        const meta = { userAgent: userAgent || null, ipAddress: ipAddress || null, trustLevel };
        // xmax = 0 only on the inserting statement: tells a brand-new device from a returning one.
        const { rows } = await query(
            `INSERT INTO user_device_sessions (user_id, device_id, device_name, platform, meta)
             VALUES ($1, $2, $3, $4, $5::jsonb)
             ON CONFLICT (user_id, device_id) DO UPDATE SET device_name = EXCLUDED.device_name, platform = EXCLUDED.platform,
                meta = user_device_sessions.meta || EXCLUDED.meta, last_activity_at = now()
             RETURNING *, (xmax = 0) AS inserted`,
            [String(userId), String(deviceId), deviceName || 'Unknown Device', platform || 'unknown', JSON.stringify(meta)]
        );
        const session = toSession(rows[0]);
        const wasNewDevice = !!rows[0].inserted;

        logger.info(`✅ [PHASE 3] Device session created/updated: ${session.deviceName} (${String(deviceId).substring(0, 8)}...)`);

        if (wasNewDevice) {
            try {
                require('./securityAudit.service').logSecurityEvent({
                    userId,
                    eventType: 'LOGIN_NEW_DEVICE',
                    deviceSession: session,
                    metadata: { deviceId, trustLevel }
                });
            } catch (_auditError) { /* audit is best effort */ }

            try {
                const { users } = require('../identity');
                const securityNotification = require('./securityNotification.service');
                const user = await users.findById(userId);
                if (user) {
                    securityNotification.sendSecurityNotification({
                        user,
                        eventType: 'LOGIN_NEW_DEVICE',
                        auditEvent: { deviceName, platform, ipAddress, createdAt: session.createdAt }
                    });
                }
            } catch (_notificationError) { /* notification is best effort */ }
        }

        return session;
    } catch (error) {
        logger.error('Error creating/updating device session:', error);
        throw error;
    }
};

exports.getDeviceSessions = async (userId, includeRevoked = false) => {
    try {
        const { rows } = await query(
            `SELECT * FROM user_device_sessions WHERE user_id = $1${includeRevoked ? '' : ' AND revoked = false'}
             ORDER BY last_activity_at DESC`,
            [String(userId)]
        );
        return rows.map(toSession);
    } catch (error) {
        logger.error('Error fetching device sessions:', error);
        throw error;
    }
};

exports.revokeDeviceSession = async (userId, deviceId) => {
    try {
        const { rows } = await query('SELECT * FROM user_device_sessions WHERE user_id = $1 AND device_id = $2', [String(userId), String(deviceId)]);
        if (!rows[0]) throw new Error('Device session not found');
        if (rows[0].revoked) throw new Error('Device session already revoked');

        const { rows: updated } = await query(
            'UPDATE user_device_sessions SET revoked = true, revoked_at = now() WHERE user_id = $1 AND device_id = $2 RETURNING *',
            [String(userId), String(deviceId)]
        );
        const session = toSession(updated[0]);

        // Refresh tokens are not tied to a device id, so none are deleted here; the
        // revoked device is refused by requireAuth on its next request.
        logger.info(`🔒 [PHASE 3] Device revoked: ${session.deviceName} (${String(deviceId).substring(0, 8)}...)`);

        return { session, tokensRevoked: 0 };
    } catch (error) {
        logger.error('Error revoking device session:', error);
        throw error;
    }
};

exports.revokeAllOtherSessions = async (userId, currentDeviceId) => {
    try {
        const { rowCount } = await query(
            `UPDATE user_device_sessions SET revoked = true, revoked_at = now()
             WHERE user_id = $1 AND device_id <> $2 AND revoked = false`,
            [String(userId), String(currentDeviceId || '')]
        );
        logger.info(`🔒 [PHASE 3] Revoked ${rowCount} other device(s) for user ${userId}`);
        return rowCount;
    } catch (error) {
        logger.error('Error revoking other sessions:', error);
        throw error;
    }
};

exports.updateSessionActivity = async (userId, deviceId) => {
    // Fire-and-forget, but the rejection MUST be handled: an unhandled rejection
    // terminates the process in production.
    query('UPDATE user_device_sessions SET last_activity_at = now() WHERE user_id = $1 AND device_id = $2', [String(userId), String(deviceId)])
        .catch((error) => logger.warn({ err: error.message, userId, deviceId }, 'Failed to update session activity'));
};

exports.isSessionRevoked = async (userId, deviceId) => {
    try {
        const { rows } = await query('SELECT revoked FROM user_device_sessions WHERE user_id = $1 AND device_id = $2', [String(userId), String(deviceId)]);
        return !!rows[0]?.revoked;
    } catch (error) {
        // Fail CLOSED: if we cannot prove the device session is still valid, treat it as revoked.
        logger.error({ err: error, userId, deviceId }, '[SECURITY] Session revocation check failed — failing closed (treating as revoked)');
        return true;
    }
};
