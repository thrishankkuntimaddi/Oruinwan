'use strict';

/**
 * Workspace settings/rules persistence, member listing, leave, delete clean-up
 * and admin hierarchy (W1-W7).
 */

jest.mock('../../../../models/Workspace', () => ({ findById: jest.fn(), findOne: jest.fn(), updateOne: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock('../../../../models/User', () => ({ findById: jest.fn(), updateOne: jest.fn(), updateMany: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../channels/channel.model.js', () => ({ updateMany: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../../../modules/messages/message.model.js', () => ({ deleteMany: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ updateMany: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../../../../models/Task', () => ({ deleteMany: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ deleteMany: jest.fn() }));
jest.mock('../../../../models/Update', () => ({ deleteMany: jest.fn() }));
jest.mock('../../../../models/Favorite', () => ({ deleteMany: jest.fn() }));
jest.mock('../../../../models/Invite', () => ({ deleteMany: jest.fn() }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({}));
jest.mock('../../../modules/messages/messages.service', () => ({}));
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn() }));
jest.mock('../../developer/apiKey.model', () => ({ updateMany: jest.fn() }));
jest.mock('../../developer/bot.model', () => ({ updateMany: jest.fn() }));
jest.mock('../../integrations/webhook.model', () => ({ updateMany: jest.fn() }));

const Workspace = require('../../../../models/Workspace');
const User = require('../../../../models/User');
const Channel = require('../../channels/channel.model.js');
const ApiKey = require('../../developer/apiKey.model');
const Bot = require('../../developer/bot.model');
const Webhook = require('../../integrations/webhook.model');
const ctrl = require('../workspace.controller');
const admin = require('../workspace-admin.controller');
const requireWorkspaceMember = require('../../../shared/middleware/requireWorkspaceMember');

const oid = (n) => n.toString(16).padStart(24, '0');
const WS = oid(1);
const OWNER = oid(11);
const ADMIN = oid(12);
const ADMIN2 = oid(13);
const MEMBER = oid(14);
const SUSPENDED = oid(15);
const OUTSIDER = oid(99);

function makeWs() {
    const members = [
        { user: OWNER, role: 'owner', status: 'active' },
        { user: ADMIN, role: 'admin', status: 'active' },
        { user: ADMIN2, role: 'admin', status: 'active' },
        { user: MEMBER, role: 'member', status: 'active' },
        { user: SUSPENDED, role: 'member', status: 'suspended' },
    ];
    return {
        _id: WS, name: 'W', company: null, rules: '', icon: 'x', description: '',
        settings: { allowMemberInvite: true, allowMemberChannelCreation: true, ai: { enabled: true } },
        members,
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
    };
}

function mkRes() {
    const r = {};
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
}
function mkReq({ user, params = {}, body = {}, query = {} }) {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    return { user: { sub: user }, params, body, query, app: { get: () => ({ to }) }, _to: to, _emit: emit };
}
const statusOf = (res) => (res.status.mock.calls[0] ? res.status.mock.calls[0][0] : 200);
const bodyOf = (res) => res.json.mock.calls[0][0];

let ws;
beforeEach(() => {
    ws = makeWs();
    Workspace.findById.mockImplementation(() => Promise.resolve(ws));
});

describe('W1 updateWorkspace', () => {
    test('persists rules and settings from body.settings and top-level keys', async () => {
        const req = mkReq({ user: ADMIN, params: { id: WS }, body: { rules: 'Be kind', settings: { allowMemberInvite: false }, allowMemberChannelCreation: false } });
        const res = mkRes();
        await ctrl.updateWorkspace(req, res);
        expect(statusOf(res)).toBe(200);
        expect(ws.rules).toBe('Be kind');
        expect(ws.settings.allowMemberInvite).toBe(false);
        expect(ws.settings.allowMemberChannelCreation).toBe(false);
        expect(bodyOf(res).workspace.settings).not.toHaveProperty('ai');
        expect(ws.save).toHaveBeenCalled();
    });
    test('rejects oversized rules, non-boolean settings and malformed ids with 400', async () => {
        for (const body of [{ rules: 'x'.repeat(5001) }, { settings: { allowMemberInvite: 'no' } }, { settings: 'bad' }]) {
            const res = mkRes();
            await ctrl.updateWorkspace(mkReq({ user: ADMIN, params: { id: WS }, body }), res);
            expect(statusOf(res)).toBe(400);
            expect(bodyOf(res)).toHaveProperty('message');
        }
        const res = mkRes();
        await ctrl.updateWorkspace(mkReq({ user: ADMIN, params: { id: 'nope' }, body: {} }), res);
        expect(statusOf(res)).toBe(400);
        expect(ws.save).not.toHaveBeenCalled();
    });
    test('plain members get 403', async () => {
        const res = mkRes();
        await ctrl.updateWorkspace(mkReq({ user: MEMBER, params: { id: WS }, body: { rules: 'x' } }), res);
        expect(statusOf(res)).toBe(403);
    });
    test('listMyWorkspaces returns rules, safe settings and active member count', async () => {
        const populated = { _id: WS, name: 'W', rules: 'R', settings: ws.settings, members: ws.members, type: 'team' };
        User.findById.mockReturnValue({ populate: () => Promise.resolve({ workspaces: [{ workspace: populated, role: 'member' }] }) });
        Workspace.findById.mockReturnValue({ populate: () => ({ lean: () => Promise.resolve({ ...populated, createdBy: { _id: OWNER, username: 'o' } }) }) });
        const res = mkRes();
        await ctrl.listMyWorkspaces(mkReq({ user: ADMIN }), res);
        const [w] = bodyOf(res).workspaces;
        expect(w.rules).toBe('R');
        expect(w.settings).toEqual({ allowMemberInvite: true, allowMemberChannelCreation: true });
        expect(w.memberCount).toBe(4);
        expect(w.role).toBe('admin');
    });
});

describe('W3 getWorkspaceMembers', () => {
    test('includes the caller with role and membershipStatus', async () => {
        const populated = makeWs();
        populated.members = populated.members.map(m => ({ ...m, user: { _id: m.user, username: 'u' + m.user.slice(-2), isOnline: false } }));
        Workspace.findById.mockReturnValue({ populate: () => Promise.resolve(populated) });
        const res = mkRes();
        await ctrl.getWorkspaceMembers(mkReq({ user: MEMBER, params: { workspaceId: WS } }), res);
        const { members } = bodyOf(res);
        const me = members.find(m => String(m._id) === MEMBER);
        expect(me).toMatchObject({ role: 'member', membershipStatus: 'active', isCurrentUser: true, status: 'offline' });
        expect(members.find(m => String(m._id) === SUSPENDED).membershipStatus).toBe('suspended');
    });
});

describe('W4 leaveWorkspace', () => {
    test('owner gets 400', async () => {
        const res = mkRes();
        await ctrl.leaveWorkspace(mkReq({ user: OWNER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(400);
        expect(bodyOf(res).message).toBe('Transfer ownership before leaving');
    });
    test('non-member gets 403', async () => {
        const res = mkRes();
        await ctrl.leaveWorkspace(mkReq({ user: OUTSIDER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(403);
    });
    test('member is removed from workspace, channels and User.workspaces', async () => {
        const res = mkRes();
        await ctrl.leaveWorkspace(mkReq({ user: MEMBER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(200);
        expect(Workspace.updateOne).toHaveBeenCalledWith({ _id: WS }, { $pull: { members: { user: MEMBER } } });
        expect(Channel.updateMany).toHaveBeenCalledWith({ workspace: WS }, { $pull: { members: { user: MEMBER }, admins: MEMBER } });
        expect(User.updateOne).toHaveBeenCalledWith({ _id: MEMBER }, { $pull: { workspaces: { workspace: WS } } });
    });
});

describe('W6 deleteWorkspace', () => {
    test('deactivates API keys, bots and webhooks', async () => {
        const res = mkRes();
        await ctrl.deleteWorkspace(mkReq({ user: OWNER, params: { id: WS } }), res);
        expect(statusOf(res)).toBe(200);
        expect(ApiKey.updateMany).toHaveBeenCalledWith({ workspaceId: WS }, { $set: { isActive: false } });
        expect(Bot.updateMany).toHaveBeenCalledWith({ workspaceId: WS }, { $set: { isActive: false } });
        expect(Webhook.updateMany).toHaveBeenCalledWith({ workspaceId: WS }, expect.objectContaining({ $set: expect.objectContaining({ isActive: false }) }));
    });
});

describe('W2/W5 admin hierarchy', () => {
    test('admin cannot suspend, demote or remove another admin; owner can', async () => {
        let res = mkRes();
        await admin.suspendMember(mkReq({ user: ADMIN, params: { workspaceId: WS, userId: ADMIN2 } }), res);
        expect(statusOf(res)).toBe(403);

        res = mkRes();
        await admin.changeRole(mkReq({ user: ADMIN, params: { workspaceId: WS, userId: ADMIN2 }, body: { newRole: 'member' } }), res);
        expect(statusOf(res)).toBe(403);

        res = mkRes();
        await admin.removeMember(mkReq({ user: ADMIN, params: { workspaceId: WS }, body: { userId: ADMIN2 } }), res);
        expect(statusOf(res)).toBe(403);

        res = mkRes();
        await admin.removeMember(mkReq({ user: ADMIN, params: { workspaceId: WS }, body: { userId: OWNER } }), res);
        expect(statusOf(res)).toBe(403);

        res = mkRes();
        const req = mkReq({ user: OWNER, params: { workspaceId: WS, userId: ADMIN2 } });
        await admin.suspendMember(req, res);
        expect(statusOf(res)).toBe(200);
        expect(req._to).toHaveBeenCalledWith(`user_${ADMIN2}`);
        expect(req._emit).toHaveBeenCalledWith('workspace:access-revoked', { workspaceId: WS, reason: 'suspended' });
    });

    test('a suspended admin cannot act', async () => {
        ws.members.find(m => m.user === ADMIN).status = 'suspended';
        const res = mkRes();
        await admin.suspendMember(mkReq({ user: ADMIN, params: { workspaceId: WS, userId: MEMBER } }), res);
        expect(statusOf(res)).toBe(403);
    });

    test('changeRole updates User.workspaces and notifies the user', async () => {
        const req = mkReq({ user: ADMIN, params: { workspaceId: WS, userId: MEMBER }, body: { newRole: 'admin' } });
        const res = mkRes();
        await admin.changeRole(req, res);
        expect(statusOf(res)).toBe(200);
        expect(User.updateOne).toHaveBeenCalledWith(
            { _id: MEMBER, 'workspaces.workspace': WS },
            { $set: { 'workspaces.$.role': 'admin' } }
        );
        expect(req._to).toHaveBeenCalledWith(`user_${MEMBER}`);
        expect(req._emit).toHaveBeenCalledWith('workspace:role-updated', { workspaceId: WS, userId: MEMBER, role: 'admin' });
    });

    test('removeMember pulls channel membership by user and revokes access', async () => {
        const req = mkReq({ user: ADMIN, params: { workspaceId: WS }, body: { userId: MEMBER } });
        const res = mkRes();
        await admin.removeMember(req, res);
        expect(statusOf(res)).toBe(200);
        expect(Channel.updateMany).toHaveBeenCalledWith({ workspace: WS }, { $pull: { members: { user: MEMBER }, admins: MEMBER } });
        expect(req._emit).toHaveBeenCalledWith('workspace:access-revoked', { workspaceId: WS, reason: 'removed' });
    });

    test('malformed ids give 400', async () => {
        const res = mkRes();
        await admin.suspendMember(mkReq({ user: OWNER, params: { workspaceId: WS, userId: 'bad' } }), res);
        expect(statusOf(res)).toBe(400);
    });
});

describe('W7 requireWorkspaceMember', () => {
    test('errors carry { message }; malformed id is 400', async () => {
        let res = mkRes();
        const next = jest.fn();
        await requireWorkspaceMember({ params: { workspaceId: 'bad' }, user: { sub: MEMBER } }, res, next);
        expect(statusOf(res)).toBe(400);
        expect(bodyOf(res).message).toBeTruthy();

        Workspace.findOne.mockReturnValue({ lean: () => Promise.resolve(makeWs()) });
        res = mkRes();
        await requireWorkspaceMember({ params: { workspaceId: WS }, user: { sub: SUSPENDED } }, res, next);
        expect(statusOf(res)).toBe(403);
        expect(bodyOf(res).message).toBeTruthy();
        expect(next).not.toHaveBeenCalled();
    });
});
