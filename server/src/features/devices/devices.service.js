'use strict';

/**
 * Devices = user_device_sessions rows (one per user + X-Device-Id), joined with the
 * sign-in sessions (refresh tokens) and push tokens that belong to that device.
 *
 * Linking: refresh tokens carry the User-Agent they signed in with (device_info);
 * a device session stores its User-Agent in meta.userAgent, so a refresh token
 * belongs to a device when the two match. Push tokens registered with an
 * X-Device-Id header (or body.deviceId) carry that deviceId.
 *
 * Revoking a device therefore:
 *   1. marks the device session revoked (requireAuth refuses that device id),
 *   2. deletes its refresh tokens (so it cannot mint new access tokens),
 *   3. removes its push tokens (so it stops receiving notifications).
 */

const { query } = require('../../shared/postgres');
const { sha256 } = require('../../../utils/hashUtils');

const MAX_NAME = 64;

class DeviceError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function deps(overrides = {}) {
  return {
    query: overrides.query || query,
    users: overrides.users || require('../../identity').users,
  };
}

const sessionsOf = (device, refreshTokens) => refreshTokens.filter(
  (t) => device.userAgent && t.deviceInfo && t.deviceInfo === device.userAgent,
);

function toDevice(row) {
  const meta = row.meta || {};
  return {
    deviceId: row.device_id,
    deviceName: meta.customName || row.device_name || 'Unknown Device',
    reportedName: row.device_name || 'Unknown Device',
    customName: meta.customName || null,
    platform: row.platform || 'unknown',
    userAgent: meta.userAgent || null,
    ipAddress: meta.ipAddress || null,
    trustLevel: meta.trustLevel || 'trusted',
    createdAt: row.created_at,
    lastActiveAt: row.last_activity_at,
    revoked: !!row.revoked,
    revokedAt: row.revoked ? (row.revoked_at || null) : null,
    location: meta.location || null,
    // How this device last signed in, and which signed-in device approved it (QR / approval).
    signIn: meta.signInMethod ? {
      method: meta.signInMethod,
      at: meta.signInAt || null,
      approvedBy: meta.approvedByDeviceId ? { deviceId: meta.approvedByDeviceId, deviceName: meta.approvedByDeviceName || null } : null,
    } : null,
  };
}

/**
 * Devices with their sessions and push-token counts.
 *   current: { deviceId, refreshToken }  identifies the caller's own device / session
 */
async function listDevices(userId, current = {}, { includeRevoked = false } = {}, overrides) {
  const d = deps(overrides);
  const { rows } = await d.query(
    `SELECT * FROM user_device_sessions WHERE user_id = $1${includeRevoked ? '' : ' AND revoked = false'} ORDER BY last_activity_at DESC`,
    [String(userId)],
  );
  const [refreshTokens, user] = await Promise.all([
    d.users.listRefreshTokens(userId),
    d.users.findById(userId, { withSecrets: true }),
  ]);
  const pushTokens = Array.isArray(user?.deviceTokens) ? user.deviceTokens : [];
  const currentHash = current.refreshToken ? sha256(current.refreshToken) : null;

  return rows.map((row) => {
    const device = toDevice(row);
    const sessions = sessionsOf(device, refreshTokens).map((t) => ({
      startedAt: t.startedAt || t.createdAt || null,
      expiresAt: t.expiresAt || null,
      ip: t.ip || null,
      current: !!currentHash && t.tokenHash === currentHash,
    }));
    const { userAgent: _ua, ...rest } = device;
    return {
      ...rest,
      isCurrent: !!current.deviceId && device.deviceId === current.deviceId,
      sessionCount: sessions.length,
      sessions,
      pushTokenCount: pushTokens.filter((p) => p.deviceId && p.deviceId === device.deviceId).length,
    };
  });
}

async function loadDevice(d, userId, deviceId) {
  if (typeof deviceId !== 'string' || !deviceId || deviceId.length > 256) throw new DeviceError(400, 'deviceId is required');
  const { rows } = await d.query('SELECT * FROM user_device_sessions WHERE user_id = $1 AND device_id = $2', [String(userId), deviceId]);
  if (!rows[0]) throw new DeviceError(404, 'Device session not found');
  return rows[0];
}

