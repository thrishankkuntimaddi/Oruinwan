'use strict';

/**
 * Follow-ups for the owner / collaboration consoles:
 *  - owner security-risk: real fields and event names, no invented numbers
 *  - owner billing summary: seat limit from settings.maxUsers, no fake billing
 *  - company security settings saved to securitySettings
 *  - domain verification: clean 4xx instead of 500
 *  - teams: department / lead must be in the caller's company
 *  - workspace permissions: company owner/admin may manage without joining
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
jest.mock('../../../../models/AuditLog', () => ({ countDocuments: jest.fn(async () => 4) }));
jest.mock('../../../../models/SecurityEvent', () => ({ countDocuments: jest.fn(async () => 1), find: jest.fn() }));
jest.mock('../../../../models/HistoryLog', () => ({ countDocuments: jest.fn(async () => 2) }));
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn(async () => {}) }));
jest.mock('dns', () => ({ promises: { resolveTxt: jest.fn() } }));
jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn(async () => {}) }));

const h = require('../../../shared/__tests__/gateHarness');
const store = require('./identityStore');
const SecurityEvent = require('../../../../models/SecurityEvent');
const dns = require('dns').promises;

const ownerRoutes = require('../owner-dashboard.routes');
const settingsRoutes = require('../../company/settings.routes');
const domainRoutes = require('../../domain-verification/domain.routes');
const teamsRoutes = require('../../teams/teams.routes');
const wsPermRoutes = require('../../workspace-permissions/workspace-permissions.routes');
jest.setTimeout(30000);

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const OWNER = h.oid(1);
const ADMIN = h.oid(2);
const MEMBER = h.oid(3);
const ADMIN_B = h.oid(4);
const WS = h.oid(0x90);
const TEAM = h.oid(0x70);
const DEPT_OK = h.oid(0x50);
const DEPT_FOREIGN = h.oid(0x51);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/owner-dashboard', ownerRoutes);
    a.use('/api/companies', settingsRoutes);
    a.use('/api/companies', domainRoutes);
    a.use('/api/teams', teamsRoutes);
    a.use('/api/workspaces/:id', wsPermRoutes);
    return a;
}

beforeEach(() => {
    store.reset();
    store.addCompany({
        _id: C1, name: 'Acme', plan: 'professional', domain: 'acme.test', ownerEmail: 'o@acme.test',
        settings: { maxUsers: 50 }, securitySettings: { mfaRequired: true },
        domainVerificationToken: 'tok', domainVerificationExpires: new Date(Date.now() + 3600e3),
    }, { admins: [{ user: OWNER, role: 'owner' }] });
    store.addCompany({ _id: C2, name: 'Beta' });
    store.addUser({ _id: OWNER, companyId: C1, companyRole: 'owner', lastLoginAt: new Date() });
    store.addUser({ _id: ADMIN, companyId: C1, companyRole: 'admin' });
    store.addUser({ _id: MEMBER, companyId: C1, companyRole: 'member' });
    store.addUser({ _id: ADMIN_B, companyId: C2, companyRole: 'admin' });
    for (let i = 0; i < 4; i += 1) store.addUser({ companyId: C1, companyRole: 'member' }); // 7 people in C1
    store.addDepartment({ _id: DEPT_OK, company: C1, name: 'Eng' });
    store.addDepartment({ _id: DEPT_FOREIGN, company: C2, name: 'Theirs' });
    store.addTeam({ _id: TEAM, company: C1, name: 'Core' });
    store.addWorkspace({ _id: WS, company: C1, name: 'HQ', members: [{ user: MEMBER, role: 'member', status: 'active' }] });
    SecurityEvent.find.mockImplementation(() => h.query([{ metadata: { email: 'x@acme.test', attempts: 3 }, ipAddress: '1.2.3.4', createdAt: new Date() }]));
});

describe('GET /api/owner-dashboard/security-risk', () => {
    it('uses lastLoginAt, real event names, and no invented compliance score', async () => {
        const res = await h.call(app(), 'GET', '/api/owner-dashboard/security-risk', OWNER);
        expect(res.status).toBe(200);
        expect(store.org.users.count).toHaveBeenCalledWith(expect.objectContaining({ companyId: C1, lastLoginAt: expect.any(Object) }));
        expect(res.body.activeSessions).toBe(1);
        expect(SecurityEvent.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ eventType: { $in: ['role_changed', 'account_suspended'] } }));
        expect(res.body.complianceScore).toBeNull();
        expect(res.body.auditSummary).toEqual({ lastWeek: 4, critical: 3, warnings: 1 });
        expect(res.body.suspiciousLogins[0]).toMatchObject({ email: 'x@acme.test', attempts: 3, ipAddress: '1.2.3.4' });
    });
    it('is owner-only', async () => {
        expect((await h.call(app(), 'GET', '/api/owner-dashboard/security-risk', ADMIN)).status).toBe(403);
    });
});

describe('GET /api/owner-dashboard/billing-summary', () => {
    it('reads the seat limit from settings.maxUsers and invents no billing figures', async () => {
        const res = await h.call(app(), 'GET', '/api/owner-dashboard/billing-summary', OWNER);
        expect(res.body.seatUsage).toEqual({ used: 7, total: 50, percentage: 14 });
        expect(res.body.monthlyCost).toBeNull();
        expect(res.body.renewalDate).toBeNull();
    });
});

describe('PUT /api/companies/:id/settings/security', () => {
    it('writes the securitySettings schema field', async () => {
        const res = await h.call(app(), 'PUT', `/api/companies/${C1}/settings/security`, ADMIN, { mfaRequired: true, sessionTimeout: 60 });
        expect(res.status).toBe(200);
        expect(store.org.updateCompany.mock.calls[0][1]).toEqual({ 'securitySettings.mfaRequired': true, 'securitySettings.sessionTimeoutMinutes': 60 });
        expect(store.state.companies.get(C1).securitySettings).toEqual({ mfaRequired: true, sessionTimeoutMinutes: 60 });
    });
    it('is closed to members and other companies', async () => {
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}/settings/security`, MEMBER, { mfaRequired: true })).status).toBe(403);
        expect((await h.call(app(), 'PUT', `/api/companies/${C1}/settings/security`, ADMIN_B, { mfaRequired: true })).status).toBe(403);
    });
});

describe('POST /api/companies/:id/domain/verify', () => {
    it('answers 400 when the DNS lookup fails (was 500)', async () => {
        dns.resolveTxt.mockRejectedValue(Object.assign(new Error('queryTxt ENOTFOUND'), { code: 'ENOTFOUND' }));
        const res = await h.call(app(), 'POST', `/api/companies/${C1}/domain/verify`, ADMIN);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/ENOTFOUND/);
    });
    it('answers 400 when the record is missing, 200 when it matches', async () => {
        dns.resolveTxt.mockResolvedValue([['something-else']]);
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/domain/verify`, ADMIN)).status).toBe(400);
        dns.resolveTxt.mockResolvedValue([['chttrix-verification=tok']]);
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/domain/verify`, ADMIN)).status).toBe(200);
        expect(store.state.companies.get(C1).domainVerified).toBe(true);
    });
    it('answers 400 when no domain is set (was 500)', async () => {
        store.state.companies.get(C1).domain = null;
        expect((await h.call(app(), 'POST', `/api/companies/${C1}/domain/generate`, ADMIN)).status).toBe(400);
    });
});

describe('PATCH /api/teams/:id', () => {
    it('accepts a department and lead from the same company', async () => {
        expect((await h.call(app(), 'PATCH', `/api/teams/${TEAM}`, ADMIN, { department: DEPT_OK, lead: MEMBER })).status).toBe(200);
        expect(store.state.teams.get(TEAM)).toMatchObject({ department: DEPT_OK, lead: MEMBER });
    });
    it('rejects another company\'s department or lead', async () => {
        expect((await h.call(app(), 'PATCH', `/api/teams/${TEAM}`, ADMIN, { department: DEPT_FOREIGN })).status).toBe(400);
        expect((await h.call(app(), 'PATCH', `/api/teams/${TEAM}`, ADMIN, { lead: ADMIN_B })).status).toBe(400);
        expect(store.identity.teams.update).not.toHaveBeenCalled();
    });
});

describe('workspace permissions / features', () => {
    it('lets a company admin who is not a member manage features', async () => {
        expect((await h.call(app(), 'GET', `/api/workspaces/${WS}/features`, ADMIN)).status).toBe(200);
        expect((await h.call(app(), 'PUT', `/api/workspaces/${WS}/features`, OWNER, { featureToggles: { tasks: false } })).status).toBe(200);
    });
    it('keeps plain members read-only and other companies out', async () => {
        expect((await h.call(app(), 'PUT', `/api/workspaces/${WS}/features`, MEMBER, { featureToggles: { tasks: false } })).status).toBe(403);
        expect((await h.call(app(), 'GET', `/api/workspaces/${WS}/features`, ADMIN_B)).status).toBe(403);
    });
});
