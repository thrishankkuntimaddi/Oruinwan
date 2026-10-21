'use strict';

/**
 * The create-workspace wizard: default channels (#general, #random, the project's channel),
 * team invite links that many people can use, and cancelled invites that no longer work.
 */

const mockChannels = [];
const mockInvites = new Map();

jest.mock('../../../identity', () => ({
    users: { findById: jest.fn(), findManyByIds: jest.fn(), update: jest.fn() },
    workspaces: { findById: jest.fn(), create: jest.fn(), update: jest.fn(), addMember: jest.fn() },
}));
jest.mock('../../../identity/queries/workspaces', () => ({
    countCreatedBy: jest.fn(async () => 0), findByNameForCreator: jest.fn(async () => null),
}));
jest.mock('../../../identity/hydrate', () => ({ ...jest.requireActual('../../../identity/hydrate'), hydrate: jest.fn(async (d) => d) }));
jest.mock('../../channels/channel.model.js', () => ({
    create: jest.fn(async (doc) => { const c = { _id: `ch${mockChannels.length + 1}`, ...doc }; mockChannels.push(c); return c; }),
    find: jest.fn(async () => []),
}));
jest.mock('../../../modules/messages/message.model.js', () => ({}));
jest.mock('../../../../models/DMSession', () => ({}));
jest.mock('../../../../models/Note', () => ({}));
jest.mock('../../../../models/Update', () => ({}));
jest.mock('../../../../models/Favorite', () => ({}));
jest.mock('../../../identity/queries/auth', () => ({
    invites: {
        create: jest.fn(async (data) => { const inv = { _id: `inv${mockInvites.size + 1}`, used: false, status: 'pending', metadata: {}, ...data }; mockInvites.set(data.tokenHash, inv); return inv; }),
        findByTokenHash: jest.fn(async (h) => mockInvites.get(h) || null),
        update: jest.fn(async (id, patch) => {
            const inv = [...mockInvites.values()].find((i) => i._id === id);
            Object.assign(inv, patch);
            return inv;
        }),
    },
}));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({
    bootstrapConversationKey: jest.fn(async () => {}), hasConversationKeys: jest.fn(async () => false),
}));
jest.mock('../../../modules/messages/messages.service', () => ({}));
jest.mock('../../../shared/events/bus', () => ({ publish: jest.fn(async () => {}) }));
jest.mock('../../../modules/notifications/notificationService', () => ({ memberJoined: jest.fn(async () => {}) }));

const crypto = require('crypto');
const identity = require('../../../identity');
const ctrl = require('../workspace.controller');
const { projectChannelName, inviteProblem } = ctrl._internal;

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

function call(handler, { body = {}, params = {}, userId = 'owner1' } = {}) {
    const req = { body, params, user: { sub: userId }, app: { get: () => null } };
    const res = {
        statusCode: 200, body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
    return handler(req, res).then(() => res);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockChannels.length = 0;
    mockInvites.clear();
    identity.users.findById.mockResolvedValue({ _id: 'owner1', username: 'Sam', companyId: null });
    identity.workspaces.create.mockImplementation(async (d) => ({ _id: 'ws1', ...d }));
    identity.workspaces.update.mockImplementation(async (id, patch) => ({ _id: id, name: 'Acme', ...patch }));
});

describe('project channel names', () => {
    test('turn a project into a channel name', () => {
        expect(projectChannelName('Website redesign!')).toBe('website-redesign');
        expect(projectChannelName('  Q4 Launch  ')).toBe('q4-launch');
        expect(projectChannelName('Café menu')).toBe('cafe-menu');
        expect(projectChannelName('!!!')).toBe('');
        expect(projectChannelName('x'.repeat(100))).toHaveLength(60);
    });
});

describe('creating a workspace', () => {
    test('creates #general, #random and a channel for the project', async () => {
        const res = await call(ctrl.createWorkspace, { body: { name: 'Acme', project: 'Website redesign' } });
        expect(res.statusCode).toBe(201);
        expect(mockChannels.map((c) => c.name)).toEqual(['general', 'random', 'website-redesign']);
        expect(mockChannels.every((c) => c.isDefault && !c.isPrivate)).toBe(true);
        // Made with the workspace: none of them counts against the free plan's 10 channels.
        expect(mockChannels.every((c) => c.autoCreated === true)).toBe(true);
        expect(res.body.workspace.channels.map((c) => c.name)).toEqual(['general', 'random', 'website-redesign']);
    });

    test('without a project, creates #general and #random only', async () => {
        await call(ctrl.createWorkspace, { body: { name: 'Acme' } });
        expect(mockChannels.map((c) => c.name)).toEqual(['general', 'random']);
    });

    test('a project named like a default channel adds nothing extra', async () => {
        await call(ctrl.createWorkspace, { body: { name: 'Acme', project: 'Random' } });
        expect(mockChannels.map((c) => c.name)).toEqual(['general', 'random']);
    });
});

describe('invites', () => {
    const workspace = { _id: 'ws1', name: 'Acme', company: null, members: [{ user: 'owner1', role: 'owner' }] };

    beforeEach(() => {
        identity.workspaces.findById.mockResolvedValue(workspace);
        identity.users.findById.mockImplementation(async (id) => ({ _id: id, username: id }));
    });

    async function makeLink(reusable) {
        const res = await call(ctrl.inviteToWorkspace, { params: { workspaceId: 'ws1', id: 'ws1' }, body: { inviteType: 'link', reusable } });
        expect(res.statusCode).toBe(200);
        return new URL(res.body.inviteLink).searchParams.get('token');
    }

    test('a team link lets several people join', async () => {
        const token = await makeLink(true);
        expect((await call(ctrl.joinWorkspace, { body: { token }, userId: 'u2' })).statusCode).toBe(200);
        expect((await call(ctrl.joinWorkspace, { body: { token }, userId: 'u3' })).statusCode).toBe(200);
        expect(mockInvites.get(sha256(token)).metadata.uses).toBe(2);
    });

    test('a one-person link works once', async () => {
        const token = await makeLink(false);
        expect((await call(ctrl.joinWorkspace, { body: { token }, userId: 'u2' })).statusCode).toBe(200);
        const again = await call(ctrl.joinWorkspace, { body: { token }, userId: 'u3' });
        expect(again.statusCode).toBe(400);
    });

    test('a cancelled invite no longer works', async () => {
        const token = await makeLink(true);
        mockInvites.get(sha256(token)).status = 'revoked';
        const res = await call(ctrl.joinWorkspace, { body: { token }, userId: 'u2' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/cancelled/);
        expect(identity.workspaces.addMember).not.toHaveBeenCalled();
        expect((await call(ctrl.getInviteDetails, { params: { token } })).statusCode).toBe(400);
    });

    test('inviteProblem covers expired links', () => {
        expect(inviteProblem({ expiresAt: new Date(Date.now() - 1000), metadata: {} }).message).toMatch(/expired/);
        expect(inviteProblem({ expiresAt: new Date(Date.now() + 1000), metadata: {} })).toBeNull();
        expect(inviteProblem(null).status).toBe(404);
    });
});
