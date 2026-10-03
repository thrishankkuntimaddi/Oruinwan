'use strict';

/**
 * /api/manager/dashboard/{metrics,team-load,unassigned,reports}/:departmentId —
 * own company only; plain managers only for departments they manage.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../shared/middleware/permissionMiddleware', () => ({
    requireManager: (req, res, next) => next(),
}));
jest.mock('../../../identity', () => require('./identityStore').identity);
jest.mock('../../../identity/queries/org', () => require('./identityStore').org);
jest.mock('../../../identity/queries/auth', () => require('./identityStore').auth);
jest.mock('../../../shared/postgres', () => require('./identityStore').postgres);
jest.mock('../../../modules/messages/message.model.js', () => ({ countDocuments: jest.fn(async () => 4) }));
jest.mock('../../../../models/TaskActivity', () => ({ create: jest.fn() }));
jest.mock('../../../../models/Task', () => ({ countDocuments: jest.fn(async () => 0), find: jest.fn(), aggregate: jest.fn(async () => []) }));

const h = require('../../../shared/__tests__/gateHarness');
const store = require('./identityStore');
const Task = require('../../../../models/Task');
const router = require('../manager-dashboard.routes');

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const MANAGER = h.oid(1);
const ADMIN = h.oid(2);
const ENG = h.oid(0x50);
const SALES = h.oid(0x51);
const FOREIGN = h.oid(0x52);


function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/manager', router);
    return a;
}

beforeEach(() => {
    store.reset();
    store.addDepartment({ _id: ENG, company: C1, name: 'Engineering' });
    store.addDepartment({ _id: SALES, company: C1, name: 'Sales' });
    store.addDepartment({ _id: FOREIGN, company: C2, name: 'Theirs' });
    store.addUser({ _id: MANAGER, companyId: C1, companyRole: 'manager', managedDepartments: [ENG] });
    store.addUser({ _id: ADMIN, companyId: C1, companyRole: 'admin' });
    Task.find.mockImplementation(() => h.query([]));
});

const kinds = ['metrics', 'team-load', 'unassigned', 'reports'];

describe.each(kinds)('GET /api/manager/dashboard/%s/:departmentId', (kind) => {
    it('serves a manager their own department', async () => {
        expect((await h.call(app(), 'GET', `/api/manager/dashboard/${kind}/${ENG}`, MANAGER)).status).toBe(200);
    });
    it('refuses a department the manager does not manage', async () => {
        expect((await h.call(app(), 'GET', `/api/manager/dashboard/${kind}/${SALES}`, MANAGER)).status).toBe(403);
    });
    it('lets an admin open any department of their company', async () => {
        expect((await h.call(app(), 'GET', `/api/manager/dashboard/${kind}/${SALES}`, ADMIN)).status).toBe(200);
    });
    it('hides other companies\' departments', async () => {
        expect((await h.call(app(), 'GET', `/api/manager/dashboard/${kind}/${FOREIGN}`, ADMIN)).status).toBe(404);
    });
});

describe('reports', () => {
    it('reports no average time instead of a made-up one when nothing is done', async () => {
        const res = await h.call(app(), 'GET', `/api/manager/dashboard/reports/${ENG}`, MANAGER);
        expect(res.body.avgTime).toBeNull();
        expect(res.body.completionRate).toBe(0);
    });
});
