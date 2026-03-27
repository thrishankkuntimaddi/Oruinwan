// server/src/features/community/marketplace.routes.js
// Community Marketplace — app listing, install, reviews, and public integrations
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const App = require('../developer/app.model');
const AppReview = require('./AppReview.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// APP MARKETPLACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/marketplace/apps
 * Public listing of all marketplace apps. Includes avg rating from reviews.
 * Paginated: ?page=1&limit=20&category=productivity&q=search
 */
router.get('/apps', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 24, 100);
    const skip = (page - 1) * limit;
    const { category, q } = req.query;

    const query = { isPublished: true };
    if (category) query.category = category;
    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [{ name: regex }, { description: regex }];
    }

    const [apps, total] = await Promise.all([
      App.find(query)
        .select('name description category developer version iconUrl installedIn')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      App.countDocuments(query)
    ]);

    // Fetch avg ratings for returned apps
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
      ...app,
      installCount: app.installedIn?.length || 0,
      avgRating: ratingMap[app._id.toString()]?.avgRating || 0,
      reviewCount: ratingMap[app._id.toString()]?.reviewCount || 0,
      installedIn: undefined // strip from public payload
    }));

    res.json({ apps: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[Marketplace] GET /apps error:', err.message);
    res.status(500).json({ error: 'Failed to fetch marketplace apps' });
  }
});

/**
 * POST /api/marketplace/install
 * Install an app into a workspace. Auth required.
 * Body: { appId, workspaceId }
 */
router.post('/install', requireAuth, async (req, res) => {
  try {
    const { appId, workspaceId } = req.body;
    if (!appId || !workspaceId) {
      return res.status(400).json({ error: 'appId and workspaceId are required' });
    }

    const app = await App.findById(appId);
    if (!app || !app.isPublished) {
      return res.status(404).json({ error: 'App not found' });
    }

    const alreadyInstalled = app.installedIn.some(id => id.toString() === workspaceId);
    if (alreadyInstalled) {
      return res.status(409).json({ error: 'App already installed in this workspace' });
    }

    app.installedIn.push(workspaceId);
    await app.save();

    logger.info(`[Marketplace] App "${app.name}" installed in workspace ${workspaceId} by ${req.user.sub}`);
    res.json({ message: `${app.name} installed successfully` });
  } catch (err) {
    logger.error('[Marketplace] POST /install error:', err.message);
    res.status(500).json({ error: 'Failed to install app' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// APP RATINGS & REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/marketplace/review
 * Submit or update a rating + review for an app. Auth required.
 * Body: { appId, rating (1-5), comment? }
 */
router.post('/review', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { appId, rating, comment } = req.body;

    if (!appId) return res.status(400).json({ error: 'appId is required' });
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    // Verify app exists
    const app = await App.findById(appId).lean();
    if (!app) return res.status(404).json({ error: 'App not found' });

    // Upsert: one review per user per app
    const review = await AppReview.findOneAndUpdate(
      { appId, userId },
      { rating: Math.round(rating), comment: (comment || '').trim() },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Review submitted', review });
  } catch (err) {
    logger.error('[Marketplace] POST /review error:', err.message);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

/**
 * GET /api/marketplace/reviews/:appId
 * List reviews for a given app. Public (no auth).
 * Paginated: ?page=1&limit=10
 */
router.get('/reviews/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ error: 'Invalid appId' });
    }

    const [reviews, total, stats] = await Promise.all([
      AppReview.find({ appId })
        .select('userId rating comment createdAt')
        .populate('userId', 'username profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC INTEGRATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/marketplace/integrations/public
 * List pre-configured integrations marked isPublic:true (no auth).
 */
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
    res.status(500).json({ error: 'Failed to fetch public integrations' });
  }
});

module.exports = router;
