'use strict';

/**
 * Privacy: company, owner, admin and manager consoles never read, count or return
 * messages. Messages are end-to-end encrypted and only their participants read them.
 *
 * Every console endpoint that used to count messages is called here with the message
 * model replaced by a tripwire: any use of it fails the test, and no response may carry a
 * message-shaped field (messages, messageCount, totalMessages, dailyMessages, ...).
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../shared/featureFlags', () => ({ requireFlag: () => (req, res, next) => next() }));
jest.mock('../../../identity', () => require('./identityStore').identity);
jest.mock('../../../identity/queries/org', () => require('./identityStore').org);
jest.mock('../../../identity/queries/auth', () => require('./identityStore').auth);
jest.mock('../../../shared/postgres', () => require('./identityStore').postgres);
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (x) => x) }));

// Tripwire: the message model must not be touched by any console code path.
const mockMessageUses = [];
jest.mock('../../../modules/messages/message.model.js', () => new Proxy({}, {
    get: (_t, key) => {
        if (typeof key === 'symbol' || key === '__esModule' || key === 'then') return undefined;
        mockMessageUses.push(String(key));
        return () => { throw new Error(`Message model used: ${String(key)}`); };
    },
}));

jest.mock('../../tasks/tasks.query', () => ({
    countDocuments: jest.fn(async () => 2),
    find: jest.fn(async () => []),
    groupCount: jest.fn(async () => []),
    statusCounts: jest.fn(async () => []),
    totals: jest.fn(async () => ({ total: 4, completed: 1 })),
    avgCompletionHours: jest.fn(async () => null),
    countBuckets: jest.fn(async (_f, _field, buckets) => buckets.map(() => 1)),
}));
jest.mock('../../channels/channel.model.js', () => {
    const q = (v) => { const o = { select: () => o, lean: () => Promise.resolve(v), sort: () => o, limit: () => o }; return o; };
    return {
        countDocuments: jest.fn(async () => 3),
        find: jest.fn(() => q([{ _id: 'c1', name: 'general', members: [1, 2, 3] }])),
    };
});
jest.mock('../../../../models/Update', () => ({ countDocuments: jest.fn(async () => 1), find: jest.fn() }));
jest.mock('../../../../models/AuditLog', () => ({ countDocuments: jest.fn(async () => 0), find: jest.fn() }));

const h = require('../../../shared/__tests__/gateHarness');
const store = require('./identityStore');

const ownerRoutes = require('../owner-dashboard.routes');
const managerRoutes = require('../manager-dashboard.routes');
const adminDashRoutes = require('../admin-dashboard.routes');
const companyAnalyticsRoutes = require('../../company-analytics/analytics.routes');
const analyticsRoutes = require('../../analytics/analytics.routes');
const dashboardRoutes = require('../../dashboard/dashboard.routes');
const metricsService = require('../../company/metrics.service');
jest.setTimeout(30000);

const C1 = h.oid(0xc1);
const OWNER = h.oid(1);
const ADMIN = h.oid(2);
const MANAGER = h.oid(3);
const MEMBER = h.oid(4);
const WS = h.oid(0x90);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/owner-dashboard', ownerRoutes);
    a.use('/api/manager', managerRoutes);
    a.use('/api/admin-dashboard', adminDashRoutes);
    a.use('/api/company', companyAnalyticsRoutes);
    a.use('/api/analytics', analyticsRoutes);
    a.use('/api/dashboard', dashboardRoutes);
    return a;
}

/** Every key path in a JSON value whose name is about messages. */
function messageKeys(value, path = '') {
    if (Array.isArray(value)) return value.flatMap((v, i) => messageKeys(v, `${path}[${i}]`));
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([k, v]) => [
        ...(/messag|msg|sender/i.test(k) ? [`${path}.${k}`] : []),
        ...messageKeys(v, `${path}.${k}`),
    ]);
}

beforeEach(() => {
    mockMessageUses.length = 0;
    store.reset();
    store.addCompany({ _id: C1, name: 'Northwind Labs' }, { admins: [{ user: OWNER, role: 'owner' }] });
    store.addUser({ _id: OWNER, companyId: C1, companyRole: 'owner', lastLoginAt: new Date() });
    store.addUser({ _id: ADMIN, companyId: C1, companyRole: 'admin', lastLoginAt: new Date() });
    store.addUser({ _id: MANAGER, companyId: C1, companyRole: 'manager', workspaces: [{ workspace: WS }] });
    store.addUser({ _id: MEMBER, companyId: C1, companyRole: 'member' });
    store.addWorkspace({
        _id: WS, company: C1, name: 'HQ',
        members: [{ user: MEMBER, role: 'member', status: 'active' }, { user: MANAGER, role: 'admin', status: 'active' }],
    });
});

const CASES = [
    ['owner activity health', OWNER, '/api/owner-dashboard/activity-health'],
    ['owner analytics', OWNER, '/api/owner-dashboard/analytics?timeRange=30d'],
    ['owner analytics 7d', OWNER, '/api/owner-dashboard/analytics?timeRange=7d'],
    ['admin workspaces access', ADMIN, '/api/admin-dashboard/workspaces-access'],
    ['company analytics overview', ADMIN, '/api/company/analytics/overview?timeRange=30d'],
    ['company analytics activity', ADMIN, '/api/company/analytics/activity'],
    ['insights summary', ADMIN, '/api/dashboard/analytics/summary'],
    ['insights users', ADMIN, '/api/dashboard/analytics/users'],
    ['insights workspaces', ADMIN, '/api/dashboard/analytics/workspaces'],
    ['insights channels', ADMIN, '/api/dashboard/analytics/channels'],
    ['insights all', ADMIN, '/api/analytics'],
    ['dashboard metrics', ADMIN, `/api/dashboard/metrics/${C1}`],
];

describe.each(CASES)('%s', (_name, user, path) => {
    it('answers without touching or returning messages', async () => {
        const res = await h.call(app(), 'GET', path, user);
        expect(res.status).toBe(200);
        expect(mockMessageUses).toEqual([]);
        expect(messageKeys(res.body)).toEqual([]);
    });
});

describe('per-person rankings', () => {
    it('/api/analytics/insights/team is retired', async () => {
        const res = await h.call(app(), 'GET', '/api/analytics/insights/team', ADMIN);
        expect(res.status).toBe(410);
    });
    it('/api/analytics has no team activity', async () => {
        const res = await h.call(app(), 'GET', '/api/analytics', ADMIN);
        expect(res.body.teamActivity).toBeUndefined();
    });
});

describe('removed message endpoints', () => {
    it.each([
        '/api/dashboard/analytics/messages',
        '/api/analytics/insights/communication',
    ])('%s is gone', async (path) => {
        const res = await h.call(app(), 'GET', path, ADMIN);
        expect(res.status).toBe(404);
        expect(mockMessageUses).toEqual([]);
    });
});

describe('manager workspaces', () => {
    it('reports members and tasks, not messages', async () => {
        const res = await h.call(app(), 'GET', '/api/manager/my-workspaces', MANAGER);
        expect(res.status).toBe(200);
        expect(mockMessageUses).toEqual([]);
        expect(messageKeys(res.body)).toEqual([]);
        expect(res.body.workspaces[0].activity).toEqual(expect.objectContaining({ tasksActive: expect.any(Number) }));
    });
});

describe('company metrics service', () => {
    it('has no per-person activity ranking and no message counts', async () => {
        const out = await metricsService.getCompanyAnalytics(C1);
        expect(mockMessageUses).toEqual([]);
        expect(out.topUsers).toBeUndefined();
        expect(messageKeys(out)).toEqual([]);
    });
});
