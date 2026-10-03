'use strict';

/** GET /api/users/:id/card and /api/users/card?username= (mention profile popover). */

jest.mock('../../../identity', () => ({ users: { findById: jest.fn() }, workspaces: { findById: jest.fn() } }));
jest.mock('../../../shared/postgres', () => ({ query: jest.fn() }));
jest.mock('../../presence/presence.service', () => ({ getPresence: jest.fn(() => null) }));

const { users: usersRepo, workspaces } = require('../../../identity');
const { query } = require('../../../shared/postgres');
const presence = require('../../presence/presence.service');
const ctrl = require('../userCard.controller');

const oid = (n) => n.toString(16).padStart(24, '0');
const WS = oid(1);
const ALICE = oid(11);
const BOB = oid(12);
const CAROL = oid(13);   // same company as Alice, no shared workspace
const MALLORY = oid(99); // shares nothing
const COMPANY = oid(500);

const users = {
    [ALICE]: { _id: ALICE, username: 'alice', email: 'alice@x.io', companyId: COMPANY },
    [BOB]: {
        _id: BOB, username: 'bob', email: 'bob@x.io', profilePicture: '/b.png',
        profile: { name: 'Bob B', about: 'Builds things' }, jobTitle: 'Engineer',
        departments: [{ _id: oid(700), name: 'Platform' }], userType: 'personal',
        preferences: { region: { timezone: 'Europe/Berlin' }, privacy: { allowDiscovery: true } },
        isOnline: true, userStatus: 'active', lastActivityAt: new Date('2026-09-01'),
    },
    [CAROL]: {
        _id: CAROL, username: 'carol', email: 'carol@gmail.com', companyEmail: 'carol@corp.io',
        userType: 'company', companyId: COMPANY, companyRole: 'manager',
        preferences: { region: { timezone: 'auto' }, privacy: { allowDiscovery: false } },
    },
    [MALLORY]: { _id: MALLORY, username: 'mallory', email: 'm@x.io' },
};

const ws = {
    _id: WS,
    members: [
        { user: ALICE, role: 'member', status: 'active' },
        { user: BOB, role: 'admin', status: 'active' },
    ],
};

function mkRes() {
    const r = {};
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
}
const statusOf = (res) => (res.status.mock.calls[0] ? res.status.mock.calls[0][0] : 200);
const bodyOf = (res) => res.json.mock.calls[0][0];

async function byId(viewer, id, workspaceId) {
    const res = mkRes();
    await ctrl.getCardById({ user: { sub: viewer }, params: { id }, query: workspaceId ? { workspaceId } : {} }, res);
    return res;
}
async function byName(viewer, username, workspaceId) {
    const res = mkRes();
    await ctrl.getCardByUsername({ user: { sub: viewer }, params: {}, query: { username, workspaceId } }, res);
    return res;
}

beforeEach(() => {
    usersRepo.findById.mockImplementation(async (id) => (users[String(id)] ? { ...users[String(id)] } : null));
    workspaces.findById.mockImplementation(async (id) => (String(id) === WS ? ws : null));
    // SQL: department names, shared-workspace check, username lookup among members.
    query.mockImplementation(async (sql, params) => {
        if (/FROM department_members/.test(sql)) {
            const u = users[String(params[0])];
            return { rows: (u?.departments || []).map((d) => ({ id: d._id, name: d.name })) };
        }
        if (/FROM workspace_members v/.test(sql)) {
            const both = params.every((id) => ws.members.some((m) => String(m.user) === String(id)));
            return { rows: both ? [{}] : [] };
        }
        if (/lower\(username\)/.test(sql)) {
            const hit = Object.values(users).find((u) => params[0].includes(String(u._id)) && u.username.toLowerCase() === String(params[1]).toLowerCase());
            return { rows: hit ? [{ id: hit._id }] : [] };
        }
        return { rows: [] };
    });
    presence.getPresence.mockReturnValue(null);
});

describe('user card', () => {
    test('workspace co-member sees the full card with workspace role', async () => {
        const res = await byId(ALICE, BOB, WS);
        expect(statusOf(res)).toBe(200);
        expect(bodyOf(res).card).toEqual(expect.objectContaining({
            id: BOB, username: 'bob', displayName: 'Bob B', email: 'bob@x.io', profilePicture: '/b.png',
            about: 'Builds things', designation: 'Engineer', department: 'Platform',
            workspaceRole: 'admin', companyRole: null, timezone: 'Europe/Berlin', isOnline: true, userStatus: 'active',
        }));
    });

    test('resolves a mention by username (case-insensitive) within the workspace', async () => {
        const res = await byName(ALICE, '@BOB', WS);
        expect(statusOf(res)).toBe(200);
        expect(bodyOf(res).card.id).toBe(BOB);
        expect(bodyOf(res).card.workspaceRole).toBe('admin');
    });

    test('unknown username in the workspace is 404', async () => {
        const res = await byName(ALICE, 'mallory', WS);
        expect(statusOf(res)).toBe(404);
        expect(bodyOf(res).code).toBe('USER_NOT_FOUND');
    });

    test('username lookup requires membership of the workspace', async () => {
        const res = await byName(MALLORY, 'bob', WS);
        expect(statusOf(res)).toBe(403);
    });

    test('someone who shares no workspace or company is refused', async () => {
        const res = await byId(MALLORY, BOB);
        expect(statusOf(res)).toBe(403);
        expect(bodyOf(res).card).toBeUndefined();
    });

    test('company co-worker without a shared workspace: company role shown, email hidden when not discoverable', async () => {
        const res = await byId(ALICE, CAROL);
        expect(statusOf(res)).toBe(200);
        const { card } = bodyOf(res);
        expect(card.companyRole).toBe('manager');
        expect(card.email).toBeNull();
        expect(card.timezone).toBeNull();
        expect(card.workspaceRole).toBeNull();
    });

    test('removed or missing users are 404', async () => {
        expect(statusOf(await byId(ALICE, oid(404)))).toBe(404);
        users[MALLORY].accountStatus = 'removed';
        expect(statusOf(await byId(ALICE, MALLORY))).toBe(404);
        delete users[MALLORY].accountStatus;
    });

    test('invalid ids are 400', async () => {
        expect(statusOf(await byId(ALICE, 'nope'))).toBe(400);
        expect(statusOf(await byName(ALICE, 'bob', 'nope'))).toBe(400);
    });

    test('live presence overrides the stored flag', async () => {
        presence.getPresence.mockReturnValue({ status: 'idle', lastSeen: new Date('2026-09-28') });
        const { card } = bodyOf(await byId(ALICE, BOB, WS));
        expect(card.isOnline).toBe(true);
        expect(card.userStatus).toBe('away');
        presence.getPresence.mockReturnValue({ status: 'offline', lastSeen: new Date('2026-09-28') });
        expect(bodyOf(await byId(ALICE, BOB, WS)).card.isOnline).toBe(false);
    });

    test('never leaks sensitive fields', async () => {
        const { card } = bodyOf(await byId(ALICE, BOB, WS));
        expect(Object.keys(card).sort()).toEqual([
            'about', 'companyRole', 'department', 'designation', 'displayName', 'email', 'id', 'isOnline',
            'lastSeen', 'profilePicture', 'timezone', 'userStatus', 'username', 'workspaceRole',
        ]);
    });
});
