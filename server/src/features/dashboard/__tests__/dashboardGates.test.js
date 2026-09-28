'use strict';

/**
 * Company analytics and backups: admins of the caller's own company only.
 * Employee dashboard: yourself, or an admin looking at their own company.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../../models/User', () => require('../../../shared/__tests__/gateHarness').userModel());
jest.mock('../../../../models/Workspace', () => ({ find: jest.fn() }));
jest.mock('../../../modules/messages/message.model.js', () => ({ countDocuments: jest.fn(async () => 0), findOne: jest.fn() }));
jest.mock('../../channels/channel.model.js', () => ({}));
jest.mock('../../../../models/Task', () => ({ find: jest.fn(), countDocuments: jest.fn(async () => 3) }));
jest.mock('../../../../models/Note', () => ({ find: jest.fn(), countDocuments: jest.fn(async () => 2) }));
jest.mock('../../../../models/Update', () => ({ find: jest.fn() }));
jest.mock('../../analytics/analytics.service', () => new Proxy({}, {
    get: (t, name) => (t[name] = t[name] || jest.fn(async (companyId) => ({ companyId: String(companyId), fn: name }))),
}));
jest.mock('../../analytics/analytics.controller', () => ({
    getCompanyAnalytics: (req, res) => res.json({ companyId: req.params.companyId }),
}));
jest.mock('../../security/backup.service', () => ({
    createBackup: jest.fn(async ({ companyId }) => ({ companyId, createdAt: new Date(), recordCount: 1, encryptedPayload: 'x' })),
}));

const h = require('../../../shared/__tests__/gateHarness');
const Task = require('../../../../models/Task');
const Note = require('../../../../models/Note');
const Update = require('../../../../models/Update');
const backupService = require('../../security/backup.service');

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const OWNER = h.oid(1);
const ADMIN = h.oid(2);
const MEMBER = h.oid(3);
const GUEST = h.oid(4);
const ADMIN_B = h.oid(5);
const CO_OWNER = h.oid(6);
const STAFF = h.oid(7);

// Load the routers up front: the first require is slow under a parallel run.
const dashboardRoutes = require('../dashboard.routes');
const analyticsRoutes = require('../../analytics/analytics.routes');
const backupRoutes = require('../../security/backup.routes');
jest.setTimeout(30000);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/dashboard', dashboardRoutes);
    a.use('/api/analytics', analyticsRoutes);
    a.use('/api/security', backupRoutes);
    return a;
}

beforeEach(() => {
    const base = { accountStatus: 'active', roles: ['user'] };
    Object.assign(h.users, {
        [OWNER]: { _id: OWNER, companyId: C1, companyRole: 'owner', ...base },
        [ADMIN]: { _id: ADMIN, companyId: C1, companyRole: 'admin', ...base },
        [MEMBER]: { _id: MEMBER, companyId: C1, companyRole: 'member', ...base },
        [GUEST]: { _id: GUEST, companyId: C1, companyRole: 'guest', ...base },
        [ADMIN_B]: { _id: ADMIN_B, companyId: C2, companyRole: 'admin', ...base },
        [CO_OWNER]: { _id: CO_OWNER, companyId: C1, companyRole: 'member', coOwnerOf: C1, ...base },
        [STAFF]: { _id: STAFF, companyId: null, companyRole: 'member', accountStatus: 'active', roles: ['user', 'chttrix_admin'] },
    });
    Task.find.mockImplementation(() => h.query([{ title: 't' }]));
    Note.find.mockImplementation(() => h.query([]));
    Update.find.mockImplementation(() => h.query([]));
});

describe('GET /api/dashboard/analytics/*', () => {
    it.each(['summary', 'users', 'channels', 'engagement'])('%s: admins, owners and co-owners get their own company', async (kind) => {
        for (const who of [OWNER, ADMIN, CO_OWNER]) {
            const res = await h.call(app(), 'GET', `/api/dashboard/analytics/${kind}`, who);
            expect(res.status).toBe(200);
            expect(res.body.companyId).toBe(C1);
        }
    });
    it('refuses members and guests', async () => {
        expect((await h.call(app(), 'GET', '/api/dashboard/analytics/users', MEMBER)).status).toBe(403);
        expect((await h.call(app(), 'GET', '/api/dashboard/analytics/summary', GUEST)).status).toBe(403);
    });
});

describe('GET /api/analytics/*', () => {
    it('insights resolve the company after requireAdmin replaced req.user (was 400)', async () => {
        const res = await h.call(app(), 'GET', '/api/analytics/insights/team?period=30', ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.companyId).toBe(C1);
    });
    it('company/:companyId is limited to the caller\'s own company', async () => {
        expect((await h.call(app(), 'GET', `/api/analytics/company/${C1}`, ADMIN)).body).toEqual({ companyId: C1 });
        expect((await h.call(app(), 'GET', `/api/analytics/company/${C1}`, ADMIN_B)).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/analytics/company/${C1}`, MEMBER)).status).toBe(403);
    });
});

describe('GET /api/dashboard/employee/:userId', () => {
    it('returns the caller\'s own dashboard (also as "me")', async () => {
        const res = await h.call(app(), 'GET', `/api/dashboard/employee/${MEMBER}`, MEMBER);
        expect(res.status).toBe(200);
        expect(res.body.stats).toEqual({ totalTasks: 3, completedTasks: 3, totalNotes: 2 });
        expect((await h.call(app(), 'GET', '/api/dashboard/employee/me', MEMBER)).status).toBe(200);
    });
    it('lets an admin open a member of their company, nobody else', async () => {
        expect((await h.call(app(), 'GET', `/api/dashboard/employee/${MEMBER}`, ADMIN)).status).toBe(200);
        expect((await h.call(app(), 'GET', `/api/dashboard/employee/${ADMIN}`, MEMBER)).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/dashboard/employee/${MEMBER}`, ADMIN_B)).status).toBe(403);
    });
});

describe('POST /api/security/backup', () => {
    it('backs up the admin\'s own company', async () => {
        const res = await h.call(app(), 'POST', '/api/security/backup', ADMIN, {});
        expect(res.status).toBe(201);
        expect(backupService.createBackup).toHaveBeenCalledWith(expect.objectContaining({ companyId: C1 }));
    });
    it('refuses members and other companies', async () => {
        expect((await h.call(app(), 'POST', '/api/security/backup', MEMBER, {})).status).toBe(403);
        expect((await h.call(app(), 'POST', '/api/security/backup', ADMIN_B, { companyId: C1 })).status).toBe(403);
        expect(backupService.createBackup).not.toHaveBeenCalled();
    });
    it('lets platform staff choose a company', async () => {
        expect((await h.call(app(), 'POST', '/api/security/backup', STAFF, { companyId: C2 })).status).toBe(201);
        expect(backupService.createBackup).toHaveBeenCalledWith(expect.objectContaining({ companyId: C2 }));
    });
});
