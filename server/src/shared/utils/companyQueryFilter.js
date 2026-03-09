// server/src/shared/utils/companyQueryFilter.js
//
// Company Query Filter — Phase 1 Company Membership Foundation
//
// Single-responsibility helper that builds a tenant-scoped Mongoose filter object.
// Use this in every controller that queries a company-scoped collection to prevent
// cross-tenant data leakage.
//
// Prerequisites:
//   requireCompanyMember middleware must have run (sets req.companyId)
//
// Usage:
//   const { companyQueryFilter } = require('../../shared/utils/companyQueryFilter');
//
//   // Basic tenant filter:
//   const filter = companyQueryFilter(req);
//   // → { companyId: "abc123" }
//
//   // With extra conditions:
//   const filter = companyQueryFilter(req, { status: 'active', deleted: false });
//   // → { companyId: "abc123", status: "active", deleted: false }
//
//   // In a controller:
//   const members = await User.find(companyQueryFilter(req, { companyRole: 'member' }));

/**
 * Build a Mongoose query filter scoped to the current user's company.
 *
 * @param {import('express').Request} req       - Express request (must have req.companyId)
 * @param {Object}                   [extra={}] - Additional filter conditions to merge
 * @returns {Object} Mongoose-compatible filter object
 * @throws {Error}  If req.companyId is not set (middleware chain error)
 */
function companyQueryFilter(req, extra = {}) {
    if (!req.companyId) {
        throw new Error(
            "[companyQueryFilter] req.companyId is not set. " +
            "Ensure requireCompanyMember middleware runs before this function is called."
        );
    }

    return {
        companyId: req.companyId,
        ...extra,
    };
}

/**
 * Variant for models that use `company` (ObjectId) instead of `companyId`.
 * Some older models (Workspace, Department) use `company` as the field name.
 *
 * @param {import('express').Request} req       - Express request
 * @param {Object}                   [extra={}] - Additional filter conditions
 * @returns {Object}
 */
function companyFilter(req, extra = {}) {
    if (!req.companyId) {
        throw new Error(
            "[companyFilter] req.companyId is not set. " +
            "Ensure requireCompanyMember middleware runs before this function is called."
        );
    }

    return {
        company: req.companyId,
        ...extra,
    };
}

module.exports = {
    companyQueryFilter, // for models using field name: companyId
    companyFilter,      // for models using field name: company (Workspace, Department)
};
