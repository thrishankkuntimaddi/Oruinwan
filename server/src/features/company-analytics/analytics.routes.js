// server/src/features/company-analytics/analytics.routes.js
//
// Phase 2 — Company Communication Layer
//
// GET /api/company/analytics/overview   — full metrics report (admin+)
// GET /api/company/analytics/activity   — lightweight 7-day activity (admin+)
// GET /api/company/analytics            — alias for /overview (backward compat)

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');
const { getCompanyAnalytics, getActivityAnalytics } = require('./analytics.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

function handleError(res, err) {
    console.error('[ANALYTICS]', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
}

const timeRangeQuery = [
    query('timeRange')
        .optional()
        .isIn(['7d', '30d', '90d'])
        .withMessage('timeRange must be 7d, 30d, or 90d'),
];

const gate = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/company/analytics/overview
 * @desc    Full company health metrics — employees, workspaces, messages, tasks, engagement
 * @access  admin / owner
 * @query   timeRange? ('7d' | '30d' | '90d', default '30d')
 */
router.get('/analytics/overview', ...gate, timeRangeQuery, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const timeRange = req.query.timeRange || '30d';
        const data = await getCompanyAnalytics(req.companyId.toString(), timeRange);
        return res.json({ success: true, analytics: data });
    } catch (err) {
        return handleError(res, err);
    }
});

/**
 * @route   GET /api/company/analytics/activity
 * @desc    Lightweight 7-day activity report: messages, tasks, active users, daily breakdown
 * @access  admin / owner
 */
router.get('/analytics/activity', ...gate, async (req, res) => {
    try {
        const data = await getActivityAnalytics(req.companyId.toString());
        return res.json({ success: true, activity: data });
    } catch (err) {
        return handleError(res, err);
    }
});

/**
 * @route   GET /api/company/analytics
 * @desc    Alias for /overview — backward compatibility
 * @access  admin / owner
 */
router.get('/analytics', ...gate, timeRangeQuery, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const timeRange = req.query.timeRange || '30d';
        const data = await getCompanyAnalytics(req.companyId.toString(), timeRange);
        return res.json({ success: true, analytics: data });
    } catch (err) {
        return handleError(res, err);
    }
});

module.exports = router;

