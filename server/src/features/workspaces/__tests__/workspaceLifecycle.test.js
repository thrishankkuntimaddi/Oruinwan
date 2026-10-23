'use strict';

/**
 * Owner/admin controls: transfer ownership, archive/restore, default channels, the
 * "members may invite" setting, and archived workspaces in GET /workspaces/my.
 */

jest.mock('../../../identity', () => ({
    users: { findById: jest.fn(), findManyByIds: jest.fn(async () => new Map()) },
    workspaces: { findById: jest.fn(), update: jest.fn(), updateMember: jest.fn() },
}));
jest.mock('../../../identity/queries/workspaces', () => ({ membershipsForUser: jest.fn() }));
jest.mock('../../channels/channel.model.js', () => ({ findOne: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn() }));
jest.mock('../../../shared/plans/planService', () => ({ assertCanCreateWorkspace: jest.fn() }));
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({
    hasConversationKeys: jest.fn(async () => true), distributeKeyToNewMember: jest.fn(async () => true),
}));
jest.mock('../../../modules/messages/messages.service', () => ({ getWorkspaceUnreadCounts: jest.fn(async () => new Map()) }));

const identity = require('../../../identity');
const wsQueries = require('../../../identity/queries/workspaces');
const Channel = require('../../channels/channel.model.js');
const planService = require('../../../shared/plans/planService');
const keys = require('../../../modules/conversations/conversationKeys.service');
const lifecycle = require('../workspace-lifecycle.controller');
const ctrl = require('../workspace.controller');

const oid = (n) => n.toString(16).padStart(24, '0');
const WS = oid(1);
const OWNER = oid(11);
const ADMIN = oid(12);
const MEMBER = oid(14);
const SUSPENDED = oid(15);
const CH = oid(31);

function makeWs(extra = {}) {
    return {
        _id: WS, name: 'Acme', company: null, type: 'company', createdBy: OWNER, isArchived: false, defaultChannels: [],
        settings: { allowMemberInvite: true },
        members: [
            { user: OWNER, role: 'owner', status: 'active' },
            { user: ADMIN, role: 'admin', status: 'active' },
            { user: MEMBER, role: 'member', status: 'active' },
            { user: SUSPENDED, role: 'member', status: 'suspended' },
        ],
        ...extra,
    };
}
function mkRes() {
    const r = {};
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
}
function mkReq({ user, params = {}, body = {}, query = {}, ...rest }) {
    const emit = jest.fn();
    return { user: { sub: user }, params, body, query, app: { get: () => ({ to: jest.fn(() => ({ emit })) }) }, ...rest };
}
const statusOf = (res) => (res.status.mock.calls[0] ? res.status.mock.calls[0][0] : 200);
const bodyOf = (res) => res.json.mock.calls[0][0];

let ws;
beforeEach(() => {
    jest.clearAllMocks();
    ws = makeWs();
    identity.workspaces.findById.mockImplementation(async () => ws);
    identity.workspaces.update.mockImplementation(async (_id, patch) => Object.assign(ws, patch));
    planService.assertCanCreateWorkspace.mockResolvedValue();
});

