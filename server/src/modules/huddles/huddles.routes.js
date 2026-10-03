'use strict';

const express = require('express');
const requireAuth = require('../../shared/middleware/auth');
const { buildIceConfig } = require('./iceServers');
const history = require('./huddleHistory.service');

const router = express.Router();

const userId = (req) => String(req.user.sub || req.user._id || req.user.id);

// Per-user ICE/TURN config for huddle peer connections. TURN credentials are
// short-lived and tied to the caller, so this is never cached publicly.
router.get('/ice-servers', requireAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await buildIceConfig(userId(req)));
  } catch (err) {
    next(err);
  }
});

function send(res, err) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) require('../../../utils/logger').error('[huddles] request failed:', err);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong' : err.message });
}

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    send(res, err);
  }
};

// Huddle ids are client-made uuids or "meeting-<id>".
router.param('huddleId', (req, res, next, id) => (
  /^[A-Za-z0-9_-]{1,80}$/.test(id) ? next() : res.status(400).json({ message: 'Invalid huddle id' })
));

// Past huddles in a workspace (survives reloads; live ones are in huddle:list).
router.get('/history', requireAuth, handle(async (req) => {
  const { workspaceId, limit } = req.query;
  return { huddles: await history.listHistory(userId(req), String(workspaceId || ''), { limit }) };
}));

// One huddle run: participants, notes id, linked tasks, wrap-up.
router.get('/:huddleId/session', requireAuth, handle(async (req) => ({
  session: await history.getSession(userId(req), req.params.huddleId),
})));

// Create (first caller) or open the huddle's shared notes.
router.post('/:huddleId/notes', requireAuth, handle((req) => history.ensureNotes(userId(req), req.params.huddleId, req.io)));

router.post('/:huddleId/tasks', requireAuth, handle((req) => history.linkTask(userId(req), req.params.huddleId, String(req.body?.taskId || ''), req.io)));
router.delete('/:huddleId/tasks/:taskId', requireAuth, handle((req) => history.unlinkTask(userId(req), req.params.huddleId, req.params.taskId, req.io)));

// Record the posted (E2EE) summary message and notify everyone who was in the call.
router.post('/:huddleId/wrap-up', requireAuth, handle(async (req) => {
  const me = await require('../../identity').users.findById(userId(req));
  return history.recordWrapUp({
    userId: userId(req),
    username: me?.username,
    huddleId: req.params.huddleId,
    messageId: String(req.body?.messageId || ''),
    io: req.io,
  });
}));

module.exports = router;
