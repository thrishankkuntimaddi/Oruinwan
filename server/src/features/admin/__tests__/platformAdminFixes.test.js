'use strict';

/**
 * Platform console (/api/admin, chttrix_admin only): approve/reject survive an
 * email failure, approval provisions a company once, broadcasts store `body`,
 * active-user stats ignore null companies, active companies hide secrets.
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../identity', () => require('./identityStore').identity);
jest.mock('../../../identity/queries/org', () => require('./identityStore').org);
jest.mock('../../../identity/queries/auth', () => require('./identityStore').auth);
jest.mock('../../../shared/postgres', () => require('./identityStore').postgres);
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn(async () => ({})) }));
jest.mock('../../../../models/Broadcast', () => ({ create: jest.fn(async (doc) => ({ _id: 'b1', ...doc })) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../utils/emailTemplates', () => ({
    companyApprovedTemplate: () => ({ subject: 's', html: 'h', text: 't' }),
    companyRejectedTemplate: () => ({ subject: 's', html: 'h', text: 't' }),
}));
jest.mock('../../support/supportTickets.service', () => ({ countOpenTickets: jest.fn(async () => 2) }));
jest.mock('../../../../models/Billing', () => ({ find: jest.fn(async () => []) }));
jest.mock('../../company-registration/registration.service', () => ({ provisionCompanyResources: jest.fn(async () => ({})) }));

const h = require('../../../shared/__tests__/gateHarness');
const store = require('./identityStore');
const Broadcast = require('../../../../models/Broadcast');
const sendEmail = require('../../../../utils/sendEmail');
const { provisionCompanyResources } = require('../../company-registration/registration.service');
const adminRoutes = require('../admin.routes');
jest.setTimeout(30000);

const STAFF = h.oid(1);
const USER = h.oid(2);
const OWNER = h.oid(3);
const C1 = h.oid(0xc1);

function app() {
    const a = express();
    a.use(express.json());
    // server.js mounts auth in front of this router.
    a.use('/api/admin', require('../../../shared/middleware/auth'), adminRoutes);
    return a;
}

const company = () => store.state.companies.get(C1);
beforeEach(() => {
    store.reset();
    store.addUser({ _id: STAFF, companyId: null, roles: ['user', 'chttrix_admin'] });
    store.addUser({ _id: USER, companyId: null, roles: ['user'] });
    store.addCompany({ _id: C1, name: 'Acme', verificationStatus: 'pending', defaultWorkspace: null,
        phone: { otp: '123456' }, domainVerification: { token: 'secret' } }, { admins: [{ user: OWNER, role: 'owner' }] });
    store.addUser({ _id: OWNER, companyId: C1, companyRole: 'owner', email: 'o@acme.test', username: 'o', accountStatus: 'pending_company' });
    sendEmail.mockRejectedValue(new Error('SMTP down'));
});

describe('approve / reject', () => {
    it('approves, provisions once, and reports emailSent:false when email fails', async () => {
        const res = await h.call(app(), 'POST', `/api/admin/approve-company/${C1}`, STAFF, {});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ emailSent: false, provisioned: true });
        expect(company().verificationStatus).toBe('verified');
        expect(store.state.users.get(OWNER).accountStatus).toBe('active');
        expect(provisionCompanyResources).toHaveBeenCalledTimes(1);
        company().defaultWorkspace = 'ws1';
        await h.call(app(), 'POST', `/api/admin/approve-company/${C1}`, STAFF, {});
        expect(provisionCompanyResources).toHaveBeenCalledTimes(1);
    });
    it('rejects even when email fails', async () => {
        const res = await h.call(app(), 'POST', `/api/admin/reject-company/${C1}`, STAFF, { reason: 'Docs missing' });
        expect(res.status).toBe(200);
        expect(res.body.emailSent).toBe(false);
        expect(company().verificationStatus).toBe('rejected');
        expect(company().rejectionReason).toBe('Docs missing');
    });
    it('is platform staff only', async () => {
        expect((await h.call(app(), 'POST', `/api/admin/approve-company/${C1}`, USER, {})).status).toBe(403);
    });
});

describe('broadcast', () => {
    it('stores the text as `body` whether sent as body or message, with real counts', async () => {
        company().verificationStatus = 'verified';
        store.state.users.get(OWNER).accountStatus = 'active';
        for (let i = 0; i < 4; i += 1) store.addUser({ companyId: C1, accountStatus: 'active' });
        const res = await h.call(app(), 'POST', '/api/admin/broadcast/send', STAFF, { subject: 'Hi', message: 'Hello all', targetType: 'all' });
        expect(res.status).toBe(200);
        expect(Broadcast.create).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hello all', recipientCount: 1 }));
        expect(res.body.recipients).toEqual({ companies: 1, users: 5 });
    });
    it('rejects an empty message or bad specific target', async () => {
        expect((await h.call(app(), 'POST', '/api/admin/broadcast/send', STAFF, { subject: 'Hi', targetType: 'all' })).status).toBe(400);
        expect((await h.call(app(), 'POST', '/api/admin/broadcast/send', STAFF, { subject: 'Hi', body: 'x', targetType: 'specific', targetCompanies: 'nope' })).status).toBe(400);
    });
});

describe('stats and lists', () => {
    it('active companies exclude secret fields', async () => {
        company().verificationStatus = 'verified';
        const res = await h.call(app(), 'GET', '/api/admin/active-companies', STAFF);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        for (const k of ['phone', 'domainVerification', 'domainVerificationToken', 'ssoConfig']) expect(res.body[0]).not.toHaveProperty(k);
        expect(res.body[0].admins[0].user).toMatchObject({ _id: OWNER, email: 'o@acme.test' });
    });
    it('active users count only people who belong to a company', async () => {
        store.state.users.get(OWNER).accountStatus = 'active';
        const res = await h.call(app(), 'GET', '/api/admin/overview/stats', STAFF);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ activeUsers: 1, openTickets: 2, pendingRequests: 1 });
    });
});
