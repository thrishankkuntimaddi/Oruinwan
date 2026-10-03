'use strict';

const identity = require('../../identity');

const PLATFORM_ADMIN_ROLES = ['chttrix_admin', 'platform-admin'];
const COMPANY_ADMIN_ROLES = ['owner', 'admin'];

/**
 * Company-scoped admin gate. Loads the caller from the database (JWT claims are
 * not trusted for role or company) and sets:
 *   req.companyId        the caller's own company, which handlers must use
 *   req.isPlatformAdmin  Oruinwan staff, who may choose a company explicitly
 *
 * Unlike requireAdmin, it never replaces req.user, so req.user.sub stays valid.
 */
async function requireCompanyAdmin(req, res, next) {
    try {
        const userId = req.user?.sub || req.user?._id;
        const user = userId && await identity.users.findById(userId);
        if (!user) return res.status(401).json({ message: 'User not found' });

        req.isPlatformAdmin = Array.isArray(user.roles) && user.roles.some((r) => PLATFORM_ADMIN_ROLES.includes(r));
        const isCoOwner = user.coOwnerOf && user.companyId && String(user.coOwnerOf) === String(user.companyId);
        const isCompanyAdmin = user.companyId && (COMPANY_ADMIN_ROLES.includes(user.companyRole) || isCoOwner);

        if (!isCompanyAdmin && !req.isPlatformAdmin) {
            return res.status(403).json({ message: 'Access denied: company admin privileges required' });
        }
        req.companyId = user.companyId ? String(user.companyId) : null;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * The company a request may act on: the caller's own, or (platform admins only)
 * the one they asked for. Returns null and sends 403 when a company admin asks
 * for someone else's company.
 */
function scopedCompanyId(req, res, requested) {
    const asked = requested ? String(requested) : null;
    if (req.isPlatformAdmin) return asked || req.companyId;
    if (asked && asked !== req.companyId) {
        res.status(403).json({ message: 'Access denied: that company is not yours' });
        return null;
    }
    return req.companyId;
}

module.exports = requireCompanyAdmin;
module.exports.scopedCompanyId = scopedCompanyId;
