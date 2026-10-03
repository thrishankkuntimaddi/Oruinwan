'use strict';

jest.mock('../../identity', () => ({
  users: { findById: jest.fn(async () => ({ email: 'a@x.test', companyRole: 'admin' })) },
}));
jest.mock('../../../models/AuditLog', () => ({ create: jest.fn(async (d) => d) }));
jest.mock('../../../models/ComplianceLog', () => ({ create: jest.fn(async (d) => d) }));

const AuditLog = require('../../../models/AuditLog');
const ComplianceLog = require('../../../models/ComplianceLog');
const { recordAdminAction } = require('../adminAudit');

beforeEach(() => jest.clearAllMocks());

describe('recordAdminAction', () => {
  test('company actions go to both logs', async () => {
    await recordAdminAction({ userId: 'u', companyId: 'c', action: 'x', category: 'permissions', req: { ip: '1.2.3.4', get: () => 'ua' } });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'permissions', ipAddress: '1.2.3.4', userAgent: 'ua' }));
    expect(ComplianceLog.create).toHaveBeenCalledWith(expect.objectContaining({ actorEmail: 'a@x.test', actorRole: 'admin' }));
  });

  test('personal workspaces only write the audit log', async () => {
    await recordAdminAction({ userId: 'u', companyId: null, action: 'x' });
    expect(AuditLog.create).toHaveBeenCalled();
    expect(ComplianceLog.create).not.toHaveBeenCalled();
  });

  test('categories each log does not accept are mapped instead of failing validation', async () => {
    await recordAdminAction({ userId: 'u', companyId: 'c', action: 'x', category: 'data-export' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'workspace' }));
    expect(ComplianceLog.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'data-export' }));
    await recordAdminAction({ userId: 'u', companyId: 'c', action: 'x', category: 'messaging' });
    expect(ComplianceLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'workspace' }));
  });

  test('a failed write never throws', async () => {
    AuditLog.create.mockRejectedValueOnce(new Error('db down'));
    await expect(recordAdminAction({ userId: 'u', action: 'x' })).resolves.toBeUndefined();
  });
});
