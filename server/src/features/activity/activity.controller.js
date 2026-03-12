/**
 * server/src/features/activity/activity.controller.js
 *
 * Unified Activity Stream — REST Controller
 *
 * Endpoints:
 *   GET /api/activity/feed?workspaceId=xxx&limit=20&before=<iso>&type=task&actor=<userId>
 *     → paginated activity events for a workspace (filterable by type + actor)
 *
 *   GET /api/activity/me?limit=20
 *     → the authenticated user's own activity history
 *
 *   GET /api/activity/stats?workspaceId=xxx
 *     → { stats: [{ type, count }] } for dashboard widgets
 */

'use strict';

const mongoose = require('mongoose');
const ActivityEvent = require('../../models/ActivityEvent');
const { ACTIVITY_TYPES } = require('../../../../platform/sdk/events/activityEvents');

const VALID_TYPES = Object.values(ACTIVITY_TYPES);

// ---------------------------------------------------------------------------
// GET /api/activity/feed
// ---------------------------------------------------------------------------
exports.getFeed = async (req, res) => {
  try {
    const { workspaceId, limit = 20, before, type, actor } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const query = { workspaceId };

    // Optional cursor-based pagination
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Optional type filter — validate against known types
    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
        });
      }
      query.type = type;
    }

    // Optional actor filter
    if (actor) {
      query.actor = actor;
    }

    const events = await ActivityEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 50))
      .populate('actor', 'firstName lastName username avatarUrl')
      .lean();

    return res.json({ events });
  } catch (err) {
    console.error('[ActivityController] getFeed error:', err);
    return res.status(500).json({ message: 'Failed to fetch activity feed' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/activity/me
// ---------------------------------------------------------------------------
exports.getMyActivity = async (req, res) => {
  try {
    const { limit = 20, before } = req.query;
    const userId = req.user.sub;

    const query = { actor: userId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const events = await ActivityEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 50))
      .lean();

    return res.json({ events });
  } catch (err) {
    console.error('[ActivityController] getMyActivity error:', err);
    return res.status(500).json({ message: 'Failed to fetch your activity' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/activity/stats
// ---------------------------------------------------------------------------
exports.getStats = async (req, res) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const stats = await ActivityEvent.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { _id: 0, type: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]);

    return res.json({ stats });
  } catch (err) {
    console.error('[ActivityController] getStats error:', err);
    return res.status(500).json({ message: 'Failed to fetch activity stats' });
  }
};
