'use strict';

const { sha256 } = require('../../../../utils/hashUtils');
const devices = require('../devices.service');

const USER = 'u1';
const UA_PHONE = 'Oruinwan/1.4 (iPhone)';
const UA_MAC = 'Mozilla/5.0 (Macintosh)';

/** Tiny in-memory stand-in for user_device_sessions + the users repo. */
function makeStore() {
  const rows = [
    { user_id: USER, device_id: 'phone', device_name: 'iPhone', platform: 'ios', revoked: false, revoked_at: null, meta: { userAgent: UA_PHONE }, created_at: new Date(1), last_activity_at: new Date(3) },
    { user_id: USER, device_id: 'mac', device_name: 'Mac', platform: 'web', revoked: false, revoked_at: null, meta: { userAgent: UA_MAC }, created_at: new Date(2), last_activity_at: new Date(4) },
  ];
  let refresh = [
    { tokenHash: sha256('phone-rt'), deviceInfo: UA_PHONE, startedAt: new Date(1) },
    { tokenHash: sha256('mac-rt'), deviceInfo: UA_MAC, startedAt: new Date(2) },
  ];
  let user = { _id: USER, deviceTokens: [{ token: 'apns-1', platform: 'ios', deviceId: 'phone' }, { token: 'fcm-old', platform: 'android' }] };

  const query = jest.fn(async (sql, params) => {
    const [uid, did, name] = params;
    const mine = rows.filter((r) => r.user_id === uid);
    if (sql.startsWith('SELECT * FROM user_device_sessions WHERE user_id = $1 AND device_id = $2')) {
      return { rows: mine.filter((r) => r.device_id === did) };
    }
    if (sql.startsWith('SELECT * FROM user_device_sessions WHERE user_id = $1')) {
      return { rows: mine.filter((r) => !sql.includes('revoked = false') || !r.revoked) };
    }
    if (sql.startsWith('SELECT device_id FROM user_device_sessions')) {
      return { rows: mine.filter((r) => r.device_id !== did) };
    }
    if (sql.startsWith('UPDATE user_device_sessions SET revoked = true')) {
      mine.filter((r) => r.device_id === did).forEach((r) => { r.revoked = true; r.revoked_at = new Date(); });
      return { rows: [] };
    }
    if (sql.includes("jsonb_build_object('customName'")) {
      const r = mine.find((x) => x.device_id === did);
      r.meta = { ...r.meta, customName: name };
      return { rows: [r] };
    }
    if (sql.includes("meta - 'customName'")) {
      const r = mine.find((x) => x.device_id === did);
      const { customName: _c, ...rest } = r.meta;
      r.meta = rest;
      return { rows: [r] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const users = {
    listRefreshTokens: jest.fn(async () => refresh.slice()),
    deleteRefreshToken: jest.fn(async (hash) => { refresh = refresh.filter((t) => t.tokenHash !== hash); }),
    findById: jest.fn(async () => ({ ...user, deviceTokens: user.deviceTokens.slice() })),
    update: jest.fn(async (_id, patch) => { user = { ...user, ...patch }; return user; }),
  };
  return { rows, query, users, get refresh() { return refresh; }, get user() { return user; } };
}

describe('devices.service', () => {
  test('lists devices with their sessions and push tokens', async () => {
    const s = makeStore();
    const list = await devices.listDevices(USER, { deviceId: 'mac', refreshToken: 'mac-rt' }, {}, s);
    expect(list).toHaveLength(2);
    const phone = list.find((d) => d.deviceId === 'phone');
    const mac = list.find((d) => d.deviceId === 'mac');
    expect(phone).toMatchObject({ isCurrent: false, sessionCount: 1, pushTokenCount: 1, deviceName: 'iPhone' });
    expect(mac).toMatchObject({ isCurrent: true, sessionCount: 1, pushTokenCount: 0 });
    expect(mac.sessions[0].current).toBe(true);
    expect(mac.userAgent).toBeUndefined();
  });

  test('rename sets and clears a custom name', async () => {
    const s = makeStore();
    expect((await devices.renameDevice(USER, 'phone', '  Work phone ', s)).deviceName).toBe('Work phone');
    expect((await devices.renameDevice(USER, 'phone', '', s)).deviceName).toBe('iPhone');
    await expect(devices.renameDevice(USER, 'phone', 'x'.repeat(65), s)).rejects.toMatchObject({ status: 400 });
    await expect(devices.renameDevice(USER, 'nope', 'A', s)).rejects.toMatchObject({ status: 404 });
  });

  test('revoking a device revokes its session row, refresh tokens and push tokens', async () => {
    const s = makeStore();
    const r = await devices.revokeDevice(USER, 'phone', { deviceId: 'mac', refreshToken: 'mac-rt' }, s);
    expect(r).toMatchObject({ wasActive: true, isCurrentDevice: false, sessionsRevoked: 1, pushTokensRemoved: 1 });
    expect(s.rows.find((x) => x.device_id === 'phone').revoked).toBe(true);
    expect(s.refresh.map((t) => t.tokenHash)).toEqual([sha256('mac-rt')]);
    expect(s.user.deviceTokens.map((t) => t.token)).toEqual(['fcm-old']);
  });

  test('the caller keeps their own session when another device shares the user agent', async () => {
    const s = makeStore();
    s.rows[0].meta.userAgent = UA_MAC; // both devices report the same browser
    const r = await devices.revokeDevice(USER, 'phone', { deviceId: 'mac', refreshToken: 'mac-rt' }, s);
    expect(r.sessionsRevoked).toBe(0);
    expect(s.refresh.some((t) => t.tokenHash === sha256('mac-rt'))).toBe(true);
  });

  test('revoke others keeps only the current device', async () => {
    const s = makeStore();
    const totals = await devices.revokeOtherDevices(USER, { deviceId: 'mac', refreshToken: 'mac-rt' }, s);
    expect(totals).toEqual({ devicesRevoked: 1, sessionsRevoked: 1, pushTokensRemoved: 1 });
    expect(s.rows.find((x) => x.device_id === 'mac').revoked).toBe(false);
    await expect(devices.revokeOtherDevices(USER, {}, s)).rejects.toMatchObject({ status: 400 });
  });

  test('unknown device is a 404', async () => {
    const s = makeStore();
    await expect(devices.revokeDevice(USER, 'ghost', {}, s)).rejects.toMatchObject({ status: 404 });
  });
});

describe('sign-in registration', () => {
  const req = (headers = {}) => ({
    headers: { 'user-agent': UA_MAC, ...headers },
    ip: '10.0.0.1',
    get(name) { return this.headers[name.toLowerCase()]; },
  });

  test('records the device of a sign-in and reactivates a revoked one', async () => {
    const s = makeStore();
    s.rows[1].revoked = true;
    const deviceSessions = { createOrUpdateSession: jest.fn(async (x) => x) };
    s.query.mockImplementationOnce(async (sql, params) => {
      expect(sql).toMatch(/SET revoked = false/);
      expect(params).toEqual([USER, 'mac-device-01']);
      return { rows: [] };
    });
    await devices.recordSignIn(req({ 'x-device-id': 'mac-device-01' }), USER, {}, { ...s, deviceSessions });
    expect(deviceSessions.createOrUpdateSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER, deviceId: 'mac-device-01', platform: 'web', userAgent: UA_MAC, ipAddress: '10.0.0.1',
    }));
  });

  test('native platform, explicit device id (SSO) and refresh without reactivation', async () => {
    const s = makeStore();
    const deviceSessions = { createOrUpdateSession: jest.fn(async (x) => x) };
    await devices.recordSignIn(req({ 'x-client-platform': 'ios' }), USER, { deviceId: 'phone-device-1', reactivate: false }, { ...s, deviceSessions });
    expect(deviceSessions.createOrUpdateSession).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'phone-device-1', platform: 'ios' }));
    expect(s.query).not.toHaveBeenCalled();
  });

  test('no or malformed device id: nothing recorded; failures never throw', async () => {
    const s = makeStore();
    const deviceSessions = { createOrUpdateSession: jest.fn(async () => { throw new Error('db down'); }) };
    expect(await devices.recordSignIn(req(), USER, {}, { ...s, deviceSessions })).toBeNull();
    expect(await devices.recordSignIn(req({ 'x-device-id': 'bad id!' }), USER, {}, { ...s, deviceSessions })).toBeNull();
    expect(deviceSessions.createOrUpdateSession).not.toHaveBeenCalled();
    expect(await devices.recordSignIn(req({ 'x-device-id': 'good-device-1' }), USER, {}, { ...s, deviceSessions })).toBeNull();
  });

  test('refresh is refused for a revoked device', async () => {
    const s = makeStore();
    const q = jest.fn(async () => ({ rows: [{ revoked: true }] }));
    expect(await devices.isRequestDeviceRevoked(req({ 'x-device-id': 'phone-device-1' }), USER, { ...s, query: q })).toBe(true);
    q.mockResolvedValueOnce({ rows: [] });
    expect(await devices.isRequestDeviceRevoked(req({ 'x-device-id': 'phone-device-1' }), USER, { ...s, query: q })).toBe(false);
    expect(await devices.isRequestDeviceRevoked(req(), USER, { ...s, query: q })).toBe(false);
  });
});
