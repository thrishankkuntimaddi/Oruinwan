const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const apiKeyMiddleware = require('./apiKey.middleware');
const logger = require('../../../utils/logger');
const { hydrate, userSelect } = require('../../identity/hydrate');
const { isValidId } = require('../../shared/utils/workspaceAccess');

/**
 * Public REST API, authenticated by X-Api-Key (see apiKey.middleware).
 * Every route requires a key scope (key.permissions includes it, or '*').
 * Errors are { message }.
 *
 *   GET  /messages   messages:read   channel message metadata only (content is E2EE)
 *   GET  /tasks      tasks:read
 *   POST /tasks      tasks:write     created as the key's creator (must still be a member)
 *   GET  /files      files:read      non-deleted workspace files
 *   GET  /users      users:read      active members
 *   GET  /channels   channels:read   non-private, non-archived channels
 */

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  handler: (req, res) => {
    res.status(429).json({ message: 'Rate limit exceeded. Max 100 requests/minute per API key.' });
  }
});

router.use(publicApiLimiter);
router.use(apiKeyMiddleware);

router.use((req, res, next) => {
  logger.info(`[PublicAPI] ${req.method} ${req.path} | workspace:${req.workspaceId} | key:${req.apiKeyDoc.keyPrefix}`);
  next();
});

function requireScope(scope) {
  return (req, res, next) => {
    const perms = Array.isArray(req.apiKeyDoc?.permissions) ? req.apiKeyDoc.permissions : [];
    if (perms.includes('*') || perms.includes(scope)) return next();
    return res.status(403).json({ message: `API key does not have the ${scope} permission` });
  };
}

function parseLimit(raw, def = 50, max = 100) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

/** Ids of the workspace's public (non-private, non-archived) channels. */
async function publicChannelIds(workspaceId) {
  const Channel = require('../channels/channel.model');
  const rows = await Channel.find({ workspace: workspaceId, isPrivate: { $ne: true }, isArchived: { $ne: true } })
    .select('_id').lean();
  return rows.map(r => String(r._id));
}

