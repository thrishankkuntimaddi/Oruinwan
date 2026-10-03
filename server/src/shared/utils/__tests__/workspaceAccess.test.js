'use strict';

jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn(), memberWorkspaceIds: jest.fn() } }));
const { workspaces } = require('../../../identity');
const { escapeRegex, safeRegex } = require('../escapeRegex');
const { assertWorkspaceMember, requireWorkspaceAccess, isValidId } = require('../workspaceAccess');

const WS = '64b000000000000000000001';
const OWNER = '64b0000000000000000000a1';
const MEMBER = '64b0000000000000000000b1';
const SUSP = '64b0000000000000000000c1';

function mockWs(ws) {
    workspaces.findById.mockResolvedValue(ws);
}
const ws = {
    _id: WS,
    members: [
        { user: OWNER, role: 'owner', status: 'active' },
        { user: MEMBER, role: 'member', status: 'active' },
        { user: SUSP, role: 'admin', status: 'suspended' },
    ],
};

function res() {
    const r = {};
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
}

describe('escapeRegex', () => {
    test('escapes metacharacters', () => {
        expect(escapeRegex('a.*(b')).toBe('a\\.\\*\\(b');
        expect(safeRegex('(').test('x(y')).toBe(true);
        expect(() => safeRegex('[')).not.toThrow();
    });
});

describe('assertWorkspaceMember', () => {
    test('400 on malformed id', async () => {
        await expect(assertWorkspaceMember('nope', OWNER)).rejects.toMatchObject({ status: 400 });
        expect(isValidId('nope')).toBe(false);
    });
    test('404 when missing', async () => {
        mockWs(null);
        await expect(assertWorkspaceMember(WS, OWNER)).rejects.toMatchObject({ status: 404 });
    });
    test('403 for non-member and suspended', async () => {
        mockWs(ws);
        await expect(assertWorkspaceMember(WS, '64b0000000000000000000ff')).rejects.toMatchObject({ status: 403 });
        await expect(assertWorkspaceMember(WS, SUSP)).rejects.toMatchObject({ status: 403 });
    });
    test('adminOnly rejects plain members', async () => {
        mockWs(ws);
        await expect(assertWorkspaceMember(WS, MEMBER, { adminOnly: true })).rejects.toMatchObject({ status: 403 });
        await expect(assertWorkspaceMember(WS, OWNER, { adminOnly: true })).resolves.toMatchObject({ isAdmin: true, role: 'owner' });
    });
    test('middleware responds with { message }', async () => {
        mockWs(ws);
        const r = res(); const next = jest.fn();
        await requireWorkspaceAccess()({ query: { workspaceId: WS }, user: { sub: 'x'.repeat(24) } }, r, next);
        expect(r.status).toHaveBeenCalledWith(403);
        expect(r.json.mock.calls[0][0]).toHaveProperty('message');
        expect(next).not.toHaveBeenCalled();
    });
});
