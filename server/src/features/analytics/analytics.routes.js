// server/src/features/analytics/analytics.routes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');
const analyticsService = require('./analytics.service');
const User = require('../../../models/User');

/**
 * @route   GET /api/analytics/company/:companyId
 * @desc    Company-level analytics (existing)
 * @access  Private (Admin)
 */
router.get('/company/:companyId', requireAuth, requireAdmin, analyticsController.getCompanyAnalytics);

// ─── Helper: resolve companyId from JWT ──────────────────────────────────────
async function resolveCompanyId(userId) {
    const user = await User.findById(userId).select('companyId').lean();
    return user?.companyId?.toString();
}

/**
 * @route   GET /api/analytics?type=team-activity|communication|productivity|workload|engagement
 * @desc    Unified insights endpoint — dispatches by `type` query param
 * @access  Private (Admin/Manager)
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company associated' });

        const { type, period: p } = req.query;
        const period = Math.min(parseInt(p) || 30, 365);

        let data;
        switch (type) {
            case 'team-activity':
                data = await analyticsService.getTeamActivity(companyId, period);
                break;
            case 'communication':
                data = await analyticsService.getCommunicationPatterns(companyId, period);
                break;
            case 'productivity':
                data = await analyticsService.getTaskAnalytics(companyId, period);
                break;
            case 'workload':
                data = await analyticsService.getWorkloadAnalysis(companyId, period);
                break;
            case 'engagement':
                data = await analyticsService.getEngagementTrends(companyId, period);
                break;
            default:
                // Return all insights in one payload
                const [teamActivity, commPatterns, productivity, workload, engagement] = await Promise.all([
                    analyticsService.getTeamActivity(companyId, period),
                    analyticsService.getCommunicationPatterns(companyId, period),
                    analyticsService.getTaskAnalytics(companyId, period),
                    analyticsService.getWorkloadAnalysis(companyId, period),
                    analyticsService.getEngagementTrends(companyId, period)
                ]);
                data = { teamActivity, commPatterns, productivity, workload, engagement };
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: 'Analytics error', error: process.env.NODE_ENV !== 'production' ? err.message : undefined });
    }
});

/**
 * @route   GET /api/analytics/insights/team
 * @route   GET /api/analytics/insights/communication
 * @route   GET /api/analytics/insights/productivity
 * @route   GET /api/analytics/insights/workload
 * @route   GET /api/analytics/insights/engagement
 */
router.get('/insights/team', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getTeamActivity(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/communication', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getCommunicationPatterns(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/productivity', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getTaskAnalytics(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/workload', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getWorkloadAnalysis(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/engagement', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req.user.sub);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getEngagementTrends(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
