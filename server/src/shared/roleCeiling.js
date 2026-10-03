'use strict';

/**
 * Role ceiling for company user management — one rule set used by every
 * route that invites people, changes roles, suspends or removes users.
 *
 *  - Nobody can grant `owner` through these routes (ownership transfer is separate).
 *  - Only an owner / co-owner can grant `admin`, or change / suspend / remove
 *    an admin or co-owner.
 *  - Nobody can change / suspend / remove the owner.
 *  - Admins manage managers, members and guests.
 *
 * Roles are always read from the database, never from the JWT.
 */

const ASSIGNABLE_ROLES = ['admin', 'manager', 'member', 'guest'];

const idStr = (v) => (v && typeof v === 'object' && v._id ? String(v._id) : v ? String(v) : '');

function isCoOwner(user) {
    return !!(user && user.coOwnerOf && user.companyId && idStr(user.coOwnerOf) === idStr(user.companyId));
}

/** 'owner' for owners and co-owners, otherwise the stored companyRole. */
function effectiveRole(user) {
    if (!user) return null;
    if (user.companyRole === 'owner' || isCoOwner(user)) return 'owner';
    return user.companyRole || 'member';
}

const isPrivileged = (user) => effectiveRole(user) === 'owner' || effectiveRole(user) === 'admin';

/**
 * Can `actor` give someone the role `newRole`? Returns null when allowed or a
 * reason string when not.
 */
function assignRoleError(actor, newRole) {
    if (!ASSIGNABLE_ROLES.includes(newRole)) {
        return newRole === 'owner'
            ? 'Ownership cannot be granted here'
            : `Invalid role. Must be one of: ${ASSIGNABLE_ROLES.join(', ')}`;
    }
    const actorRole = effectiveRole(actor);
    if (actorRole !== 'owner' && actorRole !== 'admin') return 'Admin privileges required';
    if (newRole === 'admin' && actorRole !== 'owner') return 'Only the company owner can grant admin access';
    return null;
}

/**
 * Can `actor` manage (change role / suspend / remove / edit) `target`?
 * Returns null when allowed or a reason string when not.
 */
function manageUserError(actor, target) {
    if (!actor || !target) return 'User not found';
    if (!actor.companyId || idStr(actor.companyId) !== idStr(target.companyId)) return 'That user is not in your company';
    if (idStr(actor._id) && idStr(actor._id) === idStr(target._id)) return 'You cannot perform this action on yourself';
    const actorRole = effectiveRole(actor);
    if (actorRole !== 'owner' && actorRole !== 'admin') return 'Admin privileges required';
    if (target.companyRole === 'owner') return 'The company owner cannot be modified';
    if ((target.companyRole === 'admin' || isCoOwner(target)) && actorRole !== 'owner') {
        return 'Only the company owner can manage admins';
    }
    return null;
}

/** Keeps only department ids that belong to `companyId`. Throws when any is foreign. */
async function assertCompanyDepartments(companyId, ids = []) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String);
    if (list.length === 0) return [];
    const mongoose = require('mongoose');
    if (list.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        throw Object.assign(new Error('Invalid department id'), { status: 400 });
    }
    const { query } = require('./postgres');
    const { rows } = await query('SELECT id FROM departments WHERE id = ANY($1) AND company_id = $2', [list, String(companyId)]);
    const found = rows.map((r) => ({ _id: r.id }));
    if (found.length !== new Set(list).size) {
        throw Object.assign(new Error('One or more departments do not belong to your company'), { status: 400 });
    }
    return found.map((d) => d._id);
}

/**
 * Keeps Company.admins (used by a few legacy checks) in step with a user's
 * role: present with role 'admin' for admins, absent otherwise. Owners are
 * never touched. Best effort — failures are ignored.
 */
async function syncCompanyAdmins(companyId, userId, role) {
    try {
        const { companies } = require('../identity');
        const { query } = require('./postgres');
        // Owners are never touched: only rows with role 'admin' are removed.
        await query("DELETE FROM company_admins WHERE company_id = $1 AND user_id = $2 AND role = 'admin'", [String(companyId), String(userId)]);
        if (role === 'admin') await companies.addAdmin(companyId, userId, 'admin');
    } catch { /* legacy list only */ }
}

module.exports = {
    syncCompanyAdmins,
    ASSIGNABLE_ROLES,
    isCoOwner,
    effectiveRole,
    isPrivileged,
    assignRoleError,
    manageUserError,
    assertCompanyDepartments,
};
