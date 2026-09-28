'use strict';

/** Role ceiling rules shared by every company user-management route. */

const { assignRoleError, manageUserError, effectiveRole, isCoOwner } = require('../roleCeiling');

const C1 = 'c1'.padStart(24, '0');
const C2 = 'c2'.padStart(24, '0');
const owner = { _id: 'o', companyId: C1, companyRole: 'owner' };
const coOwner = { _id: 'co', companyId: C1, companyRole: 'member', coOwnerOf: C1 };
const admin = { _id: 'a', companyId: C1, companyRole: 'admin' };
const admin2 = { _id: 'a2', companyId: C1, companyRole: 'admin' };
const manager = { _id: 'm', companyId: C1, companyRole: 'manager' };
const member = { _id: 'u', companyId: C1, companyRole: 'member' };
const stranger = { _id: 's', companyId: C2, companyRole: 'member' };

describe('effectiveRole / isCoOwner', () => {
    it('treats a co-owner of their own company as owner', () => {
        expect(isCoOwner(coOwner)).toBe(true);
        expect(effectiveRole(coOwner)).toBe('owner');
        expect(isCoOwner({ ...coOwner, coOwnerOf: C2 })).toBe(false);
    });
});

describe('assignRoleError', () => {
    it('never grants owner', () => {
        expect(assignRoleError(owner, 'owner')).toMatch(/Ownership/);
        expect(assignRoleError(admin, 'owner')).toMatch(/Ownership/);
    });
    it('only owners (and co-owners) grant admin', () => {
        expect(assignRoleError(owner, 'admin')).toBeNull();
        expect(assignRoleError(coOwner, 'admin')).toBeNull();
        expect(assignRoleError(admin, 'admin')).toMatch(/owner/);
    });
    it('admins grant manager/member/guest; managers grant nothing', () => {
        expect(assignRoleError(admin, 'manager')).toBeNull();
        expect(assignRoleError(admin, 'guest')).toBeNull();
        expect(assignRoleError(manager, 'member')).toMatch(/Admin privileges/);
    });
    it('rejects unknown roles', () => {
        expect(assignRoleError(owner, 'superuser')).toMatch(/Invalid role/);
    });
});

describe('manageUserError', () => {
    it('nobody manages the owner', () => {
        expect(manageUserError(admin, owner)).toMatch(/owner cannot/);
        expect(manageUserError(coOwner, owner)).toMatch(/owner cannot/);
    });
    it('only owners manage admins and co-owners', () => {
        expect(manageUserError(admin, admin2)).toMatch(/Only the company owner/);
        expect(manageUserError(admin, coOwner)).toMatch(/Only the company owner/);
        expect(manageUserError(owner, admin)).toBeNull();
        expect(manageUserError(coOwner, admin)).toBeNull();
    });
    it('admins manage members; nobody crosses companies or acts on themselves', () => {
        expect(manageUserError(admin, member)).toBeNull();
        expect(manageUserError(admin, stranger)).toMatch(/not in your company/);
        expect(manageUserError(admin, admin)).toMatch(/yourself/);
        expect(manageUserError(manager, member)).toMatch(/Admin privileges/);
    });
});

describe('sanitizeCompanyUpdates (PUT /api/companies/:id)', () => {
    jest.mock('../../modules/uploads/upload.service', () => ({ uploadToGCS: jest.fn() }));
    const { sanitizeCompanyUpdates } = require('../../features/company/company.service');

    it('keeps profile fields and flattens whitelisted settings', () => {
        const { updates } = sanitizeCompanyUpdates({ name: 'Acme', settings: { timezone: 'UTC', maxUsers: 9999 } }, 'admin');
        expect(updates).toEqual({ name: 'Acme', 'settings.timezone': 'UTC' });
    });
    it('silently drops verification, domain, admins, activation and SSO fields', () => {
        const { updates } = sanitizeCompanyUpdates({
            verificationStatus: 'verified', domainVerified: true, admins: [{ user: 'x', role: 'owner' }],
            isActive: false, ssoConfig: { secret: 1 }, displayName: 'A',
        }, 'owner');
        expect(updates).toEqual({ displayName: 'A' });
    });
    it('plan and billing are owner-only', () => {
        expect(sanitizeCompanyUpdates({ plan: 'enterprise' }, 'admin')).toMatchObject({ status: 403 });
        expect(sanitizeCompanyUpdates({ plan: 'enterprise' }, 'owner').updates).toEqual({ plan: 'enterprise' });
    });
});
