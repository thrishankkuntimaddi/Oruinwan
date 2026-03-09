// server/src/features/people/people.validation.js
//
// Phase 3 — Company People Management
// Express-validator rule sets for each endpoint.

const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);
const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];
const VALID_STATUSES = ['active', 'suspended', 'removed'];

// ── Reusable ─────────────────────────────────────────────────────────────────

const validObjectId = (field, location = param) =>
    location(field)
        .optional({ nullable: true })
        .custom(isObjectId)
        .withMessage(`${field} must be a valid ID`);

const validObjectIdArray = (field) =>
    body(field)
        .optional()
        .isArray()
        .withMessage(`${field} must be an array`)
        .custom((ids) => ids.every(isObjectId))
        .withMessage(`All entries in ${field} must be valid IDs`);

// ── Rule Sets ─────────────────────────────────────────────────────────────────

/**
 * POST /api/company/invite
 */
const inviteEmployee = [
    body('email')
        .isEmail().withMessage('A valid email is required')
        .normalizeEmail(),

    body('firstName')
        .optional()
        .isString().isLength({ max: 80 }).withMessage('firstName must be ≤80 chars'),

    body('lastName')
        .optional()
        .isString().isLength({ max: 80 }).withMessage('lastName must be ≤80 chars'),

    body('companyRole')
        .optional()
        .isIn(VALID_ROLES).withMessage(`companyRole must be one of: ${VALID_ROLES.join(', ')}`),

    body('jobTitle')
        .optional()
        .isString().isLength({ max: 120 }).withMessage('jobTitle must be ≤120 chars'),

    validObjectIdArray('departments'),
];

/**
 * GET /api/company/members (query param validation)
 */
const listMembers = [
    query('status')
        .optional()
        .isIn(['active', 'invited', 'suspended', 'removed'])
        .withMessage('status must be active|invited|suspended|removed'),

    query('role')
        .optional()
        .isIn(VALID_ROLES)
        .withMessage(`role must be one of: ${VALID_ROLES.join(', ')}`),

    query('search')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('search must be ≤100 chars'),
];

/**
 * PATCH /api/company/members/:id/role
 */
const changeRole = [
    param('id').custom(isObjectId).withMessage('id must be a valid member ID'),

    body('newRole')
        .isIn(VALID_ROLES)
        .withMessage(`newRole must be one of: ${VALID_ROLES.join(', ')}`),

    validObjectIdArray('managedDepartments'),
];

/**
 * PATCH /api/company/members/:id/status
 */
const updateStatus = [
    param('id').custom(isObjectId).withMessage('id must be a valid member ID'),

    body('status')
        .isIn(VALID_STATUSES)
        .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),

    body('reason')
        .optional()
        .isString().isLength({ max: 500 }).withMessage('reason must be ≤500 chars'),
];

module.exports = {
    inviteEmployee,
    listMembers,
    changeRole,
    updateStatus,
};
