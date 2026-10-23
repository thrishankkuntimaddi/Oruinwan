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

// Decline a call that is ringing for me (the phone's native Decline button, even with the app
// closed). The same as the socket event huddle:decline; 404 when nothing is ringing.
router.post('/:huddleId/decline', requireAuth, handle(async (req) => {
  const { declineCall } = require('./huddles.socket');
  const declined = await declineCall(req.io, req.params.huddleId, userId(req));
  if (!declined) throw Object.assign(new Error('That call is no longer ringing.'), { status: 404 });
  return { ok: true };
}));

// The same, without signing in: the signed link in each ring (`declineUrl`), for a phone's ring
// notification while the app is closed. 401 for an expired link, 403 for a forged one.
router.post('/:huddleId/decline-ring', handle(async (req) => {
  const ringing = require('./huddleRinging');
  const token = String(req.query?.token || req.body?.token || '');
  const check = ringing.verifyDecline(req.params.huddleId, token);
  if (!check.ok) {
    throw Object.assign(new Error(check.error === 'expired' ? 'This call is no longer ringing.' : 'Invalid decline link.'),
      { status: check.error === 'expired' ? 401 : 403 });
  }
  const { declineCall } = require('./huddles.socket');
  const declined = await declineCall(req.io, req.params.huddleId, check.userId);
  if (!declined) throw Object.assign(new Error('That call is no longer ringing.'), { status: 404 });
  return { ok: true };
}));

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
    // Optional: the wrap-up text the client posted; it becomes the meeting's summary.
    summaryText: typeof req.body?.summary === 'string' ? req.body.summary : undefined,
    io: req.io,
  });
}));

// ── Recording, transcript, draft summary (see docs/api/meetings.md) ─────────
const media = require('./huddleMedia.service');
const { uploadRecordingMiddleware } = require('../../features/meetings/recordings');
const sessionIdOf = (req) => (req.query?.sessionId ? String(req.query.sessionId) : undefined);

router.post('/:huddleId/recording', requireAuth, uploadRecordingMiddleware, async (req, res) => {
  try {
    res.status(201).json(await media.uploadRecording({
      userId: userId(req), huddleId: req.params.huddleId, file: req.file,
      durationSec: req.body?.durationSec, sessionId: sessionIdOf(req), io: req.io,
    }));
  } catch (err) {
    send(res, err);
  }
});
router.get('/:huddleId/recording', requireAuth, handle((req) => media.getRecording({ userId: userId(req), huddleId: req.params.huddleId, sessionId: sessionIdOf(req) })));
router.delete('/:huddleId/recording', requireAuth, handle((req) => media.deleteRecording({ userId: userId(req), huddleId: req.params.huddleId, sessionId: sessionIdOf(req), io: req.io })));

// Signed playback link (no Authorization header): ?s=<sessionId>&u=&exp=&sig=
router.get('/:huddleId/recording/stream', async (req, res) => {
  try {
    const recording = await media.resolveSignedStream({ huddleId: req.params.huddleId, query: req.query });
    await require('../../features/meetings/recordings').streamRecording(recording, req, res);
  } catch (err) {
    if (res.headersSent) return res.destroy();
    if (err?.code === 404) return res.status(404).json({ message: 'Recording not found' });
    send(res, err);
  }
});

router.post('/:huddleId/transcript/segments', requireAuth, async (req, res) => {
  try {
    res.status(201).json(await media.appendTranscript({ userId: userId(req), huddleId: req.params.huddleId, body: req.body, io: req.io }));
  } catch (err) {
    send(res, err);
  }
});
router.get('/:huddleId/transcript', requireAuth, handle((req) => media.getTranscript({ userId: userId(req), huddleId: req.params.huddleId, sessionId: sessionIdOf(req) })));

// Draft wrap-up: summary + action items from the transcript (else the shared notes).
router.post('/:huddleId/summarize', requireAuth, handle((req) => media.summarize({ userId: userId(req), huddleId: req.params.huddleId, sessionId: sessionIdOf(req), io: req.io })));

module.exports = router;
