// server/src/features/company-updates/updates.validation.js
//
// Phase 5 — Company Updates Feed

const { body, param, query } = require('express-validator');

const VALID_TYPES = ['announcement', 'achievement', 'milestone', 'news', 'alert', 'general'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'];
const isObjectId = (v) => /^[a-f\d]{24}$/i.test(v);

/**
 * POST /api/company/updates
 */
const postUpdate = [
    body('content')
        .trim()
        .notEmpty().withMessage('content is required')
        .isLength({ max: 5000 }).withMessage('content must be ≤5000 characters'),

    body('title')
        .optional()
        .isString().isLength({ max: 200 }).withMessage('title must be ≤200 characters'),

    body('type')
        .optional()
        .isIn(VALID_TYPES).withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),

    body('priority')
        .optional()
        .isIn(VALID_PRIORITIES).withMessage(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`),

    body('attachments')
        .optional()
        .isArray().withMessage('attachments must be an array'),

    body('mentions')
        .optional()
        .isArray().withMessage('mentions must be an array')
        .custom(ids => ids.every(isObjectId)).withMessage('All mentions must be valid IDs'),
];

/**
 * GET /api/company/updates
 */
const getUpdates = [
    query('type')
        .optional()
        .isIn(VALID_TYPES).withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),

    query('priority')
        .optional()
        .isIn(VALID_PRIORITIES).withMessage(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`),

    query('search')
        .optional()
        .isString().isLength({ max: 100 }).withMessage('search must be ≤100 chars'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100'),

    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('page must be ≥1'),
];

/**
 * POST /api/company/updates/:id/react
 */
const addReaction = [
    param('id').custom(isObjectId).withMessage('id must be a valid update ID'),

    body('emoji')
        .trim()
        .notEmpty().withMessage('emoji is required')
        .isLength({ max: 10 }).withMessage('emoji must be ≤10 chars'),
];

module.exports = { postUpdate, getUpdates, addReaction };
