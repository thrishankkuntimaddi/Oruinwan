'use strict';

const users = {
  adminA: { companyId: 'A', companyRole: 'admin', roles: ['user'] },
  memberA: { companyId: 'A', companyRole: 'member', roles: ['user'] },
  coOwnerA: { companyId: 'A', companyRole: 'member', coOwnerOf: 'A', roles: ['user'] },
  staff: { companyId: null, companyRole: null, roles: ['chttrix_admin'] },
  personal: { companyId: null, companyRole: 'member', roles: ['user'] },
};
jest.mock('../../../../models/User', () => ({
  findById: jest.fn((id) => ({ select: () => ({ lean: async () => users[id] || null }) })),
}));

const requireCompanyAdmin = require('../requireCompanyAdmin');
const { scopedCompanyId } = requireCompanyAdmin;

function run(userId) {
  const req = { user: { sub: userId } };
  const res = { statusCode: 200, body: null, headersSent: false, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; this.headersSent = true; return this; } };
  return new Promise((resolve) => {
    requireCompanyAdmin(req, res, () => resolve({ req, res, passed: true })).then(() => {
      if (res.headersSent) resolve({ req, res, passed: false });
    });
  });
}

describe('requireCompanyAdmin', () => {
  test('company admins and co-owners pass with their own company pinned', async () => {
    for (const id of ['adminA', 'coOwnerA']) {
      const { req, passed } = await run(id);
      expect(passed).toBe(true);
      expect(req.companyId).toBe('A');
      expect(req.isPlatformAdmin).toBe(false);
      expect(req.user.sub).toBe(id); // req.user is not replaced
    }
  });

  test('members and personal accounts are refused', async () => {
    for (const id of ['memberA', 'personal']) {
      const { res, passed } = await run(id);
      expect(passed).toBe(false);
      expect(res.statusCode).toBe(403);
    }
  });

  test('platform staff pass', async () => {
    const { req, passed } = await run('staff');
    expect(passed).toBe(true);
    expect(req.isPlatformAdmin).toBe(true);
  });
});

describe('scopedCompanyId', () => {
  const res = () => ({ statusCode: 200, headersSent: false, status(c) { this.statusCode = c; return this; }, json() { this.headersSent = true; return this; } });

  test('a company admin gets their own company, and asking for another is refused', () => {
    const req = { companyId: 'A', isPlatformAdmin: false };
    expect(scopedCompanyId(req, res(), undefined)).toBe('A');
    expect(scopedCompanyId(req, res(), 'A')).toBe('A');
    const r = res();
    expect(scopedCompanyId(req, r, 'B')).toBeNull();
    expect(r.statusCode).toBe(403);
  });

  test('platform staff may choose any company', () => {
    expect(scopedCompanyId({ companyId: null, isPlatformAdmin: true }, res(), 'B')).toBe('B');
  });
});
