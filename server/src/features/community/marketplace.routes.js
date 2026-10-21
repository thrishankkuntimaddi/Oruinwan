const express = require('express');
const { hydrate, USER_MIN } = require('../../identity/hydrate');
const router = express.Router();
const mongoose = require('mongoose');
const App = require('../developer/app.model');
const AppReview = require('./AppReview.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const { safeRegex } = require('../../shared/utils/escapeRegex');
const { requireWorkspaceAccess, assertWorkspaceMember, sendAccessError, isValidId } = require('../../shared/utils/workspaceAccess');
const { installApp, uninstallApp, toPublicApp } = require('../developer/appInstall.service');

const CATEGORIES = ['productivity', 'communication', 'developer', 'automation', 'analytics'];

// The catalogue itself is public; asking for per-workspace `installed` flags
// requires auth + active membership of that workspace.
function authIfWorkspace(req, res, next) {
  if (!req.query?.workspaceId) return next();
  return requireAuth(req, res, (err) => {
    if (err) return next(err);
    return requireWorkspaceAccess({ from: (r) => r.query.workspaceId })(req, res, next);
  });
}
const adminOfBodyWorkspace = requireWorkspaceAccess({ from: (req) => req.body?.workspaceId, adminOnly: true });

router.get('/apps', authIfWorkspace, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 24, 100);
    const skip = (page - 1) * limit;
    const { category, q } = req.query;

    const query = { ...App.APPROVED_QUERY };
    if (category !== undefined) {
      if (typeof category !== 'string' || !CATEGORIES.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      query.category = category;
    }
    if (q !== undefined && q !== '') {
      if (typeof q !== 'string') return res.status(400).json({ message: 'q must be a string' });
      const regex = safeRegex(q.slice(0, 200));
      query.$and = [{ $or: [{ name: regex }, { description: regex }, { developer: regex }] }];
    }
    const workspaceId = req.workspaceAccess?.workspaceId || null;

    const [apps, total] = await Promise.all([
      App.find(query)
        .select('name description category developer version iconUrl installedIn scopes botUser homepageUrl ownerId')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      App.countDocuments(query)
    ]);

    
    const appIds = apps.map(a => a._id);
    const ratings = await AppReview.aggregate([
      { $match: { appId: { $in: appIds } } },
      {
        $group: {
          _id: '$appId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    const ratingMap = {};
    ratings.forEach(r => {
      ratingMap[r._id.toString()] = {
        avgRating: Math.round(r.avgRating * 10) / 10,
        reviewCount: r.reviewCount
      };
    });

    const enriched = apps.map(app => ({
      ...toPublicApp(app, workspaceId),
      avgRating: ratingMap[app._id.toString()]?.avgRating || 0,
      reviewCount: ratingMap[app._id.toString()]?.reviewCount || 0,
    }));

    res.json({ apps: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[Marketplace] GET /apps error:', err.message);
    res.status(500).json({ message: 'Failed to fetch marketplace apps' });
  }
});

// Install / uninstall: workspace owner or admin only.
router.post('/install', requireAuth, adminOfBodyWorkspace, async (req, res) => {
  try {
    const result = await installApp(req.body.appId, req.workspaceAccess.workspaceId, { userId: req.user.sub });
    logger.info(`[Marketplace] App "${result.name}" installed in workspace ${req.workspaceAccess.workspaceId} by ${req.user.sub}`);
    res.json({ message: `${result.name} installed successfully`, ...result });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[Marketplace] POST /install error:', err.message);
    res.status(500).json({ message: 'Failed to install app' });
  }
});

router.post('/uninstall', requireAuth, adminOfBodyWorkspace, async (req, res) => {
  try {
    const result = await uninstallApp(req.body.appId, req.workspaceAccess.workspaceId);
    logger.info(`[Marketplace] App "${result.name}" uninstalled from workspace ${req.workspaceAccess.workspaceId} by ${req.user.sub}`);
    res.json({ message: `${result.name} uninstalled successfully`, ...result });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[Marketplace] POST /uninstall error:', err.message);
    res.status(500).json({ message: 'Failed to uninstall app' });
  }
});

/**
 * POST /review { appId, rating 1–5, comment?, workspaceId }
 * One review per user per app (a second POST updates it). Only people who use
 * the app may review it: the caller must be an active member of `workspaceId`
 * and the app must be installed there. App owners cannot review their own app.
 */
router.post('/review', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { appId, comment, workspaceId } = req.body || {};
    const rating = Number(req.body?.rating);

    if (!appId || !isValidId(appId)) return res.status(400).json({ message: 'Valid appId is required' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be a whole number between 1 and 5' });
    }
    if (comment !== undefined && comment !== null && typeof comment !== 'string') {
      return res.status(400).json({ message: 'comment must be a string' });
    }
    if ((comment || '').length > 1000) return res.status(400).json({ message: 'comment must be at most 1000 characters' });
    if (!workspaceId || !isValidId(workspaceId)) {
      return res.status(400).json({ message: 'workspaceId is required: only workspaces that installed the app can review it' });
    }

    const app = await App.findById(appId).select('name ownerId installedIn').lean();
    if (!app) return res.status(404).json({ message: 'App not found' });
    if (app.ownerId && String(app.ownerId) === String(userId)) {
      return res.status(403).json({ message: 'You cannot review your own app' });
    }
    await assertWorkspaceMember(workspaceId, userId);
    if (!(app.installedIn || []).some((id) => String(id) === String(workspaceId))) {
      return res.status(403).json({ message: 'Install the app in this workspace before reviewing it' });
    }

    const review = await AppReview.findOneAndUpdate(
      { appId, userId },
      { rating, comment: (comment || '').trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Review saved', review });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    if (err.code === 11000) return res.status(409).json({ message: 'You have already reviewed this app' });
    logger.error('[Marketplace] POST /review error:', err.message);
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

router.get('/reviews/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ message: 'Invalid appId' });
    }

    const [reviews, total, stats] = await Promise.all([
      AppReview.find({ appId })
        .select('userId rating comment createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .then((rows) => hydrate(rows, { userId: USER_MIN })), // reviewers live in PostgreSQL
      AppReview.countDocuments({ appId }),
      AppReview.aggregate([
        { $match: { appId: new mongoose.Types.ObjectId(appId) } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ])
    ]);

    const avgRating = stats[0] ? Math.round(stats[0].avgRating * 10) / 10 : 0;

    res.json({
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      avgRating
    });
  } catch (err) {
    logger.error('[Marketplace] GET /reviews/:appId error:', err.message);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Connectors with their own modules (not in the connector registry).
const BUILTIN_CONNECTORS = [
  { type: 'github', label: 'GitHub', category: 'developer', description: 'Pull requests, pushes, checks and issues as cards in your channels; linked tasks follow the PR.' },
  { type: 'jira', label: 'Jira', category: 'developer', description: 'Jira Cloud issues sync with tasks, both ways.' },
  { type: 'zoom', label: 'Zoom', category: 'communication', description: 'Start or schedule Zoom meetings from chat with /zoom.' },
];
// Usage counts below this are hidden so a small number cannot point at a workspace.
const MIN_PUBLIC_COUNT = 5;

/**
 * GET /integrations/public — the integrations Oruinwan ships, for the marketplace
 * page. Public, no auth. Each entry: { type, label, category, description,
 * workspaceCount } where workspaceCount is how many workspaces have it connected,
 * or null when fewer than MIN_PUBLIC_COUNT. No workspace ids, labels or settings.
 */
router.get('/integrations/public', async (req, res) => {
  try {
    const Integration = require('../integrations/integration.model');
    let registry = [];
    try {
      const { CONNECTORS } = require('../integrations/connectors/registry');
      registry = Object.values(CONNECTORS).map((c) => ({ type: c.type, label: c.label, category: c.category || 'other', description: c.description || '' }));
    } catch (e) { logger.warn('[Marketplace] connector registry unavailable:', e.message); }
    const seen = new Set();
    const list = [...BUILTIN_CONNECTORS, ...registry].filter((c) => c.type && !seen.has(c.type) && seen.add(c.type));

    const counts = await Integration.aggregate([
      { $match: { status: 'connected' } },
      { $group: { _id: '$type', workspaces: { $addToSet: '$workspaceId' } } },
      { $project: { n: { $size: '$workspaces' } } },
    ]);
    const countOf = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    const integrations = list.map((c) => {
      const n = countOf[c.type] || 0;
      return { ...c, workspaceCount: n >= MIN_PUBLIC_COUNT ? n : null };
    }).sort((a, b) => (b.workspaceCount || 0) - (a.workspaceCount || 0) || a.label.localeCompare(b.label));

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ integrations });
  } catch (err) {
    logger.error('[Marketplace] GET /integrations/public error:', err.message);
    res.status(500).json({ message: 'Failed to fetch public integrations' });
  }
});

module.exports = router;
