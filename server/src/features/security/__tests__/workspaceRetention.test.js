'use strict';

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  req.user = { sub: req.headers['x-user'] };
  next();
});

const WS = 'f00000000000000000000001';
const ADMIN = 'a00000000000000000000001';
const MEMBER = 'a00000000000000000000002';
const HELD = 'a00000000000000000000003';

const mockState = { retention: null, WS, ADMIN, MEMBER, HELD };
jest.mock('../../../identity/queries/security', () => ({
  ...jest.requireActual('../../../identity/queries/security'),
  workspaceRetention: jest.fn(async () => mockState.retention),
  setWorkspaceRetention: jest.fn(async (_id, value) => { mockState.retention = value; return value; }),
  workspacesWithRetention: jest.fn(async () => (mockState.retention ? [{ _id: mockState.WS, companyId: null, retention: mockState.retention }] : [])),
  legalHoldUserIds: jest.fn(async () => [mockState.HELD]),
  usersWithRetention: jest.fn(async () => []),
}));
jest.mock('../../../shared/utils/workspaceAccess', () => ({
  ...jest.requireActual('../../../shared/utils/workspaceAccess'),
  assertWorkspaceMember: jest.fn(async (wsId, userId, { adminOnly } = {}) => {
    const role = { [mockState.ADMIN]: 'admin', [mockState.MEMBER]: 'member' }[userId];
    if (!role) throw Object.assign(new Error('You are not a member of this workspace'), { status: 403 });
    if (adminOnly && role !== 'admin') throw Object.assign(new Error('Workspace admin or owner required'), { status: 403 });
    return { workspace: { _id: wsId, company: null }, role, isAdmin: role === 'admin' };
  }),
  sendAccessError: (res, err) => res.status(err.status || 500).json({ message: err.message }),
}));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const AuditLog = require('../../../../models/AuditLog');
const router = require('../gdpr.routes');
const retention = require('../retention.cron');

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

const path = `/api/compliance/workspaces/${WS}/retention-policy`;

describe('workspace retention policy API', () => {
  beforeEach(() => { mockState.retention = null; });

  test('members can read it, only admins can set it', async () => {
    expect((await call('GET', path, MEMBER)).body).toMatchObject({ workspaceId: WS, retentionDays: null, legalHoldRespected: true });
    expect((await call('PATCH', path, MEMBER, { retentionDays: 30 })).status).toBe(403);
    const res = await call('PATCH', path, ADMIN, { retentionDays: 30 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ retentionDays: 30, setBy: ADMIN });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'compliance.workspace_retention_updated', resourceId: WS }));
  });

  test('validates the number of days and accepts null to clear', async () => {
    expect((await call('PATCH', path, ADMIN, { retentionDays: 0 })).status).toBe(400);
    expect((await call('PATCH', path, ADMIN, { retentionDays: 4000 })).status).toBe(400);
    expect((await call('PATCH', path, ADMIN, { retentionDays: '30' })).status).toBe(400);
    mockState.retention = { days: 10, setBy: ADMIN };
    const res = await call('PATCH', path, ADMIN, { retentionDays: null });
    expect(res.body.retentionDays).toBeNull();
  });
});

describe('workspace retention enforcement', () => {
  test('filter spares legal-hold senders and their DMs', () => {
    const cutoff = new Date('2026-01-01');
    expect(retention.workspacePurgeFilter(WS, cutoff, [HELD], ['dm1'])).toEqual({
      workspace: WS,
      createdAt: { $lt: cutoff },
      type: { $ne: 'system' },
      isDeletedUniversally: { $ne: true },
      sender: { $nin: [HELD] },
      dm: { $nin: ['dm1'] },
    });
  });

  test('tombstones expired messages and audits the run', async () => {
    mockState.retention = { days: 30, setBy: ADMIN };
    const Message = { updateMany: jest.fn(async () => ({ modifiedCount: 4 })) };
    const DMSession = { find: jest.fn(() => ({ select: () => ({ lean: async () => [{ _id: 'dm1' }] }) })) };
    const result = await retention.runWorkspaceRetention({ Message, DMSession, AuditLog });

    expect(result).toEqual({ workspacesProcessed: 1, purged: 4 });
    expect(DMSession.find).toHaveBeenCalledWith({ workspace: WS, participants: { $in: [HELD] } });
    const [filter, update] = Message.updateMany.mock.calls[0];
    expect(filter.sender).toEqual({ $nin: [HELD] });
    expect(filter.dm).toEqual({ $nin: ['dm1'] });
    const cutoffAgeDays = (Date.now() - filter.createdAt.$lt.getTime()) / 86400000;
    expect(Math.round(cutoffAgeDays)).toBe(30);
    expect(update.$set).toMatchObject({ isDeletedUniversally: true, text: '', deletedByName: 'Retention policy' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'compliance.workspace_retention_enforced', userId: ADMIN }));
  });

  test('no policies: nothing happens', async () => {
    mockState.retention = null;
    const Message = { updateMany: jest.fn() };
    expect(await retention.runWorkspaceRetention({ Message, DMSession: null, AuditLog })).toEqual({ workspacesProcessed: 0, purged: 0 });
    expect(Message.updateMany).not.toHaveBeenCalled();
  });
});
