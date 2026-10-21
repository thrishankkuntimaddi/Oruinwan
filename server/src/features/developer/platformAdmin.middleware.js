'use strict';

/**
 * Platform (Oruinwan staff) admin gate — the same role check as the Platform
 * admin console (requireSuperAdmin in features/admin/admin.routes.js). Use after
 * requireAuth. Sets req.platformAdmin = { id }.
 */

const PLATFORM_ADMIN_ROLES = ['oruinwan_admin', 'platform-admin'];

async function isPlatformAdmin(userId) {
    if (!userId) return false;
    const identity = require('../../identity');
    const user = await identity.users.findById(userId);
    return !!(user && Array.isArray(user.roles) && user.roles.some((r) => PLATFORM_ADMIN_ROLES.includes(r)));
}

async function requirePlatformAdmin(req, res, next) {
    try {
        if (await isPlatformAdmin(req.user?.sub)) {
            req.platformAdmin = { id: String(req.user.sub) };
            return next();
        }
        return res.status(403).json({ message: 'Access denied: platform admins only' });
    } catch {
        return res.status(500).json({ message: 'Auth error' });
    }
}

module.exports = { requirePlatformAdmin, isPlatformAdmin, PLATFORM_ADMIN_ROLES };
