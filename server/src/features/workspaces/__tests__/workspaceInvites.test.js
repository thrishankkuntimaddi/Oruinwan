'use strict';

// Workspace invites live in PostgreSQL (identity/queries/auth.js `invites`), the same table signup reads.
const mockStore = {
    findById: jest.fn(), update: jest.fn(), listByWorkspace: jest.fn(), findManyInWorkspace: jest.fn(),
    deleteFinished: jest.fn(), deleteExpiredPending: jest.fn(),
};
jest.mock('../../../identity/queries/auth', () => ({ invites: mockStore }));
const mockWorkspaces = { findById: jest.fn() };
jest.mock('../../../identity', () => ({ workspaces: mockWorkspaces, users: {} }));
jest.mock('../../../identity/hydrate', () => ({ ...jest.requireActual('../../../identity/hydrate'), hydrate: jest.fn(async (d) => d) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn(async () => {}));
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn() }));

const ctrl = require('../workspace-admin.controller');

const WS = 'ws1';
const ADMIN = 'u-admin';
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

beforeEach(() => {
    jest.clearAllMocks();
    mockWorkspaces.findById.mockResolvedValue({ _id: WS, name: 'W', members: [{ user: ADMIN, role: 'admin', status: 'active' }] });
});

test('revoke writes the revoke fields through the repository', async () => {
    mockStore.findById.mockResolvedValue({ _id: 'i1', workspace: WS, status: 'pending', email: 'a@b.c' });
    mockStore.update.mockResolvedValue({ _id: 'i1', workspace: WS, status: 'revoked', email: 'a@b.c', revokedAt: new Date() });
    const r = res();
    await ctrl.revokeInvite({ params: { workspaceId: WS, inviteId: 'i1' }, body: { reason: 'no' }, user: { sub: ADMIN } }, r);
    expect(mockStore.update).toHaveBeenCalledWith('i1', expect.objectContaining({ status: 'revoked', revokedBy: ADMIN, revokeReason: 'no' }));
    expect(r.json.mock.calls[0][0].invite.status).toBe('revoked');
});

test('an invite from another workspace is refused', async () => {
    mockStore.findById.mockResolvedValue({ _id: 'i1', workspace: 'other', status: 'pending' });
    const r = res();
    await ctrl.revokeInvite({ params: { workspaceId: WS, inviteId: 'i1' }, body: {}, user: { sub: ADMIN } }, r);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(mockStore.update).not.toHaveBeenCalled();
});

test('bulk delete and cleanup use the SQL deletes', async () => {
    mockStore.deleteFinished.mockResolvedValue({ deletedCount: 2 });
    mockStore.deleteExpiredPending.mockResolvedValue({ deletedCount: 3 });
    const r1 = res();
    await ctrl.bulkDeleteInvites({ params: { workspaceId: WS }, body: { inviteIds: ['a', 'b'] }, user: { sub: ADMIN } }, r1);
    expect(mockStore.deleteFinished).toHaveBeenCalledWith(WS, ['a', 'b'], expect.any(Date));
    const r2 = res();
    await ctrl.cleanupExpiredInvites({ params: { workspaceId: WS }, user: { sub: ADMIN } }, r2);
    expect(r2.json.mock.calls[0][0].deletedCount).toBe(3);
});

test('listing groups invites by state', async () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 86400000);
    mockStore.listByWorkspace.mockResolvedValue([
        { _id: 'p', workspace: WS, status: 'pending', expiresAt: future, email: 'p@x' },
        { _id: 'e', workspace: WS, status: 'pending', expiresAt: past, email: 'e@x' },
        { _id: 'r', workspace: WS, status: 'revoked', expiresAt: future, email: 'r@x' },
    ]);
    const r = res();
    await ctrl.getWorkspaceInvites({ params: { workspaceId: WS }, user: { sub: ADMIN } }, r);
    const body = r.json.mock.calls[0][0];
    expect(mockStore.listByWorkspace).toHaveBeenCalledWith(WS);
    expect(JSON.stringify(body)).toContain('p@x');
});
