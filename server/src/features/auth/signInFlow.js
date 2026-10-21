'use strict';

/**
 * The last steps every sign-in goes through once the person proved who they are (password,
 * Google, passkey, SSO or QR). Two things can stop a session from being issued straight away:
 *
 *   1. Two-step verification (account has 2FA on). The device waiting to sign in can finish
 *      with any one of: approval from an already signed-in device, the authenticator-app code,
 *      or a 6-digit code sent by email. Passkeys (user verification), SSO (the identity provider)
 *      and QR sign-in (approved on a signed-in device) already count as the second factor.
 *
 *   2. The device limit (DEVICE_LIMIT, default 4). A new device over the limit gets the list of
 *      signed-in devices and signs one (or all) out to continue.
 *
 * Either way the answer carries a `pendingToken`: random, short-lived (10 min), bound to the
 * device that asked (X-Device-Id), stored only as a SHA-256 hash, sent in JSON bodies only
 * (never a URL, except the SSO browser hand-off which uses a URL fragment), and redeemed once
 * (atomic take) when the session is issued.
 *
 *   gate(req, user, opts)       -> null (go ahead) | { status, body } (stop and answer)
 *   continueSignIn(req, res)    POST /api/auth/signin/continue
 *   status(req, res)            POST /api/auth/signin/status
 *   sendEmailCode(req, res)     POST /api/auth/signin/email-code
 */

const crypto = require('crypto');
const otpStore = require('../../shared/services/otpStore');
const logger = require('../../../utils/logger');
const devices = require('../devices/devices.service');
const approvals = require('./approvals');

const TICKET_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_MAX_SENDS_PER_TICKET = 3;
const EMAIL_MAX_SENDS_PER_USER_HOUR = 6;
const MAX_CODE_ATTEMPTS = 5;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const ticketKey = (token) => `signin:${sha256(token)}`;

function deps(overrides = {}) {
  return {
    store: overrides.store || otpStore,
    devices: overrides.devices || devices,
    approvals: overrides.approvals || approvals,
    userDocs: overrides.userDocs || require('../../identity/queries/auth').userDocs,
    verifyTotp: overrides.verifyTotp || ((secret, otp) => require('../security/totp').verifyUserTotp(secret, otp)),
    sendEmail: overrides.sendEmail || require('../../../utils/sendEmail'),
    finishers: overrides.finishers || defaultFinishers(),
    audit: overrides.audit || ((userId, eventType, req, metadata) => {
      try { require('../../services/securityAudit.service').logSecurityEvent({ userId, eventType, req, metadata }); } catch { /* best effort */ }
    }),
    now: overrides.now || (() => Date.now()),
  };
}

/** How each kind of sign-in answers once it may go ahead (implemented in auth.controller). */
function defaultFinishers() {
  const auth = () => require('./auth.controller');
  return {
    password: (req, res, user, t) => auth().finishPasswordLogin(req, res, user, { signIn: t.signIn }),
    oauth: (req, res, user, t) => auth().issueSignInSession(req, res, user, { ...t.extras, method: t.method, signIn: t.signIn }),
    sso: (req, res, user, t) => auth().finishSsoJson(req, res, user, { method: t.method, signIn: t.signIn }),
    qr: (req, res, user, t) => require('./qrSignIn').finishQrSignIn(req, res, user, t),
  };
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return null;
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
}

function requesterOf(req, method) {
  const client = devices.describeClient(req);
  return {
    deviceId: devices.deviceIdFrom(req),
    deviceName: client.deviceName,
    platform: client.platform,
    location: devices.approxLocation(req),
    ip: req.ip || null,
    method,
  };
}

async function saveTicket(d, token, ticket) {
  await d.store.set(ticketKey(token), ticket, Math.max(1000, ticket.expiresAt - d.now()));
}

async function loadTicket(d, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const t = await d.store.get(ticketKey(token));
  if (!t || d.now() >= t.expiresAt) return null;
  return t;
}

/** The methods a waiting device can use for two-step verification. */
function mfaMethods(t) {
  return { approve: Boolean(t.approvalId), totp: Boolean(t.hasTotp), email: Boolean(t.hasEmail) };
}

function mfaBody(token, t, extra = {}) {
  return {
    code: 'MFA_REQUIRED',
    requires2FA: true,
    pendingToken: token,
    methods: mfaMethods(t),
    approvalId: t.approvalId || null,
    emailHint: t.emailHint || null,
    expiresAt: new Date(t.expiresAt).toISOString(),
    message: t.approvalId
      ? 'Approve this sign-in on a device where you are signed in, or enter a code.'
      : 'Enter the 6-digit code from your authenticator app, or get a code by email.',
    ...extra,
  };
}

