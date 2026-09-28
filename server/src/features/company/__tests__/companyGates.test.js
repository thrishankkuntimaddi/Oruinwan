'use strict';

/**
 * Company routes: own-company only, role ceilings, owner-only fields, and
 * metrics/analytics closed to non-admins and other companies.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../../models/User', () => require('../../../shared/__tests__/gateHarness').userModel());
jest.mock('../../../../models/Company', () => ({
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(async () => ({})),
}));
jest.mock('../../../../models/Workspace', () => ({ countDocuments: jest.fn(async () => 2), find: jest.fn() }));
jest.mock('../../../../models/Department', () => ({ countDocuments: jest.fn(async () => 3), find: jest.fn() }));
jest.mock('../../../modules/uploads/upload.service', () => ({ uploadToGCS: jest.fn() }));
jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn(async () => {}) }));
jest.mock('../../employees/employee.service', () => ({ inviteEmployee: jest.fn(async () => ({ inviteId: 'inv1', emailSent: false })) }));
jest.mock('../metrics.service', () => ({ getCompanyAnalytics: jest.fn(async () => ({ ok: true })) }));

const h = require('../../../shared/__tests__/gateHarness');
const Company = require('../../../../models/Company');
const User = require('../../../../models/User');
const employeeService = require('../../employees/employee.service');

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const OWNER = h.oid(1);
const ADMIN = h.oid(2);
const MEMBER = h.oid(3);
const OTHER_ADMIN = h.oid(4);
const ADMIN_B = h.oid(5);

// Load the routers up front: the first require is slow under a parallel run.
const companyRoutes = require('../company.routes');
const metricsRoutes = require('../metrics.routes');
const employeeRoutes = require('../../employees/employee.routes');
jest.setTimeout(30000);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/companies', companyRoutes);
    a.use('/api/companies', metricsRoutes);
    a.use('/api/companies', employeeRoutes);
    return a;
}

beforeEach(() => {
    const base = { accountStatus: 'active' };
    Object.assign(h.users, {
        [OWNER]: { _id: OWNER, companyId: C1, companyRole: 'owner', ...base },
        [ADMIN]: { _id: ADMIN, companyId: C1, companyRole: 'admin', ...base },
        [MEMBER]: { _id: MEMBER, companyId: C1, companyRole: 'member', ...base },
        [OTHER_ADMIN]: { _id: OTHER_ADMIN, companyId: C1, companyRole: 'admin', ...base },
        [ADMIN_B]: { _id: ADMIN_B, companyId: C2, companyRole: 'admin', ...base },
    });
    Company.findById.mockImplementation((id) => h.query({ _id: id, name: 'Acme', admins: [], save: jest.fn() }));
    Company.findByIdAndUpdate.mockImplementation((id, update) => h.query({ _id: id, ...update.$set }));
});

describe('PUT /api/companies/:id', () => {
    it('lets an admin edit profile fields and drops protected ones', async () => {
        const res = await h.call(app(), 'PUT', `/api/companies/${C1}`, ADMIN, { name: 'New', verificationStatus: 'verified', admins: [] });
        expect(res.status).toBe(200);
        expect(Company.findByIdAndUpdate.mock.calls[0][1]).toEqual({ $set: { name: 'New' } });
    });
    it('rejects plan changes by an admin but allows the owner', async () => {
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}`, ADMIN, { plan: 'enterprise' })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}`, OWNER, { plan: 'enterprise' })).status).toBe(200);
    });
    it('blocks members and other companies', async () => {
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}`, MEMBER, { name: 'x' })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}`, ADMIN_B, { name: 'x' })).status).toBe(403);
        expect(Company.findByIdAndUpdate).not.toHaveBeenCalled();
    });
});

describe('PUT /api/companies/:id/members/:userId/role', () => {
    beforeEach(() => {
        User.findById.mockImplementation((id) => {
            const u = h.users[String(id)];
            if (!u) return h.query(null);
            return h.query({ ...u, username: 'u', save: jest.fn(async () => {}) });
        });
    });
    it('accepts the role from `role` (was always 400) for an owner', async () => {
        const res = await h.call(app(), 'PUT', `/api/companies/${C1}/members/${MEMBER}/role`, OWNER, { role: 'manager' });
        expect(res.status).toBe(200);
        expect(res.body.companyRole).toBe('manager');
    });
    it('stops an admin from granting admin or touching another admin', async () => {
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}/members/${MEMBER}/role`, ADMIN, { role: 'admin' })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}/members/${OTHER_ADMIN}/role`, ADMIN, { role: 'member' })).status).toBe(403);
    });
    it('never grants owner and never crosses companies', async () => {
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}/members/${MEMBER}/role`, OWNER, { role: 'owner' })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}/members/${MEMBER}/role`, ADMIN_B, { role: 'guest' })).status).toBe(403);
    });
});

describe('GET /api/companies/:id/metrics and /analytics', () => {
    it('serves the company admin', async () => {
        const res = await h.call(app(), 'GET', `/api/companies/${C1}/metrics`, ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.metrics).toMatchObject({ totalWorkspaces: 2, totalDepartments: 3 });
        expect((await h.call(app(), 'GET', `/api/companies/${C1}/analytics`, OWNER)).status).toBe(200);
    });
    it('refuses members and admins of another company', async () => {
        expect((await h.call(app(), 'GET', `/api/companies/${C1}/metrics`, MEMBER)).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/companies/${C1}/analytics`, MEMBER)).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/companies/${C1}/analytics`, ADMIN_B)).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/companies/${C1}/metrics`, ADMIN_B)).status).toBe(403);
    });
});

describe('POST /api/companies/:id/invite', () => {
    it('invites into the caller\'s own company with the right field names', async () => {
        const res = await h.call(app(), 'POST', `/api/companies/${C1}/invite`, ADMIN, { email: 'new@acme.test', role: 'manager' });
        expect(res.status).toBe(200);
        expect(employeeService.inviteEmployee).toHaveBeenCalledWith(expect.objectContaining({ companyId: C1, invitedBy: ADMIN, departmentIds: [], role: 'manager' }));
    });
    it('refuses another company (the owner-takeover hole)', async () => {
        const res = await h.call(app(), 'POST', `/api/companies/${C1}/invite`, ADMIN_B, { email: 'evil@x.test', role: 'admin' });
        expect(res.status).toBe(403);
        expect(employeeService.inviteEmployee).not.toHaveBeenCalled();
    });
    it('never invites an owner; only owners invite admins; members cannot invite', async () => {
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/invite`, OWNER, { email: 'a@b.c', role: 'owner' })).status).toBe(403);
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/invite`, ADMIN, { email: 'a@b.c', role: 'admin' })).status).toBe(403);
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/invite`, OWNER, { email: 'a@b.c', role: 'admin' })).status).toBe(200);
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/invite`, MEMBER, { email: 'a@b.c' })).status).toBe(403);
    });
    it('answers bulk/direct-create with 501 instead of crashing', async () => {
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/invite/bulk`, ADMIN, { employees: [{}] })).status).toBe(501);
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/employees/create`, ADMIN, {})).status).toBe(501);
    });
});

describe('GET /api/companies/:id', () => {
    it('is closed to accounts of another company', async () => {
        expect((await h.call(app(), 'GET', `/api/companies/${C1}`, ADMIN_B)).status).toBe(403);
    });
});
