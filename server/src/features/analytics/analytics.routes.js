const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const requireAuth = require('../../shared/middleware/auth');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');
const analyticsService = require('./analytics.service');
const User = require('../../../models/User');

const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');
const { scopedCompanyId } = requireCompanyAdmin;

// Own company only (platform staff may pick any).
router.get('/company/:companyId', requireAuth, requireCompanyAdmin, (req, res, next) => {
    const companyId = scopedCompanyId(req, res, req.params.companyId);
    if (!companyId) return res.headersSent ? undefined : res.status(403).json({ message: 'Access denied' });
    req.params.companyId = companyId;
    next();
}, analyticsController.getCompanyAnalytics);

// requireAdmin replaces req.user with the database user (no `sub`), so read
// the company from it, falling back to a lookup by id.
async function resolveCompanyId(req) {
    const c = req.user && req.user.companyId;
    if (c) return String(c._id || c);
    const id = req.user && (req.user.sub || req.user._id);
    if (!id) return null;
    const user = await User.findById(id).select('companyId').lean();
    return user?.companyId?.toString();
}

router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
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

router.get('/insights/team', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getTeamActivity(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/communication', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getCommunicationPatterns(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/productivity', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getTaskAnalytics(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/workload', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getWorkloadAnalysis(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/insights/engagement', requireAuth, requireAdmin, async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ message: 'No company' });
        const period = Math.min(parseInt(req.query.period) || 30, 365);
        res.json(await analyticsService.getEngagementTrends(companyId, period));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
