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
jest.mock('../../../../models/User', () => require('../../../shared/__tests__/gateHarness').userModel());
jest.mock('../../../../models/Company', () => ({ findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn(async () => 0) }));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn(async () => ({})) }));
jest.mock('../../../../models/Broadcast', () => ({ create: jest.fn(async (doc) => ({ _id: 'b1', ...doc })) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../utils/emailTemplates', () => ({
    companyApprovedTemplate: () => ({ subject: 's', html: 'h', text: 't' }),
    companyRejectedTemplate: () => ({ subject: 's', html: 'h', text: 't' }),
}));
jest.mock('../../company-registration/registration.service', () => ({ provisionCompanyResources: jest.fn(async () => ({})) }));

const h = require('../../../shared/__tests__/gateHarness');
const User = require('../../../../models/User');
const Company = require('../../../../models/Company');
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

let company;
beforeEach(() => {
    Object.assign(h.users, {
        [STAFF]: { _id: STAFF, roles: ['user', 'chttrix_admin'] },
        [USER]: { _id: USER, roles: ['user'] },
    });
    company = { _id: C1, name: 'Acme', defaultWorkspace: null, save: jest.fn(async () => {}) };
    Company.findById.mockImplementation(async () => company);
    User.findOne.mockImplementation(async () => ({ _id: OWNER, email: 'o@acme.test', username: 'o', save: jest.fn(async () => {}) }));
    sendEmail.mockRejectedValue(new Error('SMTP down'));
});

describe('approve / reject', () => {
    it('approves, provisions once, and reports emailSent:false when email fails', async () => {
        const res = await h.call(app(), 'POST', `/api/admin/approve-company/${C1}`, STAFF, {});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ emailSent: false, provisioned: true });
        expect(company.verificationStatus).toBe('verified');
        expect(provisionCompanyResources).toHaveBeenCalledTimes(1);
        company.defaultWorkspace = 'ws1';
        await h.call(app(), 'POST', `/api/admin/approve-company/${C1}`, STAFF, {});
        expect(provisionCompanyResources).toHaveBeenCalledTimes(1);
    });
    it('rejects even when email fails', async () => {
        const res = await h.call(app(), 'POST', `/api/admin/reject-company/${C1}`, STAFF, { reason: 'Docs missing' });
        expect(res.status).toBe(200);
        expect(res.body.emailSent).toBe(false);
        expect(company.verificationStatus).toBe('rejected');
    });
    it('is platform staff only', async () => {
        expect((await h.call(app(), 'POST', `/api/admin/approve-company/${C1}`, USER, {})).status).toBe(403);
    });
});

describe('broadcast', () => {
    it('stores the text as `body` whether sent as body or message, with real counts', async () => {
        Company.find.mockImplementation(async () => [{ _id: C1 }]);
        User.countDocuments.mockImplementation(async () => 5);
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
        const select = jest.fn(() => q);
        const q = { select, populate: () => q, sort: () => q, lean: async () => [] };
        Company.find.mockImplementation(() => q);
        expect((await h.call(app(), 'GET', '/api/admin/active-companies', STAFF)).status).toBe(200);
        expect(select.mock.calls[0][0]).toMatch(/-phoneOTP .*-domainVerificationToken .*-ssoConfig/);
    });
});

describe('User.phone', () => {
    it('stores an empty phone as unset so the sparse unique index ignores it', () => {
        const RealUser = jest.requireActual('../../../../models/User');
        expect(new RealUser({ phone: null }).phone).toBeUndefined();
        expect(new RealUser({ phone: '' }).phone).toBeUndefined();
        expect(new RealUser({ phone: '+15551234' }).phone).toBe('+15551234');
    });
});
