'use strict';

/**
 * Meeting clashes (features/meetings/conflicts.js) and the scheduling API around them:
 * half-open overlap, time zones, cancelled meetings, editing a meeting, two organisers
 * booking the same person at once, priorities in invites, clearing on cancel / move.
 * ScheduledMeeting is an in-memory collection that applies the real queries and updates.
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
jest.mock('../../../identity/users.repo', () => ({
    findManyByIds: jest.fn(async (ids) => new Map((ids || []).map((id) => [String(id), { _id: String(id), username: `user-${String(id).slice(-2)}`, preferences: { region: { timezone: 'UTC' } } }]))),
    findById: jest.fn(async () => null),
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: async (x) => x }));
jest.mock('../../../models/ScheduledMeeting', () => require('./memoryCollection').createCollection('ScheduledMeeting', { defaults: { status: 'scheduled', kind: 'scheduled', priority: 'normal', conflicts: [] } }));
jest.mock('../../../../models/DMSession', () => require('./memoryCollection').createCollection('DMSession'));
jest.mock('../../channels/channel.model', () => require('./memoryCollection').createCollection('Channel'));
jest.mock('../../../modules/notifications/notificationService', () => ({ scheduleCreated: jest.fn(async () => []) }));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../../modules/threads/threadAccess', () => ({ checkConversationAccess: jest.fn(async () => ({ ok: true })) }));

const workspacesRepo = require('../../../identity/workspaces.repo');
const Meeting = require('../../../models/ScheduledMeeting');
const DMSession = require('../../../../models/DMSession');
const notifications = require('../../../modules/notifications/notificationService');
const conflicts = require('../conflicts');

const WS = '64b000000000000000000001';
const OTHER_WS = '64b000000000000000000002';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';
const CAROL = '64b0000000000000000000b2';
const DAVE = '64b0000000000000000000b3';
const DM = '64b0000000000000000000d1';

const workspace = { _id: WS, company: null, members: [ALICE, BOB, CAROL, DAVE].map((user, i) => ({ user, role: i ? 'member' : 'owner', status: 'active' })) };

// A Monday morning, in the future relative to `now` below and real time alike.
const DAY = '2030-01-07';
const at = (hhmm) => new Date(`${DAY}T${hhmm}:00.000Z`);
const NOW = new Date('2030-01-06T12:00:00.000Z');

const seed = (doc) => Meeting.insert({ workspaceId: WS, title: 'Meeting', duration: 30, participants: [], invitees: [], ...doc });

let emitted;
const io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };

beforeEach(() => {
    Meeting.reset();
    DMSession.reset();
    emitted = [];
    jest.clearAllMocks();
    workspacesRepo.findById.mockImplementation(async (id) => (String(id) === WS ? workspace : null));
});

describe('overlap', () => {
    it('treats intervals as [start, end): touching edges do not clash', () => {
        const nine = { start: at('09:00').getTime(), end: at('09:30').getTime() };
        expect(conflicts.intervalsOverlap(nine, { start: at('09:30').getTime(), end: at('10:00').getTime() })).toBe(false);
        expect(conflicts.intervalsOverlap(nine, { start: at('08:30').getTime(), end: at('09:00').getTime() })).toBe(false);
        expect(conflicts.intervalsOverlap(nine, { start: at('09:29').getTime(), end: at('10:00').getTime() })).toBe(true);
        expect(conflicts.intervalsOverlap(nine, { start: at('08:00').getTime(), end: at('11:00').getTime() })).toBe(true);
    });

    it('compares instants, whatever time zone the times were written in', async () => {
        // 09:00 in India is 03:30 UTC.
        seed({ title: 'Standup', createdBy: BOB, startTime: new Date(`${DAY}T09:00:00+05:30`), duration: 30 });
        const clash = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: `${DAY}T03:45:00Z`, durationMinutes: 30, attendeeIds: [BOB], suggest: 0, now: NOW });
        expect(clash.hasConflicts).toBe(true);
        expect(clash.attendees.find((a) => a.userId === BOB).conflicts[0]).toMatchObject({ title: 'Standup', start: `${DAY}T03:30:00.000Z`, end: `${DAY}T04:00:00.000Z` });
        // Same wall-clock 09:00, but in New York (14:00 UTC): free.
        const free = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: `${DAY}T09:00:00-05:00`, durationMinutes: 30, attendeeIds: [BOB], suggest: 0, now: NOW });
        expect(free.hasConflicts).toBe(false);
    });

    it('ignores cancelled and completed meetings', async () => {
        seed({ title: 'Called off', createdBy: BOB, startTime: at('09:00'), status: 'cancelled' });
        seed({ title: 'Done', createdBy: BOB, startTime: at('09:00'), status: 'completed' });
        const res = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: at('09:00'), attendeeIds: [BOB], suggest: 0, now: NOW });
        expect(res.hasConflicts).toBe(false);
    });

    it('leaves the meeting being edited out of its own check', async () => {
        const mine = seed({ title: 'Mine', createdBy: ALICE, participants: [BOB], invitees: [BOB], startTime: at('09:00') });
        const without = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: at('09:15'), attendeeIds: [BOB], excludeMeetingId: mine._id, suggest: 0, now: NOW });
        expect(without.hasConflicts).toBe(false);
        const withIt = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: at('09:15'), attendeeIds: [BOB], suggest: 0, now: NOW });
        expect(withIt.conflictCount).toBe(2); // Alice and Bob are both in it
    });

    it('shows a meeting the requester cannot see as "Busy", with its priority', async () => {
        seed({ workspaceId: OTHER_WS, title: 'Secret board meeting', createdBy: BOB, startTime: at('09:00'), priority: 'urgent' });
        const res = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: at('09:00'), attendeeIds: [BOB], suggest: 0, now: NOW });
        expect(res.attendees.find((a) => a.userId === BOB).conflicts[0]).toMatchObject({ title: null, busy: true, priority: 'urgent' });
        expect(JSON.stringify(res)).not.toContain('Secret');
    });

    it('suggests free slots for everyone when something clashes', async () => {
        seed({ title: 'Design review', createdBy: BOB, startTime: at('09:00'), priority: 'high' });
        const res = await conflicts.checkConflicts({ requesterId: ALICE, workspaceId: WS, start: at('09:00'), attendeeIds: [BOB], suggest: 3, now: NOW });
        expect(res.attendees.find((a) => a.userId === BOB).conflicts[0]).toMatchObject({ title: 'Design review', priority: 'high' });
        expect(res.suggestions).toHaveLength(3);
        for (const s of res.suggestions) {
            expect(conflicts.intervalsOverlap({ start: Date.parse(s.start), end: Date.parse(s.end) }, { start: at('09:00').getTime(), end: at('09:30').getTime() })).toBe(false);
            expect(s.allAvailable).toBe(true);
        }
        expect(res.suggestions[0].start).toBe(`${DAY}T09:30:00.000Z`);
    });
});

describe('recordClashes (save-time re-check)', () => {
    it('flags both meetings when two organisers book Bob at the same moment', async () => {
        // Both inserts land before either check runs: the worst interleaving.
        const a = seed({ title: 'From Alice', createdBy: ALICE, participants: [BOB], invitees: [BOB], startTime: at('09:00'), priority: 'high' });
        const c = seed({ title: 'From Carol', createdBy: CAROL, participants: [BOB], invitees: [BOB], startTime: at('09:15') });
        await Promise.all([conflicts.recordClashes(a, { io, now: NOW.getTime() }), conflicts.recordClashes(c, { io, now: NOW.getTime() })]);

        const [savedA, savedC] = [Meeting.docs.find((d) => d._id === a._id), Meeting.docs.find((d) => d._id === c._id)];
        expect(savedA.conflicts).toHaveLength(1); // marked once, not twice
        expect(savedC.conflicts).toHaveLength(1);
        expect(savedA.conflicts[0]).toMatchObject({ meetingId: c._id, userIds: [BOB], title: 'From Carol', priority: 'normal' });
        expect(savedC.conflicts[0]).toMatchObject({ meetingId: a._id, userIds: [BOB], title: 'From Alice', priority: 'high' });
        expect(emitted.filter((e) => e.room === `user:${BOB}` && e.event === 'schedule:conflict').length).toBeGreaterThan(0);
        expect(emitted.some((e) => e.room === `workspace:${WS}` && e.event === 'schedule:conflicts')).toBe(true);
    });

    it('flags both when the second booking only checks after the first finished', async () => {
        const a = seed({ title: 'First', createdBy: ALICE, participants: [BOB], invitees: [BOB], startTime: at('09:00') });
        expect(await conflicts.recordClashes(a, { now: NOW.getTime() })).toEqual([]);
        const c = seed({ title: 'Second', createdBy: CAROL, participants: [BOB], invitees: [BOB], startTime: at('09:00') });
        const found = await conflicts.recordClashes(c, { now: NOW.getTime() });
        expect(found).toHaveLength(1);
        expect(Meeting.docs.find((d) => d._id === a._id).conflicts.map((x) => x.meetingId)).toEqual([c._id]);
    });

    it('clearClashes removes a cancelled meeting from everyone else', async () => {
        const a = seed({ title: 'A', createdBy: ALICE, participants: [BOB], startTime: at('09:00') });
        const c = seed({ title: 'C', createdBy: CAROL, participants: [BOB], startTime: at('09:00') });
        await conflicts.recordClashes(c, { now: NOW.getTime() });
        await conflicts.clearClashes(Meeting.docs.find((d) => d._id === c._id), { io });
        expect(Meeting.docs.find((d) => d._id === a._id).conflicts).toEqual([]);
        expect(Meeting.docs.find((d) => d._id === c._id).conflicts).toEqual([]);
        expect(emitted.find((e) => e.event === 'schedule:conflicts').payload).toMatchObject({ resolved: true });
    });

    it('conflictsForViewer shows titles only for the viewer\'s own clashes', () => {
        const list = [{ meetingId: 'x', userIds: [BOB], title: 'Private 1:1', priority: 'high', start: at('09:00'), end: at('09:30') }];
        expect(conflicts.conflictsForViewer(list, BOB)[0]).toMatchObject({ mine: true, title: 'Private 1:1', priority: 'high' });
        expect(conflicts.conflictsForViewer(list, ALICE)[0]).toMatchObject({ mine: false, busy: true, title: null, userIds: [BOB] });
    });
});

describe('scheduling API', () => {
    let server;
    let base;
    beforeAll((done) => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => { req.io = io; next(); });
        app.use('/api/scheduled-meetings', require('../../../shared/middleware/auth'), require('../scheduled-meetings.routes'));
        app.use('/api/v2/meetings', require('../meetings.routes'));
        server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
    });
    afterAll((done) => { server.close(done); });

    const call = async (method, path, user, body) => {
        const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, body: await res.json() };
    };

    it('POST /api/v2/meetings/conflicts names who is busy and suggests free times', async () => {
        seed({ title: 'Design review', createdBy: BOB, startTime: at('09:00'), priority: 'high' });
        const res = await call('POST', '/api/v2/meetings/conflicts', ALICE, { workspaceId: WS, startTime: at('09:00').toISOString(), duration: 30, participants: [BOB, CAROL] });
        expect(res.status).toBe(200);
        expect(res.body.hasConflicts).toBe(true);
        const bob = res.body.attendees.find((a) => a.userId === BOB);
        expect(bob).toMatchObject({ name: 'user-b1', conflicts: [{ title: 'Design review', priority: 'high', start: at('09:00').toISOString() }] });
        expect(res.body.attendees.find((a) => a.userId === ALICE)).toMatchObject({ isOrganizer: true, conflicts: [] });
        expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it('rejects a bad start time and outsiders', async () => {
        expect((await call('POST', '/api/scheduled-meetings/conflicts', ALICE, { workspaceId: WS, startTime: 'soon' })).status).toBe(400);
        expect((await call('POST', '/api/scheduled-meetings/conflicts', '64b0000000000000000000f9', { workspaceId: WS, startTime: at('09:00').toISOString() })).status).toBe(403);
    });

    it('a DM meeting holds the DM people\'s time even when nobody was picked', async () => {
        DMSession.insert({ _id: DM, participants: [ALICE, BOB], workspace: WS });
        seed({ title: 'Busy Bob', createdBy: BOB, startTime: at('09:00') });
        const res = await call('POST', '/api/scheduled-meetings/conflicts', ALICE, { workspaceId: WS, dmSessionId: DM, startTime: at('09:00').toISOString() });
        expect(res.body.attendees.map((a) => a.userId).sort()).toEqual([ALICE, BOB].sort());
        expect(res.body.hasConflicts).toBe(true);
    });

    it('books despite a clash, answers with it, marks both and tells the invitee with both priorities', async () => {
        const other = seed({ title: 'Design review', createdBy: CAROL, participants: [BOB], invitees: [BOB], startTime: at('09:00'), priority: 'high' });
        const res = await call('POST', '/api/scheduled-meetings', ALICE, {
            workspaceId: WS, title: 'Planning', startTime: at('09:00').toISOString(), duration: 30, participants: [BOB, DAVE], priority: 'urgent',
        });
        expect(res.status).toBe(201);
        expect(res.body.meeting.priority).toBe('urgent');
        // Alice is not in Design review: she sees Bob is busy, not the title.
        expect(res.body.conflicts).toEqual([expect.objectContaining({ meetingId: other._id, userIds: [BOB], busy: true, title: null, priority: 'high' })]);
        expect(Meeting.docs.find((d) => d._id === other._id).conflicts[0]).toMatchObject({ title: 'Planning', priority: 'urgent', userIds: [BOB] });

        const calls = notifications.scheduleCreated.mock.calls.map((c) => c[1]);
        expect(calls.find((c) => c.recipientIds.includes(DAVE))).toMatchObject({ priority: 'urgent', recipientIds: [DAVE] });
        expect(calls.find((c) => c.recipientIds.includes(DAVE)).conflicts).toBeUndefined();
        expect(calls.find((c) => c.recipientIds.includes(BOB))).toMatchObject({
            recipientIds: [BOB], priority: 'urgent', conflicts: [expect.objectContaining({ title: 'Design review', priority: 'high' })],
        });

        // Bob sees both titles in his list.
        const list = await call('GET', `/api/scheduled-meetings?workspaceId=${WS}&limit=10`, BOB);
        const planning = list.body.meetings.find((m) => m.title === 'Planning');
        expect(planning.conflicts[0]).toMatchObject({ mine: true, title: 'Design review' });
    });

    it('refuses an unknown priority', async () => {
        const res = await call('POST', '/api/scheduled-meetings', ALICE, { workspaceId: WS, title: 'X', startTime: at('09:00').toISOString(), priority: 'critical' });
        expect(res.status).toBe(400);
    });

    it('moving a meeting re-checks, and cancelling clears the clash markers', async () => {
        const other = seed({ title: 'Design review', createdBy: CAROL, participants: [BOB], invitees: [BOB], startTime: at('10:00') });
        const created = await call('POST', '/api/scheduled-meetings', ALICE, { workspaceId: WS, title: 'Planning', startTime: at('09:00').toISOString(), participants: [BOB] });
        const id = created.body.meeting._id;
        expect(created.body.conflicts).toEqual([]);

        const moved = await call('PATCH', `/api/scheduled-meetings/${id}`, ALICE, { startTime: at('10:00').toISOString() });
        expect(moved.status).toBe(200);
        expect(moved.body.conflicts).toHaveLength(1);
        expect(Meeting.docs.find((d) => d._id === other._id).conflicts).toHaveLength(1);
        expect(notifications.scheduleCreated.mock.calls.at(-1)[1]).toMatchObject({ moved: true, recipientIds: [BOB] });

        // Only the organiser (or an admin) may move it.
        expect((await call('PATCH', `/api/scheduled-meetings/${id}`, BOB, { startTime: at('11:00').toISOString() })).status).toBe(403);

        const cancelled = await call('PATCH', `/api/scheduled-meetings/${id}`, ALICE, { status: 'cancelled' });
        expect(cancelled.status).toBe(200);
        expect(cancelled.body.conflicts).toEqual([]);
        expect(Meeting.docs.find((d) => d._id === other._id).conflicts).toEqual([]);
        expect(emitted.some((e) => e.event === 'schedule:conflicts' && e.payload.resolved)).toBe(true);
    });

    it('two creates at the same moment both come back flagged', async () => {
        const [one, two] = await Promise.all([
            call('POST', '/api/scheduled-meetings', ALICE, { workspaceId: WS, title: 'One', startTime: at('09:00').toISOString(), participants: [BOB] }),
            call('POST', '/api/scheduled-meetings', CAROL, { workspaceId: WS, title: 'Two', startTime: at('09:00').toISOString(), participants: [BOB] }),
        ]);
        expect(one.status).toBe(201);
        expect(two.status).toBe(201);
        const saved = Meeting.docs.filter((d) => ['One', 'Two'].includes(d.title));
        expect(saved.every((d) => d.conflicts.length === 1)).toBe(true);
        // Whichever checked second got the clash in its response.
        expect(one.body.conflicts.length + two.body.conflicts.length).toBeGreaterThanOrEqual(1);
    });
});
