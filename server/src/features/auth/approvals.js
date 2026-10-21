'use strict';

/**
 * Requests that a signed-in device approves something for another device of the same person:
 *
 *   kind 'signin'  a new device passed the password / Google step of a 2FA account and waits
 *                  for "Sign-in request from Windows laptop — Approve / Deny".
 *   kind 'unlock'  a signed-in device whose message key is still password-protected asks another
 *                  device to unlock it (that device enters the password once, which moves the
 *                  account to the server-sealed key; see crypto/unlockRequests).
 *
 * Requests live 10 minutes in otpStore (Redis when configured). Signed-in devices hear about
 * them over the socket (`auth:approval-request` to room user:<id>), by push notification, and
 * can list them with GET /api/auth/approvals.
 */

const crypto = require('crypto');
const otpStore = require('../../shared/services/otpStore');
const logger = require('../../../utils/logger');

const TTL_MS = 10 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9_-]{22}$/;
const KINDS = new Set(['signin', 'unlock']);
const MAX_PENDING_PER_USER = 10;

const keyOf = (id) => `approval:${id}`;
const indexKey = (userId) => `approvals:${userId}`;

function deps(overrides = {}) {
  return {
    store: overrides.store || otpStore,
    emit: overrides.emit || ((userId, event, payload) => {
      try {
        const io = require('../../socket/getIO').getIO();
        io?.to(`user:${userId}`).emit(event, payload);
      } catch { /* sockets not up (tests, worker) */ }
    }),
    push: overrides.push || ((userId, title, body, data) => {
      try {
        require('../push/push.service').sendToUser(userId, title, body, data).catch(() => {});
      } catch { /* push not configured */ }
    }),
    now: overrides.now || (() => Date.now()),
  };
}

/** What a signed-in device sees about a request (never the ticket behind it). */
function publicView(a) {
  return {
    id: a.id,
    kind: a.kind,
    status: a.status,
    requester: {
      deviceName: a.requester?.deviceName || 'Unknown device',
      platform: a.requester?.platform || 'unknown',
      location: a.requester?.location || null,
      ip: a.requester?.ip || null,
      method: a.requester?.method || null,
    },
    createdAt: new Date(a.createdAt).toISOString(),
    expiresAt: new Date(a.expiresAt).toISOString(),
  };
}

async function readIndex(d, userId) {
  const ids = await d.store.get(indexKey(userId));
  return Array.isArray(ids) ? ids.filter((x) => ID_RE.test(x)) : [];
}

/**
 * Creates a request and tells the person's signed-in devices.
 *   requester: { deviceId, deviceName, platform, location, ip, method }
 */
async function create({ userId, kind, requester, ticketHash = null }, overrides) {
  if (!KINDS.has(kind)) throw new Error(`Unknown approval kind ${kind}`);
  const d = deps(overrides);
  const id = crypto.randomBytes(16).toString('base64url');
  const at = d.now();
  const approval = {
    id, userId: String(userId), kind, status: 'pending', ticketHash,
    requester: { ...requester }, createdAt: at, expiresAt: at + TTL_MS, decidedBy: null,
  };
  await d.store.set(keyOf(id), approval, TTL_MS);
  const ids = (await readIndex(d, userId)).slice(-(MAX_PENDING_PER_USER - 1));
  await d.store.set(indexKey(userId), [...ids, id], TTL_MS);

  const view = publicView(approval);
  d.emit(String(userId), 'auth:approval-request', view);
  const who = view.requester.deviceName;
  if (kind === 'signin') {
    d.push(String(userId), 'Sign-in request', `Sign-in request from ${who}${view.requester.location ? ` near ${view.requester.location}` : ''} — Approve / Deny`, { type: 'signin_approval', approvalId: id });
  } else {
    d.push(String(userId), 'Unlock messages', `${who} asks to unlock your messages — open Oruinwan to approve`, { type: 'unlock_approval', approvalId: id });
  }
  return approval;
}

async function get(id, overrides) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const d = deps(overrides);
  const a = await d.store.get(keyOf(id));
  if (!a || d.now() >= a.expiresAt) return null;
  return a;
}

/** Pending requests for this person, newest first. */
async function listPending(userId, overrides) {
  const d = deps(overrides);
  const out = [];
  for (const id of await readIndex(d, userId)) {
    const a = await get(id, overrides);
    if (a && a.status === 'pending' && a.userId === String(userId)) out.push(publicView(a));
  }
  return out.reverse();
}

class ApprovalError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * A signed-in device answers. approver: { userId, deviceId, deviceName }.
 * A device can't approve its own request, and only pending requests can be answered.
 */
async function decide(id, approver, approve, overrides, { allowKinds = ['signin', 'unlock'] } = {}) {
  const d = deps(overrides);
  const a = await get(id, overrides);
  if (!a || a.userId !== String(approver.userId)) throw new ApprovalError(404, 'This request has expired.', 'APPROVAL_NOT_FOUND');
  if (!allowKinds.includes(a.kind)) throw new ApprovalError(400, 'This request needs a different step.', 'APPROVAL_KIND');
  if (a.status !== 'pending') throw new ApprovalError(409, 'This request was already answered.', 'APPROVAL_DONE');
  if (approver.deviceId && a.requester?.deviceId && approver.deviceId === a.requester.deviceId) {
    throw new ApprovalError(403, 'Approve from another device.', 'APPROVAL_SAME_DEVICE');
  }
  a.status = approve ? 'approved' : 'denied';
  a.decidedBy = { deviceId: approver.deviceId || null, deviceName: approver.deviceName || null, at: d.now() };
  await d.store.set(keyOf(id), a, Math.max(1000, a.expiresAt - d.now()));
  d.emit(a.userId, 'auth:approval-resolved', { id, status: a.status });
  logger.info({ approvalId: id, kind: a.kind, status: a.status }, '[approvals] answered');
  return a;
}

/** Ends a request (used once a sign-in completes or is abandoned). */
async function remove(id, overrides) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return;
  await deps(overrides).store.delete(keyOf(id));
}

module.exports = { create, get, listPending, decide, remove, publicView, ApprovalError, TTL_MS };
