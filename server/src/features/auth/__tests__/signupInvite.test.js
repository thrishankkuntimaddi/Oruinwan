'use strict';

// Signing up with an invite: only a company's invite makes a company account (exempt from the
// free plan); an invite to someone's personal workspace keeps a personal account.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';

const mockBuilt = [];
const mockInvite = { current: null };

jest.mock('../../../shared/redis', () => ({ getRedis: () => null }));
jest.mock('../../../identity/queries/auth', () => ({
  userDocs: {
    build: jest.fn((d) => { const u = { _id: 'new1', workspaces: [], ...d }; mockBuilt.push(u); return u; }),
  },
  emailTaken: jest.fn(async () => false),
  companyByAllowedEmail: jest.fn(async () => null),
  companyForAutoJoin: jest.fn(async () => null),
  invites: { findUsable: jest.fn(async () => mockInvite.current), update: jest.fn(async () => {}) },
}));
jest.mock('../../../identity', () => ({
  users: { findByUsername: jest.fn(async () => null), findByPhone: jest.fn(async () => null) },
  workspaces: { findById: jest.fn(async () => null), addMember: jest.fn(async () => {}) },
}));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn(async () => {}));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const auth = require('../auth.controller');
const { mockReq, mockRes } = require('./memStore');

const body = { username: 'Newbie', email: 'new@example.com', password: 'Passw0rd!x', dob: '1990-01-01', inviteToken: 'tok' };

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilt.length = 0;
});

test('an invite to a personal workspace keeps a personal account', async () => {
  mockInvite.current = { _id: 'i1', company: null, workspace: 'w1', role: 'member', metadata: {} };
  const res = mockRes();
  await auth.signup(mockReq({ body }), res);
  expect(res.statusCode).toBe(201);
  expect(mockBuilt[0]).toMatchObject({ userType: 'personal', companyId: null, companyRole: 'member' });
});

test("a company's invite makes a company account", async () => {
  mockInvite.current = { _id: 'i2', company: 'co1', workspace: null, role: 'manager', metadata: {} };
  const res = mockRes();
  await auth.signup(mockReq({ body }), res);
  expect(res.statusCode).toBe(201);
  expect(mockBuilt[0]).toMatchObject({ userType: 'company', companyId: 'co1', companyRole: 'manager' });
});
