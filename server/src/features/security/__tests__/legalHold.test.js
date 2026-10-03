'use strict';

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  req.user = { sub: req.headers['x-user'] };
  next();
});

// 24-hex ids so isValidId accepts them.
const ID = {
  adminA: 'a00000000000000000000001',
  memberA: 'a00000000000000000000002',
  targetA: 'a00000000000000000000003',
  targetB: 'b00000000000000000000001',
  staff: 'c00000000000000000000001',
};
// Legal hold is stored as users.legal_hold jsonb: { enabled, reason, setBy, at }.
const mockUsers = {
  [ID.adminA]: { _id: ID.adminA, username: 'adminA', companyId: 'A', companyRole: 'admin', roles: ['user'] },
  [ID.memberA]: { _id: ID.memberA, username: 'memberA', companyId: 'A', companyRole: 'member', roles: ['user'], legalHold: { enabled: false } },
  [ID.targetA]: { _id: ID.targetA, username: 'targetA', companyId: 'A', companyRole: 'member', roles: ['user'], legalHold: { enabled: true, reason: 'Litigation' } },
  [ID.targetB]: { _id: ID.targetB, username: 'targetB', companyId: 'B', companyRole: 'member', roles: ['user'], legalHold: { enabled: false } },
  [ID.staff]: { _id: ID.staff, username: 'staff', companyId: null, companyRole: 'member', roles: ['chttrix_admin'] },
};

// Every identity repository resolves users through users.repo, so mocking it covers them all.
jest.mock('../../../identity/users.repo', () => ({
  ...jest.requireActual('../../../identity/users.repo'),
  toUser: (u) => u,
  findById: jest.fn(async (id) => (mockUsers[String(id)] ? { ...mockUsers[String(id)] } : null)),
  findManyByIds: jest.fn(async (ids) => new Map(ids.filter((i) => mockUsers[i]).map((i) => [i, mockUsers[i]]))),
  update: jest.fn(async (id, patch) => {
    const u = mockUsers[String(id)];
    if (!u) return null;
    Object.assign(u, patch);
    return { ...u };
  }),
}));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const users = require('../../../identity/users.repo');
const router = require('../gdpr.routes');

function call(method, path, userId, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/compliance', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        port: server.address().port, path, method,
        headers: { 'x-user': userId, 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

describe('legal hold authorization', () => {
  test('anyone can read their own status via /legal-hold/me', async () => {
    const res = await call('GET', '/api/compliance/legal-hold/me', ID.targetA);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: ID.targetA, legalHold: true, reason: 'Litigation' });
  });

  test('a user may GET their own id', async () => {
    const res = await call('GET', `/api/compliance/legal-hold/${ID.memberA}`, ID.memberA);
    expect(res.status).toBe(200);
    expect(res.body.legalHold).toBe(false);
  });

  test('a regular member cannot read or set someone else\'s hold', async () => {
    const read = await call('GET', `/api/compliance/legal-hold/${ID.targetA}`, ID.memberA);
    expect(read.status).toBe(403);
    const write = await call('PATCH', `/api/compliance/legal-hold/${ID.targetA}`, ID.memberA, { legalHold: false });
    expect(write.status).toBe(403);
    expect(users.update).not.toHaveBeenCalled();
    expect(mockUsers[ID.targetA].legalHold.enabled).toBe(true);
  });

  test('a user cannot set a hold on themself', async () => {
    const res = await call('PATCH', `/api/compliance/legal-hold/${ID.memberA}`, ID.memberA, { legalHold: true });
    expect(res.status).toBe(403);
  });

  test('a company admin manages users of their own company only', async () => {
    const own = await call('PATCH', `/api/compliance/legal-hold/${ID.targetA}`, ID.adminA, { legalHold: false });
    expect(own.status).toBe(200);
    expect(own.body.legalHold).toBe(false);

    const other = await call('PATCH', `/api/compliance/legal-hold/${ID.targetB}`, ID.adminA, { legalHold: true });
    expect(other.status).toBe(403);
    const otherRead = await call('GET', `/api/compliance/legal-hold/${ID.targetB}`, ID.adminA);
    expect(otherRead.status).toBe(403);
  });

  test('platform staff can manage anyone', async () => {
    const res = await call('PATCH', `/api/compliance/legal-hold/${ID.targetB}`, ID.staff, { legalHold: true, reason: 'Audit' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ legalHold: true, reason: 'Audit' });
  });

  test('validates the body and id', async () => {
    expect((await call('PATCH', `/api/compliance/legal-hold/${ID.targetA}`, ID.adminA, { legalHold: 'yes' })).status).toBe(400);
    expect((await call('PATCH', '/api/compliance/legal-hold/not-an-id', ID.adminA, { legalHold: true })).status).toBe(400);
  });
});

describe('retention policy validation', () => {
  test('accepts integers 1..3650 or null only', async () => {
    for (const bad of [0, -1, 3651, 1.5, '30']) {
      expect((await call('PATCH', '/api/compliance/retention-policy', ID.memberA, { retentionDays: bad })).status).toBe(400);
    }
    const ok = await call('PATCH', '/api/compliance/retention-policy', ID.memberA, { retentionDays: 30 });
    expect(ok.status).toBe(200);
    expect(ok.body.retentionDays).toBe(30);
    const off = await call('PATCH', '/api/compliance/retention-policy', ID.memberA, { retentionDays: null });
    expect(off.status).toBe(200);
    expect(off.body.retentionDays).toBeNull();
  });
});
