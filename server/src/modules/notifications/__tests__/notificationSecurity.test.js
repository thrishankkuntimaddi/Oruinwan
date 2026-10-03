'use strict';

/**
 * Notifications security + contract: membership-gated delivery (N3), task
 * links/types/labels (N1/N2), multi-tab sync events (N4), 400 for malformed
 * ids (N6) and the account-level preferences endpoint (N5).
 */

jest.mock('../notification.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    deleteMany: jest.fn(),
}));
jest.mock('../notificationPreferenceService', () => ({
    getUserPreferences: jest.fn(),
    updateUserPreferences: jest.fn(),
}));
jest.mock('../../../features/push/push.service', () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) }));
// Users and workspaces live in PostgreSQL: the identity repositories are mocked.
jest.mock('../../../identity', () => ({
    workspaces: { findById: jest.fn() },
    users: { findById: jest.fn() },
}));
jest.mock('../../../identity/queries/auth', () => ({ setUserPaths: jest.fn() }));
jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-test-user'] };
    next();
});

const express = require('express');
const Notification = require('../notification.model');
const prefService = require('../notificationPreferenceService');
const identity = require('../../../identity');
const authQueries = require('../../../identity/queries/auth');
const notificationService = require('../notificationService');

const WS = '64b000000000000000000001';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';
const CAROL = '64b0000000000000000000c1';
const SUSPENDED = '64b0000000000000000000d1';
const TASK = '64b0000000000000000000e1';
const NOTIF = '64b0000000000000000000f1';

const workspaceDoc = {
    _id: WS,
    members: [
        { user: ALICE, role: 'owner', status: 'active' },
        { user: BOB, role: 'member', status: 'active' },
        { user: SUSPENDED, role: 'member', status: 'suspended' },
    ],
};

function fakeIo() {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    return { to, emit };
}

beforeEach(() => {
    jest.clearAllMocks();
    identity.workspaces.findById.mockResolvedValue(workspaceDoc);
    prefService.getUserPreferences.mockResolvedValue({ task: true, message: true, push: false });
    Notification.create.mockImplementation(async (doc) => ({ ...doc, _id: NOTIF, toObject: () => ({ ...doc, _id: NOTIF }) }));
});

describe('notificationService (N1-N3 + labels)', () => {
    test('does not notify non-members, suspended members or malformed workspace ids', async () => {
        const io = fakeIo();
        const base = { workspaceId: WS, type: 'digest', title: 't' };
        expect(await notificationService.create(io, { ...base, recipient: CAROL })).toBeNull();
        expect(await notificationService.create(io, { ...base, recipient: SUSPENDED })).toBeNull();
        expect(await notificationService.create(io, { ...base, workspaceId: 'not-an-id', recipient: BOB })).toBeNull();
        expect(Notification.create).not.toHaveBeenCalled();
        expect(prefService.getUserPreferences).not.toHaveBeenCalled(); // no pref upsert for non-members
        expect(await notificationService.create(io, { ...base, recipient: BOB })).not.toBeNull();
    });

    test('createMany loads the workspace once and filters to active members', async () => {
        const out = await notificationService.createMany(fakeIo(), [ALICE, BOB, CAROL, SUSPENDED], { workspaceId: WS, type: 'digest', title: 't' });
        expect(out.map(n => n.recipient).sort()).toEqual([ALICE, BOB].sort());
        expect(identity.workspaces.findById).toHaveBeenCalledTimes(1);
    });

    test('task links point at /workspace/<ws>/tasks/<id>', async () => {
        const n = await notificationService.taskAssigned(fakeIo(), { assigneeId: BOB, assignerUsername: 'alice', workspaceId: WS, taskTitle: 'T', taskId: TASK });
        expect(n.link).toBe(`/workspace/${WS}/tasks/${TASK}`);
        const [removed] = await notificationService.taskRemoved(fakeIo(), { recipientIds: [BOB], actorUsername: 'alice', workspaceId: WS, taskTitle: 'T', taskId: TASK, reason: 'deleted' });
        expect(removed.link).toBe(`/workspace/${WS}/tasks`);
    });

    test('status change uses task_status with human labels', async () => {
        const [n] = await notificationService.taskStatusChanged(fakeIo(), {
            recipientIds: [BOB], changerUsername: 'alice', workspaceId: WS, taskTitle: 'T', taskId: TASK, from: 'todo', to: 'in_progress',
        });
        expect(n.type).toBe('task_status');
        expect(n.body).toBe('To do → In progress');
        expect(n.link).toBe(`/workspace/${WS}/tasks/${TASK}`);
        expect(notificationService.PREF_KEY_BY_TYPE.task_status).toBe('task');
    });

    test('label helpers', () => {
        const { statusLabel, priorityLabel } = notificationService;
        expect(['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'].map(statusLabel))
            .toEqual(['Backlog', 'To do', 'In progress', 'In review', 'Blocked', 'Done', 'Cancelled']);
        expect(['lowest', 'low', 'medium', 'high', 'highest'].map(priorityLabel))
            .toEqual(['Lowest', 'Low', 'Medium', 'High', 'Highest']);
    });

    test('task_status is an allowed Notification type', () => {
        const src = require('fs').readFileSync(require.resolve('../notification.model'), 'utf8');
        expect(src).toMatch(/'task_status'/);
    });
});