/** Give a device a name of the user's choosing (null/'' resets to the reported name). */
async function renameDevice(userId, deviceId, name, overrides) {
  const d = deps(overrides);
  await loadDevice(d, userId, deviceId);
  const clean = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim() : name;
  if (clean !== null && clean !== '' && (typeof clean !== 'string' || clean.length > MAX_NAME)) {
    throw new DeviceError(400, `name must be text of at most ${MAX_NAME} characters`);
  }
  const { rows } = clean
    ? await d.query(
      `UPDATE user_device_sessions SET meta = meta || jsonb_build_object('customName', $3::text)
       WHERE user_id = $1 AND device_id = $2 RETURNING *`, [String(userId), deviceId, clean])
    : await d.query(
      `UPDATE user_device_sessions SET meta = meta - 'customName' WHERE user_id = $1 AND device_id = $2 RETURNING *`,
      [String(userId), deviceId]);
  const { userAgent: _ua, ...device } = toDevice(rows[0]);
  return device;
}

/**
 * Revoke one device: its device session, its refresh tokens and its push tokens.
 * Revoking an already-revoked device still cleans up leftover tokens.
 *   current: { refreshToken } — the caller's own session is kept unless this IS the caller's device.
 */
async function revokeDevice(userId, deviceId, current = {}, overrides) {
  const d = deps(overrides);
  const row = await loadDevice(d, userId, deviceId);
  const device = toDevice(row);
  const isCurrentDevice = !!current.deviceId && current.deviceId === deviceId;

  let wasActive = false;
  if (!row.revoked) {
    await d.query('UPDATE user_device_sessions SET revoked = true, revoked_at = now() WHERE user_id = $1 AND device_id = $2', [String(userId), deviceId]);
    wasActive = true;
  }

  // Refresh tokens of this device; never the caller's own session unless they revoke their own device.
  const currentHash = current.refreshToken ? sha256(current.refreshToken) : null;
  const refreshTokens = await d.users.listRefreshTokens(userId);
  const toDelete = sessionsOf(device, refreshTokens).filter((t) => isCurrentDevice || t.tokenHash !== currentHash);
  for (const t of toDelete) await d.users.deleteRefreshToken(t.tokenHash);

  // Push tokens registered from this device.
  const user = await d.users.findById(userId, { withSecrets: true });
  const pushTokens = Array.isArray(user?.deviceTokens) ? user.deviceTokens : [];
  const keep = pushTokens.filter((p) => p.deviceId !== deviceId);
  if (keep.length !== pushTokens.length) await d.users.update(userId, { deviceTokens: keep });

  const { userAgent: _ua, ...rest } = device;
  return {
    device: { ...rest, revoked: true },
    wasActive,
    isCurrentDevice,
    sessionsRevoked: toDelete.length,
    pushTokensRemoved: pushTokens.length - keep.length,
  };
}

/** Revoke every device except the caller's. */
async function revokeOtherDevices(userId, current = {}, overrides) {
  const d = deps(overrides);
  if (!current.deviceId) throw new DeviceError(400, 'Current device ID not found');
  const { rows } = await d.query(
    'SELECT device_id FROM user_device_sessions WHERE user_id = $1 AND device_id <> $2', [String(userId), current.deviceId],
  );
  const totals = { devicesRevoked: 0, sessionsRevoked: 0, pushTokensRemoved: 0 };
  for (const r of rows) {
    const res = await revokeDevice(userId, r.device_id, { refreshToken: current.refreshToken }, overrides);
    if (res.wasActive) totals.devicesRevoked += 1;
    totals.sessionsRevoked += res.sessionsRevoked;
    totals.pushTokensRemoved += res.pushTokensRemoved;
  }
  return totals;
}

// ── Sign-in registration ─────────────────────────────────────────────────

const DEVICE_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;
/** Where a browser that sends no X-Device-Id keeps the id the server gave it. */
const DEVICE_COOKIE = 'oruinwan_did';
const DEVICE_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

const validId = (raw) => (typeof raw === 'string' && DEVICE_ID_RE.test(raw) ? raw : null);

/**
 * The client's device id: an explicit value (e.g. carried through SSO), else the
 * X-Device-Id header, else the device cookie the server set (see assignDeviceId).
 */
function deviceIdFrom(req, explicit) {
  return validId(explicit) || validId(req?.headers?.['x-device-id']) || validId(req?.cookies?.[DEVICE_COOKIE]);
}

/**
 * Express middleware for the sign-in routes: a request without a device id
 * (no X-Device-Id, no device cookie) gets one made on the server, so its
 * session is still recorded under Devices and counted for the device limit.
 * The id goes back in the X-Device-Id response header (apps keep it and send it
 * from then on) and in an httpOnly cookie (browsers send it back by themselves).
 */
