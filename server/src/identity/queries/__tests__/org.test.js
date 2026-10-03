'use strict';

const postgres = require('../../../shared/postgres');
const org = require('../org');

/** Records statements; answers row lists by regex. */
function fakePool(answers = []) {
    const statements = [];
    const handle = async (text, params = []) => {
        statements.push({ text, params });
        const hit = answers.find(([re]) => re.test(text));
        return { rows: hit ? hit[1](params) : [], rowCount: hit ? hit[1](params).length : 0 };
    };
    return { statements, query: handle, connect: async () => ({ query: handle, release: () => {} }) };
}

afterEach(() => postgres._setPoolForTests(undefined));

describe('toWhere', () => {
    test('equality, $ne, $in, $or and regex', () => {
        const { where, params } = org.toWhere('users', {
            companyId: 'c1', accountStatus: { $ne: 'removed' }, _id: { $in: ['a', 'b'] },
            $or: [{ username: /ad/i }, { email: { $regex: 'x', $options: 'i' } }],
        });
        expect(where).toBe('users.company_id = $1 AND users.account_status IS DISTINCT FROM $2 AND users.id = ANY($3) AND ((users.username ~* $4) OR (users.email ~* $5))');
        expect(params).toEqual(['c1', 'removed', ['a', 'b'], 'ad', 'x']);
    });

    test('membership fields become EXISTS on the join tables', () => {
        expect(org.toWhere('users', { departments: 'd1' }).where).toBe(
            'EXISTS (SELECT 1 FROM department_members j WHERE j.user_id = users.id AND j.department_id = $1)');
        expect(org.toWhere('users', { managedDepartments: { $in: ['d1'] } }).where).toMatch(/role = 'manager'/);
        expect(org.toWhere('workspaces', { members: { $elemMatch: { user: 'u1', status: 'active' } } }).where)
            .toBe('EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspaces.id AND wm.user_id = $1 AND wm.status = $2)');
        expect(org.toWhere('companies', { 'admins.user': 'u1' }).where).toMatch(/FROM company_admins j WHERE j.company_id = companies.id AND j.user_id = \$1/);
        expect(org.toWhere('users', { _id: { $nin: [] }, departments: { $in: ['d'] } }).params).toEqual([[], ['d']]);
    });

    test('jsonb paths, array columns, null and ObjectId-like values', () => {
        expect(org.toWhere('users', { 'profile.name': 'Ada' }).where).toBe("(users.profile #>> '{name}') = $1");
        expect(org.toWhere('users', { roles: 'chttrix_admin' }).where).toBe('$1 = ANY(users.roles)');
        expect(org.toWhere('users', { companyId: null }).where).toBe('users.company_id IS NULL');
        expect(org.toWhere('users', { companyId: { $ne: null } }).where).toBe('users.company_id IS NOT NULL');
        expect(org.toWhere('users', { companyId: { toHexString: () => 'x', toString: () => 'abc' } }).params).toEqual(['abc']);
        expect(org.toWhere('companies', { ownerPhone: '999' }).where).toBe("(companies.phone ->> 'ownerPhone') = $1");
    });

    test('unknown fields and operators fail loudly', () => {
        expect(() => org.toWhere('users', { firstName: 'x' })).toThrow(/unsupported field "firstName"/);
        expect(() => org.toWhere('users', { username: { $where: 'x' } })).toThrow(/unsupported operator \$where/);
    });
});