function limitBody(token, t, check) {
  return {
    code: 'DEVICE_LIMIT',
    limit: check.limit,
    devices: check.devices,
    pendingToken: token,
    expiresAt: new Date(t.expiresAt).toISOString(),
    message: `You're signed in on ${check.limit} devices. Sign out of one to continue.`,
  };
}

async function newTicket(d, req, user, opts, { mfa }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const at = d.now();
  const ticket = {
    v: 1,
    userId: String(user._id || user.id),
    deviceId: devices.deviceIdFrom(req, opts.deviceId),
    kind: opts.kind,
    method: opts.method,
    extras: opts.extras || {},
    mfa, // 'required' | 'done' | 'none'
    mfaBy: opts.mfaSatisfiedBy || null,
    signIn: opts.signIn || { method: opts.method, approvedBy: null },
    approvalId: null,
    hasTotp: Boolean(user.twoFactorEnabled && user.twoFactorSecret),
    hasEmail: Boolean(user.email),
    emailHint: maskEmail(user.email),
    email: { hash: null, expiresAt: 0, sends: 0, attempts: 0 },
    attempts: 0,
    requester: requesterOf(req, opts.method),
    createdAt: at,
    expiresAt: at + TICKET_TTL_MS,
  };
  if (mfa === 'required') {
    // Ask the person's signed-in devices only when there is one to ask.
    let others = [];
    try {
      others = (await d.devices.activeDevices(ticket.userId)).filter((x) => x.deviceId !== ticket.deviceId);
    } catch { /* no device table: offer codes only */ }
    // At most 10 approval requests (pushes) per account per 10 minutes, so a leaked password
    // can't flood the person's phone; codes keep working beyond that.
    if (others.length && (await d.store.incr(`signin-approvals:${ticket.userId}`, 10 * 60 * 1000)) <= 10) {
      const a = await d.approvals.create({ userId: ticket.userId, kind: 'signin', requester: ticket.requester, ticketHash: sha256(token) });
      ticket.approvalId = a.id;
    }
  }
  await saveTicket(d, token, ticket);
  return { token, ticket };
}

async function countFailedCode(d, user) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= 5) {
    user.lockedUntil = new Date(d.now() + 15 * 60 * 1000);
    user.failedLoginAttempts = 0;
    logger.warn({ userId: String(user._id) }, '[signin] account locked after 5 wrong codes');
  }
  if (typeof user.save === 'function') await user.save();
}

/**
 * Decides whether this sign-in may get a session now.
 *   opts.kind             'password' | 'oauth' | 'sso' | 'qr' (how to answer once allowed)
 *   opts.method           recorded sign-in method (password, google, passkey, sso_google, qr, ...)
 *   opts.otp              authenticator code sent along (older clients, one step)
 *   opts.mfaSatisfiedBy   'passkey' | 'sso' | 'qr' when the sign-in already proved two factors
 *   opts.extras           kept for the answer (isNewUser, needsPasswordSetup, message, publicKey)
 *   opts.signIn           { method, approvedBy } recorded on the device row
 */
async function gate(req, user, opts = {}, overrides) {
  const d = deps(overrides);
  let mfaSatisfiedBy = opts.mfaSatisfiedBy || null;

  if (user.twoFactorEnabled && !mfaSatisfiedBy) {
    const otp = String(opts.otp || '').replace(/\s+/g, '');
    if (otp) {
      if (!(await d.verifyTotp(user.twoFactorSecret, otp))) {
        await countFailedCode(d, user);
        return { status: 401, body: { requires2FA: true, invalidCode: true, message: "That code didn't work. Check your authenticator app and try again." } };
      }
      mfaSatisfiedBy = 'totp';
    } else {
      const { token, ticket } = await newTicket(d, req, user, opts, { mfa: 'required' });
      return { status: 401, body: mfaBody(token, ticket) };
    }
  }

  const check = await d.devices.checkDeviceLimit(req, user, { deviceId: opts.deviceId });
  if (check.over) {
    const { token, ticket } = await newTicket(d, req, user, { ...opts, mfaSatisfiedBy }, { mfa: mfaSatisfiedBy ? 'done' : 'none' });
    return { status: 409, body: limitBody(token, ticket, check) };
  }
  return null;
}

const sameDevice = (req, t) => !t.deviceId || devices.deviceIdFrom(req) === t.deviceId;

