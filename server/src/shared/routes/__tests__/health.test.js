'use strict';

// /api/health shows internal details (instance, jobs, uptime, environment) only to platform admins.
process.env.ACCESS_TOKEN_SECRET = 'health-test-secret';
const jwt = require('jsonwebtoken');

const mockUsers = { admin: { roles: ['user', 'oruinwan_admin'] }, member: { roles: ['user'] } };
jest.mock('mongoose', () => ({ connection: { readyState: 1 } }));
jest.mock('../../postgres', () => ({ postgresStatus: async () => 'ok' }));
jest.mock('../../jobs/scheduler', () => ({ scheduledJobs: () => ['reminders'] }));
jest.mock('../../redis', () => ({ getRedis: () => null, isRedisConfigured: () => false, INSTANCE_ID: 'host:1:abc' }));
jest.mock('../../../identity', () => ({ users: { findById: async (id) => mockUsers[id] || null } }));

const router = require('../health.routes');
const handler = router.stack.find(l => l.route?.path === '/' && l.route.methods.get).route.stack[0].handle;

async function call(headers = {}) {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ headers }, res);
  return res;
}
const bearer = (sub) => ({ authorization: `Bearer ${jwt.sign({ sub }, process.env.ACCESS_TOKEN_SECRET)}` });
const INTERNAL = ['instance', 'jobs', 'uptime', 'environment', 'role'];

test('anonymous callers get the up/down states only', async () => {
  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({ status: 'healthy', mongodb: 'connected', postgres: 'ok' });
  for (const k of INTERNAL) expect(res.body).not.toHaveProperty(k);
});

test('a signed-in member who is not a platform admin gets no details', async () => {
  const res = await call(bearer('member'));
  for (const k of INTERNAL) expect(res.body).not.toHaveProperty(k);
});

test('a forged token gets no details', async () => {
  const res = await call({ authorization: `Bearer ${jwt.sign({ sub: 'admin' }, 'wrong-secret')}` });
  for (const k of INTERNAL) expect(res.body).not.toHaveProperty(k);
});

test('a platform admin gets the details the admin dashboards show', async () => {
  const res = await call(bearer('admin'));
  expect(res.body).toMatchObject({ status: 'healthy', instance: 'host:1:abc', jobs: ['reminders'] });
  expect(typeof res.body.uptime).toBe('number');
  expect(res.body.environment).toBeTruthy();
});
