'use strict';

/**
 * Sign in with a QR code, in both directions. A signed-in device ("approver") lets a new device
 * ("requester") in; the requester gets a session and its message key without a password.
 *
 *   show   The requester (web / desktop login screen) shows the QR:
 *            POST /qr/request {publicKey}         requester  -> { code, secret, qrText, qrDataUrl, expiresAt }
 *            POST /qr/scan {code}                 approver (phone, signed in) -> requester device + place
 *            POST /qr/decide {code, approve}      approver
 *            POST /qr/poll {code, secret}         requester  -> status, then the session (+ keys)
 *
 *   offer  The approver (web / desktop, Settings → Devices → "Sign in a phone") shows the QR:
 *            POST /qr/offer                       approver   -> { code, qrText, qrDataUrl, expiresAt }
 *            POST /qr/claim {code, publicKey}     requester (phone app start screen) -> { secret, approver }
 *            POST /qr/offer/status {code}         approver   -> waiting | claimed (+ requester device) | ...
 *            POST /qr/decide {code, approve}      approver
 *            POST /qr/poll {code, secret}         requester  -> status, then the session (+ keys)
 *
 * Security:
 *  - The QR holds only a random code (oruinwan://signin?c=<code>). Seeing it is not enough to get
 *    the session: polling needs the requester's secret, which never leaves the requester and is
 *    stored as a hash. The poll is also bound to the requester's X-Device-Id.
 *  - Codes are single-use and short-lived: 60 s until scanned/claimed (the screen shows a fresh
 *    one every minute), 3 minutes to decide, 2 minutes to collect the session (atomic take).
 *  - Only the approver who scanned (show) / created (offer) the code can decide.
 *  - The requester's ephemeral P-256 public key is bound when the code is made (show) or claimed
 *    (offer); the message key (UMEK) is wrapped only for that key.
 *  - Approval on a signed-in device counts as the second factor; the device limit still applies.
 *  - Everything goes in JSON bodies (no codes or tokens in URLs or logs); no cookie auth on the
 *    requester side, so the endpoints are not reachable by CSRF.
 */

const crypto = require('crypto');
const otpStore = require('../../shared/services/otpStore');
const logger = require('../../../utils/logger');
const devices = require('../devices/devices.service');

const WAIT_TTL_MS = 60 * 1000;
const DECIDE_TTL_MS = 3 * 60 * 1000;
const COLLECT_TTL_MS = 2 * 60 * 1000;
const CODE_RE = /^[A-Za-z0-9_-]{32}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;
const P256_RAW_B64 = /^[A-Za-z0-9+/]{86}[A-Za-z0-9+/=]{2}$/; // 65 bytes, base64

const keyOf = (code) => `qr:${code}`;
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

class QrError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function deps(overrides = {}) {
  return {
    store: overrides.store || otpStore,
    now: overrides.now || (() => Date.now()),
    emit: overrides.emit || ((userId, event, payload) => {
      try { require('../../socket/getIO').getIO()?.to(`user:${userId}`).emit(event, payload); } catch { /* no sockets */ }
    }),
    audit: overrides.audit || ((userId, eventType, req, metadata) => {
      try { require('../../services/securityAudit.service').logSecurityEvent({ userId, eventType, req, metadata }); } catch { /* best effort */ }
    }),
    qrImage: overrides.qrImage || qrDataUrl,
    gate: overrides.gate || ((...a) => require('./signInFlow').gate(...a)),
    userDocs: overrides.userDocs || require('../../identity/queries/auth').userDocs,
    finish: overrides.finish || finishQrSignIn,
  };
}

async function qrDataUrl(text) {
  try {
    return await require('qrcode').toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
  } catch (err) {
    logger.warn({ err: err.message }, '[qr] could not render QR image');
    return null;
  }
}

const qrTextFor = (code) => `oruinwan://signin?c=${code}`;

/** The device that sends this request, as the other side sees it. */
function clientOf(req) {
  const c = devices.describeClient(req);
  return { deviceId: devices.deviceIdFrom(req), deviceName: c.deviceName, platform: c.platform, location: devices.approxLocation(req), ip: req.ip || null };
}

const view = (c) => (c ? { deviceName: c.deviceName, platform: c.platform, location: c.location || null, ip: c.ip || null } : null);

function validPublicKey(pk) {
  if (typeof pk !== 'string' || !P256_RAW_B64.test(pk)) return false;
  const bytes = Buffer.from(pk, 'base64');
  if (bytes.length !== 65 || bytes[0] !== 4) return false;
  try {
    const probe = crypto.createECDH('prime256v1');
    probe.generateKeys();
    probe.computeSecret(bytes); // throws for a point not on the curve
    return true;
  } catch {
    return false;
  }
}

async function load(d, code) {
  if (typeof code !== 'string' || !CODE_RE.test(code)) return null;
  const r = await d.store.get(keyOf(code));
  if (!r || d.now() >= r.expiresAt) return null;
  return r;
}