function assignDeviceId(req, res, next) {
  try {
    const header = validId(req.headers?.['x-device-id']);
    if (!header) {
      let id = validId(req.cookies?.[DEVICE_COOKIE]);
      if (!id) {
        id = `srv-${require('crypto').randomUUID()}`;
        res.cookie(DEVICE_COOKIE, id, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: DEVICE_COOKIE_MAX_AGE_MS,
          path: '/',
        });
      }
      req.headers['x-device-id'] = id;
      res.setHeader('X-Device-Id', id);
    }
  } catch (err) {
    require('../../../utils/logger').warn({ err: err?.message }, '[devices] could not assign a device id');
  }
  next();
}

/**
 * Rough location from the CDN / proxy in front of the server, when it adds one
 * (CloudFront, Cloudflare, Vercel). Null when nothing tells us; we never look IPs up elsewhere.
 */
function approxLocation(req) {
  const h = req?.headers || {};
  const pick = (...names) => {
    for (const n of names) {
      const v = h[n];
      if (typeof v === 'string' && v.trim()) {
        try { return decodeURIComponent(v.trim()).slice(0, 80); } catch { return v.trim().slice(0, 80); }
      }
    }
    return null;
  };
  const city = pick('cloudfront-viewer-city', 'cf-ipcity', 'x-vercel-ip-city', 'x-geo-city');
  const country = pick('cloudfront-viewer-country-name', 'cloudfront-viewer-country', 'cf-ipcountry', 'x-vercel-ip-country', 'x-geo-country');
  if (!city && !country) return null;
  return [city, country && country !== 'XX' ? country : null].filter(Boolean).join(', ') || null;
}

function describeClient(req) {
  const ua = (req?.get ? req.get('User-Agent') : req?.headers?.['user-agent']) || null;
  const native = String(req?.headers?.['x-client-platform'] || '').trim().toLowerCase();
  const { parseDeviceInfo } = require('../../../utils/deviceParser');
  const info = parseDeviceInfo(ua);
  const platform = ['ios', 'android'].includes(native) ? native : (native === 'desktop' ? 'desktop' : 'web');
  const os = info.os && info.os !== 'Unknown OS' && info.os !== 'Unknown' ? info.os : null;
  const browser = info.browser && !/^Unknown/.test(info.browser) ? info.browser : null;
  let name;
  if (platform === 'desktop') name = `Oruinwan desktop${os ? ` on ${os}` : ''}`;
  else if (platform === 'web' && browser) name = `${browser}${os ? ` on ${os}` : ''}`; // "Chrome on macOS"
  else name = info.formattedString && info.formattedString !== 'Unknown Device' ? info.formattedString : (info.device && info.device !== 'Unknown' ? info.device : 'Unknown Device');
  return { userAgent: ua, platform, deviceName: String(name).slice(0, 120) };
}

/**
 * Create/refresh the device row for a sign-in. A fresh sign-in (reactivate) on a
 * previously revoked device makes it active again — the user just re-authenticated.
 * Never throws: device bookkeeping must not block signing in.
 */
async function recordSignIn(req, userId, { deviceId, reactivate = true, signIn = null } = {}, overrides) {
  const id = deviceIdFrom(req, deviceId);
  if (!id || !userId) return null;
  try {
    const d = deps(overrides);
    const client = describeClient(req);
    const sessions = overrides?.deviceSessions || require('../../services/deviceSession.service');
    const session = await sessions.createOrUpdateSession({
      userId: String(userId), deviceId: id, deviceName: client.deviceName, platform: client.platform,
      userAgent: client.userAgent, ipAddress: req.ip || null,
    });
    if (reactivate) {
      await d.query('UPDATE user_device_sessions SET revoked = false, revoked_at = NULL WHERE user_id = $1 AND device_id = $2 AND revoked = true', [String(userId), id]);
    }
    // Sign-in history on the device row: how it signed in, where from, and who approved it.
    const extra = {
      signInMethod: signIn?.method || null,
      signInAt: new Date().toISOString(),
      approvedByDeviceId: signIn?.approvedBy?.deviceId || null,
      approvedByDeviceName: signIn?.approvedBy?.deviceName || null,
      location: approxLocation(req),
    };
    await d.query('UPDATE user_device_sessions SET meta = meta || $3::jsonb WHERE user_id = $1 AND device_id = $2', [String(userId), id, JSON.stringify(extra)]);
    return session;
  } catch (err) {
    require('../../../utils/logger').warn({ err: err.message }, '[devices] could not record sign-in');
    return null;
  }
}

/**
 * Refresh keeps a device's "last active" fresh but never creates a device: only a sign-in
 * (which passes the device limit) does.
 */
