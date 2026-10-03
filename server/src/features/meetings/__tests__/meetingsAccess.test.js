'use strict';

// HTTP-level access checks for /api/v2/meetings, /api/scheduled-meetings and
// /api/v2/collaboration. Models are mocked; a real Express app is served on a
// random port and hit with fetch.

const http = require('http');
const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
// Workspaces and users live in PostgreSQL: mock the identity repositories.
jest.mock('../../../identity/workspaces.repo', () => ({
    findById: jest.fn(), findManyByIds: jest.fn(async () => []), membership: jest.fn(), memberWorkspaceIds: jest.fn(async () => []),
}));
jest.mock('../../../identity/users.repo', () => ({ findManyByIds: jest.fn(async () => new Map()), findById: jest.fn(async () => null) }));
jest.mock('../../../models/ScheduledMeeting', () => ({
    findById: jest.fn(), find: jest.fn(), create: jest.fn(), deleteOne: jest.fn(), updateOne: jest.fn(),
}));
jest.mock('../meetings.service', () => ({
    getMeetings: jest.fn(async () => []),
    getMeeting: jest.fn(async (id) => ({ _id: id, title: 'Standup' })),
    joinMeeting: jest.fn(async (id) => ({ _id: id })),
    endMeeting: jest.fn(async (id) => ({ _id: id })),
    updateAgenda: jest.fn(async (id, agenda) => ({ _id: id, agenda })),
    updateTranscript: jest.fn(async (id) => ({ _id: id })),
    summarizeMeeting: jest.fn(async () => 'summary'),
    suggestTime: jest.fn(async () => ({})),
    addActionItem: jest.fn(async (id) => ({ _id: id })),
    updateActionItem: jest.fn(async (id) => ({ _id: id })),
}));
jest.mock('../../collaboration/whiteboard.model', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../../collaboration/brainstorm.model', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../../../modules/notifications/notificationService', () => ({ scheduleCreated: jest.fn(async () => []) }));

const workspacesRepo = require('../../../identity/workspaces.repo');
const ScheduledMeeting = require('../../../models/ScheduledMeeting');
const Whiteboard = require('../../collaboration/whiteboard.model');
const meetingsService = require('../meetings.service');

const WS = '64b000000000000000000001';
const MEETING = '64b000000000000000000m01'.replace('m', 'a');
const OWNER = '64b0000000000000000000a1';
const ADMIN = '64b0000000000000000000a2';
const MEMBER = '64b0000000000000000000b1';
const MEMBER2 = '64b0000000000000000000b2';
const OUTSIDER = '64b0000000000000000000c1';
const SUSPENDED = '64b0000000000000000000d1';

const workspace = {
    _id: WS,
    company: null,
    members: [
        { user: OWNER, role: 'owner', status: 'active' },
        { user: ADMIN, role: 'admin', status: 'active' },
        { user: MEMBER, role: 'member', status: 'active' },
        { user: MEMBER2, role: 'member', status: 'active' },
        { user: SUSPENDED, role: 'member', status: 'suspended' },
    ],
};

