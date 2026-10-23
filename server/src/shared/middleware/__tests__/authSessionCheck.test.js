'use strict';

/**
 * requireAuth and the device-session check: a revoked device is told so (and signed out by
 * the app), but a database that can't be reached must not look like a revocation.
 */

process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';

const mockStatus = jest.fn();
jest.mock('../../../services/deviceSession.service', () => ({
  sessionStatus: (...args) => mockStatus(...args),
  updateSessionActivity: jest.fn(),
}));
jest.mock('../../../services/securityAudit.service', () => ({ logSecurityEvent: jest.fn() }));
jest.mock('../../../identity', () => ({}));

const jwt = require('jsonwebtoken');
const requireAuth = require('../auth');

function run() {
  const token = jwt.sign({ sub: 'u1' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
  const req = { headers: { authorization: `Bearer ${token}`, 'x-device-id': 'device-1' }, cookies: {} };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let passed = false;
  return requireAuth(req, res, () => { passed = true; }).then(() => ({ req, res, passed }));
}

describe('requireAuth device-session check', () => {
  test('an active session passes', async () => {
    mockStatus.mockResolvedValue('active');
    const { passed, req } = await run();
    expect(passed).toBe(true);
    expect(req.deviceId).toBe('device-1');
  });

  test('a revoked session gets DEVICE_REVOKED', async () => {
    mockStatus.mockResolvedValue('revoked');
    const { passed, res } = await run();
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('DEVICE_REVOKED');
  });

  test('a failed check refuses the request without signing the device out', async () => {
    mockStatus.mockResolvedValue('unknown');
    const { passed, res } = await run();
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('SESSION_CHECK_UNAVAILABLE');
  });
});
