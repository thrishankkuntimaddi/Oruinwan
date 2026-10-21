'use strict';

/**
 * Sign-ins without X-Device-Id still count: the server makes a device id
 * (response header + httpOnly cookie), so the session is recorded under
 * Devices and counted for the device limit.
 */

const devices = require('../devices.service');

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({
    user_id: 'u1', device_id: `device-${i}-xxxx`, device_name: `D${i}`, platform: 'web', revoked: false,
    meta: {}, created_at: new Date(), last_activity_at: new Date(),
  }));
}

const res = () => {
  const headers = {};
  const cookies = {};
  return { headers, cookies, setHeader: (k, v) => { headers[k] = v; }, cookie: (k, v, o) => { cookies[k] = { v, o }; } };
};
const request = (headers = {}, cookies = {}) => ({ headers, cookies, ip: '1.2.3.4', get() { return 'jest'; } });

test('a request without a device id gets one made on the server (header + httpOnly cookie)', () => {
  const r = request();
  const out = res();
  const next = jest.fn();
  devices.assignDeviceId(r, out, next);
  expect(next).toHaveBeenCalled();
  const id = r.headers['x-device-id'];
  expect(id).toMatch(/^srv-[0-9a-f-]{36}$/);
  expect(out.headers['X-Device-Id']).toBe(id);
  expect(out.cookies[devices.DEVICE_COOKIE]).toMatchObject({ v: id, o: { httpOnly: true } });
  expect(devices.deviceIdFrom(r)).toBe(id);
});

test('the device cookie is reused, and a client header always wins', () => {
  const fromCookie = request({}, { [devices.DEVICE_COOKIE]: 'srv-cookie-device-1' });
  const out = res();
  devices.assignDeviceId(fromCookie, out, () => {});
  expect(fromCookie.headers['x-device-id']).toBe('srv-cookie-device-1');
  expect(out.cookies).toEqual({});

  const withHeader = request({ 'x-device-id': 'client-device-01' }, { [devices.DEVICE_COOKIE]: 'srv-cookie-device-1' });
  const out2 = res();
  devices.assignDeviceId(withHeader, out2, () => {});
  expect(withHeader.headers['x-device-id']).toBe('client-device-01');
  expect(out2.headers).toEqual({});
  expect(devices.deviceIdFrom(withHeader)).toBe('client-device-01');
});

test('so the limit counts it: a 5th header-less sign-in is over the limit, the same browser again is not', async () => {
  const query = jest.fn(async () => ({ rows: rows(4) }));
  const fresh = request();
  devices.assignDeviceId(fresh, res(), () => {});
  expect((await devices.checkDeviceLimit(fresh, { _id: 'u1' }, {}, { query, users: {} }, {})).over).toBe(true);

  const known = request({}, { [devices.DEVICE_COOKIE]: 'device-3-xxxx' });
  devices.assignDeviceId(known, res(), () => {});
  expect((await devices.checkDeviceLimit(known, { _id: 'u1' }, {}, { query, users: {} }, {})).over).toBe(false);
});

test('company accounts are not counted unless COMPANY_DEVICE_LIMIT is set', async () => {
  const query = jest.fn(async () => ({ rows: rows(9) }));
  const company = { _id: 'u2', userType: 'company', companyId: 'c1' };
  expect((await devices.checkDeviceLimit(request({ 'x-device-id': 'new-device-01' }), company, {}, { query, users: {} }, {})).over).toBe(false);
  expect(query).not.toHaveBeenCalled();
  expect((await devices.checkDeviceLimit(request({ 'x-device-id': 'new-device-01' }), company, {}, { query, users: {} }, { COMPANY_DEVICE_LIMIT: '5' })).over).toBe(true);
});

test('a database error lets the sign-in through but is flagged and logged', async () => {
  const query = jest.fn(async () => { throw new Error('db down'); });
  const r = await devices.checkDeviceLimit(request({ 'x-device-id': 'x-device-0001' }), { _id: 'u1' }, {}, { query, users: {} }, {});
  expect(r).toMatchObject({ over: false, unchecked: true });
});