function chain(value) {
    const c = {
        select: () => c, populate: () => c, sort: () => c, limit: () => c,
        lean: () => Promise.resolve(value),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return c;
}

let server, base, meetingDoc;

beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.io = { to: () => ({ emit: () => {} }) }; next(); });
    app.use('/api/v2/meetings', require('../meetings.routes'));
    app.use('/api/scheduled-meetings', require('../../../shared/middleware/auth'), require('../scheduled-meetings.routes'));
    app.use('/api/v2/collaboration', require('../../collaboration/collaboration.routes'));
    server = http.createServer(app).listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}`;
        done();
    });
});
afterAll((done) => { server.close(done); });

beforeEach(() => {
    workspacesRepo.findById.mockImplementation(async (id) => (String(id) === WS ? workspace : null));
    meetingDoc = {
        _id: MEETING, workspaceId: WS, createdBy: MEMBER, status: 'scheduled',
        save: jest.fn(async () => {}), populate: jest.fn(async function () { return this; }),
    };
    ScheduledMeeting.findById.mockImplementation((id) => chain(id === MEETING ? meetingDoc : null));
    ScheduledMeeting.deleteOne.mockResolvedValue({ deletedCount: 1 });
    ScheduledMeeting.find.mockImplementation(() => chain([]));
    ScheduledMeeting.create.mockImplementation(async (doc) => ({ ...doc, _id: MEETING, populate: async function () { return this; } }));
});

async function call(method, path, user, body) {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-user': user },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
}

describe('/api/v2/meetings (H2)', () => {
    test('malformed id -> 400 { message }', async () => {
        const r = await call('GET', '/api/v2/meetings/not-an-id', MEMBER);
        expect(r.status).toBe(400);
        expect(r.body.message).toBeTruthy();
    });
    test('unknown meeting -> 404', async () => {
        const r = await call('GET', `/api/v2/meetings/${'6'.repeat(24)}`, MEMBER);
        expect(r.status).toBe(404);
    });
    test('non-member and suspended member -> 403 on every sub-route', async () => {
        for (const u of [OUTSIDER, SUSPENDED]) {
            expect((await call('GET', `/api/v2/meetings/${MEETING}`, u)).status).toBe(403);
            expect((await call('POST', `/api/v2/meetings/${MEETING}/join`, u)).status).toBe(403);
            expect((await call('PATCH', `/api/v2/meetings/${MEETING}/agenda`, u, { agenda: [] })).status).toBe(403);
            expect((await call('PATCH', `/api/v2/meetings/${MEETING}/transcript`, u, { transcript: 'x' })).status).toBe(403);
            expect((await call('POST', `/api/v2/meetings/${MEETING}/action-items`, u, { text: 'x' })).status).toBe(403);
        }
        expect(meetingsService.getMeeting).not.toHaveBeenCalled();
        expect(meetingsService.updateTranscript).not.toHaveBeenCalled();
    });
    test('member can read and join', async () => {
        expect((await call('GET', `/api/v2/meetings/${MEETING}`, MEMBER)).status).toBe(200);
        expect((await call('POST', `/api/v2/meetings/${MEETING}/join`, MEMBER)).status).toBe(200);
    });
    test('list requires membership; malformed workspaceId -> 400', async () => {
        expect((await call('GET', `/api/v2/meetings?workspaceId=${WS}`, OUTSIDER)).status).toBe(403);
        expect((await call('GET', '/api/v2/meetings?workspaceId=bad', MEMBER)).status).toBe(400);
        expect((await call('GET', `/api/v2/meetings?workspaceId=${WS}`, MEMBER)).status).toBe(200);
    });
    test('bad action item id -> 400', async () => {
        expect((await call('PATCH', `/api/v2/meetings/${MEETING}/action-items/zzz`, MEMBER, { text: 'a' })).status).toBe(400);
    });
});

describe('/api/scheduled-meetings (H1)', () => {
    test('create works without a company and filters participants to members', async () => {
        const r = await call('POST', '/api/scheduled-meetings', MEMBER, {
            workspaceId: WS, title: 'Plan', startTime: new Date(Date.now() + 3600e3).toISOString(),
            participants: [MEMBER2, OUTSIDER, 'junk'],
        });
        expect(r.status).toBe(201);
        const doc = ScheduledMeeting.create.mock.calls[0][0];
        expect(doc.companyId).toBeNull();
        expect(doc.participants).toEqual([MEMBER2]);
    });
    test('non-member cannot list or create', async () => {
        expect((await call('GET', `/api/scheduled-meetings?workspaceId=${WS}`, OUTSIDER)).status).toBe(403);
        expect((await call('POST', '/api/scheduled-meetings', OUTSIDER, { workspaceId: WS, title: 'x', startTime: new Date().toISOString() })).status).toBe(403);
    });
    test('delete: other member 403, organiser and admin ok', async () => {
        expect((await call('DELETE', `/api/scheduled-meetings/${MEETING}`, MEMBER2)).status).toBe(403);
        expect((await call('DELETE', `/api/scheduled-meetings/${MEETING}`, OUTSIDER)).status).toBe(403);
        expect(ScheduledMeeting.deleteOne).not.toHaveBeenCalled();
        expect((await call('DELETE', `/api/scheduled-meetings/${MEETING}`, ADMIN)).status).toBe(200);
        expect((await call('DELETE', `/api/scheduled-meetings/${MEETING}`, MEMBER)).status).toBe(200);
    });
    test('cancel: only organiser/admin; malformed id 400', async () => {
        expect((await call('PATCH', `/api/scheduled-meetings/${MEETING}`, MEMBER2, { status: 'cancelled' })).status).toBe(403);
        expect((await call('PATCH', `/api/scheduled-meetings/${MEETING}`, OWNER, { status: 'cancelled' })).status).toBe(200);
        expect(meetingDoc.status).toBe('cancelled');
        expect((await call('PATCH', '/api/scheduled-meetings/nope', OWNER, { status: 'cancelled' })).status).toBe(400);
    });
});

describe('/api/v2/collaboration (H3)', () => {
    test('non-member 403, malformed 400, member ok and workspaceId comes from the meeting', async () => {
        expect((await call('GET', `/api/v2/collaboration/whiteboard/${MEETING}`, OUTSIDER)).status).toBe(403);
        expect((await call('GET', '/api/v2/collaboration/brainstorm/bad', MEMBER)).status).toBe(400);
        expect((await call('POST', `/api/v2/collaboration/brainstorm/${MEETING}`, OUTSIDER, { text: 'x' })).status).toBe(403);

        Whiteboard.findOneAndUpdate.mockResolvedValue({ strokes: [] });
        const other = '64b00000000000000000ffff';
        const r = await call('POST', `/api/v2/collaboration/whiteboard/${MEETING}`, MEMBER, { workspaceId: other, strokes: [] });
        expect(r.status).toBe(200);
        expect(String(Whiteboard.findOneAndUpdate.mock.calls[0][1].workspaceId)).toBe(WS);
    });
});