router.get('/messages', requireScope('messages:read'), async (req, res) => {
  try {
    const Message = require('../../modules/messages/message.model');
    const { channelId } = req.query;
    const limit = parseLimit(req.query.limit);

    const allowed = await publicChannelIds(req.workspaceId);
    let channels = allowed;
    if (channelId !== undefined) {
      if (!isValidId(channelId)) return res.status(400).json({ message: 'Invalid channelId' });
      if (!allowed.includes(String(channelId))) return res.status(404).json({ message: 'Channel not found' });
      channels = [String(channelId)];
    }

    const messages = await Message.find({
      workspace: req.workspaceId,
      channel: { $in: channels },
      isDeleted: { $ne: true },
      isDeletedUniversally: { $ne: true },
      deletedAt: null,
      type: { $ne: 'system' },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('channel sender type parentId replyCount createdAt editedAt payload.isEncrypted attachments.type')
      .lean()
      .then((rows) => hydrate(rows, { sender: userSelect('username') }));

    // Messages are end-to-end encrypted: only ids and metadata leave the server.
    const out = messages.map(m => ({
      id: String(m._id),
      channelId: m.channel ? String(m.channel) : null,
      sender: m.sender ? { id: String(m.sender._id || m.sender), username: m.sender.username } : null,
      type: m.type,
      parentId: m.parentId ? String(m.parentId) : null,
      replyCount: m.replyCount || 0,
      attachmentCount: Array.isArray(m.attachments) ? m.attachments.length : 0,
      isEncrypted: !!m.payload?.isEncrypted,
      createdAt: m.createdAt,
      editedAt: m.editedAt || null,
    }));

    res.json({ messages: out, count: out.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /messages error:', err.message);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];

router.get('/tasks', requireScope('tasks:read'), async (req, res) => {
  try {
    const Tasks = require('../tasks/tasks.query');
    const { status } = req.query;
    const limit = parseLimit(req.query.limit);

    const query = { workspace: req.workspaceId, deleted: { $ne: true } };
    if (status !== undefined) {
      if (!TASK_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status. One of: ${TASK_STATUSES.join(', ')}` });
      }
      query.status = status;
    }

    const tasks = await Tasks.find(query, {
      sort: { createdAt: -1 },
      limit,
      select: 'title description status priority assignedTo dueDate createdAt issueKey',
    }).then((rows) => hydrate(rows, { assignedTo: userSelect('username') }));

    res.json({ tasks, count: tasks.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /tasks error:', err.message);
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', requireScope('tasks:write'), async (req, res) => {
  try {
    const body = req.body || {};
    const { title, description, priority, dueDate, status } = body;
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ message: 'title is required' });
    if (title.length > 500) return res.status(400).json({ message: 'title is too long' });
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ message: 'description must be a string' });
    }
    if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: `Invalid priority. One of: ${TASK_PRIORITIES.join(', ')}` });
    }
    if (status !== undefined && (!TASK_STATUSES.includes(status) || status === 'blocked')) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    let due;
    if (dueDate !== undefined && dueDate !== null) {
      due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) return res.status(400).json({ message: 'Invalid dueDate' });
    }
    // assigneeIds (array) or legacy assigneeId (single).
    let assigneeIds = body.assigneeIds ?? (body.assigneeId ? [body.assigneeId] : []);
    if (!Array.isArray(assigneeIds) || assigneeIds.some(id => !isValidId(id))) {
      return res.status(400).json({ message: 'assigneeIds must be an array of user ids' });
    }

    const tasksService = require('../tasks/tasks.service');
    const actorId = String(req.apiKeyDoc.createdBy);
    const taskData = {
      workspaceId: String(req.workspaceId),
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      status: status || 'todo',
      assignmentType: assigneeIds.length ? 'individual' : 'self',
      assignedToIds: assigneeIds.map(String),
      taskMode: 'shared',
    };
    if (due) taskData.dueDate = due.toISOString();

    const result = await tasksService.createTask(actorId, taskData, req.io || req.app?.get?.('io') || null, req);
    const task = result?.tasks?.[0] || result?.task || result;
    try {
      require('../integrations/webhook.trigger').fire(req.workspaceId, 'task.created', {
        taskId: task?._id, title: taskData.title, priority: taskData.priority, createdBy: actorId, via: 'api'
      });
    } catch { /* webhooks are best-effort */ }
    res.status(201).json({ task });
  } catch (err) {
    const status = err.statusCode || err.status;
    if (status && status < 500) return res.status(status).json({ message: err.message });
    if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ message: err.message });
    logger.error('[PublicAPI] POST /tasks error:', err.message);
    res.status(500).json({ message: 'Failed to create task' });
  }
});

router.get('/files', requireScope('files:read'), async (req, res) => {
  try {
    const WorkspaceFile = require('../files/WorkspaceFile');
    const limit = parseLimit(req.query.limit);

    const files = await WorkspaceFile.find({ workspaceId: req.workspaceId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name mimeType size url folderId createdAt')
      .lean();

    res.json({ files, count: files.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /files error:', err.message);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
});

router.get('/users', requireScope('users:read'), async (req, res) => {
  try {
    const { workspaces } = require('../../identity');
    const ws = await workspaces.findById(req.workspaceId)
      .then((w) => (w ? hydrate(w, { 'members.user': userSelect('username profilePicture profile') }) : w));

    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    const users = (ws.members || [])
      .filter(m => m.user && (m.status || 'active') === 'active')
      .map(m => ({
        id: m.user._id,
        username: m.user.username,
        // Accounts keep one display name; first/last are derived for API compatibility.
        firstName: (m.user.profile?.name || '').split(' ')[0] || null,
        lastName: (m.user.profile?.name || '').split(' ').slice(1).join(' ') || null,
        avatarUrl: m.user.profilePicture || null,
        role: m.role
      }));

    res.json({ users, count: users.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /users error:', err.message);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.get('/channels', requireScope('channels:read'), async (req, res) => {
  try {
    const Channel = require('../channels/channel.model');
    const channels = await Channel.find({
      workspace: req.workspaceId,
      isPrivate: { $ne: true },
      isArchived: { $ne: true },
    })
      .select('name description topic isDefault createdAt members')
      .lean();

    const out = channels.map(c => ({
      _id: c._id,
      name: c.name,
      description: c.description,
      topic: c.topic,
      isDefault: !!c.isDefault,
      membersCount: Array.isArray(c.members) ? c.members.length : 0,
      createdAt: c.createdAt,
    }));

    res.json({ channels: out, count: out.length });
  } catch (err) {
    logger.error('[PublicAPI] GET /channels error:', err.message);
    res.status(500).json({ message: 'Failed to fetch channels' });
  }
});

module.exports = router;
