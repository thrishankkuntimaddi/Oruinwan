const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');
const { getCompanyAnalytics, getActivityAnalytics } = require('./analytics.service');

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

router.get('/analytics/activity', ...gate, async (req, res) => {
    try {
        const data = await getActivityAnalytics(req.companyId.toString());
        return res.json({ success: true, activity: data });
    } catch (err) {
        return handleError(res, err);
    }
});

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