describe('notification routes (N3, N4, N6) and account prefs (N5)', () => {
    let server; let base; const emits = [];
    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.set('io', { to: (room) => ({ emit: (event, payload) => emits.push({ room, event, payload }) }) });
        app.use('/api/notifications', require('../notifications.routes'));
        const { getNotificationPreferences, updateNotificationPreferences } = require('../../../features/auth/notificationPreferences');
        const auth = require('../../../shared/middleware/auth');
        app.get('/api/auth/me/preferences/notifications', auth, getNotificationPreferences);
        app.put('/api/auth/me/preferences/notifications', auth, updateNotificationPreferences);
        await new Promise(r => { server = app.listen(0, r); });
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(() => new Promise(r => server.close(r)));
    beforeEach(() => { emits.length = 0; });

    const call = (method, path, user, body) => fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-test-user': user },
        body: body ? JSON.stringify(body) : undefined,
    }).then(async r => ({ status: r.status, body: await r.json() }));

    test('malformed workspaceId / notification id -> 400 { message }', async () => {
        for (const [m, p] of [['GET', '/api/notifications?workspaceId=bad'], ['GET', '/api/notifications/unread-count?workspaceId=bad'],
            ['PATCH', '/api/notifications/read-all?workspaceId=bad'], ['DELETE', '/api/notifications?workspaceId=bad'],
            ['GET', '/api/notifications/preferences?workspaceId=bad'], ['PATCH', '/api/notifications/bad/read'], ['DELETE', '/api/notifications/bad']]) {
            const r = await call(m, p, ALICE);
            expect(r.status).toBe(400);
            expect(r.body).toHaveProperty('message');
        }
    });

    test('preferences require membership; no upsert for non-members', async () => {
        const r = await call('GET', `/api/notifications/preferences?workspaceId=${WS}`, CAROL);
        expect(r.status).toBe(403);
        const r2 = await call('PATCH', `/api/notifications/preferences?workspaceId=${WS}`, CAROL, { task: false });
        expect(r2.status).toBe(403);
        expect(prefService.getUserPreferences).not.toHaveBeenCalled();
        expect(prefService.updateUserPreferences).not.toHaveBeenCalled();

        prefService.getUserPreferences.mockResolvedValue({ task: true });
        const ok = await call('GET', `/api/notifications/preferences?workspaceId=${WS}`, BOB);
        expect(ok.status).toBe(200);
        expect(ok.body.preferences).toEqual({ task: true });
    });

    test('read / read-all / delete / clear emit sync events to the personal room', async () => {
        Notification.findOneAndUpdate.mockResolvedValue({ _id: NOTIF, workspaceId: WS });
        Notification.findOneAndDelete.mockResolvedValue({ _id: NOTIF, workspaceId: WS });
        Notification.updateMany.mockResolvedValue({});
        Notification.deleteMany.mockResolvedValue({});

        expect((await call('PATCH', `/api/notifications/${NOTIF}/read`, BOB)).status).toBe(200);
        expect((await call('PATCH', `/api/notifications/read-all?workspaceId=${WS}`, BOB)).status).toBe(200);
        expect((await call('DELETE', `/api/notifications/${NOTIF}`, BOB)).status).toBe(200);
        expect((await call('DELETE', `/api/notifications?workspaceId=${WS}`, BOB)).status).toBe(200);

        expect(emits).toEqual([
            { room: `user:${BOB}`, event: 'notification:read', payload: { ids: [NOTIF], workspaceId: WS } },
            { room: `user:${BOB}`, event: 'notification:read-all', payload: { workspaceId: WS } },
            { room: `user:${BOB}`, event: 'notification:deleted', payload: { ids: [NOTIF], workspaceId: WS } },
            { room: `user:${BOB}`, event: 'notification:cleared', payload: { workspaceId: WS } },
        ]);
        // scoped to the caller
        expect(Notification.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: NOTIF, recipient: BOB });
    });

    test('account notification preferences: defaults, booleans only, partial update', async () => {
        identity.users.findById.mockResolvedValue({ _id: BOB, preferences: {} });
        const g = await call('GET', '/api/auth/me/preferences/notifications', BOB);
        expect(g.status).toBe(200);
        expect(g.body).toEqual({ emailDigest: true, marketingEmails: false, desktopPush: true, sound: true, mentionsOnly: false, dmNotifications: true });

        const bad = await call('PUT', '/api/auth/me/preferences/notifications', BOB, { sound: 'no' });
        expect(bad.status).toBe(400);
        expect(authQueries.setUserPaths).not.toHaveBeenCalled();

        authQueries.setUserPaths.mockResolvedValue({ _id: BOB, preferences: { notifications: { sound: false } } });
        const ok = await call('PUT', '/api/auth/me/preferences/notifications', BOB, { sound: false, hacker: true });
        expect(ok.status).toBe(200);
        expect(ok.body.sound).toBe(false);
        expect(authQueries.setUserPaths.mock.calls[0][1]).toEqual({ 'preferences.notifications.sound': false });
    });
});