function expired(res) {
  return res.status(410).json({ code: 'SIGNIN_EXPIRED', message: 'This sign-in has expired. Sign in again.' });
}

/** Signs out the devices the person picked on the device-limit screen. */
async function signOutChosen(d, req, t, body) {
  const chosen = body.signOutAll === true
    ? (await d.devices.activeDevices(t.userId)).map((x) => x.deviceId)
    : (Array.isArray(body.signOutDeviceIds) ? body.signOutDeviceIds.filter((x) => typeof x === 'string').slice(0, 20) : []);
  let count = 0;
  for (const id of chosen) {
    if (id === t.deviceId) continue;
    try {
      const r = await d.devices.revokeDevice(t.userId, id, {});
      if (r.wasActive) count += 1;
    } catch (err) {
      if (!(err instanceof d.devices.DeviceError)) throw err;
    }
  }
  if (count) d.audit(t.userId, 'DEVICE_REVOKED', req, { reason: 'device_limit', devicesRevoked: count, signOutAll: body.signOutAll === true });
  return count;
}

/** POST /api/auth/signin/continue { pendingToken, otp?, emailCode?, signOutDeviceIds?, signOutAll? } */
async function continueSignIn(req, res, overrides) {
  const d = deps(overrides);
  const body = req.body || {};
  const token = body.pendingToken;
  const t = await loadTicket(d, token);
  if (!t) return expired(res);
  if (!sameDevice(req, t)) return res.status(403).json({ code: 'SIGNIN_OTHER_DEVICE', message: 'Finish signing in on the device where you started.' });

  const user = await d.userDocs.findById(t.userId);
  if (!user) return expired(res);
  const { signInGates } = require('./auth.controller');
  const stop = await signInGates(user, null, { skipTotp: true });
  if (stop) {
    await d.store.delete(ticketKey(token));
    return res.status(stop.status).json(stop.body);
  }

  if (t.mfa === 'required') {
    const otp = String(body.otp || '').replace(/\s+/g, '');
    const emailCode = String(body.emailCode || '').replace(/\s+/g, '');
    let by = null;
    if (otp) {
      if (!t.hasTotp) return res.status(400).json({ message: 'This account has no authenticator app.' });
      if (await d.verifyTotp(user.twoFactorSecret, otp)) by = 'totp';
      else {
        await countFailedCode(d, user);
        t.attempts += 1;
      }
    } else if (emailCode) {
      const ok = t.email.hash && d.now() < t.email.expiresAt && t.email.attempts < MAX_CODE_ATTEMPTS
        && crypto.timingSafeEqual(Buffer.from(t.email.hash), Buffer.from(sha256(`${t.userId}:${emailCode}`)));
      if (ok) by = 'email';
      else t.email.attempts += 1;
    } else if (t.approvalId) {
      const a = await d.approvals.get(t.approvalId);
      if (a?.status === 'denied') {
        await d.store.delete(ticketKey(token));
        d.audit(t.userId, 'SIGNIN_DENIED', req, { approvalId: t.approvalId, deniedBy: a.decidedBy?.deviceId || null });
        return res.status(403).json({ code: 'SIGNIN_DENIED', message: 'This sign-in was denied on another device.' });
      }
      if (a?.status === 'approved') {
        by = 'approval';
        t.signIn = { method: t.method, approvedBy: { deviceId: a.decidedBy?.deviceId || null, deviceName: a.decidedBy?.deviceName || null } };
      } else {
        return res.status(401).json(mfaBody(token, t, { waiting: true }));
      }
    } else {
      return res.status(401).json(mfaBody(token, t));
    }

    if (!by) {
      if (t.attempts + t.email.attempts >= MAX_CODE_ATTEMPTS * 2) {
        await d.store.delete(ticketKey(token));
        return res.status(429).json({ code: 'SIGNIN_TOO_MANY', message: 'Too many wrong codes. Sign in again.' });
      }
      await saveTicket(d, token, t);
      return res.status(401).json(mfaBody(token, t, { invalidCode: true, message: "That code didn't work. Try again." }));
    }
    t.mfa = 'done';
    t.mfaBy = by;
    if (t.approvalId) await d.approvals.remove(t.approvalId);
    d.audit(t.userId, 'SIGNIN_SECOND_FACTOR', req, { method: by, approvedByDeviceId: t.signIn?.approvedBy?.deviceId || null });
    await saveTicket(d, token, t);
  }

  if (body.signOutAll === true || Array.isArray(body.signOutDeviceIds)) await signOutChosen(d, req, t, body);

  const check = await d.devices.checkDeviceLimit(req, user, { deviceId: t.deviceId });
  if (check.over) {
    await saveTicket(d, token, t);
    return res.status(409).json(limitBody(token, t, check));
  }

  // Single use: whoever takes the ticket first gets the session; a replay finds nothing.
  const taken = await d.store.take(ticketKey(token));
  if (!taken) return expired(res);
  const finish = d.finishers[t.kind];
  if (!finish) return expired(res);
  return finish(req, res, user, t);
}

