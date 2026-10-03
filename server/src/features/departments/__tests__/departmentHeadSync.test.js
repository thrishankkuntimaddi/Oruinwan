'use strict';

/**
 * PATCH /api/departments/:id { head }: a manager head becomes one of the
 * department's managers (department_members role 'manager'); listed managers
 * keep their role when the head changes; companyRole never changes.
 * Plus: admin users-access counts invited users as pending, and department
 * workspaces are found by workspace.department within the company.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../identity', () => require('../../admin/__tests__/identityStore').identity);
jest.mock('../../../identity/queries/org', () => require('../../admin/__tests__/identityStore').org);
jest.mock('../../../identity/queries/auth', () => require('../../admin/__tests__/identityStore').auth);
jest.mock('../../../shared/postgres', () => require('../../admin/__tests__/identityStore').postgres);

const h = require('../../../shared/__tests__/gateHarness');
const store = require('../../admin/__tests__/identityStore');

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

const managersOf = () => store.state.deptMembers.filter((r) => r.department === DEPT && r.role === 'manager').map((r) => r.user);

beforeEach(() => {
    store.reset();
    store.addCompany({ _id: C1, name: 'Acme' });
    store.addUser({ _id: ADMIN, companyId: C1, companyRole: 'admin' });
    store.addUser({ _id: MGR_NEW, companyId: C1, companyRole: 'manager' });
    store.addUser({ _id: MGR_OLD, companyId: C1, companyRole: 'manager' });
    store.addUser({ _id: MEMBER, companyId: C1, companyRole: 'member' });
    store.addDepartment({ _id: DEPT, company: C1, name: 'Eng', head: MGR_OLD });
});

describe('PATCH /api/departments/:id head', () => {
    const patch = (body) => h.call(app(), 'PATCH', `/api/departments/${DEPT}`, ADMIN, body);

    it('makes a manager head one of the department managers and records the head', async () => {
        expect((await patch({ head: MGR_NEW })).status).toBe(200);
        expect(managersOf()).toContain(MGR_NEW);
        expect(store.state.departments.get(DEPT).head).toBe(MGR_NEW);
        expect(store.state.users.get(MGR_NEW).companyRole).toBe('manager');
    });
    it('keeps a listed manager\'s role when the head changes', async () => {
        store.addDeptMember(DEPT, MGR_OLD, 'manager');
        await patch({ head: MGR_NEW });
        expect(managersOf()).toEqual(expect.arrayContaining([MGR_OLD, MGR_NEW]));
    });
    it('a member head is not made a manager; clearing the head clears it', async () => {
        await patch({ head: MEMBER });
        expect(managersOf()).not.toContain(MEMBER);
        expect((await patch({ head: null })).status).toBe(200);
        expect(store.state.departments.get(DEPT).head).toBeNull();
    });
    it('an explicit managers list replaces the manager set', async () => {
        store.addDeptMember(DEPT, MGR_OLD, 'manager');
        expect((await patch({ managers: [MGR_NEW] })).status).toBe(200);
        expect(managersOf()).toEqual([MGR_NEW]);
    });
    it('rejects a head from outside the company', async () => {
        expect((await patch({ head: h.oid(99) })).status).toBe(400);
    });
});

describe('admin routes', () => {
    it('users-access counts invited users as pending', async () => {
        store.addUser({ _id: h.oid(7), companyId: C1, accountStatus: 'invited' });
        store.addUser({ _id: h.oid(8), companyId: C1, accountStatus: 'pending' });
        const res = await h.call(app(), 'GET', '/api/admin-dashboard/users-access', ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.stats.pending).toBe(2);
    });
    it('department workspaces use workspace.department within the company', async () => {
        store.addWorkspace({ _id: h.oid(0x60), company: C1, name: 'Eng WS', department: DEPT, members: [{ user: MEMBER }] });
        store.addWorkspace({ _id: h.oid(0x61), company: h.oid(0xc2), name: 'Other', department: DEPT });
        store.addWorkspace({ _id: h.oid(0x62), company: C1, name: 'Unrelated' });
        const res = await h.call(app(), 'GET', `/api/admin/departments/${DEPT}/workspaces`, ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.map((w) => w.name)).toEqual(['Eng WS']);
        expect(res.body[0].members[0].user._id).toBe(MEMBER);
    });
});