async function touchDevice(req, userId, overrides) {
  const id = deviceIdFrom(req);
  if (!id || !userId) return false;
  try {
    const d = deps(overrides);
    const { rowCount } = await d.query(
      'UPDATE user_device_sessions SET last_activity_at = now() WHERE user_id = $1 AND device_id = $2 AND revoked = false',
      [String(userId), id],
    );
    return rowCount > 0;
  } catch {
    return false;
  }
}

/** Signing out on a device frees its place: the device row is marked signed out (revoked). */
async function signOutDevice(req, userId, overrides) {
  const id = deviceIdFrom(req);
  if (!id || !userId) return false;
  try {
    const d = deps(overrides);
    const { rowCount } = await d.query(
      'UPDATE user_device_sessions SET revoked = true, revoked_at = now() WHERE user_id = $1 AND device_id = $2 AND revoked = false',
      [String(userId), id],
    );
    return rowCount > 0;
  } catch {
    return false;
  }
}

// ── Device limit ─────────────────────────────────────────────────────────

const DEFAULT_DEVICE_LIMIT = 4;

function parseLimit(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * How many devices may be signed in at once (0 = no limit).
 *   individual accounts   DEVICE_LIMIT (default 4)
 *   company accounts      not limited, unless COMPANY_DEVICE_LIMIT is set
 */
function deviceLimitFor(user, env = process.env) {
  const isCompany = user && (user.userType === 'company' || user.companyId);
  if (isCompany) return parseLimit(env.COMPANY_DEVICE_LIMIT) ?? 0;
  return parseLimit(env.DEVICE_LIMIT) ?? DEFAULT_DEVICE_LIMIT;
}

// A device that has not been seen for longer than a refresh token lives is signed out anyway.
const idleDays = (env = process.env) => parseInt(env.REFRESH_TOKEN_DAYS || '7', 10) || 7;

/** Devices that hold a place: not signed out, and seen within the refresh-token lifetime. */
async function activeDevices(userId, overrides, env = process.env) {
  const d = deps(overrides);
  const { rows } = await d.query(
    `SELECT * FROM user_device_sessions WHERE user_id = $1 AND revoked = false
       AND last_activity_at > now() - ($2::int * interval '1 day')
     ORDER BY last_activity_at DESC`,
    [String(userId), idleDays(env)],
  );
  return rows.map(toDevice);
}

/** What the "sign out of one to continue" screen shows for each device. */
const limitView = (dev) => ({
  id: dev.deviceId,
  name: dev.deviceName,
  platform: dev.platform,
  lastActiveAt: dev.lastActiveAt,
  location: dev.location || null,
});

/**
 * May this sign-in take a device place? The device signing in again (same X-Device-Id, still
 * signed in) always may. Returns { over, limit, devices }. Never throws: when the device
 * table can't be read (no database), the sign-in is not blocked.
 */
async function checkDeviceLimit(req, user, { deviceId } = {}, overrides, env = process.env) {
  const limit = deviceLimitFor(user, env);
  if (!limit) return { over: false, limit: 0, devices: [] };
  try {
    const id = deviceIdFrom(req, deviceId);
    const list = await activeDevices(user._id || user.id, overrides, env);
    if (id && list.some((dev) => dev.deviceId === id)) return { over: false, limit, devices: [] };
    return { over: list.length >= limit, limit, devices: list.length >= limit ? list.map(limitView) : [] };
  } catch (err) {
    // Fail open (a database problem must not lock everyone out), but loudly.
    require('../../../utils/logger').error(
      { err: err.message, userId: String(user?._id || user?.id || '') },
      '[devices] DEVICE LIMIT NOT ENFORCED: the device table could not be read; this sign-in was let through',
    );
    return { over: false, limit, devices: [], unchecked: true };
  }
}

/** Is the requesting device revoked? (refresh must refuse it). Fails open only when no device id is sent. */
async function isRequestDeviceRevoked(req, userId, overrides) {
  const id = deviceIdFrom(req);
  if (!id) return false;
  const d = deps(overrides);
  const { rows } = await d.query('SELECT revoked FROM user_device_sessions WHERE user_id = $1 AND device_id = $2', [String(userId), id]);
  return !!rows[0]?.revoked;
}

module.exports = {
  DeviceError, listDevices, renameDevice, revokeDevice, revokeOtherDevices, MAX_NAME,
  recordSignIn, isRequestDeviceRevoked, deviceIdFrom, assignDeviceId, DEVICE_COOKIE, describeClient, approxLocation,
  touchDevice, signOutDevice, deviceLimitFor, activeDevices, checkDeviceLimit, DEFAULT_DEVICE_LIMIT,
};