async function save(d, r, ttl) {
  r.expiresAt = d.now() + ttl;
  await d.store.set(keyOf(r.code), r, ttl);
}

async function rateLimit(d, req, what, max) {
  const n = await d.store.incr(`qr-rate:${what}:${req.ip || 'unknown'}`, 10 * 60 * 1000);
  if (n > max) throw new QrError(429, 'Too many QR codes. Wait a few minutes and try again.', 'QR_RATE_LIMIT');
}

const newCode = () => crypto.randomBytes(24).toString('base64url');

// ── show: the requester shows the code ───────────────────────────────────

async function request(req, overrides) {
  const d = deps(overrides);
  await rateLimit(d, req, 'request', 40);
  const publicKey = req.body?.publicKey;
  if (!validPublicKey(publicKey)) throw new QrError(400, 'publicKey must be a raw P-256 public key (base64).', 'QR_BAD_KEY');
  const secret = crypto.randomBytes(32).toString('base64url');
  const code = newCode();
  const r = {
    code, dir: 'show', status: 'waiting', userId: null, createdAt: d.now(),
    requester: { ...clientOf(req), publicKey, secretHash: sha256(secret) },
    approver: null,
  };
  await save(d, r, WAIT_TTL_MS);
  const qrText = qrTextFor(code);
  return { code, secret, qrText, qrDataUrl: await d.qrImage(qrText), expiresAt: new Date(r.expiresAt).toISOString() };
}

async function scan(req, overrides) {
  const d = deps(overrides);
  const r = await load(d, req.body?.code);
  if (!r) throw new QrError(410, 'This QR code has expired. Show a new one and scan again.', 'QR_EXPIRED');
  if (r.dir !== 'show') throw new QrError(400, 'This QR code is for signing in on this device. Open the start screen of the app to use it.', 'QR_WRONG_SIDE');
  const me = String(req.user.sub);
  if (r.status !== 'waiting') {
    if (r.approver?.userId === me && r.status === 'scanned') return scanView(r);
    throw new QrError(409, 'This QR code was already used.', 'QR_USED');
  }
  r.status = 'scanned';
  r.approver = { ...clientOf(req), userId: me };
  await save(d, r, DECIDE_TTL_MS);
  return scanView(r);
}

const scanView = (r) => ({ status: r.status, requester: view(r.requester), expiresAt: new Date(r.expiresAt).toISOString() });

// ── offer: the signed-in approver shows the code ──────────────────────────

async function offer(req, overrides) {
  const d = deps(overrides);
  await rateLimit(d, req, 'offer', 40);
  const code = newCode();
  const r = {
    code, dir: 'offer', status: 'waiting', userId: String(req.user.sub), createdAt: d.now(),
    requester: null, approver: { ...clientOf(req), userId: String(req.user.sub) },
  };
  await save(d, r, WAIT_TTL_MS);
  const qrText = qrTextFor(code);
  return { code, qrText, qrDataUrl: await d.qrImage(qrText), expiresAt: new Date(r.expiresAt).toISOString() };
}

async function claim(req, overrides) {
  const d = deps(overrides);
  await rateLimit(d, req, 'claim', 30);
  const r = await load(d, req.body?.code);
  if (!r) throw new QrError(410, 'This QR code has expired. Show a new one on your computer and scan again.', 'QR_EXPIRED');
  if (r.dir !== 'offer') throw new QrError(400, 'This QR code is for signing in on a computer. Scan it from Settings → Scan to sign in on a device where you are signed in.', 'QR_WRONG_SIDE');
  if (r.status !== 'waiting') throw new QrError(409, 'This QR code was already used.', 'QR_USED');
  const publicKey = req.body?.publicKey;
  if (!validPublicKey(publicKey)) throw new QrError(400, 'publicKey must be a raw P-256 public key (base64).', 'QR_BAD_KEY');
  const secret = crypto.randomBytes(32).toString('base64url');
  r.status = 'claimed';
  r.requester = { ...clientOf(req), publicKey, secretHash: sha256(secret) };
  await save(d, r, DECIDE_TTL_MS);
  d.emit(r.userId, 'auth:qr-claimed', { code: r.code, requester: view(r.requester) });
  return { secret, approver: view(r.approver), expiresAt: new Date(r.expiresAt).toISOString() };
}

async function offerStatus(req, overrides) {
  const d = deps(overrides);
  const r = await load(d, req.body?.code);
  if (!r || r.dir !== 'offer' || r.userId !== String(req.user.sub)) return { status: 'expired' };
  return { status: r.status, requester: view(r.requester), expiresAt: new Date(r.expiresAt).toISOString() };
}

// ── both: decide and collect ──────────────────────────────────────────────

