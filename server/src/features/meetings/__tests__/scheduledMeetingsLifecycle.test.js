'use strict';

/**
 * Scheduled meetings: who gets the invite, what "upcoming" includes, and meetings
 * completing when their huddle ends. Models are mocked; Express on a random port.
 */

const http = require('http');
const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../identity/workspaces.repo', () => ({
    findById: jest.fn(), findManyByIds: jest.fn(async () => []), membership: jest.fn(), memberWorkspaceIds: jest.fn(async () => []),
}));
jest.mock('../../../identity/users.repo', () => ({ findManyByIds: jest.fn(async () => new Map()), findById: jest.fn(async () => null) }));
jest.mock('../../../models/ScheduledMeeting', () => ({
    findById: jest.fn(), find: jest.fn(), create: jest.fn(), deleteOne: jest.fn(), updateOne: jest.fn(), updateMany: jest.fn(),
}));
jest.mock('../../../modules/notifications/notificationService', () => ({ scheduleCreated: jest.fn(async () => []) }));
jest.mock('../../../modules/threads/threadAccess', () => ({
    checkConversationAccess: jest.fn(async ({ channel }, uid) => (channel && uid !== '64b0000000000000000000c9' ? { ok: true } : { ok: false, status: 404 })),
}));
jest.mock('../../channels/channel.model', () => ({ findById: jest.fn() }));
jest.mock('../../ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn() }));

const workspacesRepo = require('../../../identity/workspaces.repo');
const ScheduledMeeting = require('../../../models/ScheduledMeeting');
const Channel = require('../../channels/channel.model');
const notifications = require('../../../modules/notifications/notificationService');
const { completeMeetingsForHuddle } = require('../meetings.service');

const WS = '64b000000000000000000001';
const MEETING = '64b0000000000000000000e1';
const CHANNEL = '64b0000000000000000000f1';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';
const CAROL = '64b0000000000000000000b2';
const DAVE = '64b0000000000000000000b3';
const NOT_IN_CHANNEL = '64b0000000000000000000c9';

const workspace = {
    _id: WS, company: null,
    members: [ALICE, BOB, CAROL, DAVE, NOT_IN_CHANNEL].map((user, i) => ({ user, role: i ? 'member' : 'owner', status: 'active' })),
};

function chain(value) {
    const c = { select: () => c, sort: () => c, limit: () => c, lean: () => Promise.resolve(value), then: (res, rej) => Promise.resolve(value).then(res, rej) };
    return c;
}

let server, base;
beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.io = { to: () => ({ emit: () => {} }) }; next(); });
    app.use('/api/scheduled-meetings', require('../../../shared/middleware/auth'), require('../scheduled-meetings.routes'));
    server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll((done) => { server.close(done); });

beforeEach(() => {
    jest.clearAllMocks();
    workspacesRepo.findById.mockImplementation(async (id) => (String(id) === WS ? workspace : null));
    ScheduledMeeting.create.mockImplementation(async (doc) => ({ ...doc, _id: MEETING }));
    Channel.findById.mockImplementation(() => chain({ _id: CHANNEL, workspace: WS, members: [{ user: ALICE }, { user: BOB }] }));
});

const call = async (method, path, user, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
};
const soon = () => new Date(Date.now() + 3600e3).toISOString();

describe('POST /api/scheduled-meetings invites', () => {
    it('invites only the people picked', async () => {
        const res = await call('POST', '/api/scheduled-meetings', ALICE, { workspaceId: WS, title: 'Design review', startTime: soon(), participants: [CAROL] });
        expect(res.status).toBe(201);
        expect(notifications.scheduleCreated.mock.calls[0][1]).toMatchObject({ recipientIds: [CAROL], scheduledMeetingId: MEETING });
    });

    it('invites the channel when the meeting is placed in one', async () => {
        const res = await call('POST', '/api/scheduled-meetings', ALICE, { workspaceId: WS, channelId: CHANNEL, title: 'Standup', startTime: soon() });
        expect(res.status).toBe(201);
        expect(notifications.scheduleCreated.mock.calls[0][1].recipientIds).toEqual([BOB]);
    });

    it('invites the whole workspace when nobody is picked', async () => {
        await call('POST', '/api/scheduled-meetings', ALICE, { workspaceId: WS, title: 'All hands', startTime: soon() });
        expect(notifications.scheduleCreated.mock.calls[0][1].recipientIds).toEqual([BOB, CAROL, DAVE, NOT_IN_CHANNEL]);
    });

    it('refuses to place a meeting in a channel the organiser is not in', async () => {
        const res = await call('POST', '/api/scheduled-meetings', NOT_IN_CHANNEL, { workspaceId: WS, channelId: CHANNEL, title: 'Sneaky', startTime: soon() });
        expect(res.status).toBe(403);
        expect(ScheduledMeeting.create).not.toHaveBeenCalled();
    });
});

describe('GET /api/scheduled-meetings', () => {
    it('keeps meetings that have started but are not over, and live ones', async () => {
        const now = Date.now();
        ScheduledMeeting.find.mockImplementation(() => chain([
            { _id: 'over', status: 'scheduled', startTime: new Date(now - 2 * 3600e3), duration: 30 },
            { _id: 'running', status: 'scheduled', startTime: new Date(now - 10 * 60e3), duration: 30 },
            { _id: 'live', status: 'live', startTime: new Date(now - 5 * 3600e3), duration: 30 },
            { _id: 'later', status: 'scheduled', startTime: new Date(now + 3600e3), duration: 30 },
        ]));
        const res = await call('GET', `/api/scheduled-meetings?workspaceId=${WS}`, BOB);
        expect(res.status).toBe(200);
        expect(res.body.meetings.map((m) => m._id)).toEqual(['running', 'live', 'later']);
    });
});

describe('completeMeetingsForHuddle', () => {
    it("completes the meeting's own huddle and live meetings of the huddle's channel", async () => {
        ScheduledMeeting.find.mockImplementation(() => chain([{ _id: MEETING, workspaceId: WS, title: 'Standup' }]));
        ScheduledMeeting.updateMany.mockResolvedValue({});
        const emitted = [];
        const io = { to: (room) => ({ emit: (e, p) => emitted.push({ room, e, p }) }) };

        const done = await completeMeetingsForHuddle({ huddleId: `meeting-${MEETING}`, channelId: CHANNEL }, io);

        expect(done).toEqual([MEETING]);
        expect(ScheduledMeeting.find.mock.calls[0][0]).toEqual({ status: 'live', $or: [{ _id: MEETING }, { channelId: CHANNEL }] });
        expect(ScheduledMeeting.updateMany).toHaveBeenCalledWith({ _id: { $in: [MEETING] } }, { $set: { status: 'completed' } });
        expect(emitted[0]).toMatchObject({ room: `workspace:${WS}`, e: 'schedule:updated', p: { meeting: { status: 'completed' } } });
    });

    it('does nothing for a plain workspace huddle', async () => {
        expect(await completeMeetingsForHuddle({ huddleId: 'abc', workspaceId: WS }, null)).toEqual([]);
        expect(ScheduledMeeting.find).not.toHaveBeenCalled();
    });
});