describe('transferOwnership', () => {
    const run = async (user, body) => {
        const res = mkRes();
        await lifecycle.transferOwnership(mkReq({ user, params: { id: WS }, body }), res);
        return res;
    };

    it('makes the member the owner and the old owner an admin', async () => {
        const res = await run(OWNER, { userId: MEMBER });
        expect(statusOf(res)).toBe(200);
        expect(identity.workspaces.updateMember).toHaveBeenCalledWith(WS, MEMBER, { role: 'owner' });
        expect(identity.workspaces.updateMember).toHaveBeenCalledWith(WS, OWNER, { role: 'admin' });
        expect(identity.workspaces.update).toHaveBeenCalledWith(WS, { createdBy: MEMBER });
        expect(bodyOf(res)).toMatchObject({ ownerId: MEMBER, yourRole: 'admin' });
    });

    it('is owner only', async () => {
        expect(statusOf(await run(ADMIN, { userId: MEMBER }))).toBe(403);
        expect(identity.workspaces.updateMember).not.toHaveBeenCalled();
    });

    it('refuses suspended people, outsiders, yourself and bad ids', async () => {
        expect(statusOf(await run(OWNER, { userId: SUSPENDED }))).toBe(400);
        expect(statusOf(await run(OWNER, { userId: oid(99) }))).toBe(400);
        expect(statusOf(await run(OWNER, { userId: OWNER }))).toBe(400);
        expect(statusOf(await run(OWNER, { userId: 'nope' }))).toBe(400);
        expect(identity.workspaces.updateMember).not.toHaveBeenCalled();
    });

    it('refuses personal workspaces', async () => {
        ws = makeWs({ type: 'personal' });
        expect(statusOf(await run(OWNER, { userId: MEMBER }))).toBe(400);
    });

    it('refuses when the new owner is at their workspace limit', async () => {
        planService.assertCanCreateWorkspace.mockRejectedValue(Object.assign(new Error('limit'), { code: 'PLAN_LIMIT' }));
        identity.users.findById.mockResolvedValue({ username: 'mia' });
        const res = await run(OWNER, { userId: MEMBER });
        expect(statusOf(res)).toBe(403);
        expect(bodyOf(res)).toMatchObject({ code: 'TARGET_PLAN_LIMIT' });
        expect(bodyOf(res).message).toMatch(/mia/);
        expect(identity.workspaces.updateMember).not.toHaveBeenCalled();
    });

    it('skips the plan check for company workspaces', async () => {
        ws = makeWs({ company: oid(500) });
        planService.assertCanCreateWorkspace.mockRejectedValue(Object.assign(new Error('limit'), { code: 'PLAN_LIMIT' }));
        expect(statusOf(await run(OWNER, { userId: MEMBER }))).toBe(200);
    });
});