async function decide(req, overrides) {
  const d = deps(overrides);
  const r = await load(d, req.body?.code);
  if (!r) throw new QrError(410, 'This sign-in request has expired.', 'QR_EXPIRED');
  const me = String(req.user.sub);
  const mine = r.dir === 'show' ? r.status === 'scanned' && r.approver?.userId === me : r.status === 'claimed' && r.userId === me;
  if (!mine) throw new QrError(409, 'This sign-in request is not waiting for you.', 'QR_NOT_YOURS');
  const approve = req.body?.approve === true;
  r.status = approve ? 'approved' : 'denied';
  r.userId = me;
  r.approver = { ...r.approver, ...clientOf(req), userId: me };
  await save(d, r, approve ? COLLECT_TTL_MS : 30 * 1000);
  d.audit(me, approve ? 'QR_SIGNIN_APPROVED' : 'QR_SIGNIN_DENIED', req, {
    direction: r.dir, requester: view(r.requester), approverDeviceId: r.approver.deviceId || null,
  });
  return { status: r.status };
}

/**
 * The requester asks how its QR sign-in is going. When approved, the record is taken (once) and
 * the sign-in completes like any other (device limit applies; the approval was the second factor).
 */
async function poll(req, res, overrides) {
  const d = deps(overrides);
  const { code, secret } = req.body || {};
  if (typeof secret !== 'string' || !SECRET_RE.test(secret)) return res.status(400).json({ code: 'QR_BAD_SECRET', message: 'Missing sign-in secret.' });
  const r = await load(d, code);
  if (!r) return res.status(410).json({ code: 'QR_EXPIRED', status: 'expired', message: 'This QR code has expired.' });
  const expected = Buffer.from(r.requester?.secretHash || '');
  const actual = Buffer.from(sha256(secret));
  if (!r.requester || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return res.status(403).json({ code: 'QR_BAD_SECRET', message: 'This sign-in belongs to another device.' });
  }
  const here = devices.deviceIdFrom(req);
  if (r.requester.deviceId && here !== r.requester.deviceId) {
    return res.status(403).json({ code: 'QR_OTHER_DEVICE', message: 'This sign-in belongs to another device.' });
  }
  if (r.status === 'denied') {
    await d.store.delete(keyOf(r.code));
    return res.status(403).json({ code: 'QR_DENIED', status: 'denied', message: 'Sign-in was declined on your other device.' });
  }
  if (r.status !== 'approved') {
    return res.json({ status: r.status, approver: r.dir === 'offer' ? view(r.approver) : null, expiresAt: new Date(r.expiresAt).toISOString() });
  }

  const taken = await d.store.take(keyOf(r.code));
  if (!taken || taken.status !== 'approved') return res.status(410).json({ code: 'QR_EXPIRED', status: 'expired', message: 'This QR code has expired.' });
  const user = await d.userDocs.findById(taken.userId);
  if (!user) return res.status(410).json({ code: 'QR_EXPIRED', status: 'expired', message: 'This QR code has expired.' });
  const { signInGates } = require('./auth.controller');
  const stop = await signInGates(user, null, { skipTotp: true });
  if (stop) return res.status(stop.status).json(stop.body);

  const signIn = { method: 'qr', approvedBy: { deviceId: taken.approver?.deviceId || null, deviceName: taken.approver?.deviceName || null } };
  const ticketLike = { kind: 'qr', method: 'qr', extras: { publicKey: taken.requester.publicKey }, signIn };
  const blocked = await d.gate(req, user, { ...ticketLike, mfaSatisfiedBy: 'qr' });
  if (blocked) return res.status(blocked.status).json(blocked.body);
  return d.finish(req, res, user, ticketLike);
}

/** The message key for a QR sign-in, wrapped for the requester's ephemeral key when the server holds it sealed. */
async function keysFor(userId, publicKey) {
  try {
    const state = await require('../../identity').cryptoState.findByUserId(userId);
    if (!state) return { keyMode: 'NONE', keys: null };
    if (state.umekProtectionType !== 'SERVER_KEK') return { keyMode: state.umekProtectionType, keys: null };
    const env = require('../crypto/umekEnvelope');
    const umek = env.isUnsealedUmek(state.umekEnvelope) ? Buffer.from(state.umekEnvelope, 'base64') : env.openUmek(state.umekEnvelope, state.kekVersion);
    return { keyMode: 'SERVER_KEK', keys: env.wrapForDevice(umek, publicKey) };
  } catch (err) {
    logger.warn({ err: err.message }, '[qr] message key not included');
    return { keyMode: 'UNKNOWN', keys: null };
  }
}

/** Issues the session for a QR sign-in, with the message key wrapped for the requester. */
async function finishQrSignIn(req, res, user, t) {
  const key = await keysFor(String(user._id || user.id), t.extras?.publicKey);
  const { issueSignInSession } = require('./auth.controller');
  return issueSignInSession(req, res, user, {
    message: 'Signed in with a QR code', isNewUser: false,
    needsPasswordSetup: false, method: 'qr', signIn: t.signIn, extra: key,
  });
}

module.exports = {
  request, scan, offer, claim, offerStatus, decide, poll, finishQrSignIn, keysFor, QrError, validPublicKey, qrTextFor,
  WAIT_TTL_MS, DECIDE_TTL_MS, COLLECT_TTL_MS,
};
