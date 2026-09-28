'use strict';

/**
 * Role ceiling on the people routes (/api/company/members/*) and the admin
 * employee routes (/api/admin/employees/*): admins can't mint admins or touch
 * other admins, nobody touches the owner, and everything stays in-company.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../../models/User', () => require('../../../shared/__tests__/gateHarness').userModel());
jest.mock('../../../../models/Company', () => ({ updateOne: jest.fn(async () => ({})), findById: jest.fn() }));
jest.mock('../../../../utils/sendEmail', () => jest.fn(async () => {}));
jest.mock('../../security/security.service', () => ({ logSecurityEvent: jest.fn(async () => {}) }));

const h = require('../../../shared/__tests__/gateHarness');
const User = require('../../../../models/User');
const Company = require('../../../../models/Company');

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const OWNER = h.oid(1);
const ADMIN = h.oid(2);
const ADMIN2 = h.oid(3);
const MEMBER = h.oid(4);
const MANAGER = h.oid(5);
const FOREIGN = h.oid(6);

const saved = [];
function doc(u) {
    const d = { ...u, managedDepartments: [], workspaces: [] };
    d.save = jest.fn(async () => { saved.push({ id: d._id, role: d.companyRole, status: d.accountStatus }); return d; });
    return d;
}

// Load the routers up front: the first require is slow under a parallel run.
const peopleRoutes = require('../people.routes');
const adminRoutes = require('../../admin/admin.routes');
jest.setTimeout(30000);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/company', peopleRoutes);
    a.use('/api/admin', adminRoutes);
    return a;
}

beforeEach(() => {
    saved.length = 0;
    const base = { accountStatus: 'active' };
    Object.assign(h.users, {
        [OWNER]: { _id: OWNER, companyId: C1, companyRole: 'owner', ...base },
        [ADMIN]: { _id: ADMIN, companyId: C1, companyRole: 'admin', ...base },
        [ADMIN2]: { _id: ADMIN2, companyId: C1, companyRole: 'admin', ...base },
        [MEMBER]: { _id: MEMBER, companyId: C1, companyRole: 'member', ...base },
        [MANAGER]: { _id: MANAGER, companyId: C1, companyRole: 'manager', ...base },
        [FOREIGN]: { _id: FOREIGN, companyId: C2, companyRole: 'member', ...base },
    });
    User.findOne.mockImplementation((q) => {
        const u = h.users[String(q._id)];
        return h.query(u && String(u.companyId) === String(q.companyId) ? doc(u) : null);
    });
});

describe('PATCH /api/company/members/:id/role', () => {
    const patch = (who, target, newRole) => h.call(app(), 'PATCH', `/api/company/members/${target}/role`, who, { newRole });

    it('lets an admin make a member a manager', async () => {
        expect((await patch(ADMIN, MEMBER, 'manager')).status).toBe(200);
        expect(saved).toEqual([{ id: MEMBER, role: 'manager', status: 'active' }]);
    });
    it('stops an admin from granting admin or changing another admin', async () => {
        expect((await patch(ADMIN, MEMBER, 'admin')).status).toBe(403);
        expect((await patch(ADMIN, ADMIN2, 'member')).status).toBe(403);
        expect(saved).toEqual([]);
    });
    it('lets the owner grant admin and keeps Company.admins in step', async () => {
        expect((await patch(OWNER, MEMBER, 'admin')).status).toBe(200);
        expect(Company.updateOne).toHaveBeenCalledWith({ _id: C1 }, { $push: { admins: { user: MEMBER, role: 'admin' } } });
    });
    it('never grants owner, never touches the owner, never leaves the company', async () => {
        expect((await patch(OWNER, MEMBER, 'owner')).status).toBe(403);
        expect((await patch(ADMIN, OWNER, 'member')).status).toBe(403);
        expect((await patch(ADMIN, FOREIGN, 'guest')).status).toBe(404);
    });
    it('is closed to managers', async () => {
        expect((await patch(MANAGER, MEMBER, 'guest')).status).toBe(403);
    });
});

describe('PATCH /api/company/members/:id/status', () => {
    it('stops an admin from suspending another admin; owner may', async () => {
        const status = (who, target) => h.call(app(), 'PATCH', `/api/company/members/${target}/status`, who, { status: 'suspended' });
        expect((await status(ADMIN, ADMIN2)).status).toBe(403);
        expect((await status(OWNER, ADMIN2)).status).toBe(200);
    });
});

describe('POST /api/company/invite', () => {
    it('refuses an owner invite and admin invites by admins', async () => {
        const invite = (who, companyRole) => h.call(app(), 'POST', '/api/company/invite', who, { email: 'n@acme.test', companyRole });
        expect((await invite(OWNER, 'owner')).status).toBe(403);
        expect((await invite(ADMIN, 'admin')).status).toBe(403);
    });
});

describe('/api/admin/employees/:id', () => {
    it('change-role: admin cannot mint admins or demote admins', async () => {
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${MEMBER}/change-role`, ADMIN, { role: 'admin' })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${ADMIN2}/change-role`, ADMIN, { role: 'member' })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${MEMBER}/change-role`, ADMIN, { role: 'manager' })).status).toBe(200);
    });
    it('suspend / delete: admins cannot act on admins or the owner', async () => {
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${ADMIN2}/suspend`, ADMIN, {})).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${OWNER}/suspend`, ADMIN, {})).status).toBe(403);
        expect((await h.call(app(), 'DELETE', `/api/admin/employees/${ADMIN2}`, ADMIN)).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${MEMBER}/suspend`, ADMIN, {})).status).toBe(200);
    });
    it('stays inside the company', async () => {
        expect((await h.call(app(), 'PUT', `/api/admin/employees/${FOREIGN}/suspend`, ADMIN, {})).status).toBe(404);
    });
});
