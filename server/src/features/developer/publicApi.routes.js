// server/src/features/developer/publicApi.routes.js
// Public API — accessed via X-Api-Key header, workspace-scoped
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const apiKeyMiddleware = require('./apiKey.middleware');
const logger = require('../../../utils/logger');

// ── Rate limit: 100 req/min per API key ──────────────────────────────────────
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  handler: (req, res) => {
    res.status(429).json({ error: 'Rate limit exceeded. Max 100 requests/minute per API key.' });
  }
});

router.use(publicApiLimiter);
router.use(apiKeyMiddleware);

// ── Log all public API usage ──────────────────────────────────────────────────
router.use((req, res, next) => {
  logger.info(`[PublicAPI] ${req.method} ${req.path} | workspace:${req.workspaceId} | key:${req.apiKeyDoc.keyPrefix}`);
  next();
});

// ── GET /api/public/messages ──────────────────────────────────────────────────
router.get('/messages', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const { limit = 50, channelId } = req.query;

    // Try fetching from InternalMessage collection (messages stored there)
    const InternalMessage = require('../../models/InternalMessage');
    const query = { workspaceId: req.workspaceId };
    if (channelId) query.channelId = channelId;

    const messages = await InternalMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .select('content sender channelId createdAt type')
      .populate('sender', 'username firstName lastName')
      .lean();

    res.json({ messages, count: messages.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /messages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ── GET /api/public/tasks ─────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    const Task = require('../../models/Task');
    const { status, limit = 50 } = req.query;

    const query = { workspaceId: req.workspaceId, deletedAt: null };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .select('title description status priority assignee dueDate createdAt')
      .populate('assignee', 'username firstName lastName')
      .lean();

    res.json({ tasks, count: tasks.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /tasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ── POST /api/public/tasks ────────────────────────────────────────────────────
router.post('/tasks', async (req, res) => {
  try {
    // Check write permission
    const perms = req.apiKeyDoc.permissions;
    if (!perms.includes('tasks:write') && !perms.includes('*')) {
      return res.status(403).json({ error: 'API key does not have tasks:write permission' });
    }

    const Task = require('../../models/Task');
    const { title, description, priority, dueDate, assigneeId } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignee: assigneeId || null,
      workspaceId: req.workspaceId,
      status: 'todo',
      createdBy: req.apiKeyDoc.createdBy
    });

    res.status(201).json({ task });
  } catch (err) {
    logger.error('[PublicAPI] POST /tasks error:', err.message);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ── GET /api/public/files ─────────────────────────────────────────────────────
router.get('/files', async (req, res) => {
  try {
    const WorkspaceFile = require('../../features/files/WorkspaceFile');
    const { limit = 50 } = req.query;

    const files = await WorkspaceFile.find({ workspaceId: req.workspaceId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .select('name mimeType size url channelId createdAt')
      .lean();

    res.json({ files, count: files.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /files error:', err.message);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ── GET /api/public/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const Workspace = require('../../features/workspaces/workspace.model');

    const ws = await Workspace.findById(req.workspaceId)
      .populate('members.user', 'username firstName lastName avatarUrl email')
      .lean();

    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    const users = (ws.members || []).map(m => ({
      id: m.user?._id,
      username: m.user?.username,
      firstName: m.user?.firstName,
      lastName: m.user?.lastName,
      avatarUrl: m.user?.avatarUrl,
      role: m.role
    }));

    res.json({ users, count: users.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/public/channels ──────────────────────────────────────────────────
router.get('/channels', async (req, res) => {
  try {
    // Try finding channels associated with this workspace
    const mongoose = require('mongoose');
    let channels = [];
    try {
      const Channel = mongoose.model('Channel');
      channels = await Channel.find({ workspace: req.workspaceId, isArchived: { $ne: true } })
        .select('name description type membersCount createdAt')
        .lean();
    } catch {
      // Channel model may have different name
      channels = [];
    }

    res.json({ channels, count: channels.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /channels error:', err.message);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

module.exports = router;
