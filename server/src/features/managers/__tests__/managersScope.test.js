'use strict';

/**
 * /api/managers/*: manager-or-above only, scoped to the caller's company, and
 * plain managers limited to the departments they manage.
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
jest.mock('../../../../models/Task', () => ({ find: jest.fn(), countDocuments: jest.fn(async () => 0) }));
jest.mock('../../channels/channel.model.js', () => ({ find: jest.fn() }));

const h = require('../../../shared/__tests__/gateHarness');
const store = require('../../admin/__tests__/identityStore');
const Task = require('../../../../models/Task');

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const MANAGER = h.oid(1);
const ADMIN = h.oid(2);
const MEMBER = h.oid(3);
const OUTSIDER = h.oid(4); // personal account, no company
const ENG = h.oid(0x50);   // managed by MANAGER
const SALES = h.oid(0x51); // same company, not managed
const FOREIGN = h.oid(0x52); // another company

// Load the routers up front: the first require is slow under a parallel run.
const managersRoutes = require('../managers.routes');
jest.setTimeout(30000);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/managers', managersRoutes);
    return a;
}

const OTHER = h.oid(5); // in another company

beforeEach(() => {
    store.reset();
    store.addDepartment({ _id: ENG, company: C1, name: 'Eng' }, { members: [MEMBER] });
    store.addDepartment({ _id: SALES, company: C1, name: 'Sales' });
    store.addDepartment({ _id: FOREIGN, company: C2, name: 'Theirs' }, { members: [OTHER] });
    store.addUser({ _id: MANAGER, companyId: C1, companyRole: 'manager', managedDepartments: [ENG] });
    store.addUser({ _id: ADMIN, companyId: C1, companyRole: 'admin' });
    store.addUser({ _id: MEMBER, companyId: C1, companyRole: 'member', email: 'm@acme.test' });
    store.addUser({ _id: OUTSIDER, companyId: null, companyRole: 'member' });
    store.addUser({ _id: OTHER, companyId: C2, companyRole: 'member', email: 'x@y.z' });
    Task.find.mockImplementation(() => h.query([]));
});

describe('gate', () => {
    it('refuses members and accounts without a company', async () => {
        expect((await h.call(app(), 'GET', `/api/managers/metrics?scopeType=department&scopeId=${ENG}`, MEMBER)).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/managers/tasks?scopeType=department&scopeId=${ENG}`, OUTSIDER)).status).toBe(403);
    });
});

describe('department scope', () => {
    it('lets a manager read the department they manage', async () => {
        const res = await h.call(app(), 'GET', `/api/managers/metrics?scopeType=department&scopeId=${ENG}`, MANAGER);
        expect(res.status).toBe(200);
        // Department managers are department members too (department_members).
        expect(res.body.teamSize).toBe(2);
    });
    it('refuses a department in the same company the manager does not manage', async () => {
        expect((await h.call(app(), 'GET', `/api/managers/metrics?scopeType=department&scopeId=${SALES}`, MANAGER)).status).toBe(403);
    });
    it('lets an admin read any department of their company', async () => {
        expect((await h.call(app(), 'GET', `/api/managers/metrics?scopeType=department&scopeId=${SALES}`, ADMIN)).status).toBe(200);
    });
    it('never reaches another company\'s department', async () => {
        expect((await h.call(app(), 'GET', `/api/managers/metrics?scopeType=department&scopeId=${FOREIGN}`, ADMIN)).status).toBe(404);
        expect((await h.call(app(), 'GET', `/api/managers/tasks?scopeType=department&scopeId=${FOREIGN}`, MANAGER)).status).toBe(404);
    });
});

describe('GET /api/managers/tasks', () => {
    it('requires a scope instead of listing every company\'s tasks', async () => {
        const res = await h.call(app(), 'GET', '/api/managers/tasks', ADMIN);
        expect(res.status).toBe(400);
        expect(Task.find).not.toHaveBeenCalled();
    });
    it('queries only the scoped members and skips private tasks', async () => {
        await h.call(app(), 'GET', `/api/managers/tasks?scopeType=department&scopeId=${ENG}`, MANAGER);
        const q = Task.find.mock.calls[0][0];
        expect(q.assignedTo.$in.map(String).sort()).toEqual([MANAGER, MEMBER].sort());
        expect(q.visibility).toEqual({ $ne: 'private' });
    });
});

describe('POST /api/managers/allocations/department/add', () => {
    it('only finds people in the caller\'s company', async () => {
        const res = await h.call(app(), 'POST', '/api/managers/allocations/department/add', MANAGER, { email: 'x@y.z', departmentId: ENG });
        expect(res.status).toBe(404);
        const ok = await h.call(app(), 'POST', '/api/managers/allocations/department/add', MANAGER, { email: 'm@acme.test', departmentId: ENG });
        expect(ok.status).toBe(200);
        expect(store.state.deptMembers).toContainEqual({ department: ENG, user: MEMBER, role: 'member' });
    });
    it('refuses departments the manager does not manage', async () => {
        const res = await h.call(app(), 'POST', '/api/managers/allocations/department/add', MANAGER, { email: 'x@y.z', departmentId: SALES });
        expect(res.status).toBe(403);
    });
});
