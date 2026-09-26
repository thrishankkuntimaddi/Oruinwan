'use strict';

const users = {
  owner: { companyId: 'c1', companyRole: 'owner' },
  member: { companyId: 'c1', companyRole: 'member' },
  manager: { companyId: 'c1', companyRole: 'manager' },
  personal: { companyId: null },
};
const saved = { 'c1:member': { createChannel: false, createTasks: true } };

jest.mock('../../../models/User', () => ({
  findById: jest.fn((id) => ({ select: () => ({ lean: async () => users[id] || null }) })),
}));
jest.mock('../../../models/Permission', () => ({
  findOne: jest.fn(({ company, role }) => ({ select: () => ({ lean: async () => (saved[`${company}:${role}`] ? { permissions: saved[`${company}:${role}`] } : null) }) })),
}));

const { companyPermission, requireCompanyPermission } = require('../companyPermissions');

describe('company permission matrix', () => {
  test('owners are always allowed', async () => {
    expect(await companyPermission('owner', 'createChannel')).toBe(true);
  });
  test('a saved row decides for that role', async () => {
    expect(await companyPermission('member', 'createChannel')).toBe(false);
    expect(await companyPermission('member', 'createTasks')).toBe(true);
  });
  test('unconfigured roles and personal accounts return null (existing rules apply)', async () => {
    expect(await companyPermission('manager', 'createChannel')).toBeNull();
    expect(await companyPermission('personal', 'createChannel')).toBeNull();
  });
  test('middleware blocks only an explicit deny', async () => {
    const run = (sub) => new Promise((resolve) => {
      const res = { status(c) { this.c = c; return this; }, json(b) { resolve({ blocked: this.c, b }); } };
      requireCompanyPermission('createChannel')({ user: { sub } }, res, () => resolve({ blocked: false }));
    });
    expect(await run('member')).toMatchObject({ blocked: 403, b: { code: 'COMPANY_PERMISSION_DENIED' } });
    expect(await run('manager')).toEqual({ blocked: false });
    expect(await run('personal')).toEqual({ blocked: false });
  });
});
