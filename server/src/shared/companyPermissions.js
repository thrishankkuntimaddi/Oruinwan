'use strict';

/**
 * The company permission matrix (Owner → Permission Matrix) applied to real actions.
 *
 * companyPermission(userId, 'createChannel') returns:
 *   true / false  when the user's company has saved permissions for the user's role
 *   null          for personal accounts, or roles the company never configured —
 *                 callers then keep their existing rules, so an untouched company
 *                 behaves exactly as before.
 * Company owners (and co-owners) always get true.
 */

const TTL_MS = 30 * 1000;
const cache = new Map(); // `${companyId}:${role}` -> { permissions|null, at }

async function savedRolePermissions(companyId, role) {
    const key = `${companyId}:${role}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.permissions;
    const Permission = require('../../models/Permission');
    const doc = await Permission.findOne({ company: companyId, role }).select('permissions').lean();
    const permissions = doc?.permissions || null;
    cache.set(key, { permissions, at: Date.now() });
    return permissions;
}

async function companyPermission(userId, permission) {
    const User = require('../../models/User');
    const user = await User.findById(userId).select('companyId companyRole coOwnerOf').lean();
    if (!user?.companyId) return null;
    if (user.companyRole === 'owner' || (user.coOwnerOf && String(user.coOwnerOf) === String(user.companyId))) return true;
    const perms = await savedRolePermissions(String(user.companyId), user.companyRole || 'member');
    if (!perms || typeof perms[permission] !== 'boolean') return null;
    return perms[permission];
}

/** Express middleware: 403 only when the matrix explicitly denies the permission. */
function requireCompanyPermission(permission) {
    return async (req, res, next) => {
        try {
            if ((await companyPermission(req.user?.sub, permission)) === false) {
                return res.status(403).json({ code: 'COMPANY_PERMISSION_DENIED', permission, message: "Your role isn't allowed to do this in your company." });
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

function invalidateCompanyPermissions(companyId) {
    for (const key of cache.keys()) if (!companyId || key.startsWith(`${companyId}:`)) cache.delete(key);
}

module.exports = { companyPermission, requireCompanyPermission, invalidateCompanyPermissions };
