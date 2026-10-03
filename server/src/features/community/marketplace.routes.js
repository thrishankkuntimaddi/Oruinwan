const express = require('express');
const { hydrate, USER_MIN } = require('../../identity/hydrate');
const router = express.Router();
const mongoose = require('mongoose');
const App = require('../developer/app.model');
const AppReview = require('./AppReview.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const { safeRegex } = require('../../shared/utils/escapeRegex');
const { requireWorkspaceAccess, sendAccessError, isValidId } = require('../../shared/utils/workspaceAccess');
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

    const query = { isPublished: true };
    if (category !== undefined) {
      if (typeof category !== 'string' || !CATEGORIES.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      query.category = category;
    }
    if (q !== undefined && q !== '') {
      if (typeof q !== 'string') return res.status(400).json({ message: 'q must be a string' });
      const regex = safeRegex(q.slice(0, 200));
      query.$or = [{ name: regex }, { description: regex }];
    }
    const workspaceId = req.workspaceAccess?.workspaceId || null;

    const [apps, total] = await Promise.all([
      App.find(query)
        .select('name description category developer version iconUrl installedIn')
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
    const result = await installApp(req.body.appId, req.workspaceAccess.workspaceId);
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

router.post('/review', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { appId, rating, comment } = req.body;

    if (!appId || !isValidId(appId)) return res.status(400).json({ message: 'Valid appId is required' });
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    
    const app = await App.findById(appId).lean();
    if (!app) return res.status(404).json({ message: 'App not found' });

    
    const review = await AppReview.findOneAndUpdate(
      { appId, userId },
      { rating: Math.round(rating), comment: (comment || '').trim() },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Review submitted', review });
  } catch (err) {
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

router.get('/integrations/public', async (req, res) => {
  try {
    const Integration = require('../integrations/integration.model');
    const integrations = await Integration.find({ isPublic: true, status: 'connected' })
      .select('type label status isPublic createdAt')
      .sort({ type: 1 })
      .lean();

    res.json({ integrations });
  } catch (err) {
    logger.error('[Marketplace] GET /integrations/public error:', err.message);
    res.status(500).json({ message: 'Failed to fetch public integrations' });
  }
});

module.exports = router;