describe('archive / unarchive', () => {
    it('the owner archives and restores', async () => {
        let res = mkRes();
        await lifecycle.archiveWorkspace(mkReq({ user: OWNER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(200);
        expect(identity.workspaces.update).toHaveBeenCalledWith(WS, expect.objectContaining({ isArchived: true }));
        expect(ws.isArchived).toBe(true);

        res = mkRes();
        await lifecycle.unarchiveWorkspace(mkReq({ user: OWNER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(200);
        expect(ws.isArchived).toBe(false);
        expect(ws.archivedAt).toBeNull();
    });

    it('admins cannot archive or restore', async () => {
        let res = mkRes();
        await lifecycle.archiveWorkspace(mkReq({ user: ADMIN, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(403);
        ws.isArchived = true;
        res = mkRes();
        await lifecycle.unarchiveWorkspace(mkReq({ user: ADMIN, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(403);
        expect(identity.workspaces.update).not.toHaveBeenCalled();
    });

    it('rejects archiving twice and personal workspaces', async () => {
        ws.isArchived = true;
        let res = mkRes();
        await lifecycle.archiveWorkspace(mkReq({ user: OWNER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(400);
        ws = makeWs({ type: 'personal' });
        res = mkRes();
        await lifecycle.archiveWorkspace(mkReq({ user: OWNER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(400);
    });
});

describe('setDefaultChannel', () => {
    function channel(extra = {}) {
        return { _id: CH, name: 'design', workspace: WS, isPrivate: false, isDefault: false, members: [{ user: OWNER }], save: jest.fn(async () => {}), ...extra };
    }
    const run = async (body, ch) => {
        Channel.findOne.mockResolvedValue(ch);
        const res = mkRes();
        await lifecycle.setDefaultChannel(mkReq({ user: ADMIN, params: { workspaceId: WS, channelId: CH }, body, workspace: ws }), res);
        return res;
    };

    it('turns a public channel into a default one and adds the active members', async () => {
        const ch = channel();
        const res = await run({ isDefault: true }, ch);
        expect(statusOf(res)).toBe(200);
        expect(ch.isDefault).toBe(true);
        const ids = ch.members.map((m) => String(m.user));
        expect(ids).toEqual(expect.arrayContaining([OWNER, ADMIN, MEMBER]));
        expect(ids).not.toContain(SUSPENDED);
        expect(bodyOf(res).added).toBe(2);
        expect(keys.distributeKeyToNewMember).toHaveBeenCalledTimes(2);
        expect(identity.workspaces.update).toHaveBeenCalledWith(WS, { defaultChannels: [CH] });
    });

    it('refuses private channels and non-boolean values', async () => {
        expect(statusOf(await run({ isDefault: true }, channel({ isPrivate: true })))).toBe(400);
        expect(statusOf(await run({ isDefault: 'yes' }, channel()))).toBe(400);
    });

    it('keeps at least one default channel', async () => {
        Channel.countDocuments.mockResolvedValue(0);
        expect(statusOf(await run({ isDefault: false }, channel({ isDefault: true })))).toBe(400);
        Channel.countDocuments.mockResolvedValue(1);
        const ch = channel({ isDefault: true });
        expect(statusOf(await run({ isDefault: false }, ch))).toBe(200);
        expect(ch.isDefault).toBe(false);
    });

    it('404s for channels of another workspace', async () => {
        expect(statusOf(await run({ isDefault: true }, null))).toBe(404);
    });
});

describe('requireInviteRight', () => {
    const run = (role, settings, body = { role: 'admin' }, plan = 'free') => {
        const req = { workspaceRole: role, workspace: { settings, plan }, body };
        const res = mkRes();
        const next = jest.fn();
        lifecycle.requireInviteRight(req, res, next);
        return { req, res, next };
    };

    it('lets admins invite with any role', () => {
        const { next, req } = run('admin', {});
        expect(next).toHaveBeenCalled();
        expect(req.body.role).toBe('admin');
    });

    it('lets members invite (as members only) once an admin turns the setting on', () => {
        const { next, req } = run('member', { membersMayInvite: true });
        expect(next).toHaveBeenCalled();
        expect(req.body.role).toBe('member');
    });

    it('stops members when the setting is off or was never turned on (existing workspaces)', () => {
        for (const settings of [{ membersMayInvite: false }, {}, { allowMemberInvite: true }]) {
            const { next, res } = run('member', settings);
            expect(next).not.toHaveBeenCalled();
            expect(statusOf(res)).toBe(403);
            expect(bodyOf(res).code).toBe('MEMBER_INVITES_OFF');
        }
    });

    it('lets everyone invite in an unlimited (enterprise) workspace', () => {
        const { next } = run('member', {}, { role: 'member' }, 'enterprise');
        expect(next).toHaveBeenCalled();
    });
});

describe('listMyWorkspaces and archived workspaces', () => {
    beforeEach(() => {
        identity.users.findById.mockResolvedValue({ _id: OWNER });
        const live = makeWs();
        const archived = makeWs({ _id: oid(2), name: 'Old', isArchived: true });
        wsQueries.membershipsForUser.mockResolvedValue([
            { workspace: live, role: 'owner', status: 'active' },
            { workspace: archived, role: 'owner', status: 'active' },
            { workspace: makeWs({ _id: oid(3), isArchived: true }), role: 'member', status: 'active' },
        ]);
    });

    it('hides archived workspaces by default', async () => {
        const res = mkRes();
        await ctrl.listMyWorkspaces(mkReq({ user: OWNER }), res);
        expect(bodyOf(res).workspaces.map((w) => w.name)).toEqual(['Acme']);
        expect(bodyOf(res).workspaces[0].isArchived).toBe(false);
    });

    it('shows the owner their archived workspaces when asked', async () => {
        const res = mkRes();
        await ctrl.listMyWorkspaces(mkReq({ user: OWNER, query: { includeArchived: '1' } }), res);
        const list = bodyOf(res).workspaces;
        expect(list.map((w) => w.id)).toEqual([WS, oid(2)]);
        expect(list[1].isArchived).toBe(true);
    });
});
