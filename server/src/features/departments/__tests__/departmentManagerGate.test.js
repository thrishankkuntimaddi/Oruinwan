'use strict';

/**
 * requireCompanyMember now loads managedDepartments and coOwnerOf, so:
 *  - a manager can change members of a department they manage (was always 403),
 *  - but not of another department,
 *  - a co-owner passes admin-level gates as an owner.
 * Also: internal messages resolve the sender's company from the database
 * (the token has no companyId, so sending always failed with 403).
 */

const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../../models/User', () => require('../../../shared/__tests__/gateHarness').userModel());
jest.mock('../department.service', () => ({
    assignMembers: jest.fn(async (id) => ({ _id: id })),
    createDepartment: jest.fn(async () => ({ _id: 'new' })),
}));
jest.mock('../../../../models/InternalMessage', () => ({
    create: jest.fn(async (doc) => ({ ...doc, _id: 'm1', populate: jest.fn(async () => {}) })),
}));

const h = require('../../../shared/__tests__/gateHarness');
const deptService = require('../department.service');
const InternalMessage = require('../../../../models/InternalMessage');

const C1 = h.oid(0xc1);
const C2 = h.oid(0xc2);
const MANAGER = h.oid(1);
const CO_OWNER = h.oid(2);
const MEMBER = h.oid(3);
const ADMIN = h.oid(4);
const ADMIN_B = h.oid(5);
const ENG = h.oid(0x50);
const SALES = h.oid(0x51);

// Load the routers up front: the first require is slow under a parallel run.
const departmentsRoutes = require('../departments.routes');
const messagingRoutes = require('../../internal-messaging/messaging.routes');
jest.setTimeout(30000);

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/departments', departmentsRoutes);
    a.use('/api/internal', messagingRoutes);
    return a;
}

beforeEach(() => {
    const base = { accountStatus: 'active' };
    Object.assign(h.users, {
        [MANAGER]: { _id: MANAGER, companyId: C1, companyRole: 'manager', managedDepartments: [ENG], ...base },
        [CO_OWNER]: { _id: CO_OWNER, companyId: C1, companyRole: 'member', coOwnerOf: C1, ...base },
        [MEMBER]: { _id: MEMBER, companyId: C1, companyRole: 'member', ...base },
        [ADMIN]: { _id: ADMIN, companyId: C1, companyRole: 'admin', email: 'a@acme.test', ...base },
        [ADMIN_B]: { _id: ADMIN_B, companyId: C2, companyRole: 'admin', ...base },
    });
});

describe('PATCH /api/departments/:id/members', () => {
    const patch = (who, dept) => h.call(app(), 'PATCH', `/api/departments/${dept}/members`, who, { userIds: [MEMBER], action: 'add' });

    it('lets a manager manage their own department', async () => {
        expect((await patch(MANAGER, ENG)).status).toBe(200);
        expect(deptService.assignMembers).toHaveBeenCalledWith(ENG, C1, [MEMBER], 'add');
    });
    it('refuses a department the manager does not manage, and members', async () => {
        expect((await patch(MANAGER, SALES)).status).toBe(403);
        expect((await patch(MEMBER, ENG)).status).toBe(403);
    });
    it('treats a co-owner as an owner', async () => {
        expect((await patch(CO_OWNER, SALES)).status).toBe(200);
        expect((await h.call(app(), 'POST', '/api/departments', CO_OWNER, { name: 'Ops' })).status).not.toBe(403);
    });
});

describe('POST /api/internal/messages', () => {
    it('sends a manager → admin message inside the company', async () => {
        const res = await h.call(app(), 'POST', '/api/internal/messages', MANAGER, { recipientId: ADMIN, content: 'Hi' });
        expect(res.status).toBe(201);
        expect(InternalMessage.create).toHaveBeenCalledWith(expect.objectContaining({ companyId: C1, messageType: 'manager-to-admin' }));
    });
    it('refuses recipients from another company', async () => {
        expect((await h.call(app(), 'POST', '/api/internal/messages', MANAGER, { recipientId: ADMIN_B, content: 'Hi' })).status).toBe(403);
    });
});
