'use strict';

const logger = require('../../../utils/logger');
const devices = require('./devices.service');
const { getRefreshTokenFromRequest, clearRefreshTokenCookie } = require('../../../utils/cookieHelper');

function current(req) {
    let refreshToken = null;
    try { refreshToken = getRefreshTokenFromRequest(req); } catch { /* no cookie parser */ }
    return { deviceId: req.deviceId || req.headers['x-device-id'] || null, refreshToken };
}

function auditEvent(req, eventType, extra = {}) {
    try {
        require('../../services/securityAudit.service').logSecurityEvent({ userId: req.user.sub, eventType, req, ...extra });
    } catch (_auditError) { /* best effort */ }
}

function fail(res, error, fallback) {
    if (error instanceof devices.DeviceError) return res.status(error.status).json({ message: error.message });
    logger.error(`❌ [devices] ${fallback}:`, error);
    return res.status(500).json({ message: fallback });
}

/** GET /api/v2/devices[?includeRevoked=true] -> { devices: [...], totalCount } */
exports.getDevices = async (req, res) => {
    try {
        const list = await devices.listDevices(req.user.sub, current(req), { includeRevoked: req.query?.includeRevoked === 'true' });
        return res.json({ devices: list, totalCount: list.length });
    } catch (error) {
        return fail(res, error, 'Failed to fetch devices');
    }
};

/** PATCH /api/v2/devices/:deviceId { name } -> { device } */
exports.renameDevice = async (req, res) => {
    try {
        const device = await devices.renameDevice(req.user.sub, req.params.deviceId, req.body?.name ?? null);
        return res.json({ device });
    } catch (error) {
        return fail(res, error, 'Failed to rename device');
    }
};

async function revoke(req, res, targetDeviceId) {
    try {
        const me = current(req);
        const result = await devices.revokeDevice(req.user.sub, targetDeviceId, me);
        if (result.isCurrentDevice) clearRefreshTokenCookie(res);
        auditEvent(req, 'DEVICE_REVOKED', {
            metadata: {
                revokedDeviceId: targetDeviceId, isCurrentDevice: result.isCurrentDevice,
                sessionsRevoked: result.sessionsRevoked, pushTokensRemoved: result.pushTokensRemoved,
            },
        });
        return res.json({
            message: 'Device revoked successfully',
            revokedDeviceId: targetDeviceId,
            isCurrentDevice: result.isCurrentDevice,
            tokensRevoked: result.sessionsRevoked,
            sessionsRevoked: result.sessionsRevoked,
            pushTokensRemoved: result.pushTokensRemoved,
            device: result.device,
        });
    } catch (error) {
        return fail(res, error, 'Failed to revoke device');
    }
}

/** POST /api/v2/devices/revoke { deviceId } (kept for older clients) */
exports.revokeDevice = (req, res) => {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });
    return revoke(req, res, String(deviceId));
};

/** DELETE /api/v2/devices/:deviceId */
exports.deleteDevice = (req, res) => revoke(req, res, req.params.deviceId);

/** POST /api/v2/devices/revoke-others -> { revokedCount, devicesRevoked, sessionsRevoked, pushTokensRemoved } */
exports.revokeOtherDevices = async (req, res) => {
    try {
        const me = current(req);
        if (!me.deviceId) return res.status(400).json({ message: 'Current device ID not found' });
        const totals = await devices.revokeOtherDevices(req.user.sub, me);
        auditEvent(req, 'ALL_DEVICES_REVOKED', { metadata: { ...totals, currentDeviceId: me.deviceId } });

        try {
            const { users } = require('../../identity');
            const user = await users.findById(req.user.sub);
            if (user) {
                require('../../services/securityNotification.service').sendSecurityNotification({
                    user,
                    eventType: 'ALL_DEVICES_REVOKED',
                    auditEvent: { deviceName: req.headers['user-agent'], metadata: { revokedCount: totals.devicesRevoked }, createdAt: new Date() },
                });
            }
        } catch (_notificationError) { /* best effort */ }

        return res.json({ message: 'All other devices revoked successfully', revokedCount: totals.devicesRevoked, ...totals });
    } catch (error) {
        return fail(res, error, 'Failed to revoke other devices');
    }
};
