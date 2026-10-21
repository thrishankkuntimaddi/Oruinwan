'use strict';

// Sign-in steps after the password / Google step, sign-in approvals and QR sign-in.
// Mounted under /api/auth (see docs/api/auth-devices.md).

const express = require('express');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const flow = require('./signInFlow');
const approvals = require('./approvals');
const qr = require('./qrSignIn');
const devices = require('../devices/devices.service');

const router = express.Router();

const wrap = (fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (err) {
    if (err instanceof qr.QrError || err instanceof approvals.ApprovalError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    logger.error({ err: err.message, path: req.path }, '[signin] request failed');
    return res.status(500).json({ message: 'Something went wrong. Try again.' });
  }
};

// ── Pending sign-ins (two-step verification, device limit) ───────────────
router.post('/signin/continue', wrap((req, res) => flow.continueSignIn(req, res)));
router.post('/signin/status', wrap((req, res) => flow.status(req, res)));
router.post('/signin/email-code', wrap((req, res) => flow.sendEmailCode(req, res)));

// ── Approvals on signed-in devices ────────────────────────────────────────
router.get('/approvals', requireAuth, wrap(async (req, res) => {
  res.json({ approvals: await approvals.listPending(req.user.sub) });
}));

/** The calling device as an approver: its id and the name the person sees. */
async function approverOf(req) {
  const deviceId = devices.deviceIdFrom(req);
  let deviceName = devices.describeClient(req).deviceName;
  if (deviceId) {
    try {
      const list = await devices.activeDevices(req.user.sub);
      const mine = list.find((x) => x.deviceId === deviceId);
      if (mine) deviceName = mine.deviceName;
    } catch { /* keep the reported name */ }
  }
  return { userId: String(req.user.sub), deviceId, deviceName };
}

router.post('/approvals/:id/decision', requireAuth, wrap(async (req, res) => {
  const approve = req.body?.approve === true;
  const a = await approvals.decide(req.params.id, await approverOf(req), approve, undefined, { allowKinds: ['signin'] });
  try {
    require('../../services/securityAudit.service').logSecurityEvent({
      userId: req.user.sub, eventType: approve ? 'SIGNIN_APPROVED' : 'SIGNIN_DENIED', req,
      metadata: { approvalId: a.id, requester: approvals.publicView(a).requester, approverDeviceId: a.decidedBy?.deviceId || null },
    });
  } catch { /* best effort */ }
  res.json({ approval: approvals.publicView(a) });
}));

// ── QR sign-in ────────────────────────────────────────────────────────────
router.post('/qr/request', wrap(async (req, res) => res.json(await qr.request(req))));
router.post('/qr/claim', wrap(async (req, res) => res.json(await qr.claim(req))));
router.post('/qr/poll', wrap((req, res) => qr.poll(req, res)));
router.post('/qr/scan', requireAuth, wrap(async (req, res) => res.json(await qr.scan(req))));
router.post('/qr/offer', requireAuth, wrap(async (req, res) => res.json(await qr.offer(req))));
router.post('/qr/offer/status', requireAuth, wrap(async (req, res) => res.json(await qr.offerStatus(req))));
router.post('/qr/decide', requireAuth, wrap(async (req, res) => res.json(await qr.decide(req))));

module.exports = router;
