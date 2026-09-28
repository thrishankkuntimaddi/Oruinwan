'use strict';

/**
 * PATCH /api/departments/:id { head }: a manager head is added to dept.managers
 * and gets the department in managedDepartments; the previous head loses it
 * unless still listed in dept.managers. companyRole never changes.
 * Plus: admin users-access counts invited users as pending, and department
 * workspaces are found by Workspace.department within the company.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../../models/User', () => require('../../../shared/__tests__/gateHarness').userModel());
jest.mock('../../../../models/Department', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../../../models/Workspace', () => ({ find: jest.fn() }));

const h = require('../../../shared/__tests__/gateHarness');
const User = require('../../../../models/User');
const Department = require('../../../../models/Department');
const Workspace = require('../../../../models/Workspace');

const departmentsRoutes = require('../departments.routes');
const adminDashboardRoutes = require('../../admin/admin-dashboard.routes');
const adminRoutes = require('../../admin/admin.routes');
jest.setTimeout(30000);

const C1 = h.oid(0xc1);
const ADMIN = h.oid(1);
const MGR_NEW = h.oid(2);
const MGR_OLD = h.oid(3);
const MEMBER = h.oid(4);
const DEPT = h.oid(0x50);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/departments', departmentsRoutes);
    a.use('/api/admin-dashboard', adminDashboardRoutes);
    a.use('/api/admin', adminRoutes);
    return a;
}

let stored;
beforeEach(() => {
    const base = { accountStatus: 'active' };
    Object.assign(h.users, {
        [ADMIN]: { _id: ADMIN, companyId: C1, companyRole: 'admin', ...base },
        [MGR_NEW]: { _id: MGR_NEW, companyId: C1, companyRole: 'manager', ...base },
        [MGR_OLD]: { _id: MGR_OLD, companyId: C1, companyRole: 'manager', ...base },
        [MEMBER]: { _id: MEMBER, companyId: C1, companyRole: 'member', ...base },
    });
    stored = { _id: DEPT, company: C1, head: MGR_OLD, managers: [], workspaces: [] };
    Department.findOne.mockImplementation(() => h.query({ ...stored }));
    Department.findOneAndUpdate.mockImplementation((q, update) => {
        stored = { ...stored, ...update.$set };
        if (update.$addToSet) stored.managers = [...new Set([...stored.managers.map(String), String(update.$addToSet.managers)])];
        return h.query({ ...stored });
    });
    User.findOne.mockImplementation((q) => {
        const u = h.users[String(q._id)];
        return h.query(u && String(u.companyId) === String(q.companyId) ? u : null);
    });
    User.updateOne.mockClear();
});

describe('PATCH /api/departments/:id head', () => {
    const patch = (body) => h.call(app(), 'PATCH', `/api/departments/${DEPT}`, ADMIN, body);

    it('adds a manager head to managers and managedDepartments; the old head loses it', async () => {
        expect((await patch({ head: MGR_NEW })).status).toBe(200);
        expect(stored.managers).toContain(MGR_NEW);
        expect(User.updateOne).toHaveBeenCalledWith({ _id: MGR_NEW }, { $addToSet: { managedDepartments: DEPT } });
        expect(User.updateOne).toHaveBeenCalledWith({ _id: MGR_OLD }, { $pull: { managedDepartments: DEPT } });
        expect(User.updateOne.mock.calls.some(([, u]) => u.$set && 'companyRole' in u.$set)).toBe(false);
    });
    it('keeps the old head\'s access when they are still a listed manager', async () => {
        stored.managers = [MGR_OLD];
        await patch({ head: MGR_NEW });
        expect(User.updateOne).not.toHaveBeenCalledWith({ _id: MGR_OLD }, expect.anything());
    });
    it('a member head is not made a manager; clearing the head removes the old head\'s access', async () => {
        await patch({ head: MEMBER });
        expect(stored.managers).not.toContain(MEMBER);
        expect(User.updateOne).not.toHaveBeenCalledWith({ _id: MEMBER }, expect.anything());
        User.updateOne.mockClear();
        stored.head = MGR_OLD;
        await patch({ head: null });
        expect(User.updateOne).toHaveBeenCalledWith({ _id: MGR_OLD }, { $pull: { managedDepartments: DEPT } });
    });
    it('rejects a head from outside the company', async () => {
        expect((await patch({ head: h.oid(99) })).status).toBe(400);
    });
});

describe('admin routes', () => {
    it('users-access counts invited users as pending', async () => {
        await h.call(app(), 'GET', '/api/admin-dashboard/users-access', ADMIN);
        expect(User.countDocuments).toHaveBeenCalledWith({ companyId: C1, accountStatus: { $in: ['pending', 'invited'] } });
    });
    it('department workspaces use Workspace.department within the company', async () => {
        Workspace.find.mockImplementation(() => h.query([]));
        const res = await h.call(app(), 'GET', `/api/admin/departments/${DEPT}/workspaces`, ADMIN);
        expect(res.status).toBe(200);
        expect(Workspace.find.mock.calls[0][0]).toEqual({ company: C1, $or: [{ department: DEPT }, { _id: { $in: [] } }] });
    });
});