describe('entity helpers', () => {
    test('find builds ORDER BY / LIMIT / OFFSET and maps rows', async () => {
        const pool = fakePool([[/FROM users WHERE/, () => [{ id: 'u1', username: 'ada', email: 'a@x', company_id: 'c1', password_hash: 'h', suspension: { suspendedAt: '2026-01-01' } }]]]);
        postgres._setPoolForTests(pool);
        const [u] = await org.users.find({ companyId: 'c1' }, { sort: { createdAt: -1 }, limit: 5, skip: 10, select: 'username suspendedAt' });
        expect(pool.statements[0].text).toBe('SELECT users.* FROM users WHERE users.company_id = $1 ORDER BY users.created_at DESC LIMIT $2 OFFSET $3');
        expect(pool.statements[0].params).toEqual(['c1', 5, 10]);
        expect(u).toEqual({ _id: 'u1', username: 'ada', suspendedAt: '2026-01-01' });
    });

    test('updateMany packs Mongo-era user fields into jsonb', async () => {
        const pool = fakePool();
        postgres._setPoolForTests(pool);
        await org.users.updateMany({ _id: 'u1' }, { accountStatus: 'suspended', suspendedBy: 'admin', suspensionReason: 'r' });
        const { text, params } = pool.statements[0];
        expect(text).toMatch(/^UPDATE users SET account_status = \$2, suspension = COALESCE\(suspension, '\{\}'::jsonb\) \|\| \$3::jsonb, updated_at = now\(\) WHERE users.id = \$1$/);
        expect(JSON.parse(params[2])).toEqual({ suspendedBy: 'admin', suspensionReason: 'r' });
    });

    test('withOrg attaches departments, managed departments and workspaces', async () => {
        postgres._setPoolForTests(fakePool([
            [/FROM department_members dm/, () => [{ user_id: 'u1', department_id: 'd1', role: 'manager' }, { user_id: 'u1', department_id: 'd2', role: 'member' }]],
            [/FROM workspace_members/, () => [{ user_id: 'u1', workspace_id: 'w1', role: 'owner', joined_at: 'j' }]],
        ]));
        const [u] = await org.withOrg([{ _id: 'u1' }]);
        expect(u).toMatchObject({ departments: ['d1', 'd2'], managedDepartments: ['d1'], workspaces: [{ workspace: 'w1', role: 'owner', joinedAt: 'j' }] });
    });
});

describe('companies', () => {
    test('flatten / pack / publicCompany keep the Mongo-era field names', () => {
        const packed = org.packCompany({ ownerPhone: '1', ownerEmail: 'o@x', ssoEnabled: true, domainVerificationToken: 't' });
        expect(packed).toEqual({ phone: { ownerPhone: '1', ownerEmail: 'o@x' }, sso: { enabled: true }, domainVerification: { token: 't' } });
        const flat = org.flattenCompany({ phone: { ownerPhone: '1' }, sso: { enabled: true }, domainVerification: { token: 't' }, limits: { maxUsers: 5 }, settings: { theme: 'x' } });
        expect(flat).toMatchObject({ ownerPhone: '1', ssoEnabled: true, domainVerificationToken: 't', settings: { maxUsers: 5, theme: 'x' } });
        const pub = org.publicCompany({ ...flat, isAdmin: () => true, sso: { enabled: true, config: { secret: 1 } } });
        expect(pub).not.toHaveProperty('phone');
        expect(pub).not.toHaveProperty('domainVerificationToken');
        expect(pub.sso).toEqual({ enabled: true, provider: null, domain: null });
        expect(pub.isAdmin).toBeUndefined();
    });

    test('updateCompany folds dotted paths and merges jsonb', async () => {
        const pool = fakePool([[/^UPDATE companies/, () => [{ id: 'c1', name: 'n' }]], [/company_admins/, () => []]]);
        postgres._setPoolForTests(pool);
        await org.updateCompany('c1', { 'securitySettings.mfaRequired': true, ownerPhone: '9', setupStep: 2 });
        const { text, params } = pool.statements[0];
        expect(text).toMatch(/setup_step = \$\d/);
        expect(text).toMatch(/security_settings = COALESCE\(security_settings, '\{\}'::jsonb\) \|\| \$\d::jsonb/);
        expect(text).toMatch(/phone = COALESCE\(phone, '\{\}'::jsonb\) \|\| \$\d::jsonb/);
        expect(params).toContain('{"mfaRequired":true}');
        expect(params).toContain('{"ownerPhone":"9"}');
    });
});
