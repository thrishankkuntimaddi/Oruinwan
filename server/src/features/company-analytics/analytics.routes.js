// server/src/features/company-analytics/analytics.routes.js
//
// Phase 6 — Company Analytics
// Single endpoint: GET /api/company/analytics
// Mounted under /api/company — alongside people.routes.js and updates.routes.js

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');
const { getCompanyAnalytics } = require('./analytics.service');

// ── Helper ────────────────────────────────────────────────────────────────────

function handleError(res, err) {
    console.error('[ANALYTICS]', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
}

// ── Validation ────────────────────────────────────────────────────────────────

const validateQuery = [
    query('timeRange')
        .optional()
        .isIn(['7d', '30d', '90d'])
        .withMessage('timeRange must be 7d, 30d, or 90d'),
];

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/company/analytics
 * @desc    Company health metrics — aggregate counts only, no message content read.
 * @access  Private — admin or owner (analytics is sensitive)
 * @query   timeRange? ('7d' | '30d' | '90d', default '30d')
 *
 * Response shape:
 *   employees    { total, active, invited, suspended, newHires, roleDistribution[] }
 *   orgStructure { departments, departmentBreakdown[] }
 *   workspaces   { total, active, workspaceActivity[] }
 *   messages     { total, recent, channelMessages, dmMessages, messageGrowthRate }
 *   tasks        { total, open, completed, overdue, taskCompletionRate }
 *   engagement   { activeUsers, engagementScore }
 *   updates      { total, recent }
 */
router.get(
    '/analytics',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),     // Only admin/owner can view full analytics
    validateQuery,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
            });
        }

        try {
            const timeRange = req.query.timeRange || '30d';
            const data = await getCompanyAnalytics(req.companyId.toString(), timeRange);
            return res.json({ success: true, analytics: data });
        } catch (err) {
            return handleError(res, err);
        }
    }
);

module.exports = router;
