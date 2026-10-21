'use strict';

const devices = require('../devices.service');

const req = (deviceId) => ({ headers: deviceId ? { 'x-device-id': deviceId } : {}, ip: '1.2.3.4', get() { return 'jest'; } });

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({
    user_id: 'u1', device_id: `device-${i}-xxxx`, device_name: `D${i}`, platform: 'web', revoked: false,
    meta: { location: i === 0 ? 'Hyderabad, IN' : undefined }, created_at: new Date(), last_activity_at: new Date(),
  }));
}

describe('deviceLimitFor', () => {
  test('defaults to 4 and follows DEVICE_LIMIT', () => {
    expect(devices.deviceLimitFor({}, {})).toBe(4);
    expect(devices.deviceLimitFor({}, { DEVICE_LIMIT: '2' })).toBe(2);
    expect(devices.deviceLimitFor({}, { DEVICE_LIMIT: '0' })).toBe(0);
    expect(devices.deviceLimitFor({}, { DEVICE_LIMIT: 'lots' })).toBe(4);
  });

  test('company accounts use COMPANY_DEVICE_LIMIT when set, else the same limit', () => {
    const company = { userType: 'company', companyId: 'c1' };
    expect(devices.deviceLimitFor(company, { DEVICE_LIMIT: '3' })).toBe(3);
    expect(devices.deviceLimitFor(company, { DEVICE_LIMIT: '3', COMPANY_DEVICE_LIMIT: '10' })).toBe(10);
    expect(devices.deviceLimitFor({ userType: 'personal' }, { COMPANY_DEVICE_LIMIT: '10' })).toBe(4);
  });
});

describe('checkDeviceLimit', () => {
  const user = { _id: 'u1' };

  test('counts only signed-in devices seen within the refresh-token lifetime', async () => {
    const query = jest.fn(async () => ({ rows: rows(3) }));
    const r = await devices.checkDeviceLimit(req('new-device-001'), user, {}, { query, users: {} }, {});
    expect(r).toEqual({ over: false, limit: 4, devices: [] });
    expect(query.mock.calls[0][0]).toMatch(/revoked = false/);
    expect(query.mock.calls[0][0]).toMatch(/last_activity_at > now\(\)/);
    expect(query.mock.calls[0][1]).toEqual(['u1', 7]);
  });

  test('a new device over the limit is refused with the list', async () => {
    const query = jest.fn(async () => ({ rows: rows(4) }));
    const r = await devices.checkDeviceLimit(req('new-device-001'), user, {}, { query, users: {} }, {});
    expect(r.over).toBe(true);
    expect(r.devices).toHaveLength(4);
    expect(r.devices[0]).toEqual({ id: 'device-0-xxxx', name: 'D0', platform: 'web', lastActiveAt: expect.any(Date), location: 'Hyderabad, IN' });
  });

  test('a device already signed in is never refused; a request without a device id counts as new', async () => {
    const query = jest.fn(async () => ({ rows: rows(4) }));
    expect((await devices.checkDeviceLimit(req('device-2-xxxx'), user, {}, { query, users: {} }, {})).over).toBe(false);
    expect((await devices.checkDeviceLimit(req(null), user, {}, { query, users: {} }, {})).over).toBe(true);
    // SSO carries the device id explicitly.
    expect((await devices.checkDeviceLimit(req(null), user, { deviceId: 'device-1-xxxx' }, { query, users: {} }, {})).over).toBe(false);
  });

  test('DEVICE_LIMIT=0 turns the limit off; a database error never blocks sign-in', async () => {
    const query = jest.fn(async () => { throw new Error('db down'); });
    expect((await devices.checkDeviceLimit(req('x-device-0001'), user, {}, { query, users: {} }, { DEVICE_LIMIT: '0' })).over).toBe(false);
    expect(query).not.toHaveBeenCalled();
    expect((await devices.checkDeviceLimit(req('x-device-0001'), user, {}, { query, users: {} }, {})).over).toBe(false);
  });
});

describe('refresh and sign-out never add devices', () => {
  test('touchDevice only updates a known, signed-in device', async () => {
    const query = jest.fn(async () => ({ rowCount: 0 }));
    expect(await devices.touchDevice(req('unknown-device-1'), 'u1', { query, users: {} })).toBe(false);
    expect(query.mock.calls[0][0]).toMatch(/^UPDATE user_device_sessions SET last_activity_at = now\(\)/);
    expect(query.mock.calls[0][0]).not.toMatch(/INSERT/);
    expect(await devices.touchDevice(req(null), 'u1', { query, users: {} })).toBe(false);
  });

  test('signOutDevice frees the device place', async () => {
    const query = jest.fn(async () => ({ rowCount: 1 }));
    expect(await devices.signOutDevice(req('device-1-xxxx'), 'u1', { query, users: {} })).toBe(true);
    expect(query.mock.calls[0][0]).toMatch(/SET revoked = true/);
  });
});

describe('device names and places', () => {
  test('browsers are named "<browser> on <OS>", the desktop app and phones by what they are', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
    const r = (h) => ({ headers: h, get: (n) => h[n.toLowerCase()] });
    expect(devices.describeClient(r({ 'user-agent': mac })).deviceName).toBe('Chrome on macOS');
    expect(devices.describeClient(r({ 'user-agent': mac, 'x-client-platform': 'desktop' })).deviceName).toBe('Oruinwan desktop on macOS');
  });

  test('approximate location comes from CDN headers only', () => {
    expect(devices.approxLocation({ headers: { 'cloudfront-viewer-city': 'Hyderabad', 'cloudfront-viewer-country': 'IN' } })).toBe('Hyderabad, IN');
    expect(devices.approxLocation({ headers: { 'cf-ipcountry': 'XX' } })).toBeNull();
    expect(devices.approxLocation({ headers: {} })).toBeNull();
  });
});