/** POST /api/auth/signin/status { pendingToken } -> where this sign-in stands (polled while waiting). */
async function status(req, res, overrides) {
  const d = deps(overrides);
  const token = req.body?.pendingToken;
  const t = await loadTicket(d, token);
  if (!t) return expired(res);
  if (!sameDevice(req, t)) return res.status(403).json({ code: 'SIGNIN_OTHER_DEVICE', message: 'Finish signing in on the device where you started.' });
  let approval = null;
  if (t.approvalId && t.mfa === 'required') {
    const a = await d.approvals.get(t.approvalId);
    approval = { status: a ? a.status : 'expired' };
  }
  let devicesList = null;
  if (t.mfa !== 'required') {
    const user = await d.userDocs.findById(t.userId);
    const check = user ? await d.devices.checkDeviceLimit(req, user, { deviceId: t.deviceId }) : { devices: [] };
    devicesList = check.devices;
  }
  return res.json({
    stage: t.mfa === 'required' ? 'mfa' : (devicesList?.length ? 'device_limit' : 'ready'),
    methods: mfaMethods(t),
    approval,
    emailHint: t.emailHint,
    devices: devicesList,
    expiresAt: new Date(t.expiresAt).toISOString(),
  });
}

/** POST /api/auth/signin/email-code { pendingToken } -> sends a 6-digit code (10 min) by email. */
async function sendEmailCode(req, res, overrides) {
  const d = deps(overrides);
  const token = req.body?.pendingToken;
  const t = await loadTicket(d, token);
  if (!t) return expired(res);
  if (!sameDevice(req, t)) return res.status(403).json({ code: 'SIGNIN_OTHER_DEVICE', message: 'Finish signing in on the device where you started.' });
  if (t.mfa !== 'required') return res.status(400).json({ message: 'No code is needed for this sign-in.' });
  if (t.email.sends >= EMAIL_MAX_SENDS_PER_TICKET) {
    return res.status(429).json({ code: 'EMAIL_CODE_LIMIT', message: 'We already sent a few codes. Check your inbox or use another way.' });
  }
  const perUser = await d.store.incr(`signin-email:${t.userId}`, 60 * 60 * 1000);
  if (perUser > EMAIL_MAX_SENDS_PER_USER_HOUR) {
    return res.status(429).json({ code: 'EMAIL_CODE_LIMIT', message: 'Too many codes sent. Try again in an hour or use another way.' });
  }
  const user = await d.userDocs.findById(t.userId);
  if (!user?.email) return expired(res);

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  t.email = { hash: sha256(`${t.userId}:${code}`), expiresAt: d.now() + EMAIL_CODE_TTL_MS, sends: t.email.sends + 1, attempts: 0 };
  await saveTicket(d, token, t);

  const where = [t.requester.deviceName, t.requester.location ? `near ${t.requester.location}` : null].filter(Boolean).join(' ');
  try {
    await d.sendEmail({
      to: user.email,
      subject: `${code} is your Oruinwan sign-in code`,
      text: `Your Oruinwan sign-in code is ${code}. It works for 10 minutes.\n\nSomeone is signing in on ${where}. If this wasn't you, don't share the code and change your password.`,
      html: `<p>Your Oruinwan sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for 10 minutes.</p><p style="color:#666">Someone is signing in on ${escapeHtml(where)}. If this wasn't you, don't share the code and change your password.</p>`,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[signin] email code could not be sent');
    return res.status(502).json({ message: "We couldn't send the email. Try another way." });
  }
  d.audit(t.userId, 'SIGNIN_EMAIL_CODE_SENT', req, {});
  return res.json({ sent: true, emailHint: t.emailHint, expiresAt: new Date(t.email.expiresAt).toISOString() });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = {
  gate, continueSignIn, status, sendEmailCode, maskEmail, requesterOf,
  TICKET_TTL_MS, EMAIL_CODE_TTL_MS, _internal: { ticketKey, loadTicket, sha256 },
};
